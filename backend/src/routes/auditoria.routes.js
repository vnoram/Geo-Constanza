const { Router } = require('express');
const auditoriaController = require('../controllers/auditoria.controller');
const { authenticate } = require('../middlewares/auth');
const { authorize } = require('../middlewares/rbac');

const router = Router();

router.use(authenticate);

router.get('/', authorize('admin'), auditoriaController.listar);

module.exports = router;
