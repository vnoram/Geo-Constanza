const { Router } = require('express');
const { z } = require('zod');
const rateLimit = require('express-rate-limit');
const invitaciones = require('../services/invitacionesDispositivo.service');
const { authenticate } = require('../middlewares/auth');
const { authorize, exigirEmpresa } = require('../middlewares/rbac');
const { ROLES } = require('../constants/roles');
const { validarBody } = require('../validators/auth.validators');
const equipos = require('../services/dispositivos.service');
const { desconectarDispositivo } = require('../socket/socketManager');

const router = Router();
const responder = (status, operacion) => async (req, res, next) => {
  try { res.set('Cache-Control', 'no-store').status(status).json(await operacion(req)); } catch (err) { next(err); }
};

const contexto = req => ({ ip: req.ip, userAgent: req.get('user-agent') });
const instalacion = z.string().trim().min(1).max(100).nullable().optional();
const limitarEnrolamiento = () => rateLimit({
  windowMs: 60_000, limit: 10, standardHeaders: true, legacyHeaders: false,
  message: { error: 'Demasiadas solicitudes. Intenta nuevamente en un minuto.' },
});
router.post('/canjear', limitarEnrolamiento(), validarBody(z.object({ codigo: z.string().trim().toLowerCase().regex(/^[a-f0-9]{24}$/) })),
  responder(200, req => equipos.canjear(req.body.codigo, contexto(req))));
router.post('/invitaciones/confirmar', limitarEnrolamiento(),
  validarBody(z.object({ token: z.string().regex(/^[a-f0-9]{64}$/) })),
  responder(200, req => invitaciones.confirmar(req.body.token, contexto(req))));

router.use(authenticate, exigirEmpresa);
const invitado = authorize(ROLES.SUPERVISOR, ROLES.OPERADOR_CENTRAL);
router.get('/mis-invitaciones', invitado, responder(200, req => invitaciones.misInvitaciones({ id: req.user.id, rol: req.user.rol })));
router.post('/:id/aceptar', invitado, limitarEnrolamiento(),
  responder(200, req => invitaciones.aceptar({ id: req.user.id, rol: req.user.rol, empresa_id: req.user.empresaId }, req.params.id)));
router.use(authorize(ROLES.ADMINISTRADOR));
router.get('/destinatarios', responder(200, () => invitaciones.destinatarios()));
router.post('/invitaciones', validarBody(z.object({
  nombre: z.string().trim().min(1).max(100),
  usuario_id: z.string().trim().min(1).max(100),
  instalacion_id: instalacion,
})), responder(201, async req => {
  const invitacion = await invitaciones.invitar(req.body.nombre, req.body.usuario_id, req.user.id, req.body.instalacion_id);
  await equipos.auditar('invitar_dispositivo', invitacion.id, req.user.id, req.user.empresaId, contexto(req));
  return invitacion;
}));
router.post('/:id/invitaciones/reenviar', responder(200, async req => {
  const invitacion = await invitaciones.reenviar(req.params.id);
  equipos.invalidar(invitacion.id, req.user.empresaId);
  await equipos.auditar('reenviar_invitacion_dispositivo', invitacion.id, req.user.id, req.user.empresaId, contexto(req));
  return invitacion;
}));
router.get('/', responder(200, () => equipos.listar()));
router.post('/', validarBody(z.object({ nombre: z.string().trim().min(1).max(100), instalacion_id: instalacion })),
  responder(201, async req => {
    const equipo = await equipos.crear(req.body.nombre, req.user.id, req.body.instalacion_id);
    await equipos.auditar('crear_codigo_dispositivo', equipo.id, req.user.id, req.user.empresaId, contexto(req));
    return equipo;
  }));
router.patch('/:id/revocar', responder(200, async (req) => {
  await equipos.revocar(req.params.id);
  equipos.invalidar(req.params.id, req.user.empresaId);
  await equipos.auditar('revocar_dispositivo', req.params.id, req.user.id, req.user.empresaId, contexto(req));
  desconectarDispositivo(req.user.empresaId, req.params.id);
  return { estado: 'revocado' };
}));

module.exports = router;
