// 2FA TOTP (RFC 6238) para roles con acceso privilegiado.
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const { authenticator } = require('otplib');
const { prisma } = require('../config/database');
const { jwtConfig } = require('../config/jwt');
const { getRedis } = require('../config/redis');
const { ROLES } = require('../constants/roles');
const { cifrar, descifrar, hashSha256 } = require('../utils/cifrado');

const ROLES_CON_2FA = [ROLES.SUPERVISOR, ROLES.ADMINISTRADOR];
const MAX_INTENTOS = 5;
const BLOQUEO_MINUTOS = 15;
const TEMP_TOKEN_EXPIRA = '5m';
const CANTIDAD_CODIGOS_RECUPERACION = 8;
const TIPO_TEMP = '2fa_pending';

authenticator.options = { window: 1, step: 30, digits: 6 };

// REQUIRE_2FA="true"/"false". Por defecto: activo solo en producción.
const dosFactoresExigido = () => {
  const valor = (process.env.REQUIRE_2FA || '').trim().toLowerCase();
  if (valor === 'true') return true;
  if (valor === 'false') return false;
  return process.env.NODE_ENV === 'production';
};

const rolExige2FA = (rol) => ROLES_CON_2FA.includes(rol);

// El tempToken se firma con una clave DISTINTA a la de acceso: authenticate() no puede aceptarlo como sesión.
const claveTemporal = () => `${jwtConfig.accessSecret}:2fa-pending`;
const emitirTempToken = (usuarioId) =>
  jwt.sign({ id: usuarioId, tipo: TIPO_TEMP }, claveTemporal(), { expiresIn: TEMP_TOKEN_EXPIRA });

// ── Intentos fallidos (Redis; si no hay Redis, memoria del proceso) ──────────
const memoria = new Map();
const claveIntentos = (usuarioId) => `2fa_attempts:${usuarioId}`;

const intentosActuales = async (usuarioId) => {
  const redis = getRedis();
  try {
    if (redis) return parseInt(await redis.get(claveIntentos(usuarioId)), 10) || 0;
  } catch (_) { /* Redis caído: usar memoria */ }
  const registro = memoria.get(usuarioId);
  return registro && registro.expira > Date.now() ? registro.cuenta : 0;
};

const sumarIntento = async (usuarioId) => {
  const redis = getRedis();
  try {
    if (redis) {
      await redis.incr(claveIntentos(usuarioId));
      await redis.expire(claveIntentos(usuarioId), BLOQUEO_MINUTOS * 60);
      return;
    }
  } catch (_) { /* Redis caído: usar memoria */ }
  const registro = memoria.get(usuarioId);
  const vigente = registro && registro.expira > Date.now();
  memoria.set(usuarioId, { cuenta: (vigente ? registro.cuenta : 0) + 1, expira: Date.now() + BLOQUEO_MINUTOS * 60000 });
};

const limpiarIntentos = async (usuarioId) => {
  memoria.delete(usuarioId);
  try { const redis = getRedis(); if (redis) await redis.del(claveIntentos(usuarioId)); } catch (_) { /* ignorar */ }
};

const error = (mensaje, statusCode) => Object.assign(new Error(mensaje), { statusCode });

// ── Códigos de recuperación ───────────────────────────────────────────────────
const normalizarCodigo = (codigo) => String(codigo || '').trim().toUpperCase().replace(/[\s-]/g, '');
const generarCodigosRecuperacion = () => Array.from({ length: CANTIDAD_CODIGOS_RECUPERACION }, () => {
  const bruto = crypto.randomBytes(5).toString('hex').toUpperCase(); // 10 caracteres
  return `${bruto.slice(0, 5)}-${bruto.slice(5)}`;
});

// ── Enrolamiento ──────────────────────────────────────────────────────────────
const iniciarEnrolamiento = async (usuarioId) => {
  const usuario = await prisma.usuario.findUnique({ where: { id: usuarioId } });
  if (!usuario || usuario.estado !== 'activo') throw error('Usuario no disponible', 404);
  if (!rolExige2FA(usuario.rol)) throw error('Tu rol no utiliza segundo factor.', 403);
  if (usuario.two_factor_enabled) throw error('El segundo factor ya está activo. Pide a un administrador que lo reinicie.', 409);

  const secreto = authenticator.generateSecret();
  await prisma.usuario.update({ where: { id: usuarioId }, data: { two_factor_secret: cifrar(secreto) } });

  const emisor = process.env.TWO_FACTOR_ISSUER || 'Geo Constanza';
  return { otpauth_url: authenticator.keyuri(usuario.email, emisor, secreto), secreto };
};

