// src/services/solicitudes.service.js

const { prisma } = require('../config/database');
const { ROLES } = require('../constants/roles');
const { enviarNotificacion } = require('./notificacion.service');
const { exigirAlcanceInstalacion, resolverInstalacionesSupervisor } = require('./supervisor.helper');
const { TIPOS_COBERTURA } = require('../constants/solicitudes');
const { ahoraChile, aFechaDB } = require('../utils/fechaChile');
const { uploadAdjuntoToAzure, generarUrlLectura } = require('../utils/azureStorage');

// El contenedor es privado: el cliente recibe un link temporal, nunca la URL guardada.
const conAdjuntoFirmado = async ({ adjunto_url, ...resto }) => ({
  ...resto,
  adjunto_url_firmada: adjunto_url ? await generarUrlLectura(adjunto_url) : null,
});

const MAX_FECHAS = 31;
const FECHA_ISO = /^\d{4}-\d{2}-\d{2}$/;

/** Acepta un arreglo (o su JSON en multipart) de fechas YYYY-MM-DD; devuelve ordenado y sin repetidas, o null. */
function normalizarFechas(valor) {
  if (valor === undefined || valor === null || valor === '') return null;
  let lista = valor;
  if (typeof valor === 'string') {
    try { lista = JSON.parse(valor); } catch { lista = null; }
  }
  const invalida = () => Object.assign(new Error(`Indica entre 1 y ${MAX_FECHAS} fechas válidas (AAAA-MM-DD)`), { statusCode: 400 });
  if (!Array.isArray(lista) || lista.length === 0 || lista.length > MAX_FECHAS) throw invalida();
  if (!lista.every(f => typeof f === 'string' && FECHA_ISO.test(f) && !Number.isNaN(Date.parse(f)))) throw invalida();
  return [...new Set(lista)].sort();
}

