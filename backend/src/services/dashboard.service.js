const { prisma } = require('../config/database');
const { resolverInstalacionesSupervisor } = require('./supervisor.helper');

/**
 * Dashboard principal del día.
 * - supervisor: solo su(s) instalación(es) asignadas
 * - central: todas las instalaciones + KPIs globales
 * - admin: igual que central + métricas del mes
 */
const getDashboardHoy = async (user) => {
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  const manana = new Date(hoy);
  manana.setDate(manana.getDate() + 1);

  // Resolver instalaciones visibles según rol
  let instalacionIds = undefined;
  if (user.rol === 'supervisor') {
    instalacionIds = await resolverInstalacionesSupervisor(user);
  }
  // central y admin ven todo (instalacionIds = undefined → sin filtro)

  const whereInstalacion = instalacionIds ? { instalacion_id: { in: instalacionIds } } : {};

  // Turnos de hoy
  const turnos = await prisma.turno.findMany({
    where: {
      fecha: { gte: hoy, lt: manana },
      estado: { not: 'cancelado' },
      ...whereInstalacion,
    },
    include: {
      usuario: { select: { id: true, nombre: true, rol: true } },
      instalacion: { select: { id: true, nombre: true } },
      asistencias: {
        where: { hora_entrada: { gte: hoy } },
        orderBy: { hora_entrada: 'desc' },
        take: 1,
      },
    },
    orderBy: { hora_inicio: 'asc' },
  });

  const lista = turnos.map(t => {
    const asistencia = t.asistencias[0] || null;
    let estadoActual = 'faltante';
    if (asistencia) {
      estadoActual = asistencia.estado === 'tardio' ? 'tardio' : 'presente';
    }
    return {
      turno_id: t.id,
      guardia: t.usuario.nombre,
      instalacion: t.instalacion.nombre,
      instalacion_id: t.instalacion.id,
      hora_inicio: t.hora_inicio,
      hora_fin: t.hora_fin,
      hora_entrada: asistencia?.hora_entrada || null,
      es_fallback: asistencia?.es_fallback || false,
      estado: estadoActual,
    };
  });

  const presentes = lista.filter(t => t.estado === 'presente').length;
  const tardios = lista.filter(t => t.estado === 'tardio').length;
  const faltantes = lista.filter(t => t.estado === 'faltante').length;
  const fallbacks = lista.filter(t => t.es_fallback).length;

  const base = { total: turnos.length, presentes, tardios, faltantes, fallbacks, lista };

  // ── KPIs para Supervisor (sus instalaciones asignadas) ─────────────────────
  if (user.rol === 'supervisor' && instalacionIds) {
    const whereNov = instalacionIds.length > 0
      ? { instalacion_id: { in: instalacionIds } }
      : { id: 'never-match' };

    const [novedadesAbiertas, novedadesEscaladas, instalacionesDetalle] = await Promise.all([
      prisma.novedad.count({ where: { ...whereNov, estado: 'abierta'  } }),
      prisma.novedad.count({ where: { ...whereNov, estado: 'escalada' } }),
      instalacionIds.length > 0
        ? prisma.instalacion.findMany({
            where: { id: { in: instalacionIds } },
            select: {
              id: true, nombre: true, nivel_criticidad: true, direccion: true,
              _count: { select: { novedades: { where: { estado: { not: 'resuelta' } } } } },
            },
          })
        : [],
    ]);

    base.kpis = {
      novedadesAbiertas,
      novedadesEscaladas,
      instalacionesAsignadas: instalacionesDetalle.map((i) => ({
        id:               i.id,
        nombre:           i.nombre,
        criticidad:       i.nivel_criticidad,
        direccion:        i.direccion,
        novedadesActivas: i._count.novedades,
      })),
    };
  }

  // ── KPIs globales para Central y Admin ──────────────────────────────────────
  if (['central', 'admin'].includes(user.rol)) {
    const [
      novedadesAbiertas,
      novedadesEscaladas,
      totalInstalaciones,
      instalacionesActivas,
    ] = await Promise.all([
      prisma.novedad.count({ where: { estado: 'abierta' } }),
      prisma.novedad.count({ where: { estado: 'escalada' } }),
      prisma.instalacion.count(),
      prisma.instalacion.count({ where: { estado: 'activo' } }),
    ]);

    // Cobertura: % de turnos de hoy que tienen asistencia
    const coberturaDia = turnos.length > 0
      ? Math.round(((presentes + tardios) / turnos.length) * 100)
      : 0;

    // Resumen por instalación para mapa/tabla global
    const resumenPorInstalacion = await prisma.instalacion.findMany({
      where: instalacionIds ? { id: { in: instalacionIds } } : undefined,
      select: {
        id: true,
        nombre: true,
        nivel_criticidad: true,
        _count: {
          select: {
            novedades: { where: { estado: { not: 'resuelta' } } },
          },
        },
      },
    });

    base.kpis = {
      novedadesAbiertas,
      novedadesEscaladas,
      totalInstalaciones,
      instalacionesActivas,
      coberturaDia,
      resumenPorInstalacion: resumenPorInstalacion.map(i => ({
        id: i.id,
        nombre: i.nombre,
        criticidad: i.nivel_criticidad,
        novedadesActivas: i._count.novedades,
      })),
    };
  }

  // Métricas mensuales exclusivas para Admin
  if (user.rol === 'admin') {
    const inicioMes = new Date();
    inicioMes.setDate(1);
    inicioMes.setHours(0, 0, 0, 0);

    const [totalGuardias, turnosMes, asistenciasMes] = await Promise.all([
      prisma.usuario.count({ where: { rol: { in: ['pauta', 'libre'] }, estado: 'activo' } }),
      prisma.turno.count({ where: { fecha: { gte: inicioMes }, estado: { not: 'cancelado' } } }),
      prisma.asistencia.count({ where: { created_at: { gte: inicioMes } } }),
    ]);

    const coberturaMensual = turnosMes > 0
      ? Math.min(100, Math.round((asistenciasMes / turnosMes) * 100))
      : 0;

    base.adminStats = { totalGuardias, turnosMes, asistenciasMes, coberturaMensual };
  }

  return base;
};

/**
 * Estado de supervisores activos (para Central).
 */
const getEstadoSupervisores = async () => {
  return prisma.supervisor_Instalacion.findMany({
    include: {
      supervisor: { select: { id: true, nombre: true, email: true, estado: true } },
      instalacion: { select: { id: true, nombre: true, nivel_criticidad: true } },
    },
    orderBy: { instalacion: { nombre: 'asc' } },
  });
};

module.exports = { getDashboardHoy, getEstadoSupervisores };
