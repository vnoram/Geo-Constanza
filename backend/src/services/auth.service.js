const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
// Cliente global a propósito: login, renovar sesión y el segundo factor ocurren ANTES de conocer la
// empresa (por eso el RUT es único en toda la plataforma). Después de autenticar, todo usa el contexto.
const { prismaGlobal } = require('../config/database');
const { ESTADO_EMPRESA, ESTADO_USUARIO } = require('../constants/estados');
const { jwtConfig } = require('../config/jwt');
const { getRedis } = require('../config/redis');
const twoFactor = require('./twoFactor.service');
const passwordReset = require('./passwordReset.service');

const MAX_LOGIN_ATTEMPTS = 5;
const LOCKOUT_MINUTES = 15;

// El RUT puede estar guardado con o sin puntos (12.345.678-5 / 12345678-5); el login acepta ambos.
const variantesRut = (rut) => {
  const limpio = String(rut).replace(/[.\s]/g, '').toUpperCase();
  const [cuerpo, dv] = limpio.split('-');
  const variantes = new Set([rut, limpio]);
  if (cuerpo && dv) variantes.add(`${cuerpo.replace(/\B(?=(\d{3})+(?!\d))/g, '.')}-${dv}`);
  return [...variantes];
};

const login = async (rut, password, _ip, _userAgent) => {
  const usuario = await prismaGlobal.usuario.findFirst({
    where: { rut: { in: variantesRut(rut) } },
    include: {
      instalacion_asignada: { select: { id: true, nombre: true } },
      empresa: { select: { id: true, nombre: true, estado: true } },
    },
  });
  if (!usuario || usuario.estado !== ESTADO_USUARIO.ACTIVO) {
    throw Object.assign(new Error('Credenciales inválidas'), { statusCode: 401 });
  }

  // Verificar bloqueo por intentos fallidos
  const redis = getRedis();
  try {
    if (redis) {
      const attempts = await redis.get(`login_attempts:${usuario.id}`);
      if (attempts && parseInt(attempts) >= MAX_LOGIN_ATTEMPTS) {
        throw Object.assign(new Error(`Cuenta bloqueada temporalmente. Intenta en ${LOCKOUT_MINUTES} minutos.`), { statusCode: 429 });
      }
    }
  } catch (err) {
    if (err.statusCode) throw err; // re-lanzar errores de negocio
    // error de Redis: continuar sin rate limiting
  }

  const validPassword = await bcrypt.compare(password, usuario.password_hash);
  if (!validPassword) {
    try {
      if (redis) {
        await redis.incr(`login_attempts:${usuario.id}`);
        await redis.expire(`login_attempts:${usuario.id}`, LOCKOUT_MINUTES * 60);
      }
    } catch (_) { /* Redis caído — continuar sin rate limiting */ }
    throw Object.assign(new Error('Credenciales inválidas'), { statusCode: 401 });
  }

  // Reset intentos fallidos
  try { if (redis) await redis.del(`login_attempts:${usuario.id}`); } catch (_) { /* ignorar */ }

  // Una empresa suspendida no puede iniciar sesión (se avisa recién con la contraseña correcta,
  // para no revelar a un tercero el estado de una cuenta).
  exigirEmpresaActiva(usuario);

  // Segundo factor (TOTP) para supervisor y administrador.
  // - Enrolado: se exige el código antes de emitir sesión (devuelve tempToken).
  // - Sin enrolar: el acceso continúa y se avisa para que complete el enrolamiento (nadie queda fuera).
  if (twoFactor.dosFactoresExigido() && twoFactor.rolExige2FA(usuario.rol)) {
    if (usuario.two_factor_enabled) {
      return { requires2FA: true, tempToken: twoFactor.emitirTempToken(usuario.id) };
    }
    const tokensSinFactor = generateTokens(usuario);
    return { usuario: sanitizeUser(usuario), ...tokensSinFactor, mustEnroll2FA: true };
  }

  const tokens = generateTokens(usuario);
  return { usuario: sanitizeUser(usuario), ...tokens };
};

