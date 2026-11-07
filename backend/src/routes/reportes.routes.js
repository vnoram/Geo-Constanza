const { Router } = require('express');
const reportesController = require('../controllers/reportes.controller');
const { authenticate } = require('../middlewares/auth');
const { authorize, exigirEmpresa } = require('../middlewares/rbac');
const { ROLES } = require('../constants/roles');

const router = Router();

router.use(authenticate, exigirEmpresa);

// Datos tabulares
router.get('/asistencia',        authorize(ROLES.SUPERVISOR, ROLES.ADMINISTRADOR), reportesController.asistencia);
router.get('/incidentes',        authorize(ROLES.SUPERVISOR, ROLES.ADMINISTRADOR), reportesController.incidentes);

// Agregaciones para gráficos (admin, supervisor y operador central, que ve todas las instalaciones)
router.get('/semana',            authorize(ROLES.SUPERVISOR, ROLES.OPERADOR_CENTRAL, ROLES.ADMINISTRADOR), reportesController.semana);
router.get('/estado',            authorize(ROLES.SUPERVISOR, ROLES.OPERADOR_CENTRAL, ROLES.ADMINISTRADOR), reportesController.estadoHoy);
router.get('/mensual',           authorize(ROLES.SUPERVISOR, ROLES.OPERADOR_CENTRAL, ROLES.ADMINISTRADOR), reportesController.mensual);

// Exportación — antes de /:tipo para que no capture rutas con nombre
router.get('/exportar/:tipo',    authorize(ROLES.SUPERVISOR, ROLES.ADMINISTRADOR), reportesController.exportar);

module.exports = router;
