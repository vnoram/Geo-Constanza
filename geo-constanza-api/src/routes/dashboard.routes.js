const { Router } = require('express');
const { hoy } = require('../controllers/dashboard.controller');
const { authenticate } = require('../middlewares/auth');
const { authorize } = require('../middlewares/rbac');

const router = Router();

router.use(authenticate);
router.get('/hoy', authorize('supervisor', 'admin'), hoy);

module.exports = router;
