const jwt = require('jsonwebtoken');
const { jwtConfig } = require('../config/jwt');
const { getRedis } = require('../config/redis');

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
