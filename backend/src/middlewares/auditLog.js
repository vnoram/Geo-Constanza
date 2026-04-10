const { prisma } = require('../config/database');
const { logger } = require('../config/logger');

/**
 * Registra una acción en el log de auditoría inmutable.
 */
const registrarAuditoria = async ({ usuarioId, accion, tablaAfectada, registroId, valoresAntes, valoresDespues, ip, userAgent }) => {
  try {
    await prisma.auditoria.create({
      data: {
        usuario_id: usuarioId,
        accion,
        tabla_afectada: tablaAfectada,
        registro_id: registroId,
        valores_antes: valoresAntes || undefined,
        valores_despues: valoresDespues || undefined,
        ip_address: ip,
        user_agent: userAgent,
      },
    });
  } catch (error) {
    logger.error('Error registrando auditoría:', error);
  }
};

module.exports = { registrarAuditoria };
