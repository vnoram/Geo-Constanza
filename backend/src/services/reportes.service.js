// src/services/reportes.service.js
const { prisma } = require('../config/database');
const { ROLES } = require('../constants/roles');
const { resolverInstalacionesSupervisor } = require('./supervisor.helper');
const { SOLO_INCIDENCIAS, TIPOS_RUTINA } = require('./priorizacion.service');
const { AUSENCIAS } = require('../constants/solicitudes');
const { ahoraChile, sumarDias, aFechaDB, inicioDiaChile, finDiaChile } = require('../utils/fechaChile');

// ── Helpers ────────────────────────────────────────────────────────
/** Devuelve los instalacion_ids accesibles según el rol del usuario */
async function resolverInstalaciones(instalacion_id, user) {
  if (user.rol === ROLES.SUPERVISOR) {
    // Misma regla que dashboard y novedades: asignaciones directas + comunas de cobertura
    // + instalación asignada como último recurso.
    const ids = await resolverInstalacionesSupervisor(user);
    // Si pidieron filtro por una instalación concreta, respetar si está en su lista
    return instalacion_id && ids.includes(instalacion_id) ? instalacion_id : { in: ids };
  }
  // admin y roles superiores ven todo
  return instalacion_id || undefined;
}

// ── Reporte de Asistencia ──────────────────────────────────────────
const reporteAsistencia = async (query, user) => {
  const { fecha_inicio, fecha_fin, instalacion_id } = query;

  const instFiltro = await resolverInstalaciones(instalacion_id, user);

  const where = {};
  if (instFiltro) where.instalacion_id = instFiltro;
  if (fecha_inicio || fecha_fin) {
    where.hora_entrada = {};
    if (fecha_inicio) where.hora_entrada.gte = inicioDiaChile(fecha_inicio);
    if (fecha_fin)    where.hora_entrada.lte = finDiaChile(fecha_fin);
  }

  return prisma.asistencia.findMany({
    where,
    include: {
      usuario:    { select: { id: true, nombre: true, rut: true } },
      instalacion: { select: { id: true, nombre: true, direccion: true } },
      turno:      { select: { hora_inicio: true, hora_fin: true, tipo_turno: true } },
    },
    orderBy: { hora_entrada: 'desc' },
  });
};

// ── Reporte de Novedades ───────────────────────────────────────────
const reporteIncidentes = async (query, user) => {
  const { fecha_inicio, fecha_fin, instalacion_id, tipo, urgencia, categoria } = query;

  const instFiltro = await resolverInstalaciones(instalacion_id, user);

  const where = {};
  if (instFiltro)  where.instalacion_id = instFiltro;
  if (tipo)        where.tipo    = tipo;
  // categoria=incidencias | rutina (libro de rondas). Sin parámetro: todo, como antes.
  if (!tipo && categoria === 'incidencias') where.tipo = { notIn: TIPOS_RUTINA };
  if (!tipo && categoria === 'rutina')      where.tipo = { in: TIPOS_RUTINA };
  if (urgencia)    where.urgencia = urgencia;
  if (fecha_inicio || fecha_fin) {
    where.created_at = {};
    if (fecha_inicio) where.created_at.gte = inicioDiaChile(fecha_inicio);
    if (fecha_fin)    where.created_at.lte = finDiaChile(fecha_fin);
  }

  return prisma.novedad.findMany({
    where,
    include: {
      usuario:    { select: { id: true, nombre: true, rut: true } },
      instalacion: { select: { id: true, nombre: true } },
    },
    orderBy: [{ urgencia: 'asc' }, { created_at: 'desc' }],
  });
};

// ── Novedades agrupadas por día (últimos 7 días) — para gráfico ────
// Filtro de instalaciones para reportes agregados: supervisor solo las suyas.
const filtroAlcance = async (user) => (
  user?.rol === ROLES.SUPERVISOR ? { in: await resolverInstalacionesSupervisor(user) } : undefined
);

