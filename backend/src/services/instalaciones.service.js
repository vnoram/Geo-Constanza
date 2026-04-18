const { prisma } = require('../config/database');

const listar = async (query, user) => {
  const where = {};
  if (query.estado) where.estado = query.estado;
  if (query.tipo_recinto) where.tipo_recinto = query.tipo_recinto;

  // Row-level security: supervisor solo ve sus instalaciones asignadas
  if (user.rol === 'supervisor') {
    const asignaciones = await prisma.supervisor_Instalacion.findMany({
      where: { supervisor_id: user.id },
      select: { instalacion_id: true },
    });
    const ids = asignaciones.map((a) => a.instalacion_id);
    // Fallback: si no tiene entradas en la tabla intermedia, usar instalacion_asignada_id
    if (ids.length === 0 && user.instalacion_asignada_id) {
      ids.push(user.instalacion_asignada_id);
    }
    where.id = { in: ids };
  }

  return prisma.instalacion.findMany({ where, orderBy: { nombre: 'asc' } });
};

const crear = async (data) => {
  return prisma.instalacion.create({
    data: {
      ...data,
      latitud:          parseFloat(data.latitud),
      longitud:         parseFloat(data.longitud),
      radio_geofence_m: parseInt(data.radio_geofence_m ?? 100, 10),
    },
  });
};

const obtenerPorId = async (id) => {
  return prisma.instalacion.findUniqueOrThrow({ where: { id } });
};

const editar = async (id, data) => {
  return prisma.instalacion.update({ where: { id }, data });
};

module.exports = { listar, obtenerPorId, crear, editar };
