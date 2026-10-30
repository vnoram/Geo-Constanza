const { prisma } = require('../config/database');
const { ROLES } = require('../constants/roles');
const { ESTADO_TURNO, ESTADO_USUARIO, ESTADO_SOLICITUD } = require('../constants/estados');
const { TIPO_SOLICITUD } = require('../constants/solicitudes');
const { toleranciaInstalacion } = require('../constants/cobertura');
const { ahoraChile, sumarDias, aFechaDB, intervaloTurno } = require('../utils/fechaChile');
const { verificarConflictos } = require('./turnos.service');

const esVacante = (turno, ahora = new Date()) => {
  if (turno.estado !== ESTADO_TURNO.PROGRAMADO) return false;
  const { inicio, fin } = intervaloTurno(turno);
  if (ahora >= fin || turno.asistencias?.length) return false;
  return !turno.usuario_id || ahora.getTime() >= inicio.getTime() + toleranciaInstalacion(turno.instalacion) * 60000;
};

const exigirLibre = async (user, db = prisma) => {
  const usuario = await db.usuario.findUnique({ where: { id: user.id } });
  if (user.rol !== ROLES.GGSS_LIBRE || usuario?.rol !== ROLES.GGSS_LIBRE || usuario.estado !== ESTADO_USUARIO.ACTIVO) {
    throw Object.assign(new Error('Solo un GGSS Libre activo puede solicitar cobertura.'), { statusCode: 403 });
  }
};

const listarCompatibles = async (user) => {
  await exigirLibre(user);
  const ahora = new Date();
  const ayer = sumarDias(ahoraChile(ahora).fecha, -1);
  const turnos = await prisma.turno.findMany({ where: { estado: ESTADO_TURNO.PROGRAMADO, fecha: { gte: aFechaDB(ayer) } },
    include: { instalacion: true, asistencias: { select: { id: true } } }, orderBy: [{ fecha: 'asc' }, { hora_inicio: 'asc' }],
  });
  const compatibles = [];
  for (const turno of turnos.filter(t => esVacante(t, ahora))) {
    const conflictos = await verificarConflictos({ ...turno, usuario_id: user.id });
    if (!conflictos.length) compatibles.push({ id: turno.id, fecha: turno.fecha, hora_inicio: turno.hora_inicio,
      hora_fin: turno.hora_fin, instalacion: { id: turno.instalacion.id, nombre: turno.instalacion.nombre },
      motivo_vacante: turno.usuario_id ? 'sin_asistencia' : 'sin_asignar',
    });
  }
  return compatibles;
};

const solicitar = async (turnoId, user, motivo) => {
  await exigirLibre(user);
  if (typeof turnoId !== 'string' || !turnoId) throw Object.assign(new Error('Indica la vacante.'), { statusCode: 400 });
  return prisma.$transaction(async (tx) => {
    const turno = await tx.turno.findUnique({ where: { id: turnoId }, include: { instalacion: true, asistencias: { select: { id: true } } } });
    if (!turno) throw Object.assign(new Error('Vacante no encontrada.'), { statusCode: 404 });
    if (!esVacante(turno)) throw Object.assign(new Error('El turno ya no está vacante.'), { statusCode: 409 });
    if ((await verificarConflictos({ ...turno, usuario_id: user.id }, tx)).length) {
      throw Object.assign(new Error('La vacante se superpone con tus turnos.'), { statusCode: 409 });
    }
    const existente = await tx.solicitud.findFirst({ where: { usuario_id: user.id, vacante_turno_id: turnoId,
      estado: { in: [ESTADO_SOLICITUD.PENDIENTE, ESTADO_SOLICITUD.APROBADA] },
    } });
    if (existente) throw Object.assign(new Error('Ya existe una solicitud para esta vacante.'), { statusCode: 409 });
    return tx.solicitud.create({ data: { usuario_id: user.id, tipo: TIPO_SOLICITUD.COBERTURA, vacante_turno_id: turnoId,
      fecha_desde: turno.fecha, motivo: typeof motivo === 'string' ? motivo.trim() : null, estado: ESTADO_SOLICITUD.PENDIENTE,
    } });
  }, { isolationLevel: 'Serializable' });
};
module.exports = { esVacante, listarCompatibles, solicitar };