const novedadesPorSemana = async (user) => {
  const alcance = await filtroAlcance(user);
  const hoy = ahoraChile().fecha;
  const hace7dias = inicioDiaChile(sumarDias(hoy, -6));

  const novedades = await prisma.novedad.findMany({
    where: { created_at: { gte: hace7dias }, ...SOLO_INCIDENCIAS, ...(alcance && { instalacion_id: alcance }) },
    select: { created_at: true, urgencia: true },
  });

  // Construir estructura de los 7 días
  const dias = Array.from({ length: 7 }, (_, i) => {
    const fecha = sumarDias(hoy, -(6 - i));
    return {
      fecha,
      label:    aFechaDB(fecha).toLocaleDateString('es-CL', { weekday: 'short', day: 'numeric', timeZone: 'UTC' }),
      total:    0,
      rojo:     0,
      amarillo: 0,
      verde:    0,
    };
  });

  novedades.forEach((n) => {
    const fechaStr = ahoraChile(new Date(n.created_at)).fecha;
    const dia = dias.find((d) => d.fecha === fechaStr);
    if (!dia) return;
    dia.total++;
    if      (n.urgencia === 'rojo')     dia.rojo++;
    else if (n.urgencia === 'amarillo') dia.amarillo++;
    else                                dia.verde++;
  });

  return dias;
};

// ── Estado de guardias hoy — para gráfico de torta ────────────────
const estadoGuardias = async (user) => {
  const alcance = await filtroAlcance(user);
  const porInstalacion = alcance ? { instalacion_id: alcance } : {};
  const hoy = ahoraChile().fecha;
  const inicio = inicioDiaChile(hoy);
  const manana = inicioDiaChile(sumarDias(hoy, 1));

  const { hora: horaAhora } = ahoraChile();

  const hoyDB = aFechaDB(hoy);

  const [totalTurnos, porIniciar, conAusencia, asistencias] = await Promise.all([
    prisma.turno.count({
      where: { fecha: aFechaDB(hoy), estado: { not: 'cancelado' }, ...porInstalacion },
    }),
    // Turnos de hoy que todavía no comienzan: no cuentan como ausentes
    prisma.turno.count({
      where: { fecha: aFechaDB(hoy), estado: { not: 'cancelado' }, hora_inicio: { gt: horaAhora }, ...porInstalacion },
    }),
    // Turnos ya iniciados cuyo guardia tiene vacaciones o una ausencia aprobada hoy: no son ausentes
    prisma.turno.count({
      where: {
        fecha: hoyDB, estado: { not: 'cancelado' }, hora_inicio: { lte: horaAhora }, ...porInstalacion,
        usuario: { solicitudes: { some: {
          tipo: { in: Object.keys(AUSENCIAS) }, estado: 'aprobada', fecha_desde: { lte: hoyDB },
          OR: [{ fecha_hasta: { gte: hoyDB } }, { fecha_hasta: null, fecha_desde: hoyDB }],
        } } },
      },
    }),
    prisma.asistencia.findMany({
      where: { hora_entrada: { gte: inicio, lt: manana }, ...porInstalacion },
      select: { estado: true },
    }),
  ]);

  const presentes = asistencias.filter((a) => a.estado === 'normal').length;
  const tardios   = asistencias.filter((a) => a.estado === 'tardio').length;
  const ausentes  = Math.max(0, totalTurnos - porIniciar - conAusencia - asistencias.length);

  return { presentes, tardios, ausentes, totalTurnos, porIniciar, conAusencia };
};

// ── Cobertura por período ──────────────────────────────────────────
// Un marcaje solo cuenta si pertenece a un turno programado del período que ya comenzó. Lo demás (turnos
// extra, turnos de otro período o cancelados) es ajeno a la cobertura de la instalación: si alguien falta,
// otro guardia lo compensa, pero el turno sigue sin cubrirse.
// Un guardia pertenece a una sola instalación: los turnos programados en otra no cuentan para la cobertura.
const turnosDelPeriodo = async (inicioISO, siguienteISO, porInstalacion) => {
  const { fecha: hoy, hora: horaAhora } = ahoraChile();
  const hoyDB = aFechaDB(hoy);
  const turnos = await prisma.turno.findMany({
    where: {
      AND: [
        { fecha: { gte: aFechaDB(inicioISO), lt: aFechaDB(siguienteISO) } },
        { OR: [{ fecha: { lt: hoyDB } }, { fecha: hoyDB, hora_inicio: { lte: horaAhora } }] },
      ],
      estado: { not: 'cancelado' }, ...porInstalacion,
    },
    select: {
      usuario_id: true, instalacion_id: true, fecha: true,
      usuario: { select: { instalacion_asignada_id: true } },
      asistencias: { select: { minutos_retraso: true, horas_trabajadas: true } },
    },
  });
  return turnos.filter((t) => !t.usuario?.instalacion_asignada_id || t.usuario.instalacion_asignada_id === t.instalacion_id);
};

