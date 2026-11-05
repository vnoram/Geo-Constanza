/**
 * Gestión de empresas (nivel de plataforma, solo SUPER_ADMIN).
 *
 * Usa `prismaGlobal` a propósito: las empresas no pertenecen a ninguna empresa. Este módulo NO lee
 * ni escribe datos operativos (guardias, turnos, novedades, asistencia, solicitudes); lo único que
 * toca de una empresa son sus datos propios, sus contadores y la cuenta de su primer administrador.
 */
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const { prismaGlobal } = require('../config/database');
const { ROLES } = require('../constants/roles');
const { ESTADO_EMPRESA, ESTADO_USUARIO, PLANES_EMPRESA } = require('../constants/estados');
const { normalizarRut } = require('../utils/rut');
const { registrarAuditoria } = require('../middlewares/auditLog');
const passwordReset = require('./passwordReset.service');

const BCRYPT_ROUNDS = 12;
const rechazo = (mensaje, statusCode = 400) => Object.assign(new Error(mensaje), { statusCode });
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const SELECT_EMPRESA = {
  id: true,
  nombre: true,
  rut: true,
  estado: true,
  plan: true,
  created_at: true,
  // Solo conteos y la cuenta de administración: nunca datos operativos de la empresa.
  _count: { select: { usuarios: true, instalaciones: true } },
  usuarios: { where: { rol: ROLES.ADMINISTRADOR }, select: { id: true, nombre: true, email: true, estado: true } },
};

const aVista = ({ usuarios, _count, ...empresa }) => ({
  ...empresa,
  total_usuarios: _count.usuarios,
  total_instalaciones: _count.instalaciones,
  administradores: usuarios,
});

const validarNombre = (nombre) => {
  const limpio = typeof nombre === 'string' ? nombre.trim() : '';
  if (limpio.length < 3 || limpio.length > 120) throw rechazo('El nombre de la empresa debe tener entre 3 y 120 caracteres.');
  return limpio;
};

const validarRutEmpresa = (rut) => {
  const normalizado = normalizarRut(rut);
  if (!normalizado) throw rechazo('El RUT de la empresa no es válido.');
  return normalizado;
};

const validarPlan = (plan) => {
  if (!PLANES_EMPRESA.includes(plan)) throw rechazo(`Plan inválido. Valores permitidos: ${PLANES_EMPRESA.join(', ')}.`);
  return plan;
};

const traducirDuplicado = (error, mensaje) => {
  if (error?.code === 'P2002') throw rechazo(mensaje, 409);
  throw error;
};

const auditar = (actor, accion, empresaId, valores) => registrarAuditoria({
  usuarioId: actor.id,
  accion,
  tablaAfectada: 'empresas',
  registroId: empresaId,
  valoresDespues: valores,
  ip: actor.ip,
  userAgent: actor.userAgent,
  empresaId: null, // acción de plataforma: no pertenece a ninguna empresa
});

const listar = async () => (await prismaGlobal.empresa.findMany({
  select: SELECT_EMPRESA,
  orderBy: { created_at: 'desc' },
})).map(aVista);

const obtener = async (id) => {
  const empresa = await prismaGlobal.empresa.findUnique({ where: { id }, select: SELECT_EMPRESA });
  if (!empresa) throw rechazo('Empresa no encontrada.', 404);
  return aVista(empresa);
};

const crear = async (datos, actor) => {
  const data = {
    nombre: validarNombre(datos?.nombre),
    rut: validarRutEmpresa(datos?.rut),
    plan: validarPlan(datos?.plan ?? 'estandar'),
  };
  try {
    const creada = await prismaGlobal.empresa.create({ data, select: SELECT_EMPRESA });
    await auditar(actor, 'crear_empresa', creada.id, { nombre: data.nombre, rut: data.rut, plan: data.plan });
    return aVista(creada);
  } catch (error) {
    return traducirDuplicado(error, 'Ya existe una empresa con ese RUT.');
  }
};

