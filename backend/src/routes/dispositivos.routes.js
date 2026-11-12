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

router.post('/canjear', validarBody(z.object({ codigo: z.string().trim().toLowerCase().regex(/^[a-f0-9]{24}$/) })),
  responder(200, (req) => equipos.canjear(req.body.codigo)));
const limitarConfirmacion = rateLimit({
  windowMs: 60_000, limit: 10, standardHeaders: true, legacyHeaders: false,
  message: { error: 'Demasiadas solicitudes. Intenta nuevamente en un minuto.' },
});
router.post('/invitaciones/confirmar', limitarConfirmacion,
  validarBody(z.object({ token: z.string().regex(/^[a-f0-9]{64}$/) })),
  responder(200, req => invitaciones.confirmar(req.body.token)));

router.use(authenticate, exigirEmpresa, authorize(ROLES.ADMINISTRADOR));
router.get('/destinatarios', responder(200, () => invitaciones.destinatarios()));
router.post('/invitaciones', validarBody(z.object({
  nombre: z.string().trim().min(1).max(100),
  usuario_id: z.string().trim().min(1).max(100),
})), responder(201, req => invitaciones.invitar(req.body.nombre, req.body.usuario_id, req.user.id)));
router.post('/:id/invitaciones/reenviar', responder(200, req => invitaciones.reenviar(req.params.id)));
router.get('/', responder(200, () => equipos.listar()));
router.post('/', validarBody(z.object({ nombre: z.string().trim().min(1).max(100) })),
  responder(201, (req) => equipos.crear(req.body.nombre, req.user.id)));
router.patch('/:id/revocar', responder(200, async (req) => {
  await equipos.revocar(req.params.id);
  desconectarDispositivo(req.user.empresaId, req.params.id);
  return { estado: 'revocado' };
}));

module.exports = router;
