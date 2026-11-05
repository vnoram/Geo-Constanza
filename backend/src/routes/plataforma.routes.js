/**
 * Consola de plataforma: gestión de empresas. SOLO el rol SUPER_ADMIN.
 * Ninguna de estas rutas expone datos operativos de las empresas (guardias, turnos, novedades).
 */
const { Router } = require('express');
const empresasController = require('../controllers/empresas.controller');
const { authenticate } = require('../middlewares/auth');
const { authorize } = require('../middlewares/rbac');
const { ROLES } = require('../constants/roles');

const router = Router();

router.use(authenticate, authorize(ROLES.SUPER_ADMIN));

router.get('/empresas', empresasController.listar);
router.post('/empresas', empresasController.crear);
router.get('/empresas/:id', empresasController.obtener);
router.put('/empresas/:id', empresasController.editar);
router.patch('/empresas/:id/estado', empresasController.cambiarEstado);
router.post('/empresas/:id/admin', empresasController.crearPrimerAdmin);

module.exports = router;
