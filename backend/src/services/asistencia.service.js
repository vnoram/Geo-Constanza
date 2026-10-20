const { prisma } = require('../config/database');
const { getSocketIO } = require('../socket/socketManager');
const geovalidacion = require('./geovalidacion.service');
const notificacion = require('./notificacion.service');
const { ROLES } = require('../constants/roles');
const { MIN_MS, DIA_MS, inicioTurno, finTurno, diaUTC } = require('../utils/tiempo');

const TOLERANCIA_MINUTOS = 15;
const ATRASO_MINUTOS = 10;

/**
 * Elige el turno vigente en `ahora` entre varios candidatos.
 * Vigente = desde TOLERANCIA_MINUTOS antes del inicio hasta el fin del turno.
 * Si hay más de uno (turnos seguidos), gana el que empezó más recientemente.
 */
const seleccionarTurno = (candidatos, ahora) => {
  const vigentes = candidatos
    .map((t) => ({ t, inicio: inicioTurno(t), fin: finTurno(t) }))
    .filter(({ inicio, fin }) => ahora.getTime() >= inicio.getTime() - TOLERANCIA_MINUTOS * MIN_MS && ahora < fin)
    .sort((a, b) => b.inicio - a.inicio);
  return vigentes.length > 0 ? vigentes[0].t : null;
};

/**
 * Entrada desde TABLET (dispositivo fijo en instalación).
 * Solo GGSS en pauta. El flag es_fallback = false, dispositivo_usado = 'tablet'.
 */
const registrarEntradaTablet = async (data, user) => {
  return registrarEntrada({ ...data, metodo: 'tablet', dispositivo: 'tablet' }, user, false);
};

/**
 * Entrada desde MÓVIL (fallback cuando la tablet no está disponible).
 * - GGSS en pauta: siempre puede, flag es_fallback = true.
 * - GGSS libre: SOLO si tiene solicitud de turno aprobada para hoy.
 */
const registrarEntradaFallback = async (data, user) => {
  if (user.rol === ROLES.GGSS_LIBRE) {
    const { tieneturnoAprobadoHoy } = require('./solicitudes.service');
    const tieneAprobado = await tieneturnoAprobadoHoy(user.id);
    if (!tieneAprobado) {
      throw Object.assign(
        new Error('No tienes un turno aprobado para hoy. Solicita un turno a tu supervisor.'),
        { statusCode: 403 },
      );
    }
  }
  return registrarEntrada({ ...data, metodo: 'fallback_telefono', dispositivo: 'mobil_empresa' }, user, true);
};