const confirmarEnrolamiento = async (usuarioId, codigo) => {
  const usuario = await prisma.usuario.findUnique({ where: { id: usuarioId } });
  if (!usuario || usuario.estado !== 'activo') throw error('Usuario no disponible', 404);
  if (usuario.two_factor_enabled) throw error('El segundo factor ya está activo.', 409);
  if (!usuario.two_factor_secret) throw error('Primero inicia el enrolamiento.', 400);
  if ((await intentosActuales(usuarioId)) >= MAX_INTENTOS) {
    throw error(`Demasiados intentos. Intenta en ${BLOQUEO_MINUTOS} minutos.`, 429);
  }

  const delta = authenticator.checkDelta(String(codigo || '').trim(), descifrar(usuario.two_factor_secret));
  if (delta === null) {
    await sumarIntento(usuarioId);
    throw error('Código inválido.', 400);
  }

  const codigos = generarCodigosRecuperacion();
  await prisma.usuario.update({
    where: { id: usuarioId },
    data: {
      two_factor_enabled: true,
      two_factor_recovery: codigos.map((c) => hashSha256(normalizarCodigo(c))),
      two_factor_ultimo_paso: Math.floor(Date.now() / 30000) + delta,
    },
  });
  await limpiarIntentos(usuarioId);
  return { codigos_recuperacion: codigos };
};

// ── Verificación durante el login ─────────────────────────────────────────────
const verificarLogin = async (tempToken, codigo) => {
  let payload;
  try {
    payload = jwt.verify(String(tempToken || ''), claveTemporal());
  } catch (_) {
    throw error('Sesión de verificación expirada. Inicia sesión nuevamente.', 401);
  }
  if (payload.tipo !== TIPO_TEMP) throw error('Sesión de verificación inválida.', 401);

  const usuario = await prisma.usuario.findUnique({
    where: { id: payload.id },
    include: { instalacion_asignada: { select: { id: true, nombre: true } } },
  });
  if (!usuario || usuario.estado !== 'activo' || !usuario.two_factor_enabled || !usuario.two_factor_secret) {
    throw error('Sesión de verificación inválida.', 401);
  }
  if ((await intentosActuales(usuario.id)) >= MAX_INTENTOS) {
    throw error(`Cuenta bloqueada temporalmente. Intenta en ${BLOQUEO_MINUTOS} minutos.`, 429);
  }

  const ingresado = String(codigo || '').trim();
  const esTotp = /^\d{6}$/.test(ingresado);
  let valido = false;

  if (esTotp) {
    const delta = authenticator.checkDelta(ingresado, descifrar(usuario.two_factor_secret));
    if (delta !== null) {
      const paso = Math.floor(Date.now() / 30000) + delta;
      // Anti-reutilización: cada paso de 30 s solo sirve una vez.
      const { count } = await prisma.usuario.updateMany({
        where: { id: usuario.id, OR: [{ two_factor_ultimo_paso: null }, { two_factor_ultimo_paso: { lt: paso } }] },
        data: { two_factor_ultimo_paso: paso },
      });
      valido = count === 1;
    }
  } else {
    const hash = hashSha256(normalizarCodigo(ingresado));
    const guardados = Array.isArray(usuario.two_factor_recovery) ? usuario.two_factor_recovery : [];
    if (guardados.includes(hash)) {
      // Un solo uso: se consume de forma condicional para evitar carreras.
      const { count } = await prisma.usuario.updateMany({
        where: { id: usuario.id, two_factor_recovery: { equals: guardados } },
        data: { two_factor_recovery: guardados.filter((h) => h !== hash) },
      });
      valido = count === 1;
    }
  }

  if (!valido) {
    await sumarIntento(usuario.id);
    throw error('Código inválido.', 401);
  }
  await limpiarIntentos(usuario.id);
  return usuario;
};

// ── Desactivación por un administrador / script de emergencia ────────────────
const reiniciar = async (usuarioId) => {
  const usuario = await prisma.usuario.findUnique({ where: { id: usuarioId } });
  if (!usuario) throw error('Usuario no encontrado', 404);
  await prisma.usuario.update({
    where: { id: usuarioId },
    data: { two_factor_enabled: false, two_factor_secret: null, two_factor_recovery: null, two_factor_ultimo_paso: null },
  });
  await limpiarIntentos(usuarioId);
  return { id: usuarioId, two_factor_enabled: false };
};

module.exports = {
  ROLES_CON_2FA, rolExige2FA, dosFactoresExigido, emitirTempToken, iniciarEnrolamiento, confirmarEnrolamiento,
  verificarLogin, reiniciar, generarCodigosRecuperacion, normalizarCodigo,
};
