// src/services/reportes.service.js
const { prisma } = require('../config/database');
const { ROLES } = require('../constants/roles');
const { ahoraChile, sumarDias, aFechaDB, inicioDiaChile, finDiaChile } = require('../utils/fechaChile');

// ── Helpers ────────────────────────────────────────────────────────
/** Devuelve los instalacion_ids accesibles según el rol del usuario */
async function resolverInstalaciones(instalacion_id, user) {
  if (user.rol === ROLES.SUPERVISOR) {
    const asignaciones = await prisma.supervisor_Instalacion.findMany({
      where: { supervisor_id: user.id },
      select: { instalacion_id: true },
    });
    const ids = asignaciones.map((a) => a.instalacion_id);
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
  const { fecha_inicio, fecha_fin, instalacion_id, tipo, urgencia } = query;

  const instFiltro = await resolverInstalaciones(instalacion_id, user);

  const where = {};
  if (instFiltro)  where.instalacion_id = instFiltro;
  if (tipo)        where.tipo    = tipo;
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
const novedadesPorSemana = async () => {
  const hoy = ahoraChile().fecha;
  const hace7dias = inicioDiaChile(sumarDias(hoy, -6));

  const novedades = await prisma.novedad.findMany({
    where: { created_at: { gte: hace7dias } },
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
const estadoGuardias = async () => {
  const hoy = ahoraChile().fecha;
  const inicio = inicioDiaChile(hoy);
  const manana = inicioDiaChile(sumarDias(hoy, 1));

  const [totalTurnos, asistencias] = await Promise.all([
    prisma.turno.count({
      where: { fecha: aFechaDB(hoy), estado: { not: 'cancelado' } },
    }),
    prisma.asistencia.findMany({
      where: { hora_entrada: { gte: inicio, lt: manana } },
      select: { estado: true },
    }),
  ]);

  const presentes = asistencias.filter((a) => a.estado === 'normal').length;
  const tardios   = asistencias.filter((a) => a.estado === 'tardio').length;
  const ausentes  = Math.max(0, totalTurnos - asistencias.length);

  return { presentes, tardios, ausentes, totalTurnos };
};

// ── Resumen mensual por instalación — para tabla analítica ─────────
const resumenMensual = async (mes, anio) => {
  const inicioISO = `${anio}-${String(mes).padStart(2, '0')}-01`;
  const siguienteISO = mes === 12
    ? `${anio + 1}-01-01`
    : `${anio}-${String(mes + 1).padStart(2, '0')}-01`;
  const inicioTurnos = aFechaDB(inicioISO);
  const siguienteTurnos = aFechaDB(siguienteISO);
  const inicioInstantes = inicioDiaChile(inicioISO);
  const siguienteInstantes = inicioDiaChile(siguienteISO);

  const [turnos, asistencias, novedades] = await Promise.all([
    prisma.turno.groupBy({
      by: ['instalacion_id'],
      where: { fecha: { gte: inicioTurnos, lt: siguienteTurnos }, estado: { not: 'cancelado' } },
      _count: { id: true },
    }),
    prisma.asistencia.groupBy({
      by: ['instalacion_id'],
      where: { hora_entrada: { gte: inicioInstantes, lt: siguienteInstantes } },
      _count: { id: true },
      _avg:   { minutos_retraso: true, horas_trabajadas: true },
    }),
    prisma.novedad.groupBy({
      by: ['instalacion_id'],
      where: { created_at: { gte: inicioInstantes, lt: siguienteInstantes } },
      _count: { id: true },
    }),
  ]);

  const ids = [...new Set([
    ...turnos.map((t) => t.instalacion_id),
    ...asistencias.map((a) => a.instalacion_id),
  ])];

  const instalaciones = await prisma.instalacion.findMany({
    where: { id: { in: ids } },
    select: { id: true, nombre: true },
  });

  return instalaciones.map((inst) => {
    const t  = turnos.find((x) => x.instalacion_id === inst.id);
    const a  = asistencias.find((x) => x.instalacion_id === inst.id);
    const n  = novedades.find((x) => x.instalacion_id === inst.id);
    const nT = t?._count.id ?? 0;
    const nA = a?._count.id ?? 0;
    return {
      instalacion:          inst.nombre,
      instalacion_id:       inst.id,
      turnos_programados:   nT,
      asistencias:          nA,
      cobertura:            nT > 0 ? Math.min(100, Math.round((nA / nT) * 100)) : 0,
      promedio_retraso_min: Math.round(a?._avg?.minutos_retraso ?? 0),
      promedio_horas:       parseFloat((a?._avg?.horas_trabajadas ?? 0).toFixed(1)),
      novedades:            n?._count.id ?? 0,
    };
  }).sort((a, b) => b.asistencias - a.asistencias);
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
  exportarCSV,
};
