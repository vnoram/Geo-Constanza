const { Router } = require('express');
const asistenciaController = require('../controllers/asistencia.controller');
const { authenticate } = require('../middlewares/auth');
const { authorize } = require('../middlewares/rbac');

const router = Router();

router.use(authenticate);

router.post('/entrada',  authorize('pauta', 'libre', 'admin'), asistenciaController.registrarEntrada);
router.post('/salida',   authorize('pauta', 'libre', 'admin'), asistenciaController.registrarSalida);
// Ruta sin parámetro — debe estar ANTES de las rutas con /:param para evitar captura accidental
router.get('/estado-actual', authorize('pauta', 'libre', 'admin'), asistenciaController.obtenerEstadoActual);
router.get('/hoy/:instalacionId',    authorize('supervisor', 'admin'), asistenciaController.obtenerHoy);
router.get('/historial/:usuarioId',  authorize('pauta', 'libre', 'supervisor', 'admin'), asistenciaController.obtenerHistorial);
router.post('/sync', asistenciaController.sincronizarOffline);

module.exports = router;
