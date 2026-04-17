// src/services/solicitudes.service.js

const { prisma } = require('../config/database');

const TIPOS_VALIDOS = ['vacaciones', 'dias_libres', 'turno_extra', 'traslado', 'turno'];

/**
 * Lista solicitudes.
 * - GGSS (pauta/libre): solo las propias
 * - Supervisor: las de sus GGSS (filtradas por instalación asignada)
 * - Central/Admin: todas
 */
const listar = async (query, user) => {
  const { estado, tipo, page = 1, limit = 20 } = query;
  const where = {};

  if (estado) where.estado = estado;
  if (tipo) where.tipo = tipo;

  if (user.rol === 'pauta' || user.rol === 'libre') {
    // Guardia solo ve sus propias solicitudes
    where.usuario_id = user.id;
  } else if (user.rol === 'supervisor') {
    // Supervisor ve solicitudes de GGSS de su(s) instalación(es)
    const asignaciones = await prisma.supervisor_Instalacion.findMany({
      where: { supervisor_id: user.id },
      select: { instalacion_id: true },
    });
    const instalacionIds = asignaciones.map(a => a.instalacion_id);

    // GGSS que trabajan en esas instalaciones
    const guardias = await prisma.usuario.findMany({
      where: {
        instalacion_asignada_id: { in: instalacionIds },
        rol: { in: ['pauta', 'libre'] },
      },
      select: { id: true },
    });
    where.usuario_id = { in: guardias.map(g => g.id) };
  }
  // central y admin no tienen filtro extra

  const skip = (+page - 1) * +limit;
  const [data, total] = await Promise.all([
    prisma.solicitud.findMany({
      where,
      include: {
        usuario: { select: { id: true, nombre: true, rut: true } },
        revisor: { select: { id: true, nombre: true } },
      },
      orderBy: { created_at: 'desc' },
      skip,
      take: +limit,
    }),
    prisma.solicitud.count({ where }),
  ]);

  return { data, total, page: +page, totalPages: Math.ceil(total / +limit) };
};

/**
 * Crea una solicitud. Solo para GGSS libre o pauta.
 */
const crear = async (body, userId) => {
  const { tipo, fecha_desde, fecha_hasta, motivo } = body;

  if (!tipo || !fecha_desde) {
    throw Object.assign(new Error('Los campos tipo y fecha_desde son obligatorios'), { statusCode: 400 });
  }

  if (!TIPOS_VALIDOS.includes(tipo)) {
    throw Object.assign(
      new Error(`Tipo inválido. Valores permitidos: ${TIPOS_VALIDOS.join(', ')}`),
      { statusCode: 400 },
    );
  }

  return prisma.solicitud.create({
    data: {
      usuario_id: userId,
      tipo,
      fecha_desde: new Date(fecha_desde),
      fecha_hasta: fecha_hasta ? new Date(fecha_hasta) : null,
      motivo: motivo || null,
      estado: 'pendiente',
    },
    include: {
      usuario: { select: { id: true, nombre: true, rut: true } },
    },
  });
};

/**
 * Aprueba una solicitud. Solo supervisor (sobre sus GGSS) o admin.
 */
const aprobar = async (id, supervisorId, comentario) => {
  const solicitud = await prisma.solicitud.findUniqueOrThrow({ where: { id } });

  if (solicitud.estado !== 'pendiente') {
    throw Object.assign(new Error('Solo se pueden aprobar solicitudes en estado pendiente'), { statusCode: 409 });
  }

  return prisma.solicitud.update({
    where: { id },
    data: {
      estado: 'aprobada',
      revisada_por: supervisorId,
      comentario_revision: comentario || null,
    },
    include: {
      usuario: { select: { id: true, nombre: true } },
      revisor: { select: { id: true, nombre: true } },
    },
  });
};

/**
 * Rechaza una solicitud. Solo supervisor o admin.
 */
const rechazar = async (id, motivo, supervisorId) => {
  const solicitud = await prisma.solicitud.findUniqueOrThrow({ where: { id } });

  if (solicitud.estado !== 'pendiente') {
    throw Object.assign(new Error('Solo se pueden rechazar solicitudes en estado pendiente'), { statusCode: 409 });
  }

  return prisma.solicitud.update({
    where: { id },
    data: {
      estado: 'rechazada',
      revisada_por: supervisorId,
      comentario_revision: motivo || null,
    },
    include: {
      usuario: { select: { id: true, nombre: true } },
      revisor: { select: { id: true, nombre: true } },
    },
  });
};

/**
 * Verifica si un GGSS libre tiene una solicitud de turno aprobada para la fecha dada.
 * Usado por novedades y asistencia para validar acceso.
 */
const tieneturnoAprobadoHoy = async (usuarioId) => {
  const hoy = new Date();
  const fechaHoy = new Date(Date.UTC(hoy.getFullYear(), hoy.getMonth(), hoy.getDate()));

  const solicitud = await prisma.solicitud.findFirst({
    where: {
      usuario_id: usuarioId,
      tipo: { in: ['turno', 'turno_extra'] },
      estado: 'aprobada',
      fecha_desde: { lte: fechaHoy },
      OR: [
        { fecha_hasta: null },
        { fecha_hasta: { gte: fechaHoy } },
      ],
    },
  });

  return solicitud !== null;
};

module.exports = { listar, crear, aprobar, rechazar, tieneturnoAprobadoHoy };
