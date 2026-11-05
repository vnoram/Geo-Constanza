// Cliente global a propósito: la auditoría también se escribe antes de que exista empresa en el
// contexto (login, restablecer contraseña) y para acciones de plataforma. La empresa se fija aquí.
const { prismaGlobal } = require('../config/database');
const { empresaActual } = require('../config/tenant');
const { logger } = require('../config/logger');

/**
 * Empresa a la que pertenece el evento: la indicada, o la del contexto de la petición, o la del
 * usuario que lo origina (login). Null en acciones de plataforma (super admin).
 */
const empresaDelEvento = async (usuarioId, empresaId) => {
  if (empresaId !== undefined) return empresaId;
  const delContexto = empresaActual();
  if (delContexto) return delContexto;
  const usuario = await prismaGlobal.usuario.findUnique({ where: { id: usuarioId }, select: { empresa_id: true } });
  return usuario?.empresa_id ?? null;
};

/**
 * Registra una acción en el log de auditoría inmutable.
 * `empresaId` es opcional; si se omite se deduce (ver empresaDelEvento).
 */
const registrarAuditoria = async ({ usuarioId, accion, tablaAfectada, registroId, valoresAntes, valoresDespues, ip, userAgent, empresaId }) => {
  try {
    await prismaGlobal.auditoria.create({
      data: {
        empresa_id: await empresaDelEvento(usuarioId, empresaId),
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
