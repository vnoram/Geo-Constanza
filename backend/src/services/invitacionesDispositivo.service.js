const { createHash, createHmac, randomBytes } = require('node:crypto');
const jwt = require('jsonwebtoken');
const { prisma, prismaGlobal } = require('../config/database');
const { conEmpresa } = require('../config/tenant');
const { jwtConfig } = require('../config/jwt');
const { ESTADO_EMPRESA, ESTADO_USUARIO } = require('../constants/estados');
const { ROLES } = require('../constants/roles');
const { enviarCorreo } = require('./correo.service');

const ROLES_INVITABLES = [ROLES.SUPERVISOR, ROLES.OPERADOR_CENTRAL];
const FILTRO_DESTINATARIO = { rol: { in: ROLES_INVITABLES }, estado: ESTADO_USUARIO.ACTIVO };
const error = (statusCode, message) => Object.assign(new Error(message), { statusCode });
const invalida = () => error(400, 'La invitación no es válida para este acceso o ha vencido.');
const hash = token => createHash('sha256').update(token).digest('hex');
const clave = () => createHmac('sha256', jwtConfig.accessSecret).update('geo:dispositivo:invitacion:v1').digest();
const TIPO_PENDIENTE = 'dispositivo_pendiente';

const destinatarios = () => prisma.usuario.findMany({
  where: FILTRO_DESTINATARIO, select: { id: true, nombre: true, email: true, rol: true }, orderBy: { nombre: 'asc' },
});

async function obtenerDestinatario(id) {
  const usuario = await prisma.usuario.findFirst({
    where: { id, ...FILTRO_DESTINATARIO }, select: { email: true, nombre: true },
  });
  if (!usuario) throw error(400, 'Selecciona un supervisor u operador central activo de tu empresa.');
  return usuario;
}

function generarInvitacion() {
  const token = randomBytes(32).toString('hex');
  let url;
  try {
    url = new URL(process.env.FRONTEND_URL);
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) throw new Error();
  } catch (_) {
    throw error(503, 'El enlace de invitación no está disponible.');
  }
  url.hash = '/enrolar?t=' + token;
  return {
    enlace: url.toString(),
    datos: { invitacion_hash: hash(token), invitacion_expira_en: new Date(Date.now() + 15 * 60_000) },
  };
}

async function entregar(usuario, nombre, enlace) {
  const texto = [
    'Hola ' + usuario.nombre + ',',
    'Te invitaron a registrar el equipo «' + nombre + '» como corporativo de Geo Constanza.',
    'Abre este enlace en el equipo, confirma e inicia sesión con tu cuenta:',
    enlace,
    'El enlace vence en 15 minutos y solo puede usarse una vez.',
  ].join('\n\n');
  return enviarCorreo(usuario.email, 'Invitación a un equipo corporativo - Geo Constanza', undefined, texto, { soloSMTP: true });
}

async function invitar(nombre, destinatarioId, adminId) {
  const usuario = await obtenerDestinatario(destinatarioId);
  const { datos, enlace } = generarInvitacion();
  const equipo = await prisma.dispositivo.create({
    data: { nombre, creado_por: adminId, invitado_usuario_id: destinatarioId, ...datos },
    select: { id: true, invitacion_expira_en: true },
  });
  return { ...equipo, enlace, correoEnviado: await entregar(usuario, nombre, enlace) };
}

async function reenviar(id) {
  const equipo = await prisma.dispositivo.findFirst({
    where: { id, estado: 'activo', token_hash: null, invitado_usuario_id: { not: null } },
    select: { nombre: true, invitado_usuario_id: true, invitacion_hash: true },
  });
  if (!equipo) throw error(404, 'Invitación pendiente no encontrada.');
  const usuario = await obtenerDestinatario(equipo.invitado_usuario_id);
  const { datos, enlace } = generarInvitacion();
  const { count } = await prisma.dispositivo.updateMany({
    where: { id, estado: 'activo', token_hash: null, invitacion_hash: equipo.invitacion_hash, invitado: { is: FILTRO_DESTINATARIO } },
    data: datos,
  });
  if (!count) throw error(404, 'Invitación pendiente no encontrada.');
  return { id, invitacion_expira_en: datos.invitacion_expira_en, enlace, correoEnviado: await entregar(usuario, equipo.nombre, enlace) };
}

const filtroVigente = digest => ({
  invitacion_hash: digest, invitacion_expira_en: { gt: new Date() }, token_hash: null,
  estado: 'activo', empresa: { estado: ESTADO_EMPRESA.ACTIVA }, invitado: { is: FILTRO_DESTINATARIO },
});

async function confirmar(token) {
  // El hash único identifica la empresa sin exponer datos del destinatario.
  const equipo = await prismaGlobal.dispositivo.findFirst({
    where: filtroVigente(hash(token)), select: { empresa: { select: { nombre: true } } },
  });
  if (!equipo) throw invalida();
  return { empresa: equipo.empresa.nombre };
}

async function validarParaUsuario(usuario, token) {
  if (!usuario.empresa_id || !ROLES_INVITABLES.includes(usuario.rol)) throw invalida();
  const digest = hash(token);
  const equipo = await conEmpresa(usuario.empresa_id, async () => prisma.dispositivo.findFirst({
    where: { ...filtroVigente(digest), invitado_usuario_id: usuario.id }, select: { id: true },
  }));
  if (!equipo) throw invalida();
  return digest;
}

async function consumir(usuario, digest) {
  if (!usuario.empresa_id || !ROLES_INVITABLES.includes(usuario.rol)) throw invalida();
  const tokenDispositivo = randomBytes(32).toString('hex');
  const { count } = await conEmpresa(usuario.empresa_id, async () => prisma.dispositivo.updateMany({
    where: { ...filtroVigente(digest), invitado_usuario_id: usuario.id },
    data: {
      token_hash: hash(tokenDispositivo), enrolado_por: usuario.id,
      invitacion_hash: null, invitacion_expira_en: null, ultimo_uso: new Date(),
    },
  }));
  if (!count) throw invalida();
  return tokenDispositivo;
}

function vincularSegundoFactor(desafio, digest) {
  if (!digest) return desafio;
  return {
    ...desafio,
    tempToken: jwt.sign({ tipo: TIPO_PENDIENTE, original: desafio.tempToken, digest }, clave(), {
      algorithm: 'HS256', expiresIn: '10m',
    }),
  };
}

function separarSegundoFactor(token) {
  // Los desafíos de 2FA existentes conservan su formato y su validación original.
  if (jwt.decode(token)?.tipo !== TIPO_PENDIENTE) return { token };
  try {
    const payload = jwt.verify(token, clave(), { algorithms: ['HS256'] });
    return { token: payload.original, digest: payload.digest };
  } catch (_) { throw invalida(); }
}

module.exports = {
  destinatarios, invitar, reenviar, confirmar, validarParaUsuario, consumir,
  vincularSegundoFactor, separarSegundoFactor,
};