/** Agrupa turnos por clave: programados, cubiertos (con al menos un marcaje) y promedios sobre esos marcajes. */
const acumularTurnos = (turnos, claveDe) => {
  const mapa = new Map();
  for (const t of turnos) {
    const k = claveDe(t);
    const a = mapa.get(k) ?? { usuario_id: t.usuario_id, instalacion_id: t.instalacion_id, programados: 0, cubiertos: 0, marcajes: 0, retraso: 0, conHoras: 0, horas: 0 };
    a.programados += 1;
    if (t.asistencias.length > 0) a.cubiertos += 1;
    for (const m of t.asistencias) {
      a.marcajes += 1;
      a.retraso += m.minutos_retraso ?? 0;
      if (m.horas_trabajadas != null) { a.conHoras += 1; a.horas += m.horas_trabajadas; }
    }
    mapa.set(k, a);
  }
  return mapa;
};

const filaCobertura = (a) => ({
  turnos_programados: a.programados,
  turnos_cubiertos: a.cubiertos,
  cobertura: a.programados > 0 ? Math.round((a.cubiertos / a.programados) * 100) : 0,
  promedio_retraso_min: a.marcajes ? Math.round(a.retraso / a.marcajes) : 0,
  promedio_horas: a.conHoras ? parseFloat((a.horas / a.conHoras).toFixed(1)) : 0,
});

const rangoMeses = (mes, anio, cantidad) => {
  const iso = (a, m) => new Date(Date.UTC(a, m, 1)).toISOString().slice(0, 10);
  return { inicioISO: iso(anio, mes - 1), siguienteISO: iso(anio, mes - 1 + cantidad) };
};

// ── Resumen por guardia (mes o varios meses) ──────────────────────
const resumenGuardias = async (mes, anio, user, cantidad = 1) => {
  const alcance = await filtroAlcance(user);
  const porInstalacion = alcance ? { instalacion_id: alcance } : {};
  const { inicioISO, siguienteISO } = rangoMeses(mes, anio, cantidad);

  const [turnos, novedades] = await Promise.all([
    turnosDelPeriodo(inicioISO, siguienteISO, porInstalacion),
    prisma.novedad.groupBy({
      by: ['usuario_id', 'instalacion_id'],
      where: { created_at: { gte: inicioDiaChile(inicioISO), lt: inicioDiaChile(siguienteISO) }, ...SOLO_INCIDENCIAS, ...porInstalacion },
      _count: { id: true },
    }),
  ]);

  const filas = acumularTurnos(turnos, (t) => `${t.usuario_id}|${t.instalacion_id}`);
  const [usuarios, instalaciones] = await Promise.all([
    prisma.usuario.findMany({ where: { id: { in: [...new Set(turnos.map((t) => t.usuario_id))] } }, select: { id: true, nombre: true, rut: true } }),
    prisma.instalacion.findMany({ where: { id: { in: [...new Set(turnos.map((t) => t.instalacion_id))] } }, select: { id: true, nombre: true } }),
  ]);

  return [...filas.values()].map((a) => {
    const u = usuarios.find((x) => x.id === a.usuario_id);
    const n = novedades.find((x) => x.usuario_id === a.usuario_id && x.instalacion_id === a.instalacion_id);
    return {
      usuario_id: a.usuario_id,
      guardia: u?.nombre ?? 'Sin asignar',
      rut: u?.rut ?? null,
      instalacion_id: a.instalacion_id,
      instalacion: instalaciones.find((x) => x.id === a.instalacion_id)?.nombre ?? '',
      ...filaCobertura(a),
      novedades: n?._count.id ?? 0,
    };
  }).sort((x, y) => x.instalacion.localeCompare(y.instalacion) || x.guardia.localeCompare(y.guardia));
};

