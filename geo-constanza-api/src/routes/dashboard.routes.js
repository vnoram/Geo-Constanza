const { Router } = require('express');
const dashboardController = require('../controllers/dashboard.controller');
const { authenticate } = require('../middlewares/auth');
const { authorize } = require('../middlewares/rbac');

const router = Router();

router.use(authenticate);

router.get('/supervisor', authorize('supervisor', 'admin'), dashboardController.obtenerKPIs);
router.get('/guardias-activos', authorize('supervisor', 'admin'), dashboardController.guardiasActivos);

module.exports = router;
