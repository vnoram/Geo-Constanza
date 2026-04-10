const { Router } = require('express');
const turnosController = require('../controllers/turnos.controller');
const { authenticate } = require('../middlewares/auth');
const { authorize } = require('../middlewares/rbac');

const router = Router();

router.use(authenticate);

router.get('/', authorize('pauta', 'libre', 'supervisor', 'admin'), turnosController.listar);
router.get('/conflictos', authorize('supervisor', 'admin'), turnosController.verificarConflictos);
router.get('/:id', turnosController.obtener);
router.post('/', authorize('supervisor', 'admin'), turnosController.crear);
router.post('/lote', authorize('admin'), turnosController.crearLote);
router.put('/:id', authorize('supervisor', 'admin'), turnosController.editar);
router.patch('/:id/cancelar', authorize('supervisor', 'admin'), turnosController.cancelar);

module.exports = router;
