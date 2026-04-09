/**
 * Middleware de control de acceso basado en roles (RBAC).
 * Roles: pauta, libre, supervisor, admin
 */
const authorize = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'No autenticado' });
    }

    if (!allowedRoles.includes(req.user.rol)) {
      return res.status(403).json({
        error: 'No tienes permisos para realizar esta acción',
      });
    }

    next();
  };
};

module.exports = { authorize };
