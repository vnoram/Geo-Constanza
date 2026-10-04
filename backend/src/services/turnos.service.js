const { prisma } = require('../config/database');
const { getSocketIO } = require('../socket/socketManager');
const { ROLES } = require('../constants/roles');
const { resolverInstalacionesSupervisor } = require('./supervisor.helper');

const { ahoraChile, aFechaDB, sumarDias, intervaloTurno, seSolapan } = require('../utils/fechaChile');

const CAMPOS_EDITABLES = ['usuario_id', 'instalacion_id', 'fecha', 'hora_inicio', 'hora_fin'];
const HORA_REGEX = /^([01]\d|2[0-3]):[0-5]\d$/;

// Busca un turno no cancelado del guardia que se solape con el horario indicado.
// `excluirId` permite ignorar el propio turno al editar.
const buscarConflicto = async ({ usuario_id, fecha, hora_inicio, hora_fin, excluirId }) => {
  const dia = new Date(fecha).toISOString().slice(0, 10);
  const intervalo = intervaloTurno({ fecha, hora_inicio, hora_fin });
  const candidatos = await prisma.turno.findMany({
    where: {
      usuario_id,
      fecha: { gte: aFechaDB(sumarDias(dia, -1)), lte: aFechaDB(sumarDias(dia, 1)) },
      estado: { not: 'cancelado' },
      ...(excluirId && { id: { not: excluirId } }),
    },
    include: { instalacion: { select: { nombre: true } } },
    orderBy: [{ fecha: 'asc' }, { hora_inicio: 'asc' }],
  });
  return candidatos.find((t) => seSolapan(intervalo, intervaloTurno(t)));
};

const mensajeConflicto = (t) => `Conflicto con turno ${t.id}: ${new Date(t.fecha).toISOString().slice(0, 10)} ${t.hora_inicio}–${t.hora_fin} en ${t.instalacion?.nombre || t.instalacion_id}`;

const listar = async (query, user) => {
  const where = {};
  if (query.fecha) where.fecha = new Date(query.fecha);
  else if (query.desde) where.fecha = { gte: new Date(query.desde) };
  if (query.instalacion_id) where.instalacion_id = query.instalacion_id;
  if (query.usuario_id) where.usuario_id = query.usuario_id;

  // GGSS solo ve sus propios turnos
  if ([ROLES.GGSS_EN_PAUTA, ROLES.GGSS_LIBRE].includes(user.rol)) {
    where.usuario_id = user.id;
  }

  // Supervisor solo ve turnos de las instalaciones bajo su gestión
  if (user.rol === ROLES.SUPERVISOR) {
    const permitidas = await resolverInstalacionesSupervisor(user);
    where.instalacion_id = where.instalacion_id
      ? (permitidas.includes(where.instalacion_id) ? where.instalacion_id : { in: [] })
      : { in: permitidas };
  }

  return prisma.turno.findMany({
    where,
    include: {
      usuario: { select: { id: true, nombre: true, rut: true } },
      instalacion: { select: { id: true, nombre: true } },
    },
    orderBy: { fecha: 'asc' },
  });
};

const obtenerPorId = async (id) => {
  return prisma.turno.findUniqueOrThrow({
    where: { id },
    include: {
      usuario: { select: { id: true, nombre: true, rut: true } },
      instalacion: { select: { id: true, nombre: true, direccion: true } },
    },
  });
};

const crear = async (data, creadoPor) => {
  // Validar conflictos antes de crear
  const conflicto = await buscarConflicto(data);

  if (conflicto) {
    throw Object.assign(new Error(mensajeConflicto(conflicto)), { statusCode: 409 });
  }

  const turno = await prisma.turno.create({
    data: { ...data, fecha: new Date(data.fecha), creado_por: creadoPor },
  });

  try { getSocketIO().emit('admin:dashboard_update', { entity: 'turno' }); } catch (_) {}

  return turno;
};

