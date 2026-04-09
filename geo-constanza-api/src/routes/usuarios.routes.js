const { Router } = require('express');
const usuariosController = require('../controllers/usuarios.controller');
const { authenticate } = require('../middlewares/auth');
const { authorize } = require('../middlewares/rbac');

const router = Router();

router.use(authenticate);

router.get('/', authorize('admin'), usuariosController.listar);
router.post('/', authorize('admin'), usuariosController.crear);
router.put('/:id', authorize('admin'), usuariosController.editar);
router.patch('/:id/desactivar', authorize('admin'), usuariosController.desactivar);

module.exports = router;