const registrarEntrada = async (data, user, esFallbackOverride = null) => {
  const { instalacion_id, metodo, latitud, longitud, qr_code, dispositivo } = data;
  const usuario_id = user?.id || data.usuario_id;

  const ahora = new Date();

  // Candidatos: turnos del usuario en la instalación con fecha cercana (la columna
  // `fecha` es un día de calendario, no un instante). Entre ellos se elige el que
  // está vigente ahora, comparando con la hora de Chile (ver utils/tiempo.js).
  const candidatos = await prisma.turno.findMany({
    where: {
      usuario_id,
      instalacion_id,
      fecha: { gte: diaUTC(new Date(ahora.getTime() - 2 * DIA_MS)), lte: diaUTC(new Date(ahora.getTime() + DIA_MS)) },
      estado: { not: 'cancelado' },
    },
    include: { instalacion: true },
  });
  const turno = seleccionarTurno(candidatos, ahora);

  if (!turno) {
    const fechaChile = ahora.toLocaleString('es-CL', { timeZone: 'America/Santiago', hour12: false });
    throw Object.assign(
      new Error(
        `No tienes un turno vigente en esta instalación. ` +
        `Hora actual: ${fechaChile} (hora de Chile). ` +
        `Puedes marcar desde ${TOLERANCIA_MINUTOS} min antes del inicio hasta el fin del turno.`,
      ),
      { statusCode: 400 },
    );
  }

  // Idempotencia: si ya existe una asistencia abierta para este turno, devolverla.
  // Esto evita registros duplicados cuando el guardia pulsa el botón dos veces
  // o cuando el componente re-monta tras un F5 justo en el momento del marcaje.
  const asistenciaAbierta = await prisma.asistencia.findFirst({
    where: { usuario_id, turno_id: turno.id, hora_salida: null },
  });
  if (asistenciaAbierta) return asistenciaAbierta;

  // Convertir coordenadas a número (pueden llegar como string desde JSON del body)
  const lat = latitud  != null ? parseFloat(latitud)  : null;
  const lon = longitud != null ? parseFloat(longitud) : null;

  // Validar geofence: aplica cuando se envían coordenadas válidas
  if (lat != null && lon != null && !isNaN(lat) && !isNaN(lon)) {
    const instLat = parseFloat(turno.instalacion.latitud);
    const instLon = parseFloat(turno.instalacion.longitud);
    const { esValido, distanciaMetros } = geovalidacion.validarAsistencia(
      lat, lon, instLat, instLon,
      turno.instalacion.radio_geofence_m,
    );
    if (!esValido) {
      throw Object.assign(
        new Error(`Fuera de rango: Debe estar en la instalación para marcar (${distanciaMetros}m del límite permitido de ${turno.instalacion.radio_geofence_m}m)`),
        { statusCode: 400 },
      );
    }
  }

  // Minutos de retraso respecto del inicio del turno en hora de Chile.
  const inicioDelTurno = inicioTurno(turno);
  const diffMin = Math.floor((ahora - inicioDelTurno) / MIN_MS);
  const minutosRetraso = Math.max(0, diffMin);
  const estado = minutosRetraso > ATRASO_MINUTOS ? 'tardio' : 'normal';

  const esFallback = esFallbackOverride !== null
    ? esFallbackOverride
    : metodo === 'fallback_telefono';

  const asistencia = await prisma.asistencia.create({
    data: {
      usuario_id,
      turno_id: turno.id,
      instalacion_id,
      hora_entrada: ahora,
      metodo_entrada: metodo,
      estado,
      minutos_retraso: minutosRetraso,
      latitud_entrada:  lat,
      longitud_entrada: lon,
      es_fallback: esFallback,
      dispositivo_usado: dispositivo || (metodo === 'fallback_telefono' ? 'mobil_empresa' : 'tablet'),
    },
  });

  // Emitir evento WebSocket (no crítico — no bloquea el registro si falla)
  try {
    const io = getSocketIO();
    io.to(`instalacion:${instalacion_id}`).emit('guardia:entrada', {
      guardia: usuario_id,
      instalacion: instalacion_id,
      hora: ahora,
      estado,
      es_fallback: esFallback,
    });
    // Alerta al supervisor si fue entrada fallback
    if (esFallback) {
      io.to(`instalacion:${instalacion_id}`).emit('guardia:entrada_fallback', {
        guardia: usuario_id,
        instalacion: instalacion_id,
        hora: ahora,
        mensaje: 'El guardia marcó entrada desde dispositivo móvil (fallback)',
      });
    }
    if (estado === 'tardio') {
      io.to(`instalacion:${instalacion_id}`).emit('guardia:atraso', {
        guardia: usuario_id,
        instalacion: instalacion_id,
        minutos_retraso: minutosRetraso,
      });
    }
    // Publicar ubicación GPS del guardia para el mapa del admin (solo si hay coords)
    if (lat != null && lon != null && !isNaN(lat) && !isNaN(lon)) {
      io.emit('guardia:ubicacion', {
        guardia_id: usuario_id,
        instalacion_id,
        latitud: lat,
        longitud: lon,
        hora: ahora,
        estado,
      });
    }
    // Notificar al panel admin global
    io.emit('admin:dashboard_update', { entity: 'asistencia' });
  } catch (_) {
    // Socket.IO no disponible — el registro se guarda igual
  }

  return asistencia;
};

const registrarSalida = async (data, user) => {
  const { asistencia_id, metodo, latitud, longitud } = data;

  const asistencia = await prisma.asistencia.findUniqueOrThrow({ where: { id: asistencia_id }, include: { turno: true } });

  const ahora = new Date();
  const horasTrabajadas = (ahora - new Date(asistencia.hora_entrada)) / 3600000;

  // Calcular horas extra
  // El fin se calcula en hora de Chile; los turnos nocturnos terminan al día siguiente.
  const horasExtra = Math.max(0, (ahora - finTurno(asistencia.turno)) / 3600000);

  const actualizada = await prisma.asistencia.update({
    where: { id: asistencia_id },
    data: {
      hora_salida: ahora,
      metodo_salida: metodo,
      horas_trabajadas: parseFloat(horasTrabajadas.toFixed(2)),
      horas_extra: parseFloat(horasExtra.toFixed(2)),
    },
  });

  // Notificar al panel admin global
  try {
    getSocketIO().emit('admin:dashboard_update', { entity: 'asistencia' });
  } catch (_) {}

  return actualizada;
};

