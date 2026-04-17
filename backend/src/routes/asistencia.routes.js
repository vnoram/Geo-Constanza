const { Router } = require('express');
const asistenciaController = require('../controllers/asistencia.controller');
const { authenticate } = require('../middlewares/auth');
const { authorize } = require('../middlewares/rbac');

const router = Router();

router.use(authenticate);

// ── Rutas sin parámetros → PRIMERO (evitar captura por /:param) ───────────

// Estado actual del usuario autenticado
router.get('/estado-actual', authorize('pauta', 'libre', 'admin'), asistenciaController.obtenerEstadoActual);

// Entrada desde TABLET fija (GGSS en pauta — método primario 95% de los casos)
router.post('/entrada-tablet',   authorize('pauta'), asistenciaController.registrarEntradaTablet);

// Entrada desde MÓVIL (fallback para pauta, o GGSS libre con turno aprobado)
router.post('/entrada-fallback', authorize('pauta', 'libre'), asistenciaController.registrarEntradaFallback);

// Entrada genérica (mantener compatibilidad con clientes existentes)
router.post('/entrada',  authorize('pauta', 'libre', 'admin'), asistenciaController.registrarEntrada);

// Salida — GGSS libre solo puede si tiene turno aprobado (validación en service via estado-actual)
router.post('/salida',   authorize('pauta', 'libre', 'admin'), asistenciaController.registrarSalida);

// Sincronización offline
router.post('/sync', asistenciaController.sincronizarOffline);

// ── Rutas con parámetros ──────────────────────────────────────────────────
router.get('/hoy/:instalacionId',   authorize('supervisor', 'central', 'admin'), asistenciaController.obtenerHoy);
router.get('/historial/:usuarioId', authorize('pauta', 'libre', 'supervisor', 'central', 'admin'), asistenciaController.obtenerHistorial);

module.exports = router;
