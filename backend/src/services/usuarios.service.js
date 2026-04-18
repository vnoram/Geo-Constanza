const bcrypt = require('bcryptjs');
const { prisma } = require('../config/database');

const BCRYPT_ROUNDS = 12;

/**
 * Devuelve el perfil completo del usuario autenticado.
 * Para supervisores incluye todas las instalaciones asignadas vía Supervisor_Instalacion.
 */
const miInformacion = async (userId) => {
  return prisma.usuario.findUniqueOrThrow({
    where: { id: userId },
    select: {
      id: true,
      rut: true,
      nombre: true,
      email: true,
      telefono: true,
      rol: true,
      tipo_ggss: true,
      estado: true,
      dispositivo_principal: true,
      instalacion_asignada_id: true,
      instalacion_asignada: {
        select: { id: true, nombre: true, direccion: true, latitud: true, longitud: true },
      },
      instalaciones_sup: {
        select: {
          instalacion: {
            select: { id: true, nombre: true, direccion: true, nivel_criticidad: true, latitud: true, longitud: true },
          },
        },
      },
      comunas_cobertura: true,
      created_at: true,
    },
  });
};

const listar = async ({ rol, estado, page, limit }) => {
  const where = {};
  if (rol)    where.rol    = rol;
  if (estado) where.estado = estado;

  const [data, total] = await Promise.all([
    prisma.usuario.findMany({
      where,
      select: {
        id: true, rut: true, nombre: true, email: true,
        telefono: true, rol: true, estado: true, created_at: true,
        instalacion_asignada_id: true,
        instalacion_asignada: { select: { id: true, nombre: true } },
        instalaciones_sup: {
          select: {
            instalacion_id: true,
            instalacion: { select: { id: true, nombre: true } },
          },
        },
        comunas_cobertura: true,
      },
      orderBy: { nombre: 'asc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.usuario.count({ where }),
  ]);

  return { data, total, page, totalPages: Math.ceil(total / limit) };
};

const crear = async (data) => {
  const { instalacionIds, comunas, password, ...campos } = data;

  const password_hash = await bcrypt.hash(password, BCRYPT_ROUNDS);

  // Guardar comunas de cobertura como JSON si el rol es supervisor
  if (campos.rol === 'supervisor' && Array.isArray(comunas)) {
    campos.comunas_cobertura = comunas.filter((c) => typeof c === 'string' && c.trim());
  }

  return prisma.$transaction(async (tx) => {
    const nuevo = await tx.usuario.create({
      data: { ...campos, password_hash },
      select: { id: true, nombre: true, email: true, rol: true, estado: true },
    });

    if (campos.rol === 'supervisor' && Array.isArray(instalacionIds) && instalacionIds.length > 0) {
      await tx.supervisor_Instalacion.createMany({
        data: instalacionIds.map((instalacion_id) => ({ supervisor_id: nuevo.id, instalacion_id })),
        skipDuplicates: true,
      });
    }

    return nuevo;
  });
};

const editar = async (id, data) => {
  const { instalacionIds, comunas, password, ...campos } = data;

  if (password) {
    campos.password_hash = await bcrypt.hash(password, BCRYPT_ROUNDS);
  }

  // Actualizar comunas de cobertura si se envió el array (solo supervisores)
  if (Array.isArray(comunas)) {
    campos.comunas_cobertura = comunas.filter((c) => typeof c === 'string' && c.trim());
  }

  return prisma.$transaction(async (tx) => {
    const actualizado = await tx.usuario.update({
      where: { id },
      data: campos,
      select: { id: true, nombre: true, email: true, rol: true, estado: true },
    });

    // Sincronizar instalaciones directas si el rol final es supervisor y se envió el array
    const rolFinal = campos.rol ?? actualizado.rol;
    if (rolFinal === 'supervisor' && Array.isArray(instalacionIds)) {
      await tx.supervisor_Instalacion.deleteMany({ where: { supervisor_id: id } });
      if (instalacionIds.length > 0) {
        await tx.supervisor_Instalacion.createMany({
          data: instalacionIds.map((instalacion_id) => ({ supervisor_id: id, instalacion_id })),
          skipDuplicates: true,
        });
      }
    }

    return actualizado;
  });
};

const desactivar = async (id) => {
  return prisma.usuario.update({
    where: { id },
    data: { estado: 'inactivo' },
  });
};

module.exports = { miInformacion, listar, crear, editar, desactivar };
