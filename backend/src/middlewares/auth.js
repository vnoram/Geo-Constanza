const jwt = require('jsonwebtoken');
const { jwtConfig } = require('../config/jwt');
const { getRedis } = require('../config/redis');
const { prisma } = require('../config/database');
const { ESTADO_USUARIO } = require('../constants/estados');

const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Token no proporcionado' });
    }

    const token = authHeader.split(' ')[1];

    // Verificar si el token está en la blacklist (logout)
    const redis = getRedis();
    if (redis) {
      const isBlacklisted = await redis.get(`bl:${token}`);
      if (isBlacklisted) {
        return res.status(401).json({ error: 'Token inválido' });
      }
    }

    const decoded = jwt.verify(token, jwtConfig.accessSecret);
    if (decoded.tipo === '2fa_pending') {
      return res.status(401).json({ error: 'Token inválido' });
    }
    // El token solo prueba quién era el usuario al emitirse: se confirma que siga activo
    // y con el mismo rol (una desactivación o cambio de rol aplica de inmediato).
    const vigente = await prisma.usuario.findUnique({ where: { id: decoded.id }, select: { estado: true, rol: true } });
    if (!vigente || vigente.estado !== ESTADO_USUARIO.ACTIVO || vigente.rol !== decoded.rol) {
      return res.status(401).json({ error: 'Token inválido' });
    }
    // Sesiones anteriores a un restablecimiento de contraseña quedan revocadas.
    if (redis) {
      const cambio = await redis.get(`pwd_changed:${decoded.id}`);
      if (cambio && decoded.iat < parseInt(cambio, 10)) {
        return res.status(401).json({ error: 'Token inválido' });
      }
    }
    req.user = decoded;
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expirado' });
    }
    return res.status(401).json({ error: 'Token inválido' });
  }
};

module.exports = { authenticate };
