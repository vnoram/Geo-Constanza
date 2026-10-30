const admin = require('firebase-admin');
const { logger } = require('./logger');

const initFirebase = () => {
  if (!admin.apps.length) {
    if (![process.env.FIREBASE_PROJECT_ID, process.env.FIREBASE_PRIVATE_KEY, process.env.FIREBASE_CLIENT_EMAIL].every(Boolean)) {
      logger.warn('FCM no configurado: se omite el envío de notificaciones.');
      return null;
    }
    try { admin.initializeApp({
      credential: admin.credential.cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      }),
    }); } catch (_) {
      logger.warn('No se pudo inicializar FCM; la operación continuará sin notificación.');
      return null;
    }
  }
  return admin;
};

module.exports = { initFirebase };
