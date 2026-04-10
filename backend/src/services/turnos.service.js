const { prisma } = require('../config/database');

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

  return prisma.turno.create({
    data: { ...data, fecha: new Date(data.fecha), creado_por: creadoPor },
  });
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

module.exports = { listar, obtenerPorId, crear, crearLote, editar, cancelar, verificarConflictos };
