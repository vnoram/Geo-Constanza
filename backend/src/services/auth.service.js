const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { prisma } = require('../config/database');
const { jwtConfig } = require('../config/jwt');
const { getRedis } = require('../config/redis');

const BCRYPT_ROUNDS = 12;
const MAX_LOGIN_ATTEMPTS = 5;
const LOCKOUT_MINUTES = 15;

const login = async (rut, password, ip, userAgent) => {
  const usuario = await prisma.usuario.findUnique({
    where: { rut },
    include: { instalacion_asignada: { select: { id: true, nombre: true } } },
  });
  if (!usuario || usuario.estado !== 'activo') {
    throw Object.assign(new Error('Credenciales inválidas'), { statusCode: 401 });
  }

  // Verificar bloqueo por intentos fallidos
  const redis = getRedis();
  if (redis) {
    const attempts = await redis.get(`login_attempts:${usuario.id}`);
    if (attempts && parseInt(attempts) >= MAX_LOGIN_ATTEMPTS) {
      throw Object.assign(new Error(`Cuenta bloqueada temporalmente. Intenta en ${LOCKOUT_MINUTES} minutos.`), { statusCode: 429 });
    }
  }

  const validPassword = await bcrypt.compare(password, usuario.password_hash);
  if (!validPassword) {
    if (redis) {
      await redis.incr(`login_attempts:${usuario.id}`);
      await redis.expire(`login_attempts:${usuario.id}`, LOCKOUT_MINUTES * 60);
    }
    throw Object.assign(new Error('Credenciales inválidas'), { statusCode: 401 });
  }

  // Reset intentos fallidos
  if (redis) await redis.del(`login_attempts:${usuario.id}`);

  // 2FA — Fase 2: se activará cuando two_factor_secret esté configurado Y el backend lo verifique vía TOTP.
  // Por ahora se omite para que admin/supervisor puedan iniciar sesión en desarrollo.
  // if (['supervisor', 'admin'].includes(usuario.rol) && usuario.two_factor_secret) {
  //   const tempToken = jwt.sign({ id: usuario.id, requires2FA: true }, jwtConfig.accessSecret, { expiresIn: '5m' });
  //   return { requires2FA: true, tempToken };
  // }

  const tokens = generateTokens(usuario);
  return { usuario: sanitizeUser(usuario), ...tokens };
};

const verify2FA = async (tempToken, code) => {
  // TODO: Implementar verificación TOTP con otplib
  throw Object.assign(new Error('2FA no implementado aún'), { statusCode: 501 });
};

const refreshToken = async (token) => {
  const decoded = jwt.verify(token, jwtConfig.refreshSecret);
  const usuario = await prisma.usuario.findUnique({ where: { id: decoded.id } });
  if (!usuario || usuario.estado !== 'activo') {
    throw Object.assign(new Error('Token inválido'), { statusCode: 401 });
  }
  return generateTokens(usuario);
};

const logout = async (token, userId) => {
  const redis = getRedis();
  if (redis) {
    const decoded = jwt.decode(token);
    const ttl = decoded.exp - Math.floor(Date.now() / 1000);
    if (ttl > 0) await redis.set(`bl:${token}`, '1', 'EX', ttl);
  }
};

const requestPasswordReset = async (email) => {
  // TODO: Implementar envío de email con token de reset
};

const generateTokens = (usuario) => {
  const payload = {
    id: usuario.id,
    email: usuario.email,
    rol: usuario.rol,
    tipo_ggss: usuario.tipo_ggss || null,
  };
  const accessToken = jwt.sign(payload, jwtConfig.accessSecret, { expiresIn: jwtConfig.expiresIn[usuario.rol] });
  const refreshToken = jwt.sign({ id: usuario.id }, jwtConfig.refreshSecret, { expiresIn: jwtConfig.refreshExpiresIn });
  return { accessToken, refreshToken };
};

const sanitizeUser = (usuario) => ({
  id: usuario.id,
  nombre: usuario.nombre,
  email: usuario.email,
  rol: usuario.rol,
  tipo_ggss: usuario.tipo_ggss || null,
  instalacion_asignada: usuario.instalacion_asignada || null,
});

module.exports = { login, verify2FA, refreshToken, logout, requestPasswordReset };
