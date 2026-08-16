const { Router } = require('express');
const novedadesController = require('../controllers/novedades.controller');
const { authenticate } = require('../middlewares/auth');
const { authorize } = require('../middlewares/rbac');
const { ROLES } = require('../constants/roles');
const multer = require('multer');

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

const router = Router();

router.use(authenticate);

// ── Listado ───────────────────────────────────────────────────────────────
// Supervisor ve su instalación, central/admin ven todas (filtro en service)
router.get('/', authorize(ROLES.GGSS_EN_PAUTA, ROLES.GGSS_LIBRE, ROLES.SUPERVISOR, ROLES.OPERADOR_CENTRAL, ROLES.ADMINISTRADOR), novedadesController.listar);
router.get('/:id', authorize(ROLES.GGSS_EN_PAUTA, ROLES.GGSS_LIBRE, ROLES.SUPERVISOR, ROLES.OPERADOR_CENTRAL, ROLES.ADMINISTRADOR), novedadesController.obtener);

// ── Creación ──────────────────────────────────────────────────────────────
// pauta: siempre puede (tiene turno 4x4)
// libre: solo si tiene turno aprobado hoy (validación en service)
router.post('/', authorize(ROLES.GGSS_EN_PAUTA, ROLES.GGSS_LIBRE), upload.single('foto'), novedadesController.crear);

// ── Gestión (supervisor de su instalación, central/admin para todas) ───────
router.patch('/:id/resolver', authorize(ROLES.SUPERVISOR, ROLES.OPERADOR_CENTRAL, ROLES.ADMINISTRADOR), novedadesController.resolver);
router.patch('/:id/escalar',  authorize(ROLES.SUPERVISOR), novedadesController.escalar);

module.exports = router;
