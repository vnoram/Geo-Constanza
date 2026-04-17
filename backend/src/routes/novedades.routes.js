const { Router } = require('express');
const novedadesController = require('../controllers/novedades.controller');
const { authenticate } = require('../middlewares/auth');
const { authorize } = require('../middlewares/rbac');
const multer = require('multer');

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

const router = Router();

router.use(authenticate);

// ── Listado ───────────────────────────────────────────────────────────────
// Supervisor ve su instalación, central/admin ven todas (filtro en service)
router.get('/', authorize('supervisor', 'central', 'admin'), novedadesController.listar);
router.get('/:id', authorize('pauta', 'libre', 'supervisor', 'central', 'admin'), novedadesController.obtener);

// ── Creación ──────────────────────────────────────────────────────────────
// pauta: siempre puede (tiene turno 4x4)
// libre: solo si tiene turno aprobado hoy (validación en service)
router.post('/', authorize('pauta', 'libre'), upload.single('foto'), novedadesController.crear);

// ── Gestión (supervisor de su instalación, central/admin para todas) ───────
router.patch('/:id/resolver', authorize('supervisor', 'central', 'admin'), novedadesController.resolver);
router.patch('/:id/escalar',  authorize('supervisor'), novedadesController.escalar);

module.exports = router;
