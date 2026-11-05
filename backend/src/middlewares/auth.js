const jwt = require('jsonwebtoken');
const { jwtConfig } = require('../config/jwt');
const { getRedis } = require('../config/redis');
// Cliente global a propósito: aquí todavía no hay empresa en el contexto; la fijamos justo abajo
// con la empresa del TOKEN, y recién entonces el resto de la petición usa el cliente con alcance.
const { prismaGlobal } = require('../config/database');
const { conEmpresa } = require('../config/tenant');
const { ESTADO_USUARIO, ESTADO_EMPRESA } = require('../constants/estados');

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
    // Una sola consulta valida usuario, rol, empresa y estado de la empresa en cada petición,
    // así que suspender una empresa o desactivar un usuario corta el acceso de inmediato.
    const vigente = await prismaGlobal.usuario.findUnique({
      where: { id: decoded.id },
      select: { estado: true, rol: true, empresa_id: true, empresa: { select: { estado: true } } },
    });
    if (!vigente || vigente.estado !== ESTADO_USUARIO.ACTIVO || vigente.rol !== decoded.rol) {
      return res.status(401).json({ error: 'Token inválido' });
    }
    // La empresa del token y la de la base deben coincidir (los tokens anteriores a multiempresa
    // no traen empresaId y deben volver a iniciar sesión).
    if ((decoded.empresaId ?? null) !== (vigente.empresa_id ?? null)) {
      return res.status(401).json({ error: 'Token inválido' });
    }
    if (vigente.empresa_id && vigente.empresa?.estado !== ESTADO_EMPRESA.ACTIVA) {
      return res.status(403).json({
        error: 'La empresa se encuentra suspendida. Contacta al administrador de la plataforma.',
        code: 'EMPRESA_SUSPENDIDA',
      });
    }
    if (redis) {
      // Cambio de contraseña posterior a la emisión: el token ya no sirve.
      const cambio = await redis.get(`pwd_changed:${decoded.id}`);
      if (cambio && decoded.iat < parseInt(cambio, 10)) {
        return res.status(401).json({ error: 'Token inválido' });
      }
    }
    req.user = decoded;
    // Desde aquí, todo el código de la petición (servicios, transacciones) queda aislado
    // a la empresa del token. El super admin (empresaId null) no abre contexto de empresa.
    if (decoded.empresaId) return conEmpresa(decoded.empresaId, () => next());
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expirado' });
    }
    return res.status(401).json({ error: 'Token inválido' });
  }
};

module.exports = { authenticate };
