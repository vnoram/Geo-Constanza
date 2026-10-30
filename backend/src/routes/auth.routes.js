const { Router } = require('express');
const authController = require('../controllers/auth.controller');
const { authenticate } = require('../middlewares/auth');

const router = Router();

// Públicos
router.post('/login', authController.login);
router.post('/password/reset', authController.resetPassword);

// Autenticados
router.post('/refresh', authController.refreshToken);
router.post('/logout', authenticate, authController.logout);

// 2FA (Supervisor y Admin)
router.post('/2fa/verify', authController.verify2FA);
router.post('/2fa/setup', authenticate, authController.setup2FA);
router.post('/2fa/enable', authenticate, authController.enable2FA);

module.exports = router;
