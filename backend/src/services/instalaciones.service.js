const { prisma } = require('../config/database');
const { ROLES } = require('../constants/roles');

const listar = async (query, user) => {
  const where = {};
  if (query.estado) where.estado = query.estado;
  if (query.tipo_recinto) where.tipo_recinto = query.tipo_recinto;

  // Row-level security: supervisor solo ve sus instalaciones asignadas
  if (user.rol === ROLES.SUPERVISOR) {
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
  const { supervisorIds, ...campos } = data;

  return prisma.$transaction(async (tx) => {
    const nueva = await tx.instalacion.create({
      data: {
        ...campos,
        latitud:          parseFloat(campos.latitud),
        longitud:         parseFloat(campos.longitud),
        radio_geofence_m: parseInt(campos.radio_geofence_m ?? 100, 10),
      },
    });

    // Sin esto, la instalación queda invisible para todo supervisor: el
    // listado de supervisores filtra por Supervisor_Instalacion (o el
    // fallback instalacion_asignada_id del usuario), y una instalación
    // recién creada no tiene ninguna fila ahí.
    if (Array.isArray(supervisorIds) && supervisorIds.length > 0) {
      await tx.supervisor_Instalacion.createMany({
        data: supervisorIds.map((supervisor_id) => ({ supervisor_id, instalacion_id: nueva.id })),
        skipDuplicates: true,
      });
    }

    return nueva;
  });
};

const obtenerPorId = async (id) => {
  return prisma.instalacion.findUniqueOrThrow({ where: { id } });
};

const editar = async (id, data) => {
  const { supervisorIds, ...campos } = data;

  return prisma.$transaction(async (tx) => {
    const actualizada = await tx.instalacion.update({ where: { id }, data: campos });

    // Si se envió el array, sincroniza las asignaciones (reemplaza el set completo,
    // igual que hace usuarios.service.js al editar un supervisor).
    if (Array.isArray(supervisorIds)) {
      await tx.supervisor_Instalacion.deleteMany({ where: { instalacion_id: id } });
      if (supervisorIds.length > 0) {
        await tx.supervisor_Instalacion.createMany({
          data: supervisorIds.map((supervisor_id) => ({ supervisor_id, instalacion_id: id })),
          skipDuplicates: true,
        });
      }
    }

    return actualizada;
  });
};

module.exports = { listar, obtenerPorId, crear, editar };
