const { Router } = require('express');
const asistenciaController = require('../controllers/asistencia.controller');
const { authenticate } = require('../middlewares/auth');
const { authorize } = require('../middlewares/rbac');
const { ROLES } = require('../constants/roles');

const router = Router();

router.use(authenticate);

// ── Rutas sin parámetros → PRIMERO (evitar captura por /:param) ───────────

// Estado actual del usuario autenticado
router.get('/estado-actual', authorize(ROLES.GGSS_EN_PAUTA, ROLES.GGSS_LIBRE, ROLES.ADMINISTRADOR), asistenciaController.obtenerEstadoActual);

// Entrada desde TABLET fija (GGSS en pauta — método primario 95% de los casos)
router.post('/entrada-tablet',   authorize(ROLES.GGSS_EN_PAUTA), asistenciaController.registrarEntradaTablet);

// Entrada desde MÓVIL (fallback para pauta, o GGSS libre con turno aprobado)
router.post('/entrada-fallback', authorize(ROLES.GGSS_EN_PAUTA, ROLES.GGSS_LIBRE), asistenciaController.registrarEntradaFallback);

// Entrada genérica (mantener compatibilidad con clientes existentes)
router.post('/entrada',  authorize(ROLES.GGSS_EN_PAUTA, ROLES.GGSS_LIBRE, ROLES.ADMINISTRADOR), asistenciaController.registrarEntrada);

// Salida — GGSS libre solo puede si tiene turno aprobado (validación en service via estado-actual)
router.post('/salida',   authorize(ROLES.GGSS_EN_PAUTA, ROLES.GGSS_LIBRE, ROLES.ADMINISTRADOR), asistenciaController.registrarSalida);

// Sincronización offline
router.post('/sync', asistenciaController.sincronizarOffline);

// ── Rutas con parámetros ──────────────────────────────────────────────────
router.get('/hoy/:instalacionId',   authorize(ROLES.SUPERVISOR, ROLES.OPERADOR_CENTRAL, ROLES.ADMINISTRADOR), asistenciaController.obtenerHoy);
router.get('/historial/:usuarioId', authorize(ROLES.GGSS_EN_PAUTA, ROLES.GGSS_LIBRE, ROLES.SUPERVISOR, ROLES.OPERADOR_CENTRAL, ROLES.ADMINISTRADOR), asistenciaController.obtenerHistorial);

module.exports = router;