// ── Cobertura diaria por instalación (gráfico del detalle de cada instalación) ──
const resumenDiario = async (mes, anio, user, cantidad = 1) => {
  const alcance = await filtroAlcance(user);
  const porInstalacion = alcance ? { instalacion_id: alcance } : {};
  const { inicioISO, siguienteISO } = rangoMeses(mes, anio, cantidad);
  const turnos = await turnosDelPeriodo(inicioISO, siguienteISO, porInstalacion);

  const dias = new Map();
  for (const t of turnos) {
    const fecha = new Date(t.fecha).toISOString().slice(0, 10);
    const k = `${t.instalacion_id}|${fecha}`;
    const d = dias.get(k) ?? { instalacion_id: t.instalacion_id, fecha, turnos_programados: 0, turnos_cubiertos: 0 };
    d.turnos_programados += 1;
    if (t.asistencias.length > 0) d.turnos_cubiertos += 1;
    dias.set(k, d);
  }
  return [...dias.values()]
    .map((d) => ({ ...d, cobertura: Math.round((d.turnos_cubiertos / d.turnos_programados) * 100) }))
    .sort((a, b) => a.fecha.localeCompare(b.fecha));
};

// ── Resumen mensual por instalación — para tabla analítica ─────────
const resumenMensual = async (mes, anio, user) => {
  const alcance = await filtroAlcance(user);
  const porInstalacion = alcance ? { instalacion_id: alcance } : {};
  const { inicioISO, siguienteISO } = rangoMeses(mes, anio, 1);

  const [turnos, novedades] = await Promise.all([
    turnosDelPeriodo(inicioISO, siguienteISO, porInstalacion),
    prisma.novedad.groupBy({
      by: ['instalacion_id'],
      where: { created_at: { gte: inicioDiaChile(inicioISO), lt: inicioDiaChile(siguienteISO) }, ...SOLO_INCIDENCIAS, ...porInstalacion },
      _count: { id: true },
    }),
  ]);

  const porInst = acumularTurnos(turnos, (t) => t.instalacion_id);
  const instalaciones = await prisma.instalacion.findMany({
    where: { id: { in: [...porInst.keys()] } },
    select: { id: true, nombre: true },
  });

  return instalaciones.filter((inst) => porInst.has(inst.id)).map((inst) => ({
    instalacion: inst.nombre,
    instalacion_id: inst.id,
    ...filaCobertura(porInst.get(inst.id)),
    novedades: novedades.find((x) => x.instalacion_id === inst.id)?._count.id ?? 0,
  }));
};

// ── Exportar a CSV (sin dependencias externas) ────────────────────
const exportarCSV = async (query, user) => {
  const datos = await reporteAsistencia(query, user);

  const cabecera = [
    'Fecha', 'RUT', 'Nombre', 'Instalación', 'Dirección',
    'Turno Inicio', 'Turno Fin',
    'Hora Entrada', 'Hora Salida', 'Estado', 'Min Retraso', 'Horas Trabajadas',
  ];

  const filas = datos.map((a) => [
    new Date(a.hora_entrada).toLocaleDateString('es-CL', { timeZone: 'America/Santiago' }),
    a.usuario.rut,
    a.usuario.nombre,
    a.instalacion.nombre,
    a.instalacion.direccion || '',
    a.turno?.hora_inicio    || '',
    a.turno?.hora_fin       || '',
    new Date(a.hora_entrada).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Santiago' }),
    a.hora_salida ? new Date(a.hora_salida).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Santiago' }) : 'Activo',
    a.estado === 'tardio' ? 'Tardío' : 'Normal',
    a.minutos_retraso,
    a.horas_trabajadas != null ? a.horas_trabajadas.toFixed(2) : '',
  ]);

  const escapar = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const csv = [cabecera, ...filas].map((r) => r.map(escapar).join(',')).join('\r\n');
  return Buffer.from('\uFEFF' + csv, 'utf-8'); // BOM para Excel en español
};

module.exports = {
  reporteAsistencia,
  reporteIncidentes,
  novedadesPorSemana,
  estadoGuardias,
  resumenMensual,
  resumenDiario,
  resumenGuardias,
  exportarCSV,
};
