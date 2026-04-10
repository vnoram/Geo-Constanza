// src/services/solicitudes.service.js

const { prisma } = require('../config/database');

const listar = async (query, user) => {
  const { estado, tipo } = query;
  const where = {};

  if (estado) where.estado = estado;
  if (tipo) where.tipo = tipo;

  // Guardias solo ven sus propias solicitudes
  if (user.rol === 'guardia' || user.rol === 'pauta' || user.rol === 'libre') {
    where.usuario_id = user.id;
  }

  return prisma.solicitud.findMany({
    where,
    include: {
      usuario: { select: { id: true, nombre: true, rut: true } },
    },
    orderBy: { created_at: 'desc' },
  });
};

const crear = async (body, userId) => {
  const { tipo, fecha_inicio, fecha_fin, descripcion } = body;

  if (!tipo || !fecha_inicio) {
    throw Object.assign(new Error('Tipo y fecha de inicio son requeridos'), { statusCode: 400 });
  }

  return prisma.solicitud.create({
    data: {
      usuario_id: userId,
      tipo,
      fecha_inicio: new Date(fecha_inicio),
      fecha_fin: fecha_fin ? new Date(fecha_fin) : null,
      descripcion,
      estado: 'pendiente',
    },
  });
};

const aprobar = async (id, supervisorId) => {
  return prisma.solicitud.update({
    where: { id },
    data: {
      estado: 'aprobada',
      revisada_por: supervisorId,
      fecha_revision: new Date(),
    },
  });
};

const rechazar = async (id, motivo, supervisorId) => {
  return prisma.solicitud.update({
    where: { id },
    data: {
      estado: 'rechazada',
      motivo_rechazo: motivo,
      revisada_por: supervisorId,
      fecha_revision: new Date(),
    },
  });
};

module.exports = { listar, crear, aprobar, rechazar };
