const { Router } = require('express');
const authController = require('../controllers/auth.controller');
const { authenticate } = require('../middlewares/auth');
const v = require('../validators/auth.validators');

const router = Router();

// Públicos
router.post('/login', v.validarBody(v.loginSchema), authController.login);
router.post('/password/reset-request', v.validarBody(v.resetRequestSchema), authController.resetPassword);
router.post('/password/reset', v.validarBody(v.resetRequestSchema), authController.resetPassword); // alias histórico
router.post('/password/reset-confirm', v.validarBody(v.resetConfirmSchema), authController.confirmResetPassword);

// Autenticados
router.post('/refresh', v.validarBody(v.refreshSchema), authController.refreshToken);
router.post('/logout', authenticate, authController.logout);

// 2FA (Supervisor y Admin)
router.post('/2fa/verify', v.validarBody(v.verify2FASchema), authController.verify2FA);
router.post('/2fa/setup', authenticate, authController.setup2FA);
router.post('/2fa/enable', authenticate, v.validarBody(v.enable2FASchema), authController.enable2FA);

module.exports = router;