const crearLote = async (turnos, creadoPor) => {
  const resultados = [];
  for (const turno of turnos) {
    try {
      const creado = await crear(turno, creadoPor);
      resultados.push({ success: true, turno: creado });
    } catch (error) {
      resultados.push({ success: false, error: error.message, datos: turno });
    }
  }
  return resultados;
};

const editar = async (id, data, user) => {
  const actual = await prisma.turno.findUniqueOrThrow({ where: { id } });

  if (actual.estado !== 'programado') {
    throw Object.assign(new Error('Solo se pueden editar turnos en estado programado'), { statusCode: 409 });
  }

  // Solo se aceptan campos de planificación; el resto del body se ignora
  const cambios = {};
  for (const campo of CAMPOS_EDITABLES) {
    if (data[campo] !== undefined && data[campo] !== '') cambios[campo] = data[campo];
  }
  for (const campo of ['hora_inicio', 'hora_fin']) {
    if (cambios[campo] && !HORA_REGEX.test(cambios[campo])) {
      throw Object.assign(new Error(`Formato de hora inválido en ${campo} (HH:MM)`), { statusCode: 400 });
    }
  }

  if (user.rol === ROLES.SUPERVISOR) {
    const permitidas = await resolverInstalacionesSupervisor(user);
    const destino = cambios.instalacion_id ?? actual.instalacion_id;
    if (!permitidas.includes(actual.instalacion_id) || !permitidas.includes(destino)) {
      throw Object.assign(new Error('No tienes acceso a la instalación de este turno'), { statusCode: 403 });
    }
  }

  const final = { ...actual, ...cambios };
  const conflicto = await buscarConflicto({ ...final, excluirId: id });
  if (conflicto) {
    throw Object.assign(new Error(mensajeConflicto(conflicto)), { statusCode: 409 });
  }

  if (cambios.fecha) cambios.fecha = new Date(cambios.fecha);
  // Mantener coherente el tipo nocturno/normal si cambian las horas (los turnos extra no se tocan)
  if ((cambios.hora_inicio || cambios.hora_fin) && actual.tipo_turno !== 'extra') {
    cambios.tipo_turno = final.hora_fin < final.hora_inicio ? 'nocturno' : 'normal';
  }

  const turno = await prisma.turno.update({
    where: { id },
    data: cambios,
    include: {
      usuario: { select: { id: true, nombre: true, rut: true } },
      instalacion: { select: { id: true, nombre: true } },
    },
  });

  try { getSocketIO().emit('admin:dashboard_update', { entity: 'turno' }); } catch (_) {}

  return { turno, anterior: actual, cambios };
};

const cancelar = async (id, motivo, canceladoPor) => {
  if (!motivo) {
    throw Object.assign(new Error('El motivo de cancelación es obligatorio'), { statusCode: 400 });
  }
  return prisma.turno.update({
    where: { id },
    data: { estado: 'cancelado', motivo_cancelacion: motivo },
  });
};

const verificarConflictos = async (query) => {
  const { usuario_id, fecha } = query;
  return prisma.turno.findMany({
    where: {
      usuario_id,
      fecha: new Date(fecha),
      estado: { not: 'cancelado' },
    },
    include: { instalacion: { select: { nombre: true } } },
  });
};

