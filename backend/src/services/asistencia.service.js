const { prisma } = require('../config/database');
const { getSocketIO } = require('../socket/socketManager');
const geovalidacion = require('./geovalidacion.service');
const notificacion = require('./notificacion.service');

const TOLERANCIA_MINUTOS = 15;
const ATRASO_MINUTOS = 10;

const registrarEntrada = async (data, user) => {
  const { instalacion_id, metodo, latitud, longitud, qr_code } = data;
  const usuario_id = user?.id || data.usuario_id;

  const ahora = new Date();

  // Ventana de búsqueda de 24 h hacia atrás + TOLERANCIA hacia adelante.
  // Cubre tres casos sin depender del reloj local del servidor:
  //   1. Turnos diurnos que empezaron "hoy" en UTC.
  //   2. Turnos nocturnos que empezaron ayer UTC y aún están vigentes (ej. 19:00–07:00).
  //   3. Turnos del día chileno real cuando ya es "mañana" en UTC (después de las 20:00 CLT).
  const ventanaInicio = new Date(ahora.getTime() - 24 * 60 * 60 * 1000);
  const ventanaFin    = new Date(ahora.getTime() + TOLERANCIA_MINUTOS * 60 * 1000);

  const turno = await prisma.turno.findFirst({
    where: {
      usuario_id,
      instalacion_id,
      fecha: { gte: ventanaInicio, lte: ventanaFin },
      estado: { not: 'cancelado' },
    },
    include: { instalacion: true },
    orderBy: { fecha: 'desc' }, // Si hay varios en ventana, tomar el más reciente
  });

  if (!turno) {
    // Mensaje de debug con timestamp del servidor y rango buscado, para facilitar diagnóstico
    const fechaUTC   = ahora.toISOString();
    const fechaChile = ahora.toLocaleString('es-CL', { timeZone: 'America/Santiago', hour12: false });
    throw Object.assign(
      new Error(
        `No tienes un turno asignado en esta instalación. ` +
        `Hora servidor: ${fechaUTC} (UTC) / ${fechaChile} (CLT). ` +
        `Rango buscado: ${ventanaInicio.toISOString()} → ${ventanaFin.toISOString()}.`,
      ),
      { statusCode: 400 },
    );
  }

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

  // Calcular minutos de retraso usando la fecha UTC real almacenada en el turno.
  // turno.fecha está guardado como mediodía UTC (ej. 2026-04-13T12:00:00Z).
  // Reconstruimos el instante de inicio del turno en UTC con la hora del turno,
  // de modo que el diff sea correcto independientemente del TZ del servidor.
  const fechaTurnoUTC = new Date(turno.fecha);
  const [horaInicio, minInicio] = turno.hora_inicio.split(':').map(Number);
  const inicioTurno = new Date(Date.UTC(
    fechaTurnoUTC.getUTCFullYear(),
    fechaTurnoUTC.getUTCMonth(),
    fechaTurnoUTC.getUTCDate(),
    horaInicio,
    minInicio,
    0,
  ));
  const diffMin = Math.floor((ahora - inicioTurno) / 60000);
  const minutosRetraso = Math.max(0, diffMin);
  const estado = minutosRetraso > ATRASO_MINUTOS ? 'tardio' : 'normal';

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
      es_fallback: metodo === 'fallback_telefono',
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
    });
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
  const [horaFin, minFin] = asistencia.turno.hora_fin.split(':').map(Number);
  const finTurno = new Date(asistencia.hora_entrada);
  finTurno.setHours(horaFin, minFin, 0, 0);
  const horasExtra = Math.max(0, (ahora - finTurno) / 3600000);

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

module.exports = { registrarEntrada, registrarSalida, obtenerHoy, obtenerHistorial, sincronizarBatch };
