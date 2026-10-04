const { prisma } = require('../config/database');
const { resolverInstalacionesSupervisor } = require('./supervisor.helper');
const { ROLES } = require('../constants/roles');
const { ahoraChile, aFechaDB, instanteChile, turnosDeHoy } = require('../utils/fechaChile');

/**
 * Dashboard principal del día.
 * - supervisor: solo su(s) instalación(es) asignadas
 * - central: todas las instalaciones + KPIs globales
 * - admin: igual que central + métricas del mes
 */
const getDashboardHoy = async (user) => {
  // Resolver instalaciones visibles según rol
  let instalacionIds = undefined;
  if (user.rol === ROLES.SUPERVISOR) {
    instalacionIds = await resolverInstalacionesSupervisor(user);
  }
  // central y admin ven todo (instalacionIds = undefined → sin filtro)

  const whereInstalacion = instalacionIds ? { instalacion_id: { in: instalacionIds } } : {};

  // Turnos de hoy (hora Chile): los que comienzan hoy + nocturnos de ayer aún en curso
  const ventana = turnosDeHoy();
  const turnos = (await prisma.turno.findMany({
    where: {
      ...ventana.where,
      estado: { not: 'cancelado' },
      ...whereInstalacion,
    },
    include: {
      usuario: { select: { id: true, nombre: true, rol: true } },
      instalacion: { select: { id: true, nombre: true } },
      // La asistencia ya pertenece al turno: no filtrar por fecha, porque en un
      // turno nocturno la entrada se marca el día anterior
      asistencias: {
        orderBy: { hora_entrada: 'desc' },
        take: 1,
      },
    },
    orderBy: [{ fecha: 'asc' }, { hora_inicio: 'asc' }],
  })).filter(ventana.incluir);

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
  if (user.rol === ROLES.SUPERVISOR && instalacionIds) {
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
  if ([ROLES.OPERADOR_CENTRAL, ROLES.ADMINISTRADOR].includes(user.rol)) {
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
  if (user.rol === ROLES.ADMINISTRADOR) {
    const { fecha: hoy } = ahoraChile();
    const inicioMesISO = `${hoy.slice(0, 7)}-01`;
    const inicioMesTurnos = aFechaDB(inicioMesISO);
    const inicioMesInstantes = instanteChile(inicioMesISO, '00:00');

    const [totalGuardias, turnosMes, asistenciasMes] = await Promise.all([
      prisma.usuario.count({ where: { rol: { in: [ROLES.GGSS_EN_PAUTA, ROLES.GGSS_LIBRE] }, estado: 'activo' } }),
      prisma.turno.count({ where: { fecha: { gte: inicioMesTurnos }, estado: { not: 'cancelado' } } }),
      prisma.asistencia.count({ where: { created_at: { gte: inicioMesInstantes } } }),
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
