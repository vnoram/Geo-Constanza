const { prisma } = require('../config/database');
const { ROLES } = require('../constants/roles');
const { resolverInstalacionesSupervisor } = require('./supervisor.helper');
const { TOLERANCIA_POR_DEFECTO_MINUTOS } = require('../constants/cobertura');

const validarTolerancia = (valor) => {
  const numero = Number(valor);
  if (!['string', 'number'].includes(typeof valor) || valor === '' || !Number.isInteger(numero) || numero < 0 || numero > 2147483647) {
    throw Object.assign(new Error('La tolerancia debe ser un número entero de minutos no negativo.'), { statusCode: 400 });
  }
  return numero;
};

const validarGeocerca = (campos, crear = false) => {
  for (const [campo, minimo, maximo] of [['latitud', -90, 90], ['longitud', -180, 180], ['radio_geofence_m', 1, 2147483647]]) {
    const valor = campos[campo] ?? (crear && campo === 'radio_geofence_m' ? 100 : undefined);
    if (valor === undefined && !crear) continue;
    const numero = Number(valor);
    if (!['string', 'number'].includes(typeof valor) || String(valor).trim() === '' || !Number.isFinite(numero) || numero < minimo || numero > maximo ||
        (campo === 'radio_geofence_m' && !Number.isInteger(numero))) {
      throw Object.assign(new Error(`Valor inválido para ${campo}.`), { statusCode: 400 });
    }
  }
};

const listar = async (query, user) => {
  const where = {};
  if (query.estado) where.estado = query.estado;
  if (query.tipo_recinto) where.tipo_recinto = query.tipo_recinto;

  // Row-level security: supervisor ve sus instalaciones asignadas (o todas las activas si aún no tiene asignación)
  if (user && user.rol === ROLES.SUPERVISOR) {
    const ids = await resolverInstalacionesSupervisor(user);
    where.id = { in: ids };
  }

  return prisma.instalacion.findMany({
    where,
    include: {
      supervisores: {
        select: { supervisor_id: true },
      },
    },
    orderBy: { nombre: 'asc' },
  });
};

const crear = async (data) => {
  const { supervisorIds, ...campos } = data;
  validarGeocerca(campos, true);
  const tolerancia = validarTolerancia(campos.tolerancia_atraso_minutos ?? TOLERANCIA_POR_DEFECTO_MINUTOS);

  return prisma.$transaction(async (tx) => {
    const nueva = await tx.instalacion.create({
      data: {
        ...campos,
        latitud:          parseFloat(campos.latitud),
        longitud:         parseFloat(campos.longitud),
        radio_geofence_m: parseInt(campos.radio_geofence_m ?? 100, 10),
        tolerancia_atraso_minutos: tolerancia,
      },
      include: {
        supervisores: {
          select: { supervisor_id: true },
        },
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
  return prisma.instalacion.findUniqueOrThrow({
    where: { id },
    include: {
      supervisores: {
        select: { supervisor_id: true },
      },
    },
  });
};

const editar = async (id, data) => {
  const { supervisorIds, ...campos } = data;
  validarGeocerca(campos);

  const dataToUpdate = { ...campos };
  if (campos.tolerancia_atraso_minutos !== undefined) {
    dataToUpdate.tolerancia_atraso_minutos = validarTolerancia(campos.tolerancia_atraso_minutos);
  }
  if (campos.latitud !== undefined) {
    dataToUpdate.latitud = parseFloat(campos.latitud);
  }
  if (campos.longitud !== undefined) {
    dataToUpdate.longitud = parseFloat(campos.longitud);
  }
  if (campos.radio_geofence_m !== undefined) {
    dataToUpdate.radio_geofence_m = parseInt(campos.radio_geofence_m, 10);
  }

  return prisma.$transaction(async (tx) => {
    const actualizada = await tx.instalacion.update({
      where: { id },
      data: dataToUpdate,
      include: {
        supervisores: {
          select: { supervisor_id: true },
        },
      },
    });

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
