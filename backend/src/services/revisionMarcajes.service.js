const { prisma } = require('../config/database');
const { registrarAuditoria } = require('../middlewares/auditLog');
const { enviarNotificacion } = require('./notificacion.service');
const { exigirAlcanceInstalacion } = require('./supervisor.helper');
const { habilitada } = require('./dispositivos.service');
const { getSocketIO } = require('../socket/socketManager');

const GPS_REVISABLE = ['por_revisar', 'sin_ubicacion'];
const RESULTADO = { aprobar: 'aprobado', rechazar: 'rechazado' };
const error = (statusCode, message) => Object.assign(new Error(message), { statusCode });

async function revisar(id, { decision, comentario }, usuario, contexto) {
  if (!habilitada()) throw error(404, 'Revisión de marcajes no disponible.');
  const asistencia = await prisma.asistencia.findUniqueOrThrow({ where: { id } });
  await exigirAlcanceInstalacion(usuario, asistencia.instalacion_id);
  if (!GPS_REVISABLE.includes(asistencia.verificacion_gps)) throw error(400, 'El marcaje no requiere revisión GPS.');
  const resultado = RESULTADO[decision];
  if (!resultado) throw error(400, 'La decisión debe ser aprobar o rechazar.');
  const motivo = comentario?.trim() || null;
  if (decision === 'rechazar' && !motivo) throw error(400, 'Ingresa un comentario para rechazar el marcaje.');

  const { count } = await prisma.asistencia.updateMany({
    where: { id, revision_estado: null, verificacion_gps: { in: GPS_REVISABLE } },
    data: { revision_estado: resultado, revisado_por: usuario.id, revisado_en: new Date(), comentario_revision: motivo },
  });
  const vigente = await prisma.asistencia.findUniqueOrThrow({ where: { id } });
  if (!count && vigente.revision_estado !== resultado) throw error(409, 'El marcaje ya tiene otra decisión de revisión.');
  if (count) {
    await registrarAuditoria({
      usuarioId: usuario.id, accion: 'revisar_marcaje', tablaAfectada: 'asistencias', registroId: id,
      valoresDespues: { revision_estado: resultado, comentario_revision: motivo }, ...contexto,
    });
    await enviarNotificacion(asistencia.usuario_id, 'Marcaje revisado', 'Tu marcaje fue ' + resultado + '.', {
      asistencia_id: id, revision_estado: resultado,
    });
  }
  return vigente;
}

/**
 * El guardia explica su caso y reenvía a revisión un marcaje rechazado (p. ej. "estoy en la instalación,
 * pero el computador no tiene GPS"). Vuelve a quedar pendiente y el supervisor decide de nuevo.
 * El rechazo anterior queda en la auditoría.
 */
async function solicitarNuevaRevision(id, { comentario }, usuario, contexto) {
  if (!habilitada()) throw error(404, 'Revisión de marcajes no disponible.');
  const asistencia = await prisma.asistencia.findUniqueOrThrow({ where: { id } });
  if (asistencia.usuario_id !== usuario.id) throw error(403, 'Solo puedes reenviar tu propio marcaje.');
  if (asistencia.hora_salida) throw error(400, 'El turno ya terminó.');
  if (asistencia.revision_estado !== 'rechazado') throw error(400, 'Este marcaje no está rechazado.');
  const texto = comentario?.trim();
  if (!texto) throw error(400, 'Explica brevemente tu situación para que el supervisor la revise.');

  const antes = { revision_estado: asistencia.revision_estado, comentario_revision: asistencia.comentario_revision };
  const { count } = await prisma.asistencia.updateMany({
    where: { id, revision_estado: 'rechazado', hora_salida: null },
    data: { revision_estado: null, comentario_revision: null, comentario_guardia: texto },
  });
  if (!count) throw error(409, 'El marcaje cambió mientras lo reenviabas. Recarga la pantalla.');
  await registrarAuditoria({
    usuarioId: usuario.id, accion: 'reenviar_marcaje', tablaAfectada: 'asistencias', registroId: id,
    valoresAntes: antes, valoresDespues: { revision_estado: null, comentario_guardia: texto }, ...contexto,
  });
  try {
    getSocketIO().to(`instalacion:${asistencia.instalacion_id}`).emit('guardia:marcaje_por_revisar', {
      guardia: usuario.id, instalacion: asistencia.instalacion_id, hora: new Date(),
      verificacion: asistencia.verificacion_gps, mensaje: 'El guardia pidió una nueva revisión de su marcaje.',
    });
  } catch (_) { /* no crítico */ }
  return prisma.asistencia.findUniqueOrThrow({ where: { id } });
}

module.exports = { revisar, solicitarNuevaRevision };
