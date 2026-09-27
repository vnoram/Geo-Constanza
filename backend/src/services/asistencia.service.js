const { prisma } = require('../config/database');
const { getSocketIO } = require('../socket/socketManager');
const geovalidacion = require('./geovalidacion.service');
const { ROLES } = require('../constants/roles');

const { ahoraChile, sumarDias, aFechaDB, intervaloTurno, turnoVigente, instanteChile } = require('../utils/fechaChile');

const TOLERANCIA_MINUTOS = 15;
const ATRASO_MINUTOS = 10;

// La misma selección alimenta el marcaje y la pantalla del guardia.
const ordenarTurnos = (a, b) => intervaloTurno(a).inicio - intervaloTurno(b).inicio
  || String(a.id).localeCompare(String(b.id));

const buscarTurnos = (db, usuario_id, ahora, instalacion_id) => {
  const { fecha } = ahoraChile(ahora);
  return db.turno.findMany({
    where: {
      usuario_id,
      ...(instalacion_id && { instalacion_id }),
      fecha: { gte: aFechaDB(sumarDias(fecha, -1)), lte: aFechaDB(sumarDias(fecha, 1)) },
      estado: { not: 'cancelado' },
    },
    include: { instalacion: true },
  });
};

const seleccionarVigente = (turnos, abiertas, ahora) => {
  const vigentes = turnos.filter((t) => turnoVigente(t, ahora, TOLERANCIA_MINUTOS));
  if (vigentes.length > 1) console.warn('[Asistencia] Varios turnos elegibles:', vigentes.map((t) => t.id));
  return vigentes.sort((a, b) =>
    Number(abiertas.some((x) => x.turno_id === b.id)) - Number(abiertas.some((x) => x.turno_id === a.id))
    || ordenarTurnos(a, b))[0];
};

const buscarAbiertas = (db, usuario_id) => db.asistencia.findMany({
  where: { usuario_id, hora_salida: null },
  include: { turno: { include: { instalacion: true } } },
  orderBy: [{ hora_entrada: 'asc' }, { id: 'asc' }],
});

const advertirDuplicadas = (abiertas) => {
  if (abiertas.length > 1) console.warn('[Asistencia] Asistencias abiertas duplicadas:', abiertas.map((a) => a.id));
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
  const { instalacion_id, metodo, latitud, longitud, dispositivo } = data;
  const usuario_id = user?.id || data.usuario_id;

  const resultado = await prisma.$transaction(async (db) => {
    // Bloqueo por guardia compartido entre procesos; evita dos entradas simultáneas.
    // ReadCommitted permite ver la entrada que confirmó quien tenía el bloqueo.
    await db.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${usuario_id}))`;
    const ahora = new Date();
    const abiertas = await buscarAbiertas(db, usuario_id);
    advertirDuplicadas(abiertas);
    const turnos = await buscarTurnos(db, usuario_id, ahora, instalacion_id);
    const turno = seleccionarVigente(turnos, abiertas, ahora);
    const otraAbierta = abiertas.find((a) => a.turno_id !== turno?.id);
    if (otraAbierta) {
      throw Object.assign(new Error(`Ya tienes una entrada abierta en el turno ${otraAbierta.turno_id}; marca salida antes de iniciar otro`), { statusCode: 409 });
    }
    const mismaAbierta = abiertas.find((a) => a.turno_id === turno?.id);
    if (mismaAbierta) return { asistencia: mismaAbierta };
    if (!turno) {
      throw Object.assign(new Error('No tienes un turno vigente en esta instalación (entrada permitida desde 15 minutos antes).'), { statusCode: 400 });
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

    const { inicio: inicioTurno } = intervaloTurno(turno);
    const diffMin = Math.floor((ahora - inicioTurno) / 60000);
    const minutosRetraso = Math.max(0, diffMin);
    const estado = minutosRetraso > ATRASO_MINUTOS ? 'tardio' : 'normal';

    const esFallback = esFallbackOverride !== null
      ? esFallbackOverride
      : metodo === 'fallback_telefono';

    const asistencia = await db.asistencia.create({
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

    return { asistencia, ahora, estado, esFallback, lat, lon };
  }, { isolationLevel: 'ReadCommitted' });
  const { asistencia, ahora, estado, esFallback, lat, lon } = resultado;
  if (!ahora) return asistencia; // Reintento idempotente, sin repetir notificaciones.

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
        minutos_retraso: asistencia.minutos_retraso,
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
  const { fin: finTurno } = intervaloTurno(asistencia.turno);
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
  const { fecha } = ahoraChile();
  const hoy = instanteChile(fecha, '00:00');
  const manana = instanteChile(sumarDias(fecha, 1), '00:00');

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

// Las lecturas no inventan una salida: incluso una asistencia antigua se
// conserva hasta que el guardia marque salida o se revise administrativamente.
const obtenerEstadoActual = async (usuarioId) => {
  const ahora = new Date();
  const abiertas = await buscarAbiertas(prisma, usuarioId);
  advertirDuplicadas(abiertas);
  const abierta = [...abiertas].sort((a, b) =>
    Number(turnoVigente(b.turno, ahora)) - Number(turnoVigente(a.turno, ahora))
    || ordenarTurnos(a.turno, b.turno))[0];
  if (abierta) {
    return {
      activo: true,
      asistencia_id: abierta.id,
      hora_entrada: abierta.hora_entrada,
      estado: abierta.estado,
      minutos_retraso: abierta.minutos_retraso,
      turno_id: abierta.turno_id,
      instalacion_id: abierta.instalacion_id,
      turno: abierta.turno,
      instalacion: abierta.turno.instalacion,
    };
  }
  const turnos = await buscarTurnos(prisma, usuarioId, ahora);
  const hoy = ahoraChile(ahora).fecha;
  const turno = seleccionarVigente(turnos, [], ahora) || turnos
    .filter((t) => new Date(t.fecha).toISOString().slice(0, 10) === hoy && intervaloTurno(t).inicio > ahora)
    .sort(ordenarTurnos)[0] || null;
  return { activo: false, turno, instalacion: turno?.instalacion || null };
};

const sincronizarBatch = async (registros) => {
  const resultados = [];
  for (const registro of registros) {
    try {
      // La sincronización también puede abrir entradas: respeta el mismo bloqueo.
      const result = await prisma.$transaction(async (db) => {
        await db.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${registro.usuario_id}))`;
        if (registro.hora_salida == null) {
          const abiertas = await buscarAbiertas(db, registro.usuario_id);
          if (abiertas.some((a) => a.turno_id !== registro.turno_id)) {
            throw Object.assign(new Error('Ya tienes una entrada abierta en otro turno; marca salida antes de sincronizar otra entrada'), { statusCode: 409 });
          }
          if (abiertas.length) return abiertas[0];
        }
        return db.asistencia.create({ data: registro });
      }, { isolationLevel: 'ReadCommitted' });
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
};
