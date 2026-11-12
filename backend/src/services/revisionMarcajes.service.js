const { prisma } = require('../config/database');
const { registrarAuditoria } = require('../middlewares/auditLog');
const { enviarNotificacion } = require('./notificacion.service');
const { exigirAlcanceInstalacion } = require('./supervisor.helper');
const { habilitada } = require('./dispositivos.service');

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

module.exports = { revisar };
