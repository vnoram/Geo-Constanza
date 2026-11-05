/**
 * Middleware de control de acceso basado en roles (RBAC).
 * Roles válidos: ver backend/src/constants/roles.js (ROLES)
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
 * Las rutas operativas (guardias, turnos, novedades...) pertenecen a una empresa.
 * El super admin es de nivel de plataforma y no tiene empresa: no puede operar datos de empresas.
 * Debe usarse después de authenticate.
 */
const exigirEmpresa = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ error: 'No autenticado' });
  }
  if (!req.user.empresaId) {
    return res.status(403).json({
      error: 'Esta ruta opera datos de una empresa; el nivel de plataforma no tiene acceso.',
      rol_actual: req.user.rol,
    });
  }
  next();
};

/**
 * Verifica que el supervisor tenga asignada la instalación indicada en req.params.instalacionId
 * o en req.body.instalacion_id. Debe usarse después de authenticate + authorize(ROLES.SUPERVISOR).
 *
 * Una instalación que no existe en la empresa del token (incluida una de OTRA empresa) responde 404;
 * una de la empresa pero no asignada al supervisor responde 403.
 */
const autorizarInstalacionSupervisor = async (req, res, next) => {
  try {
    const instalacionId = req.params.instalacionId || req.body.instalacion_id || req.query.instalacion_id;

    if (!instalacionId) {
      return next(); // Sin filtro de instalación → continuar (el service filtrará)
    }

    // El cliente `prisma` ya está limitado a la empresa del token
    const instalacion = await prisma.instalacion.findUnique({ where: { id: instalacionId }, select: { id: true } });
    if (!instalacion) {
      return res.status(404).json({ error: 'Registro no encontrado.' });
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

module.exports = { authorize, exigirEmpresa, autorizarInstalacionSupervisor };
