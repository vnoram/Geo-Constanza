const { prisma } = require('../config/database');
const { getSocketIO } = require('../socket/socketManager');
const priorizacion = require('./priorizacion.service');
const geovalidacion = require('./geovalidacion.service');
const { resolverInstalacionesSupervisor } = require('./supervisor.helper');

const listar = async (query, user) => {
  const { instalacion_id, tipo, urgencia, estado, fecha_inicio, fecha_fin, page = 1, limit = 50 } = query;
  const where = {};

  if (tipo) where.tipo = tipo;
  if (urgencia) where.urgencia = urgencia;
  if (estado) where.estado = estado;
  if (fecha_inicio || fecha_fin) {
    where.created_at = {};
    if (fecha_inicio) where.created_at.gte = new Date(fecha_inicio);
    if (fecha_fin) where.created_at.lte = new Date(fecha_fin);
  }

  if (user.rol === 'pauta' || user.rol === 'libre') {
    // Guardias: solo ven sus propias novedades
    where.usuario_id = user.id;
  } else if (user.rol === 'supervisor') {
    // Supervisor: instalaciones directas + comunas de cobertura (ver supervisor.helper.js)
    const ids = await resolverInstalacionesSupervisor(user);
    where.instalacion_id = instalacion_id ? instalacion_id : { in: ids };
  } else if (instalacion_id) {
    // Central/Admin pueden filtrar por instalación explícita
    where.instalacion_id = instalacion_id;
  }

  const skip = (+page - 1) * +limit;
  const [data, total] = await Promise.all([
    prisma.novedad.findMany({
      where,
      include: {
        usuario: { select: { id: true, nombre: true } },
        instalacion: { select: { id: true, nombre: true } },
      },
      orderBy: [{ urgencia: 'asc' }, { created_at: 'desc' }],
      skip,
      take: +limit,
    }),
    prisma.novedad.count({ where }),
  ]);

  return { data, total, page: +page, totalPages: Math.ceil(total / +limit) };
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

  // GGSS libre: validar que tenga solicitud de turno aprobada para hoy
  if (!turno && user.rol === 'libre') {
    const { tieneturnoAprobadoHoy } = require('./solicitudes.service');
    const tieneAprobado = await tieneturnoAprobadoHoy(user.id);
    if (!tieneAprobado) {
      throw Object.assign(
        new Error('No tienes un turno aprobado para hoy. Solo puedes reportar novedades durante un turno activo.'),
        { statusCode: 403 },
      );
    }
  }

  if (!turno) {
    throw Object.assign(new Error('No tienes un turno activo para reportar novedades'), { statusCode: 400 });
  }

  // ── Validación geográfica ─────────────────────────────────────
  // Determina si el guardia está dentro del radio de la instalación al momento del reporte.
  let gps_dentro_rango = null;
  const lat = parseFloat(latitud);
  const lon = parseFloat(longitud);
  if (!isNaN(lat) && !isNaN(lon)) {
    const geoResult = geovalidacion.validarAsistencia(
      lat,
      lon,
      turno.instalacion.latitud,
      turno.instalacion.longitud,
      turno.instalacion.radio_geofence_m,
    );
    gps_dentro_rango = geoResult.esValido;
  }

  // ── Urgencia ──────────────────────────────────────────────────
  const urgencia = priorizacion.evaluarUrgencia(tipo);

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
      latitud: isNaN(lat) ? null : lat,
      longitud: isNaN(lon) ? null : lon,
      gps_dentro_rango,
    },
  });

  // ── Eventos WebSocket ─────────────────────────────────────────
  try {
    const io = getSocketIO();

    // Notificar a supervisores de la instalación
    io.to(`instalacion:${turno.instalacion_id}`).emit('novedad:nueva', {
      id: novedad.id,
      tipo,
      urgencia,
      gps_dentro_rango,
      guardia: { id: user.id, nombre: user.nombre },
      instalacion_id: turno.instalacion_id,
      instalacion_nombre: turno.instalacion.nombre,
      created_at: novedad.created_at,
    });

    // Notificar al panel admin global
    io.emit('admin:dashboard_update', { entity: 'novedad' });

    // Escalamiento crítico: urgencia roja + instalación de alta criticidad
    if (urgencia === 'rojo' && turno.instalacion.nivel_criticidad === 'Alta') {
      io.emit('alerta_critica_central', {
        id: novedad.id,
        tipo,
        urgencia,
        descripcion,
        gps_dentro_rango,
        guardia: { id: user.id, nombre: user.nombre },
        instalacion: {
          id: turno.instalacion_id,
          nombre: turno.instalacion.nombre,
          nivel_criticidad: turno.instalacion.nivel_criticidad,
        },
        created_at: novedad.created_at,
      });
    }
  } catch (_) {}

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

  try {
    const io = getSocketIO();
    io.emit('novedad:escalada', {
      id: novedad.id,
      tipo: novedad.tipo,
      urgencia: novedad.urgencia,
      instalacion: novedad.instalacion_id,
    });
  } catch (_) {}

  return novedad;
};

module.exports = { listar, obtenerPorId, crear, resolver, escalar };
