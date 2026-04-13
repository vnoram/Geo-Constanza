const { prisma } = require('../config/database');
const { getSocketIO } = require('../socket/socketManager');

const listar = async (query, user) => {
  const where = {};
  if (query.fecha) where.fecha = new Date(query.fecha);
  if (query.instalacion_id) where.instalacion_id = query.instalacion_id;
  if (query.usuario_id) where.usuario_id = query.usuario_id;

  // GGSS solo ve sus propios turnos
  if (['pauta', 'libre'].includes(user.rol)) {
    where.usuario_id = user.id;
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
  const conflicto = await prisma.turno.findFirst({
    where: {
      usuario_id: data.usuario_id,
      fecha: new Date(data.fecha),
      estado: { not: 'cancelado' },
      OR: [
        { hora_inicio: { lte: data.hora_fin }, hora_fin: { gte: data.hora_inicio } },
      ],
    },
  });

  if (conflicto) {
    throw Object.assign(new Error('Conflicto de turno: el guardia ya tiene un turno asignado en ese horario'), { statusCode: 409 });
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

const editar = async (id, data, editadoPor) => {
  return prisma.turno.update({ where: { id }, data });
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
  const { usuario_id, instalacion_id, fecha_inicio, hora_inicio, hora_fin } = data;

  // Parsear fecha en UTC para evitar desfases de zona horaria
  const [anio, mes, dia] = fecha_inicio.split('-').map(Number);
  const inicio = new Date(Date.UTC(anio, mes - 1, dia));

  const turnosACrear = [];
  const omitidos = [];

  // 32 días = 4 ciclos completos de 8 días (4 trabajo + 4 descanso)
  for (let i = 0; i < 32; i++) {
    const diaEnCiclo = (i % 8) + 1; // 1-8
    if (diaEnCiclo > 4) continue;   // días 5-8 son descanso

    const fecha = new Date(Date.UTC(
      inicio.getUTCFullYear(),
      inicio.getUTCMonth(),
      inicio.getUTCDate() + i,
    ));

    // Verificar si el guardia ya tiene un turno (no cancelado) ese día
    const conflicto = await prisma.turno.findFirst({
      where: {
        usuario_id,
        fecha,
        estado: { not: 'cancelado' },
      },
    });

    if (conflicto) {
      omitidos.push({
        fecha: fecha.toISOString().split('T')[0],
        motivo: 'El guardia ya tiene un turno asignado en esa fecha',
      });
      continue;
    }

    turnosACrear.push({
      usuario_id,
      instalacion_id,
      fecha,
      hora_inicio,
      hora_fin,
      tipo_turno: 'normal',
      estado: 'programado',
      creado_por: creadoPor,
    });
  }

  // Insertar todos los turnos válidos en una única transacción atómica
  const creados = await prisma.$transaction(
    turnosACrear.map((turno) => prisma.turno.create({ data: turno })),
  );

  try { getSocketIO().emit('admin:dashboard_update', { entity: 'turno' }); } catch (_) {}

  return {
    creados: creados.length,
    omitidos: omitidos.length,
    detalles_omitidos: omitidos,
    turnos: creados,
  };
};

module.exports = { listar, obtenerPorId, crear, crearLote, crearPauta4x4, editar, cancelar, verificarConflictos };
