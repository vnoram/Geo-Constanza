const { Router } = require('express');
const solicitudesController = require('../controllers/solicitudes.controller');
const { authenticate } = require('../middlewares/auth');
const { authorize } = require('../middlewares/rbac');

const router = Router();

router.use(authenticate);

// ── GGSS: ver y crear sus propias solicitudes ─────────────────────────────
router.get('/',  authorize('pauta', 'libre', 'supervisor', 'central', 'admin'), solicitudesController.listar);
router.post('/', authorize('pauta', 'libre'), solicitudesController.crear);

// ── Supervisor/Admin: aprobar y rechazar ──────────────────────────────────
router.patch('/:id/aprobar',  authorize('supervisor', 'admin'), solicitudesController.aprobar);
router.patch('/:id/rechazar', authorize('supervisor', 'admin'), solicitudesController.rechazar);

module.exports = router;
