const { Router } = require('express');
const { hoy, estadoSupervisores } = require('../controllers/dashboard.controller');
const { authenticate } = require('../middlewares/auth');
const { authorize } = require('../middlewares/rbac');
const { ROLES } = require('../constants/roles');

const router = Router();

router.use(authenticate);

// Supervisor: ve su instalación | Central y Admin: ven todo
router.get('/hoy', authorize(ROLES.SUPERVISOR, ROLES.OPERADOR_CENTRAL, ROLES.ADMINISTRADOR), hoy);

// Estado de supervisores (solo Central y Admin)
router.get('/supervisores', authorize(ROLES.OPERADOR_CENTRAL, ROLES.ADMINISTRADOR), estadoSupervisores);

module.exports = router;
