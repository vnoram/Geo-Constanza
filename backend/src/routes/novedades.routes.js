const { Router } = require('express');
const novedadesController = require('../controllers/novedades.controller');
const { authenticate } = require('../middlewares/auth');
const { authorize, exigirEmpresa } = require('../middlewares/rbac');
const { ROLES } = require('../constants/roles');
const multer = require('multer');
const { conEmpresa } = require('../config/tenant');

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

// multer lee el cuerpo multipart (la foto) con eventos de stream, y al terminar puede continuar
// fuera del contexto de empresa que fijó `authenticate`. Se vuelve a abrir con la empresa del token.
const restaurarEmpresa = (req, res, next) => (
  req.user?.empresaId ? conEmpresa(req.user.empresaId, () => next()) : next()
);

const router = Router();

router.use(authenticate, exigirEmpresa);

// ── Listado ───────────────────────────────────────────────────────────────
// Supervisor ve su instalación, central/admin ven todas (filtro en service)
router.get('/', authorize(ROLES.GGSS_EN_PAUTA, ROLES.GGSS_LIBRE, ROLES.SUPERVISOR, ROLES.OPERADOR_CENTRAL, ROLES.ADMINISTRADOR), novedadesController.listar);
router.get('/:id', authorize(ROLES.GGSS_EN_PAUTA, ROLES.GGSS_LIBRE, ROLES.SUPERVISOR, ROLES.OPERADOR_CENTRAL, ROLES.ADMINISTRADOR), novedadesController.obtener);
router.get('/:id/historial', authorize(ROLES.GGSS_EN_PAUTA, ROLES.GGSS_LIBRE, ROLES.SUPERVISOR, ROLES.OPERADOR_CENTRAL, ROLES.ADMINISTRADOR), novedadesController.historial);

// ── Creación ──────────────────────────────────────────────────────────────
// pauta: siempre puede (tiene turno 4x4)
// libre: solo si tiene turno aprobado hoy (validación en service)
router.post('/', authorize(ROLES.GGSS_EN_PAUTA, ROLES.GGSS_LIBRE), upload.single('foto'), restaurarEmpresa, novedadesController.crear);

// ── Gestión (supervisor de su instalación, central/admin para todas) ───────
router.patch('/:id/resolver', authorize(ROLES.SUPERVISOR, ROLES.OPERADOR_CENTRAL, ROLES.ADMINISTRADOR), novedadesController.resolver);
router.get('/:id/responsables', authorize(ROLES.SUPERVISOR, ROLES.OPERADOR_CENTRAL, ROLES.ADMINISTRADOR), novedadesController.responsables);
router.patch('/:id/asignar', authorize(ROLES.SUPERVISOR, ROLES.OPERADOR_CENTRAL, ROLES.ADMINISTRADOR), novedadesController.asignar);
router.patch('/:id/escalar', authorize(ROLES.SUPERVISOR, ROLES.OPERADOR_CENTRAL, ROLES.ADMINISTRADOR), novedadesController.escalar);

module.exports = router;
