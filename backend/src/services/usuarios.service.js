const bcrypt = require('bcryptjs');
const { prisma } = require('../config/database');

const BCRYPT_ROUNDS = 12;

/**
 * Devuelve el perfil completo del usuario autenticado.
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
      created_at: true,
    },
  });
};

const listar = async ({ rol, estado, page, limit }) => {
  const where = {};
  if (rol) where.rol = rol;
  if (estado) where.estado = estado;

  const [data, total] = await Promise.all([
    prisma.usuario.findMany({
      where,
      select: { id: true, rut: true, nombre: true, email: true, telefono: true, rol: true, estado: true, created_at: true },
      orderBy: { nombre: 'asc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.usuario.count({ where }),
  ]);

  return { data, total, page, totalPages: Math.ceil(total / limit) };
};

const crear = async (data) => {
  const passwordHash = await bcrypt.hash(data.password, BCRYPT_ROUNDS);
  return prisma.usuario.create({
    data: {
      rut: data.rut,
      nombre: data.nombre,
      email: data.email,
      telefono: data.telefono,
      password_hash: passwordHash,
      rol: data.rol,
    },
    select: { id: true, nombre: true, email: true, rol: true, estado: true },
  });
};

const editar = async (id, data) => {
  const updateData = { ...data };
  if (data.password) {
    updateData.password_hash = await bcrypt.hash(data.password, BCRYPT_ROUNDS);
    delete updateData.password;
  }
  return prisma.usuario.update({
    where: { id },
    data: updateData,
    select: { id: true, nombre: true, email: true, rol: true, estado: true },
  });
};

const desactivar = async (id) => {
  return prisma.usuario.update({
    where: { id },
    data: { estado: 'inactivo' },
  });
};

module.exports = { miInformacion, listar, crear, editar, desactivar };
