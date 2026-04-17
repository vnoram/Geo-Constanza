const { Router } = require('express');
const turnosController = require('../controllers/turnos.controller');
const { authenticate } = require('../middlewares/auth');
const { authorize } = require('../middlewares/rbac');

const router = Router();

router.use(authenticate);

// ── GGSS Libre: ver turnos disponibles en su instalación asignada ──────────
router.get('/disponibles', authorize('libre'), turnosController.listarDisponibles);

// ── Verificar conflictos (antes de /:id para evitar captura) ───────────────
router.get('/conflictos', authorize('supervisor', 'central', 'admin'), turnosController.verificarConflictos);

// ── Creación de pautas y lotes (antes de /:id) ────────────────────────────
router.post('/lote',      authorize('central', 'admin'), turnosController.crearLote);
router.post('/pauta-4x4', authorize('central', 'admin'), turnosController.crearPauta4x4);

// ── CRUD general ──────────────────────────────────────────────────────────
router.get('/',    authorize('pauta', 'libre', 'supervisor', 'central', 'admin'), turnosController.listar);
router.get('/:id', authorize('pauta', 'libre', 'supervisor', 'central', 'admin'), turnosController.obtener);
router.post('/',   authorize('supervisor', 'central', 'admin'), turnosController.crear);
router.put('/:id', authorize('supervisor', 'central', 'admin'), turnosController.editar);
router.patch('/:id/cancelar', authorize('supervisor', 'central', 'admin'), turnosController.cancelar);

module.exports = router;
