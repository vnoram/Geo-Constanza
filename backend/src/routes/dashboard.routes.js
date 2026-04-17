const { Router } = require('express');
const { hoy, estadoSupervisores } = require('../controllers/dashboard.controller');
const { authenticate } = require('../middlewares/auth');
const { authorize } = require('../middlewares/rbac');

const router = Router();

router.use(authenticate);

// Supervisor: ve su instalación | Central y Admin: ven todo
router.get('/hoy', authorize('supervisor', 'central', 'admin'), hoy);

// Estado de supervisores (solo Central y Admin)
router.get('/supervisores', authorize('central', 'admin'), estadoSupervisores);

module.exports = router;
