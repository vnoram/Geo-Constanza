const { Router } = require('express');
const instalacionesController = require('../controllers/instalaciones.controller');
const { authenticate } = require('../middlewares/auth');
const { authorize } = require('../middlewares/rbac');

const router = Router();

router.use(authenticate);

router.get('/', authorize('supervisor', 'admin'), instalacionesController.listar);
router.post('/', authorize('admin'), instalacionesController.crear);
router.put('/:id', authorize('admin'), instalacionesController.editar);

module.exports = router;
