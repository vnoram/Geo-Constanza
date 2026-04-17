const { Router } = require('express');
const usuariosController = require('../controllers/usuarios.controller');
const { authenticate } = require('../middlewares/auth');
const { authorize } = require('../middlewares/rbac');

const router = Router();

router.use(authenticate);

// ── Perfil propio (cualquier rol autenticado) ──────────────────────────────
router.get('/me', usuariosController.miInformacion);

// ── CRUD (solo admin, supervisor puede listar) ─────────────────────────────
router.get('/', authorize('supervisor', 'central', 'admin'), usuariosController.listar);
router.post('/', authorize('admin'), usuariosController.crear);
router.put('/:id', authorize('admin'), usuariosController.editar);
router.patch('/:id/desactivar', authorize('admin'), usuariosController.desactivar);

module.exports = router;
