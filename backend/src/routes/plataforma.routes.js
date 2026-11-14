/**
 * Consola de plataforma: gestión de empresas. SOLO el rol SUPER_ADMIN.
 * Ninguna de estas rutas expone datos operativos de las empresas (guardias, turnos, novedades).
 */
const { Router } = require('express');
const empresasController = require('../controllers/empresas.controller');
const { authenticate } = require('../middlewares/auth');
const { authorize } = require('../middlewares/rbac');
const { ROLES } = require('../constants/roles');
const plataformaDispositivos = require('../services/plataformaDispositivos.service');
const { registrarAuditoria } = require('../middlewares/auditLog');

const router = Router();

router.use(authenticate, authorize(ROLES.SUPER_ADMIN));

router.get('/empresas', empresasController.listar);
router.post('/empresas', empresasController.crear);
router.get('/empresas/:id', empresasController.obtener);
router.put('/empresas/:id', empresasController.editar);
router.patch('/empresas/:id/estado', empresasController.cambiarEstado);
router.post('/empresas/:id/admin', empresasController.crearPrimerAdmin);
router.put('/empresas/:id/admin/:adminId', empresasController.editarAdmin);
router.post('/empresas/:id/admin/:adminId/invitacion', empresasController.reenviarInvitacionAdmin);
router.patch('/empresas/:id/admin/:adminId/estado', empresasController.cambiarEstadoAdmin);
// Equipos principales: la plataforma invita por correo al administrador de gestión de cada empresa.
const contexto = req => ({ ip: req.ip, userAgent: req.get('user-agent') });
const aud = (req, accion, empresaId, registroId) => registrarAuditoria({
  accion, registroId, usuarioId: req.user.id, empresaId, tablaAfectada: 'dispositivos',
  valoresDespues: { autenticado: true, plataforma: true }, ...contexto(req),
});
const responder = (status, operacion) => async (req, res, next) => {
  try { res.set('Cache-Control', 'no-store').status(status).json(await operacion(req)); } catch (e) { next(e); }
};
router.get('/dispositivos', responder(200, () => plataformaDispositivos.listar()));
router.post('/empresas/:id/dispositivos/invitacion', responder(201, async (req) => {
  const nombre = typeof req.body?.nombre === 'string' && req.body.nombre.trim() ? req.body.nombre.trim().slice(0, 100) : 'Equipo principal';
  const equipo = await plataformaDispositivos.invitar(req.params.id, nombre);
  await aud(req, 'invitar_dispositivo_plataforma', req.params.id, equipo.id);
  return equipo;
}));
router.patch('/empresas/:id/dispositivos/:equipoId/revocar', responder(200, async (req) => {
  await plataformaDispositivos.revocar(req.params.id, req.params.equipoId);
  await aud(req, 'revocar_dispositivo_plataforma', req.params.id, req.params.equipoId);
  return { ok: true };
}));

module.exports = router;
