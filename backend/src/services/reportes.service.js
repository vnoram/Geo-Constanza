// src/services/reportes.service.js

const { prisma } = require('../config/database');

const reporteAsistencia = async (query, user) => {
  const { fecha_inicio, fecha_fin, instalacion_id } = query;

  const where = {};
  if (fecha_inicio || fecha_fin) {
    where.fecha_hora = {};
    if (fecha_inicio) where.fecha_hora.gte = new Date(fecha_inicio);
    if (fecha_fin) where.fecha_hora.lte = new Date(fecha_fin);
  }

  if (instalacion_id) {
    where.turno = { instalacion_id };
  }

  const asistencias = await prisma.asistencia.findMany({
    where,
    include: {
      usuario: { select: { id: true, nombre: true, rut: true } },
      turno: {
        include: {
          instalacion: { select: { id: true, nombre: true } },
        },
      },
    },
    orderBy: { fecha_hora: 'desc' },
  });

  return asistencias;
};

const reporteIncidentes = async (query, user) => {
  const { fecha_inicio, fecha_fin, instalacion_id, tipo, urgencia } = query;

  const where = {};
  if (tipo) where.tipo = tipo;
  if (urgencia) where.urgencia = urgencia;
  if (instalacion_id) where.instalacion_id = instalacion_id;
  if (fecha_inicio || fecha_fin) {
    where.created_at = {};
    if (fecha_inicio) where.created_at.gte = new Date(fecha_inicio);
    if (fecha_fin) where.created_at.lte = new Date(fecha_fin);
  }

  const novedades = await prisma.novedad.findMany({
    where,
    include: {
      usuario: { select: { id: true, nombre: true, rut: true } },
      instalacion: { select: { id: true, nombre: true } },
    },
    orderBy: [{ urgencia: 'asc' }, { created_at: 'desc' }],
  });

  return novedades;
};

const exportar = async (tipo, query, user) => {
  // Placeholder: returns empty buffer until PDF/Excel library is integrated
  // tipo: 'pdf' | 'excel'
  return Buffer.alloc(0);
};

module.exports = { reporteAsistencia, reporteIncidentes, exportar };