/** [['2026-12-01','2026-12-03'], ...] a partir de fechas ordenadas. */
function agruparConsecutivas(fechas) {
  const dia = 86_400_000;
  const tramos = [];
  for (const f of fechas) {
    const ultimo = tramos[tramos.length - 1];
    if (ultimo && Date.parse(f) - Date.parse(ultimo[1]) === dia) ultimo[1] = f;
    else tramos.push([f, f]);
  }
  return tramos;
}

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

  if (user.rol === ROLES.GGSS) {
    // Guardia solo ve sus propias solicitudes
    where.usuario_id = user.id;
  } else if (user.rol === ROLES.SUPERVISOR) {
    // Supervisor ve solicitudes de GGSS de su(s) instalación(es): las mismas que ve en el resto de la app
    // (asignaciones directas, cobertura por comunas o instalación propia)
    const instalacionIds = await resolverInstalacionesSupervisor(user);

    // GGSS que trabajan en esas instalaciones
    const guardias = await prisma.usuario.findMany({
      where: {
        OR: [
          { instalacion_asignada_id: { in: instalacionIds } },
          { turnos: { some: { instalacion_id: { in: instalacionIds } } } },
        ],
        rol: { in: [ROLES.GGSS] },
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

  return { data: await Promise.all(data.map(conAdjuntoFirmado)), total, page: +page, totalPages: Math.ceil(total / +limit) };
};

/**
 * Crea una solicitud. Solo para GGSS libre o pauta.
 */
const crear = async (body, userId, archivo) => {
  const { tipo, fecha_hasta, motivo } = body;
  const fechas = normalizarFechas(body.fechas);
  const fecha_desde = body.fecha_desde ?? fechas?.[0];

  if (!tipo || !fecha_desde) {
    throw Object.assign(new Error('Los campos tipo y fecha_desde son obligatorios'), { statusCode: 400 });
  }

  if (!TIPOS_VALIDOS.includes(tipo)) {
    throw Object.assign(
      new Error(`Tipo inválido. Valores permitidos: ${TIPOS_VALIDOS.join(', ')}`),
      { statusCode: 400 },
    );
  }

  let adjunto_url = null;
  if (archivo) {
    try {
      adjunto_url = await uploadAdjuntoToAzure(archivo.buffer, { usuarioId: userId });
    } catch (err) {
      if (err.statusCode) throw err;
      throw Object.assign(new Error('No se pudo guardar el adjunto. Intenta nuevamente.'), { statusCode: 503 });
    }
  }

  const comunes = {
    usuario_id: userId,
    adjunto_url,
    adjunto_nombre: archivo ? String(archivo.originalname || 'adjunto').slice(0, 100) : null,
    tipo,
    motivo: motivo || null,
    estado: 'pendiente',
  };
  const include = { usuario: { select: { id: true, nombre: true, rut: true } } };

  // Varias fechas sueltas: un turno extra por día; en ausencias, los días consecutivos forman un solo tramo.
  if (fechas) {
    if (!['dias_libres', 'turno_extra'].includes(tipo)) {
      throw Object.assign(new Error('Solo las ausencias y los turnos extra admiten varias fechas'), { statusCode: 400 });
    }
    const tramos = tipo === 'turno_extra' ? fechas.map(f => [f, f]) : agruparConsecutivas(fechas);
    const creadas = await prisma.$transaction(tramos.map(([desde, hasta]) => prisma.solicitud.create({
      data: { ...comunes, fecha_desde: new Date(desde), fecha_hasta: hasta !== desde ? new Date(hasta) : null },
      include,
    })));
    return Promise.all(creadas.map(conAdjuntoFirmado));
  }

  const creada = await prisma.solicitud.create({
    data: {
      ...comunes,
      fecha_desde: new Date(fecha_desde),
      fecha_hasta: fecha_hasta ? new Date(fecha_hasta) : null,
    },
    include,
  });
  return conAdjuntoFirmado(creada);
};

/**
 * Aprueba una solicitud. Solo supervisor (sobre sus GGSS) o admin.
 */
const aprobar = async (id, supervisorId, comentario, user) => {
  const solicitud = await prisma.solicitud.findUniqueOrThrow({ where: { id } });
  await exigirAlcanceSolicitud(solicitud, user);

  if (solicitud.estado !== 'pendiente') {
    throw Object.assign(new Error('Solo se pueden aprobar solicitudes en estado pendiente'), { statusCode: 409 });
  }

  const actualizada = solicitud.vacante_turno_id
    ? await require('./cobertura.service').aprobarCobertura(id, supervisorId, comentario)
    : await prisma.solicitud.update({
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
  if (TIPOS_COBERTURA.includes(solicitud.tipo)) {
    await enviarNotificacion(solicitud.usuario_id, 'Solicitud de cobertura aprobada', comentario || 'Tu solicitud fue aprobada.', { solicitud_id: id });
  }
  return actualizada;
};

// Un supervisor solo revisa solicitudes de su alcance: la instalación del turno
// vacante o, si no hay, la instalación del solicitante.
const exigirAlcanceSolicitud = async (solicitud, user) => {
  if (user?.rol !== ROLES.SUPERVISOR) return;
  let instalacionId = null;
  if (solicitud.vacante_turno_id) {
    const turno = await prisma.turno.findUnique({ where: { id: solicitud.vacante_turno_id }, select: { instalacion_id: true } });
    instalacionId = turno?.instalacion_id || null;
  }
  if (!instalacionId) {
    const autor = await prisma.usuario.findUnique({ where: { id: solicitud.usuario_id }, select: { instalacion_asignada_id: true } });
    instalacionId = autor?.instalacion_asignada_id || null;
  }
  await exigirAlcanceInstalacion(user, instalacionId);
};

/**
 * Rechaza una solicitud. Solo supervisor o admin.
 */
const rechazar = async (id, motivo, supervisorId, user) => {
  const solicitud = await prisma.solicitud.findUniqueOrThrow({ where: { id } });
  await exigirAlcanceSolicitud(solicitud, user);

  if (solicitud.estado !== 'pendiente') {
    throw Object.assign(new Error('Solo se pueden rechazar solicitudes en estado pendiente'), { statusCode: 409 });
  }

  const actualizada = await prisma.solicitud.update({
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
  if (TIPOS_COBERTURA.includes(solicitud.tipo)) {
    await enviarNotificacion(solicitud.usuario_id, 'Solicitud de cobertura rechazada', motivo || 'Tu solicitud fue rechazada.', { solicitud_id: id });
  }
  return actualizada;
};

/**
 * Verifica si un GGSS libre tiene una solicitud de turno aprobada para la fecha dada.
 * Usado por novedades y asistencia para validar acceso.
 */
const tieneturnoAprobadoHoy = async (usuarioId) => {
  const fechaHoy = aFechaDB(ahoraChile().fecha);

  const solicitud = await prisma.solicitud.findFirst({
    where: {
      usuario_id: usuarioId,
      tipo: { in: TIPOS_COBERTURA },
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

module.exports = { listar, crear, aprobar, rechazar, tieneturnoAprobadoHoy, normalizarFechas, agruparConsecutivas };
