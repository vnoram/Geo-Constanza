/**
 * Middleware de control de acceso basado en roles (RBAC).
 * Roles válidos: 'pauta' | 'libre' | 'supervisor' | 'central' | 'admin'
 */

const { prisma } = require('../config/database');

/**
 * Valida que el usuario tenga alguno de los roles permitidos.
 */
const authorize = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'No autenticado' });
    }

    if (!allowedRoles.includes(req.user.rol)) {
      return res.status(403).json({
        error: 'No tienes permisos para realizar esta acción',
        rol_requerido: allowedRoles,
        rol_actual: req.user.rol,
      });
    }

    next();
  };
};

/**
 * Verifica que el supervisor tenga asignada la instalación indicada en req.params.instalacionId
 * o en req.body.instalacion_id. Debe usarse después de authenticate + authorize('supervisor').
 */
const autorizarInstalacionSupervisor = async (req, res, next) => {
  try {
    const instalacionId = req.params.instalacionId || req.body.instalacion_id || req.query.instalacion_id;

    if (!instalacionId) {
      return next(); // Sin filtro de instalación → continuar (el service filtrará)
    }

    const asignacion = await prisma.supervisor_Instalacion.findFirst({
      where: {
        supervisor_id: req.user.id,
        instalacion_id: instalacionId,
      },
    });

    if (!asignacion) {
      return res.status(403).json({ error: 'No tienes acceso a esta instalación' });
    }

    next();
  } catch (error) {
    next(error);
  }
};

module.exports = { authorize, autorizarInstalacionSupervisor };