const obtenerHoy = async (instalacionId) => {
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  const manana = new Date(hoy);
  manana.setDate(manana.getDate() + 1);

  return prisma.asistencia.findMany({
    where: {
      instalacion_id: instalacionId,
      created_at: { gte: hoy, lt: manana },
    },
    include: {
      usuario: { select: { id: true, nombre: true, rut: true } },
      turno: { select: { hora_inicio: true, hora_fin: true, tipo_turno: true } },
    },
    orderBy: { hora_entrada: 'desc' },
  });
};

const obtenerHistorial = async (usuarioId, query) => {
  const { fecha_inicio, fecha_fin, page = 1, limit = 20 } = query;
  const where = { usuario_id: usuarioId };

  if (fecha_inicio || fecha_fin) {
    where.created_at = {};
    if (fecha_inicio) where.created_at.gte = new Date(fecha_inicio);
    if (fecha_fin) where.created_at.lte = new Date(fecha_fin);
  }

  const [data, total] = await Promise.all([
    prisma.asistencia.findMany({
      where,
      include: { instalacion: { select: { nombre: true } }, turno: { select: { hora_inicio: true, hora_fin: true } } },
      orderBy: { created_at: 'desc' },
      skip: (+page - 1) * +limit,
      take: +limit,
    }),
    prisma.asistencia.count({ where }),
  ]);

  return { data, total, page: +page, totalPages: Math.ceil(total / +limit) };
};

// Horas máximas que una asistencia puede estar abierta antes de considerarse vencida.
// Si un guardia olvidó marcar salida, al día siguiente puede volver a entrar.
const MAX_HORAS_ABIERTA = 14;

/**
 * Devuelve el estado de asistencia activo del usuario autenticado.
 *
 * Respuesta posible:
 *   { activo: false }                         — sin entrada abierta
 *   { activo: false, vencido: true }          — había una pero fue auto-cerrada (>14 h)
 *   { activo: true, asistencia_id, hora_entrada, estado,
 *     minutos_retraso, turno_id, turno, instalacion }
 */
const obtenerEstadoActual = async (usuarioId) => {
  const abierta = await prisma.asistencia.findFirst({
    where: { usuario_id: usuarioId, hora_salida: null },
    include: {
      turno: {
        select: {
          id: true, hora_inicio: true, hora_fin: true,
          tipo_turno: true, fecha: true, instalacion_id: true,
          instalacion: { select: { id: true, nombre: true, direccion: true } },
        },
      },
    },
    orderBy: { hora_entrada: 'desc' },
  });

  if (!abierta) return { activo: false };

  // Calcular cuántas horas lleva abierta
  const horasAbiertas = (Date.now() - new Date(abierta.hora_entrada).getTime()) / 3_600_000;

  if (horasAbiertas > MAX_HORAS_ABIERTA) {
    // Auto-cerrar la asistencia vencida para desbloquear al guardia
    await prisma.asistencia.update({
      where: { id: abierta.id },
      data: {
        hora_salida:     new Date(),
        horas_trabajadas: parseFloat(horasAbiertas.toFixed(2)),
        horas_extra:     0,
      },
    });

    try { getSocketIO().emit('admin:dashboard_update', { entity: 'asistencia' }); } catch (_) {}

    return { activo: false, vencido: true };
  }

  return {
    activo:          true,
    asistencia_id:   abierta.id,
    hora_entrada:    abierta.hora_entrada,
    estado:          abierta.estado,
    minutos_retraso: abierta.minutos_retraso,
    turno_id:        abierta.turno_id,
    instalacion_id:  abierta.instalacion_id,
    turno:           abierta.turno,
    instalacion:     abierta.turno?.instalacion ?? null,
  };
};

const sincronizarBatch = async (registros) => {
  const resultados = [];
  for (const registro of registros) {
    try {
      const result = await prisma.asistencia.create({ data: registro });
      resultados.push({ success: true, id: result.id });
    } catch (error) {
      resultados.push({ success: false, error: error.message });
    }
  }
  return resultados;
};

module.exports = {
  registrarEntrada,
  registrarEntradaTablet,
  registrarEntradaFallback,
  registrarSalida,
  obtenerHoy,
  obtenerHistorial,
  obtenerEstadoActual,
  sincronizarBatch,
  seleccionarTurno,
};
