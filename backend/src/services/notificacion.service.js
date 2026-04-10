// src/services/notificacion.service.js

/**
 * Servicio encargado de gestionar el envío de notificaciones
 * de novedades, atrasos y pánicos.
 */

const enviarNotificacion = async (usuario_id, titulo, mensaje) => {
    // TODO: Implementar la conexión con Firebase o el servicio de Correos / Sockets
    console.log(`[NOTIFICACIÓN] Para ${usuario_id}: ${titulo} - ${mensaje}`);
    return true;
};

module.exports = {
    enviarNotificacion
};
