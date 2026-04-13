const { prisma } = require('../config/database');

const getDashboardHoy = async (user) => {
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  const manana = new Date(hoy);
  manana.setDate(manana.getDate() + 1);

  // Filtrar por instalaciones del supervisor si aplica
  let instalacionIds = undefined;
  if (user.rol === 'supervisor') {
    const asignaciones = await prisma.supervisor_Instalacion.findMany({
      where: { supervisor_id: user.id },
      select: { instalacion_id: true },
    });
    instalacionIds = asignaciones.map(a => a.instalacion_id);
  }

  const whereInstalacion = instalacionIds ? { instalacion_id: { in: instalacionIds } } : {};

  // Turnos de hoy
  const turnos = await prisma.turno.findMany({
    where: {
      fecha: { gte: hoy, lt: manana },
      estado: { not: 'cancelado' },
      ...whereInstalacion,
    },
    include: {
      usuario: { select: { id: true, nombre: true } },
      instalacion: { select: { id: true, nombre: true } },
      asistencias: {
        where: { hora_entrada: { gte: hoy } },
        orderBy: { hora_entrada: 'desc' },
        take: 1,
      },
    },
    orderBy: { hora_inicio: 'asc' },
  });

  // Calcular estado por turno
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
      hora_inicio: t.hora_inicio,
      hora_fin: t.hora_fin,
      hora_entrada: asistencia?.hora_entrada || null,
      estado: estadoActual,
    };
  });

  const presentes = lista.filter(t => t.estado === 'presente').length;
  const tardios = lista.filter(t => t.estado === 'tardio').length;
  const faltantes = lista.filter(t => t.estado === 'faltante').length;

  const base = { total: turnos.length, presentes, tardios, faltantes, lista };

  // Métricas globales exclusivas para el admin
  if (user.rol === 'admin') {
    const inicioMes = new Date();
    inicioMes.setDate(1);
    inicioMes.setHours(0, 0, 0, 0);

    const [totalGuardias, totalInstalaciones, turnosMes, asistenciasMes, novedadesAbiertas] =
      await Promise.all([
        prisma.usuario.count({ where: { rol: { in: ['pauta', 'libre'] }, estado: 'activo' } }),
        prisma.instalacion.count({ where: { estado: 'activa' } }),
        prisma.turno.count({ where: { fecha: { gte: inicioMes }, estado: { not: 'cancelado' } } }),
        prisma.asistencia.count({ where: { created_at: { gte: inicioMes } } }),
        prisma.novedad.count({ where: { estado: { notIn: ['resuelta'] } } }),
      ]);

    const coberturaMensual = turnosMes > 0
      ? Math.min(100, Math.round((asistenciasMes / turnosMes) * 100))
      : 0;

    base.adminStats = {
      totalGuardias,
      totalInstalaciones,
      turnosMes,
      asistenciasMes,
      coberturaMensual,
      novedadesAbiertas,
    };
  }

  return base;
};

module.exports = { getDashboardHoy };
