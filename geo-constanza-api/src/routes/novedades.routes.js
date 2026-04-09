const { Router } = require('express');
const novedadesController = require('../controllers/novedades.controller');
const { authenticate } = require('../middlewares/auth');
const { authorize } = require('../middlewares/rbac');
const multer = require('multer');

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

const router = Router();

router.use(authenticate);

router.get('/', authorize('supervisor', 'admin'), novedadesController.listar);
router.get('/:id', authorize('pauta', 'supervisor', 'admin'), novedadesController.obtener);
router.post('/', authorize('pauta'), upload.single('foto'), novedadesController.crear);
router.patch('/:id/resolver', authorize('supervisor'), novedadesController.resolver);
router.patch('/:id/escalar', authorize('supervisor'), novedadesController.escalar);

module.exports = router;