const verify2FA = async (tempToken, code) => {
  const usuario = await twoFactor.verificarLogin(tempToken, code);
  exigirEmpresaActiva(usuario);
  const tokens = generateTokens(usuario);
  return { usuario: sanitizeUser(usuario), ...tokens };
};

const refreshToken = async (token) => {
  let decoded;
  try {
    decoded = jwt.verify(token, jwtConfig.refreshSecret);
  } catch (_) {
    // Refresh token mal formado, vencido o firmado con otra clave: es un 401, no un fallo del servidor.
    throw Object.assign(new Error('Token inválido'), { statusCode: 401 });
  }
  const usuario = await prismaGlobal.usuario.findUnique({
    where: { id: decoded.id },
    include: { empresa: { select: { id: true, nombre: true, estado: true } } },
  });
  if (!usuario || usuario.estado !== ESTADO_USUARIO.ACTIVO) {
    throw Object.assign(new Error('Token inválido'), { statusCode: 401 });
  }
  exigirEmpresaActiva(usuario);
  // Sesión revocada por cambio de contraseña: el refresh token es anterior al cambio.
  if (usuario.password_cambiada_en && decoded.iat * 1000 < usuario.password_cambiada_en.getTime()) {
    throw Object.assign(new Error('Token inválido'), { statusCode: 401 });
  }
  return generateTokens(usuario);
};

const logout = async (token, _userId) => {
  try {
    const redis = getRedis();
    if (redis) {
      const decoded = jwt.decode(token);
      const ttl = decoded.exp - Math.floor(Date.now() / 1000);
      if (ttl > 0) await redis.set(`bl:${token}`, '1', 'EX', ttl);
    }
  } catch (_) { /* Redis caído — logout continúa sin blacklist */ }
};

const requestPasswordReset = (email, ip) => passwordReset.solicitar(email, ip);
const confirmPasswordReset = (token, password) => passwordReset.confirmar(token, password);

// Lanza 403 si la empresa del usuario está suspendida. El super admin (sin empresa) no se ve afectado.
const exigirEmpresaActiva = (usuario) => {
  if (usuario.empresa_id && usuario.empresa?.estado !== ESTADO_EMPRESA.ACTIVA) {
    throw Object.assign(
      new Error('La empresa se encuentra suspendida. Contacta al administrador de la plataforma.'),
      { statusCode: 403, code: 'EMPRESA_SUSPENDIDA' },
    );
  }
};

const generateTokens = (usuario) => {
  const payload = {
    id: usuario.id,
    email: usuario.email,
    rol: usuario.rol,
    tipo_ggss: usuario.tipo_ggss || null,
    // La empresa SIEMPRE sale de aquí (del token firmado por el servidor), nunca de lo que envíe el cliente.
    // Es null solo para el super admin (nivel de plataforma).
    empresaId: usuario.empresa_id ?? null,
  };
  const accessToken = jwt.sign(payload, jwtConfig.accessSecret, { expiresIn: jwtConfig.expiresIn[usuario.rol] });
  const refreshToken = jwt.sign({ id: usuario.id, empresaId: usuario.empresa_id ?? null }, jwtConfig.refreshSecret, { expiresIn: jwtConfig.refreshExpiresIn });
  return { accessToken, refreshToken };
};

const sanitizeUser = (usuario) => ({
  id: usuario.id,
  nombre: usuario.nombre,
  email: usuario.email,
  rol: usuario.rol,
  tipo_ggss: usuario.tipo_ggss || null,
  instalacion_asignada: usuario.instalacion_asignada || null,
  empresa: usuario.empresa ? { id: usuario.empresa.id, nombre: usuario.empresa.nombre } : null,
});

const changePassword = (usuarioId, actual, nueva) => passwordReset.cambiar(usuarioId, actual, nueva);

module.exports = { changePassword, login, verify2FA, refreshToken, logout, requestPasswordReset, confirmPasswordReset };
