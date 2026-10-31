// Restablecimiento de contraseña (AB#41): token aleatorio de un solo uso, 30 min, solo se guarda su hash.
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const { prisma } = require('../config/database');
const { getRedis } = require('../config/redis');
const { logger } = require('../config/logger');
const { hashSha256 } = require('../utils/cifrado');
const { enviarCorreo } = require('./correo.service');

const TOKEN_VIGENCIA_MIN = 30;
const PASSWORD_MIN = 10;
const PASSWORD_MAX = 128;
const LIMITE_POR_EMAIL = 3;   // solicitudes por hora
const LIMITE_POR_IP = 10;     // solicitudes por hora
const VENTANA_SEG = 3600;
const REVOCACION_SEG = 24 * 3600; // mayor que la vida de cualquier access token

const MENSAJE_GENERICO = 'Si el correo está registrado, recibirás un enlace para restablecer tu contraseña.';

const error = (statusCode, message) => Object.assign(new Error(message), { statusCode });

// Contador por ventana: Redis si está disponible; si no, memoria del proceso (degradación segura).
const contadoresMemoria = new Map();
const superaLimite = async (clave, limite) => {
  try {
    const redis = getRedis();
    if (redis) {
      const n = await redis.incr(clave);
      if (n === 1) await redis.expire(clave, VENTANA_SEG);
      return n > limite;
    }
  } catch (_) { /* Redis caído: usar memoria */ }
  const ahora = Date.now();
  const previo = contadoresMemoria.get(clave);
  const entrada = previo && previo.vence > ahora ? previo : { n: 0, vence: ahora + VENTANA_SEG * 1000 };
  entrada.n += 1;
  contadoresMemoria.set(clave, entrada);
  return entrada.n > limite;
};

const validarPassword = (password) => {
  if (typeof password !== 'string' || password.length < PASSWORD_MIN) {
    throw error(400, `La contraseña debe tener al menos ${PASSWORD_MIN} caracteres`);
  }
  if (password.length > PASSWORD_MAX) throw error(400, `La contraseña no puede superar ${PASSWORD_MAX} caracteres`);
};

// Siempre resuelve igual exista o no el correo (no revela qué cuentas existen).
// Lanza 429 solo cuando la IP excede su cuota, que no filtra información de cuentas.
const solicitar = async (email, ip) => {
  if (await superaLimite(`rl:reset:ip:${ip || 'desconocida'}`, LIMITE_POR_IP)) {
    throw error(429, 'Demasiadas solicitudes. Intenta nuevamente más tarde.');
  }
  const correo = typeof email === 'string' ? email.trim().toLowerCase() : '';
  if (!correo || correo.length > 254) return { mensaje: MENSAJE_GENERICO };
  if (await superaLimite(`rl:reset:email:${correo}`, LIMITE_POR_EMAIL)) return { mensaje: MENSAJE_GENERICO };

  const usuario = await prisma.usuario.findFirst({ where: { email: { equals: correo, mode: 'insensitive' } } });
  if (!usuario || usuario.estado !== 'activo') return { mensaje: MENSAJE_GENERICO };

  const token = crypto.randomBytes(32).toString('base64url');
  await prisma.passwordReset.create({
    data: {
      usuario_id: usuario.id,
      token_hash: hashSha256(token),
      expira_en: new Date(Date.now() + TOKEN_VIGENCIA_MIN * 60 * 1000),
    },
  });

  const base = (process.env.FRONTEND_URL || '').replace(/\/$/, '');
  const enlace = `${base}/restablecer?token=${token}`;
  const texto = `Hola ${usuario.nombre}. Para restablecer tu contraseña de Geo Constanza abre este enlace (vale ${TOKEN_VIGENCIA_MIN} minutos y solo se puede usar una vez): ${enlace}\nSi no lo solicitaste, ignora este mensaje.`;
  const html = `<p>Hola ${usuario.nombre},</p><p>Para restablecer tu contraseña de Geo Constanza usa este enlace. Vale ${TOKEN_VIGENCIA_MIN} minutos y solo se puede usar una vez:</p><p><a href="${enlace}">Restablecer contraseña</a></p><p>Si no lo solicitaste, ignora este mensaje.</p>`;
  const enviado = await enviarCorreo(usuario.email, 'Restablecer contraseña - Geo Constanza', html, texto);
  if (!enviado) logger.warn(`Reset de contraseña solicitado para ${usuario.id} pero el correo no pudo enviarse`);
  return { mensaje: MENSAJE_GENERICO, usuarioId: usuario.id };
};

const confirmar = async (token, password) => {
  validarPassword(password);
  if (typeof token !== 'string' || token.length < 20 || token.length > 200) throw error(400, 'Enlace inválido o vencido');

  const registro = await prisma.passwordReset.findUnique({ where: { token_hash: hashSha256(token) }, include: { usuario: true } });
  if (!registro || registro.usado_en || registro.expira_en <= new Date() || registro.usuario.estado !== 'activo') {
    throw error(400, 'Enlace inválido o vencido');
  }
  if (await bcrypt.compare(password, registro.usuario.password_hash)) {
    throw error(400, 'La nueva contraseña debe ser distinta a la actual');
  }

  const ahora = new Date();
  const hash = await bcrypt.hash(password, 12);
  await prisma.$transaction(async (tx) => {
    // Consumo atómico: si dos solicitudes llegan a la vez, solo una afecta una fila.
    const consumido = await tx.passwordReset.updateMany({ where: { id: registro.id, usado_en: null }, data: { usado_en: ahora } });
    if (consumido.count !== 1) throw error(400, 'Enlace inválido o vencido');
    await tx.usuario.update({ where: { id: registro.usuario_id }, data: { password_hash: hash, password_cambiada_en: ahora } });
    await tx.passwordReset.updateMany({ where: { usuario_id: registro.usuario_id, usado_en: null }, data: { usado_en: ahora } });
  });

  // Revoca sesiones abiertas: access tokens por Redis (si está) y refresh tokens por password_cambiada_en.
  try {
    const redis = getRedis();
    if (redis) {
      await redis.set(`pwd_changed:${registro.usuario_id}`, String(Math.floor(ahora.getTime() / 1000)), 'EX', REVOCACION_SEG);
      await redis.del(`login_attempts:${registro.usuario_id}`);
    }
  } catch (_) { /* Redis caído: los refresh tokens igual quedan revocados por BD */ }

  return { usuarioId: registro.usuario_id };
};

module.exports = { solicitar, confirmar, MENSAJE_GENERICO, TOKEN_VIGENCIA_MIN };
