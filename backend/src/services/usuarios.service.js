const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const { prisma } = require('../config/database');
const { ROLES } = require('../constants/roles');
const passwordReset = require('./passwordReset.service');

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

const rechazo = (mensaje) => Object.assign(new Error(mensaje), { statusCode: 400 });

// Nadie define la contraseña de otra persona: se guarda una clave aleatoria que nadie conoce y se envía
// una invitación por correo para que la persona elija la suya. Si llega `password`, se descarta.
const crear = async (data) => {
  // eslint-disable-next-line no-unused-vars
  const { instalacionIds, comunas, password: _descartada, ...campos } = data;
  if (!Object.values(ROLES).includes(campos.rol)) throw rechazo('Rol de usuario inválido.');
  if (campos.rol === ROLES.ADMINISTRADOR) throw rechazo('No se pueden crear administradores desde el sistema.');

  const password_hash = await bcrypt.hash(crypto.randomBytes(32).toString('hex'), BCRYPT_ROUNDS);

  // Guardar comunas de cobertura como JSON si el rol es supervisor
  if (campos.rol === ROLES.SUPERVISOR && Array.isArray(comunas)) {
    campos.comunas_cobertura = comunas.filter((c) => typeof c === 'string' && c.trim());
  }

  const creado = await prisma.$transaction(async (tx) => {
    const nuevo = await tx.usuario.create({
      data: { ...campos, password_hash },
      select: { id: true, nombre: true, email: true, rol: true, estado: true },
    });

    if (campos.rol === ROLES.SUPERVISOR && Array.isArray(instalacionIds) && instalacionIds.length > 0) {
      await tx.supervisor_Instalacion.createMany({
        data: instalacionIds.map((instalacion_id) => ({ supervisor_id: nuevo.id, instalacion_id })),
        skipDuplicates: true,
      });
    }

    return nuevo;
  });

  let invitacion_enviada = false;
  try { invitacion_enviada = await passwordReset.invitar(creado); } catch (_) { /* el usuario ya existe: se puede reenviar con "Olvidé mi contraseña" */ }
  return { ...creado, invitacion_enviada };
};

const editar = async (id, data) => {
  // eslint-disable-next-line no-unused-vars
  const { instalacionIds, comunas, password: _descartada, ...campos } = data;
  if (campos.rol !== undefined) {
    if (!Object.values(ROLES).includes(campos.rol)) throw rechazo('Rol de usuario inválido.');
    const actual = await prisma.usuario.findUnique({ where: { id }, select: { rol: true } });
    if (actual?.rol === ROLES.ADMINISTRADOR && campos.rol !== ROLES.ADMINISTRADOR) {
      throw rechazo('No se puede cambiar el rol de un administrador.');
    }
    if (campos.rol === ROLES.ADMINISTRADOR && actual?.rol !== ROLES.ADMINISTRADOR) {
      throw rechazo('No se puede asignar el rol de administrador.');
    }
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
    if (rolFinal === ROLES.SUPERVISOR && Array.isArray(instalacionIds)) {
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
  const objetivo = await prisma.usuario.findUnique({ where: { id }, select: { rol: true } });
  if (objetivo?.rol === ROLES.ADMINISTRADOR) throw rechazo('No se puede desactivar a un administrador.');
  return prisma.usuario.update({
    where: { id },
    data: { estado: 'inactivo' },
    select: { id: true, nombre: true, email: true, rol: true, estado: true },
  });
};

module.exports = { miInformacion, listar, crear, editar, desactivar };