const crearPauta4x4 = async (data, creadoPor) => {
  const { usuario_id, instalacion_id, fecha_inicio, hora_inicio, hora_fin, reemplazar = false } = data;

  const inicio = aFechaDB(fecha_inicio);

  // Detectar si es turno nocturno (hora_fin < hora_inicio → termina al día siguiente)
  const esNocturno = hora_fin < hora_inicio;

  // Calcular las fechas exactas de los 16 días de trabajo (4 bloques × 4 días)
  const fechasTrabajo = [];
  for (let i = 0; i < 32; i++) {
    const diaEnCiclo = (i % 8) + 1; // 1-8
    if (diaEnCiclo > 4) continue;   // días 5-8 son descanso → exactamente 16 días de trabajo
    fechasTrabajo.push(new Date(Date.UTC(
      inicio.getUTCFullYear(),
      inicio.getUTCMonth(),
      inicio.getUTCDate() + i,
      0, 0, 0,
    )));
  }

  // Si reemplazar=true, eliminar todos los turnos existentes (no cancelados)
  // del usuario en el rango completo de 32 días antes de crear los nuevos.
  if (reemplazar) {
    const fechaFin32 = new Date(Date.UTC(
      inicio.getUTCFullYear(),
      inicio.getUTCMonth(),
      inicio.getUTCDate() + 31,
      23, 59, 59,
    ));
    await prisma.turno.deleteMany({
      where: {
        usuario_id,
        fecha: { gte: inicio, lte: fechaFin32 },
        estado: { not: 'cancelado' },
      },
    });
  }

  const turnosACrear = [];
  const omitidos = [];

  for (const fecha of fechasTrabajo) {
    if (!reemplazar) {
      const conflicto = await buscarConflicto({ usuario_id, fecha, hora_inicio, hora_fin });

      if (conflicto) {
        omitidos.push({
          fecha: fecha.toISOString().split('T')[0],
          motivo: mensajeConflicto(conflicto),
        });
        continue;
      }
    }

    turnosACrear.push({
      usuario_id,
      instalacion_id,
      fecha,
      hora_inicio,
      hora_fin,
      tipo_turno: esNocturno ? 'nocturno' : 'normal',
      estado: 'programado',
      creado_por: creadoPor,
    });
  }

  if (turnosACrear.length === 0) {
    return {
      creados: 0,
      omitidos: omitidos.length,
      detalles_omitidos: omitidos,
      turnos: [],
      advertencia: 'No se creó ningún turno. Todos los días presentaron conflictos. Usa "Reemplazar" para sobrescribir.',
    };
  }

  // Insertar en una única transacción atómica
  const creados = await prisma.$transaction(
    turnosACrear.map((turno) => prisma.turno.create({ data: turno })),
  );

  try { getSocketIO().emit('admin:dashboard_update', { entity: 'turno' }); } catch (_) {}

  return {
    creados: creados.length,
    omitidos: omitidos.length,
    detalles_omitidos: omitidos,
    turnos: creados,
    esNocturno,
  };
};

/**
 * Devuelve turnos disponibles (sin guardia asignado) en la instalación
 * asignada al GGSS libre, en los próximos 60 días.
 * Solo aplica cuando el GGSS libre tiene instalacion_asignada_id en su perfil.
 */
const listarDisponibles = async (user) => {
  const fechaHoy = ahoraChile().fecha;
  const hoy = aFechaDB(fechaHoy);
  const en60Dias = aFechaDB(sumarDias(fechaHoy, 60));

  // Obtener instalación asignada del guardia
  const { prisma: db } = require('../config/database');
  const guardia = await db.usuario.findUniqueOrThrow({
    where: { id: user.id },
    select: { instalacion_asignada_id: true },
  });

  if (!guardia.instalacion_asignada_id) {
    throw Object.assign(
      new Error('No tienes instalación asignada. Contacta a tu supervisor.'),
      { statusCode: 400 },
    );
  }

  // Turnos programados en esa instalación sin usuario asignado aún
  // o turnos de tipo "extra" que requieren cobertura
  return prisma.turno.findMany({
    where: {
      instalacion_id: guardia.instalacion_asignada_id,
      fecha: { gte: hoy, lte: en60Dias },
      estado: 'programado',
      tipo_turno: 'extra', // Turnos extra = disponibles para GGSS libre
    },
    include: {
      instalacion: { select: { id: true, nombre: true, direccion: true } },
    },
    orderBy: { fecha: 'asc' },
  });
};

module.exports = { listar, obtenerPorId, crear, crearLote, crearPauta4x4, editar, cancelar, verificarConflictos, listarDisponibles };
