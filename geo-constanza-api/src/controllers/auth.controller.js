const authService = require('../services/auth.service');
const { registrarAuditoria } = require('../middlewares/auditLog');

const login = async (req, res, next) => {
  try {
    const { rut, password } = req.body;
    const result = await authService.login(rut, password, req.ip, req.get('user-agent'));

    await registrarAuditoria({
      usuarioId: result.usuario.id,
      accion: 'login',
      tablaAfectada: 'usuarios',
      registroId: result.usuario.id,
      ip: req.ip,
      userAgent: req.get('user-agent'),
    });

    res.json(result);
  } catch (error) {
    next(error);
  }
};

const refreshToken = async (req, res, next) => {
  try {
    const { refreshToken } = req.body;
    const result = await authService.refreshToken(refreshToken);
    res.json(result);
  } catch (error) {
    next(error);
  }
};

const logout = async (req, res, next) => {
  try {
    const token = req.headers.authorization.split(' ')[1];
    await authService.logout(token, req.user.id);
    res.json({ message: 'Sesión cerrada correctamente' });
  } catch (error) {
    next(error);
  }
};

const verify2FA = async (req, res, next) => {
  try {
    const { tempToken, code } = req.body;
    const result = await authService.verify2FA(tempToken, code);
    res.json(result);
  } catch (error) {
    next(error);
  }
};

const resetPassword = async (req, res, next) => {
  try {
    const { email } = req.body;
    await authService.requestPasswordReset(email);
    res.json({ message: 'Si el correo existe, recibirás un enlace de recuperación.' });
  } catch (error) {
    next(error);
  }
};

module.exports = { login, refreshToken, logout, verify2FA, resetPassword };
