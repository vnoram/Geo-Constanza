const { prisma } = require('../config/database');

const listar = async (query, user) => {
  const where = {};
  if (query.estado) where.estado = query.estado;
  if (query.tipo_recinto) where.tipo_recinto = query.tipo_recinto;

  // Row-level security: supervisor solo ve sus instalaciones asignadas
  if (user.rol === 'supervisor') {
    const asignaciones = await prisma.supervisor_instalacion.findMany({
      where: { supervisor_id: user.id },
      select: { instalacion_id: true },
    });
    where.id = { in: asignaciones.map((a) => a.instalacion_id) };
  }

  return prisma.instalacion.findMany({ where, orderBy: { nombre: 'asc' } });
};

const crear = async (data) => {
  return prisma.instalacion.create({ data });
};

const editar = async (id, data) => {
  return prisma.instalacion.update({ where: { id }, data });
};

module.exports = { listar, crear, editar };
