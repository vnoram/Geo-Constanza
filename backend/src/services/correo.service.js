// Envío de correo por SMTP genérico (cualquier proveedor: Gmail, Resend, SendGrid, etc.).
// Interfaz única: enviarCorreo(destino, asunto, html). Sin credenciales no rompe la app.
const nodemailer = require('nodemailer');
const { logger } = require('../config/logger');

let transporte = null;

const smtpConfigurado = () => Boolean(process.env.SMTP_HOST && process.env.MAIL_FROM);

const obtenerTransporte = () => {
  if (!transporte) {
    const puerto = parseInt(process.env.SMTP_PORT, 10) || 587;
    transporte = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: puerto,
      secure: puerto === 465,
      auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined,
    });
  }
  return transporte;
};

// Devuelve true si el correo salió (o se imprimió en desarrollo), false si no hay forma de enviarlo.
const enviarCorreo = async (destino, asunto, html, textoPlano, { soloSMTP = false } = {}) => {
  if (!smtpConfigurado()) {
    if (soloSMTP) return false;
    if (process.env.NODE_ENV !== 'production') {
      // Solo desarrollo/pruebas: permite completar el flujo sin proveedor de correo.
      logger.info(`[correo:dev] Para: ${destino} | ${asunto}\n${textoPlano || html}`);
      return true;
    }
    logger.error('SMTP no configurado (SMTP_HOST, MAIL_FROM): no se pudo enviar el correo de restablecimiento');
    return false;
  }
  try {
    const resultado = await obtenerTransporte().sendMail({ from: process.env.MAIL_FROM, to: destino, subject: asunto, html, text: textoPlano });
    return !soloSMTP || resultado.accepted?.length > 0;
  } catch (error) {
    logger.error(soloSMTP ? 'Fallo al enviar correo de verificación.' : `Fallo al enviar correo: ${error.message}`);
    return false;
  }
};

module.exports = { enviarCorreo, smtpConfigurado };
