const { prisma } = require('../config/database');
const { getSocketIO } = require('../socket/socketManager');
const priorizacion = require('./priorizacion.service');

const listar = async (query, user) => {
  const { instalacion_id, tipo, urgencia, estado, fecha_inicio, fecha_fin } = query;
  const where = {};

  if (instalacion_id) where.instalacion_id = instalacion_id;
  if (tipo) where.tipo = tipo;
  if (urgencia) where.urgencia = urgencia;
  if (estado) where.estado = estado;
  if (fecha_inicio || fecha_fin) {
    where.created_at = {};
    if (fecha_inicio) where.created_at.gte = new Date(fecha_inicio);
    if (fecha_fin) where.created_at.lte = new Date(fecha_fin);
  }

  return prisma.novedad.findMany({
    where,
    include: {
      usuario: { select: { id: true, nombre: true } },
      instalacion: { select: { id: true, nombre: true } },
    },
    orderBy: [{ urgencia: 'asc' }, { created_at: 'desc' }],
  });
};

const obtenerPorId = async (id, user) => {
  return prisma.novedad.findUniqueOrThrow({
    where: { id },
    include: {
      usuario: { select: { id: true, nombre: true, telefono: true } },
      instalacion: { select: { id: true, nombre: true } },
    },
  });
};

const crear = async (data, file, user) => {
  const { tipo, descripcion, latitud, longitud } = data;

  // Obtener turno activo del guardia
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  const turno = await prisma.turno.findFirst({
    where: { usuario_id: user.id, fecha: hoy, estado: { not: 'cancelado' } },
    include: { instalacion: true },
  });

  if (!turno) {
    throw Object.assign(new Error('No tienes un turno activo para reportar novedades'), { statusCode: 400 });
  }

  // Calcular urgencia con matriz priorización
  const urgencia = priorizacion.calcularUrgencia(tipo, turno.instalacion.nivel_criticidad);

  let foto_url = null;
  if (file) {
    // TODO: Subir foto a S3 y obtener URL
    foto_url = `uploads/novedades/${Date.now()}_${file.originalname}`;
  }

  const novedad = await prisma.novedad.create({
    data: {
      usuario_id: user.id,
      instalacion_id: turno.instalacion_id,
      turno_id: turno.id,
      tipo,
      descripcion,
      urgencia,
      foto_url,
      latitud: parseFloat(latitud),
      longitud: parseFloat(longitud),
    },
  });

  // Emitir WebSocket
  const io = getSocketIO();
  if (io) {
    io.to(`instalacion:${turno.instalacion_id}`).emit('novedad:nueva', {
      id: novedad.id,
      tipo,
      urgencia,
      guardia: user.id,
      instalacion: turno.instalacion_id,
    });
  }

  return novedad;
};

const resolver = async (id, comentario, supervisorId) => {
  return prisma.novedad.update({
    where: { id },
    data: {
      estado: 'resuelta',
      comentario_cierre: comentario,
      atendida_por: supervisorId,
      fecha_atencion: new Date(),
    },
  });
};

const escalar = async (id, supervisorId) => {
  const novedad = await prisma.novedad.update({
    where: { id },
    data: { estado: 'escalada' },
  });

  const io = getSocketIO();
  if (io) {
    io.emit('novedad:escalada', {
      id: novedad.id,
      tipo: novedad.tipo,
      urgencia: novedad.urgencia,
      instalacion: novedad.instalacion_id,
    });
  }

  return novedad;
};

module.exports = { listar, obtenerPorId, crear, resolver, escalar };
