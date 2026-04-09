const { Router } = require('express');
const solicitudesController = require('../controllers/solicitudes.controller');
const { authenticate } = require('../middlewares/auth');
const { authorize } = require('../middlewares/rbac');

const router = Router();

router.use(authenticate);

router.get('/', authorize('libre', 'supervisor', 'admin'), solicitudesController.listar);
router.post('/', authorize('libre'), solicitudesController.crear);
router.patch('/:id/aprobar', authorize('supervisor'), solicitudesController.aprobar);
router.patch('/:id/rechazar', authorize('supervisor'), solicitudesController.rechazar);

module.exports = router;
