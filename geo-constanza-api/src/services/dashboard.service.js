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

  return {
    total: turnos.length,
    presentes,
    tardios,
    faltantes,
    lista,
  };
};

module.exports = { getDashboardHoy };