const editar = async (id, datos, actor) => {
  const data = {};
  if (datos?.nombre !== undefined) data.nombre = validarNombre(datos.nombre);
  if (datos?.rut !== undefined) data.rut = validarRutEmpresa(datos.rut);
  if (datos?.plan !== undefined) data.plan = validarPlan(datos.plan);
  if (!Object.keys(data).length) throw rechazo('No hay campos para actualizar.');
  try {
    const editada = await prismaGlobal.empresa.update({ where: { id }, data, select: SELECT_EMPRESA });
    await auditar(actor, 'editar_empresa', id, data);
    return aVista(editada);
  } catch (error) {
    if (error?.code === 'P2025') throw rechazo('Empresa no encontrada.', 404);
    return traducirDuplicado(error, 'Ya existe una empresa con ese RUT.');
  }
};

/**
 * Activa o suspende una empresa. Suspender corta el acceso de inmediato: `authenticate` revisa el
 * estado en cada petición y se desconectan sus sockets.
 */
const cambiarEstado = async (id, estado, actor, { desconectar } = {}) => {
  if (![ESTADO_EMPRESA.ACTIVA, ESTADO_EMPRESA.SUSPENDIDA].includes(estado)) {
    throw rechazo(`Estado inválido. Valores permitidos: ${Object.values(ESTADO_EMPRESA).join(', ')}.`);
  }
  try {
    const empresa = await prismaGlobal.empresa.update({ where: { id }, data: { estado }, select: SELECT_EMPRESA });
    await auditar(actor, estado === ESTADO_EMPRESA.SUSPENDIDA ? 'suspender_empresa' : 'activar_empresa', id, { estado });
    if (estado === ESTADO_EMPRESA.SUSPENDIDA && typeof desconectar === 'function') {
      try { desconectar(id); } catch (_) { /* sin sockets activos: nada que desconectar */ }
    }
    return aVista(empresa);
  } catch (error) {
    if (error?.code === 'P2025') throw rechazo('Empresa no encontrada.', 404);
    throw error;
  }
};

/**
 * Crea el primer administrador de gestión de una empresa. Nadie define su contraseña: se guarda una
 * clave aleatoria que nadie conoce y se le envía una invitación por correo para que elija la suya.
 * Solo se permite mientras la empresa no tenga un administrador activo.
 */
const crearPrimerAdmin = async (empresaId, datos, actor) => {
  const nombre = typeof datos?.nombre === 'string' ? datos.nombre.trim() : '';
  if (nombre.length < 3) throw rechazo('El nombre del administrador es obligatorio.');
  const rut = normalizarRut(datos?.rut);
  if (!rut) throw rechazo('El RUT del administrador no es válido.');
  const email = typeof datos?.email === 'string' ? datos.email.trim().toLowerCase() : '';
  if (!EMAIL.test(email)) throw rechazo('El correo del administrador no es válido.');

  const empresa = await prismaGlobal.empresa.findUnique({ where: { id: empresaId }, select: { id: true } });
  if (!empresa) throw rechazo('Empresa no encontrada.', 404);

  const yaTiene = await prismaGlobal.usuario.count({
    where: { empresa_id: empresaId, rol: ROLES.ADMINISTRADOR, estado: ESTADO_USUARIO.ACTIVO },
  });
  if (yaTiene > 0) throw rechazo('La empresa ya tiene un administrador activo.', 409);

  const password_hash = await bcrypt.hash(crypto.randomBytes(32).toString('hex'), BCRYPT_ROUNDS);
  let creado;
  try {
    creado = await prismaGlobal.usuario.create({
      data: { empresa_id: empresaId, rol: ROLES.ADMINISTRADOR, nombre, rut, email, password_hash, telefono: datos?.telefono || null },
      select: { id: true, nombre: true, email: true, rol: true, estado: true },
    });
  } catch (error) {
    return traducirDuplicado(error, 'Ya existe un usuario con ese RUT o correo.');
  }

  let invitacion_enviada = false;
  try { invitacion_enviada = await passwordReset.invitar(creado); } catch (_) { /* se puede reenviar con "Olvidé mi contraseña" */ }
  await auditar(actor, 'crear_admin_empresa', empresaId, { usuario_id: creado.id, email });
  return { ...creado, invitacion_enviada };
};

module.exports = { listar, obtener, crear, editar, cambiarEstado, crearPrimerAdmin };
