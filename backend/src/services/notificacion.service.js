// src/services/notificacion.service.js

/**
 * Servicio encargado de gestionar el envío de notificaciones
 * de novedades, atrasos y pánicos.
 */

const { prisma } = require('../config/database');
const { initFirebase } = require('../config/firebase');
const { logger } = require('../config/logger');
const { ESTADO_USUARIO } = require('../constants/estados');

const registrarToken = async (usuarioId, token) => {
  if (typeof token !== 'string' || !token.trim() || token.length > 4096) {
    throw Object.assign(new Error('El token del dispositivo debe ser texto no vacío de hasta 4096 caracteres.'), { statusCode: 400 });
  }
  await prisma.usuario.update({ where: { id: usuarioId }, data: { fcm_token: token.trim() } });
  return { registrado: true };
};

const enviarNotificacion = async (usuarioId, titulo, mensaje, data = {}) => {
  try {
    const firebase = initFirebase();
    if (!firebase) return false;
    const usuario = await prisma.usuario.findUnique({ where: { id: usuarioId }, select: { fcm_token: true, estado: true } });
    if (!usuario?.fcm_token || usuario.estado !== ESTADO_USUARIO.ACTIVO) return false;
    await firebase.messaging().send({ token: usuario.fcm_token, notification: { title: titulo, body: mensaje },
      data: Object.fromEntries(Object.entries(data).map(([key, value]) => [key, String(value)])),
    });
    return true;
  } catch (error) {
    logger.warn('No se pudo enviar la notificación FCM.', { codigo: error.code || 'FCM_ERROR' });
    return false;
  }
};

module.exports = {
    enviarNotificacion, registrarToken
};
