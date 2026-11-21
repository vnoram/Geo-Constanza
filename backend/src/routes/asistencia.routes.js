const { Router } = require('express');
const { z } = require('zod');
const { validarBody } = require('../validators/auth.validators');
const { revisar, solicitarNuevaRevision } = require('../services/revisionMarcajes.service');
const asistenciaController = require('../controllers/asistencia.controller');
const { authenticate } = require('../middlewares/auth');
const { authorize, exigirEmpresa } = require('../middlewares/rbac');
const { ROLES } = require('../constants/roles');

const router = Router();

router.use(authenticate, exigirEmpresa);

// ── Rutas sin parámetros → PRIMERO (evitar captura por /:param) ───────────

// Estado actual del usuario autenticado
router.get('/estado-actual', authorize(ROLES.GGSS, ROLES.ADMINISTRADOR), asistenciaController.obtenerEstadoActual);

// Entrada desde TABLET fija (GGSS en pauta — método primario 95% de los casos)
router.post('/entrada-tablet',   authorize(ROLES.GGSS), asistenciaController.registrarEntradaTablet);

// Entrada desde MÓVIL (fallback para pauta, o GGSS libre con turno aprobado)
router.post('/entrada-fallback', authorize(ROLES.GGSS), asistenciaController.registrarEntradaFallback);

// Entrada genérica (mantener compatibilidad con clientes existentes)
router.post('/entrada',  authorize(ROLES.GGSS, ROLES.ADMINISTRADOR), asistenciaController.registrarEntrada);

// Salida — GGSS libre solo puede si tiene turno aprobado (validación en service via estado-actual)
router.post('/salida',   authorize(ROLES.GGSS, ROLES.ADMINISTRADOR), asistenciaController.registrarSalida);

// Sincronización offline
router.post('/sync', authorize(ROLES.GGSS), asistenciaController.sincronizarOffline);

// ── Rutas con parámetros ──────────────────────────────────────────────────
router.get('/hoy/:instalacionId',   authorize(ROLES.SUPERVISOR, ROLES.OPERADOR_CENTRAL, ROLES.ADMINISTRADOR), asistenciaController.obtenerHoy);
router.get('/historial/:usuarioId', authorize(ROLES.GGSS, ROLES.SUPERVISOR, ROLES.OPERADOR_CENTRAL, ROLES.ADMINISTRADOR), asistenciaController.obtenerHistorial);

router.patch('/:id/revisar', authorize(ROLES.SUPERVISOR, ROLES.OPERADOR_CENTRAL, ROLES.ADMINISTRADOR),
  validarBody(z.object({ decision: z.enum(['aprobar', 'rechazar']), comentario: z.string().trim().max(1000).optional() })),
  async (req, res, next) => {
    try {
      res.json(await revisar(req.params.id, req.body, req.user, { ip: req.ip, userAgent: req.get('user-agent') }));
    } catch (err) { next(err); }
  });

// El guardia explica su caso y reenvía a revisión un marcaje rechazado.
router.post('/:id/solicitar-revision', authorize(ROLES.GGSS),
  validarBody(z.object({ comentario: z.string().trim().min(5).max(500) })),
  async (req, res, next) => {
    try {
      res.json(await solicitarNuevaRevision(req.params.id, req.body, req.user, { ip: req.ip, userAgent: req.get('user-agent') }));
    } catch (err) { next(err); }
  });

module.exports = router;
