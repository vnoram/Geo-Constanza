const { Router } = require('express');
const { z } = require('zod');
const { authenticate } = require('../middlewares/auth');
const { authorize, exigirEmpresa } = require('../middlewares/rbac');
const { ROLES } = require('../constants/roles');
const { validarBody } = require('../validators/auth.validators');
const equipos = require('../services/dispositivos.service');
const { desconectarDispositivo } = require('../socket/socketManager');

const router = Router();
const responder = (status, operacion) => async (req, res, next) => {
  try { res.status(status).json(await operacion(req)); } catch (err) { next(err); }
};

router.post('/canjear', validarBody(z.object({ codigo: z.string().trim().toLowerCase().regex(/^[a-f0-9]{24}$/) })),
  responder(200, (req) => equipos.canjear(req.body.codigo)));
router.use(authenticate, exigirEmpresa, authorize(ROLES.ADMINISTRADOR));
router.get('/', responder(200, () => equipos.listar()));
router.post('/', validarBody(z.object({ nombre: z.string().trim().min(1).max(100) })),
  responder(201, (req) => equipos.crear(req.body.nombre, req.user.id)));
router.patch('/:id/revocar', responder(200, async (req) => {
  await equipos.revocar(req.params.id);
  desconectarDispositivo(req.user.empresaId, req.params.id);
  return { estado: 'revocado' };
}));

module.exports = router;
