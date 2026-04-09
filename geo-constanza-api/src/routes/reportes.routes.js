const { Router } = require('express');
const reportesController = require('../controllers/reportes.controller');
const { authenticate } = require('../middlewares/auth');
const { authorize } = require('../middlewares/rbac');

const router = Router();

router.use(authenticate);

router.get('/asistencia', authorize('supervisor', 'admin'), reportesController.asistencia);
router.get('/incidentes', authorize('supervisor', 'admin'), reportesController.incidentes);
router.get('/exportar/:tipo', authorize('supervisor', 'admin'), reportesController.exportar);

module.exports = router;
