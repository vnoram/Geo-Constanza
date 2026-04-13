const { Router } = require('express');
const reportesController = require('../controllers/reportes.controller');
const { authenticate } = require('../middlewares/auth');
const { authorize } = require('../middlewares/rbac');

const router = Router();

router.use(authenticate);

// Datos tabulares
router.get('/asistencia',        authorize('supervisor', 'admin'), reportesController.asistencia);
router.get('/incidentes',        authorize('supervisor', 'admin'), reportesController.incidentes);

// Agregaciones para gráficos (admin y supervisor)
router.get('/semana',            authorize('supervisor', 'admin'), reportesController.semana);
router.get('/estado',            authorize('supervisor', 'admin'), reportesController.estadoHoy);
router.get('/mensual',           authorize('supervisor', 'admin'), reportesController.mensual);

// Exportación — antes de /:tipo para que no capture rutas con nombre
router.get('/exportar/:tipo',    authorize('supervisor', 'admin'), reportesController.exportar);

module.exports = router;
