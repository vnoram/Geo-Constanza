const { Router } = require('express');
const auditoriaController = require('../controllers/auditoria.controller');
const { authenticate } = require('../middlewares/auth');
const { authorize } = require('../middlewares/rbac');
const { ROLES } = require('../constants/roles');

const router = Router();

router.use(authenticate);

router.get('/', authorize(ROLES.ADMINISTRADOR), auditoriaController.listar);

module.exports = router;
