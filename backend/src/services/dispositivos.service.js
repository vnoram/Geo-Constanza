const { createHash, randomBytes } = require('node:crypto');
const { prisma, prismaGlobal } = require('../config/database');
const { conEmpresa } = require('../config/tenant');
const { ESTADO_EMPRESA } = require('../constants/estados');
const { ROLES } = require('../constants/roles');

const { registrarAuditoria } = require('../middlewares/auditLog');

const TIPOS = { CORPORATIVO: 'corporativo', PERSONAL: 'personal' };
const GUARDIAS = [ROLES.GGSS_EN_PAUTA, ROLES.GGSS_LIBRE];
const ACTIVO = 'activo';
const REVOCADO = 'revocado';
const habilitada = () => process.env.DEVICE_POLICY === 'on';
const hash = (valor) => createHash('sha256').update(valor).digest('hex');
const error = (statusCode, message) => Object.assign(new Error(message), { statusCode });
const vista = {
  id: true, nombre: true, tipo: true, estado: true, codigo_expira_en: true, ultimo_uso: true,
  invitacion_expira_en: true, invitado_usuario_id: true,
  enrolador: { select: { nombre: true } },
  instalacion: { select: { id: true, nombre: true } },
};

const cache = new Map();
const HORA = 3_600_000;
let versionCache = 0;
function invalidar(id, empresaId) {
  versionCache++;
  for (const [clave, valor] of cache) {
    if (valor.empresaId === empresaId && valor.equipo.id === id) cache.delete(clave);
  }
}

const auditar = (accion, registroId, usuarioId, empresaId, contexto, autenticado = true) =>
  registrarAuditoria({ accion, registroId, usuarioId, empresaId, tablaAfectada: 'dispositivos', valoresDespues: { autenticado }, ...contexto });

async function validarInstalacion(id) {
  if (!id) return null;
  const instalacion = await prisma.instalacion.findUnique({ where: { id }, select: { id: true } });
  if (!instalacion) throw error(400, 'Selecciona una instalación de tu empresa.');
  return instalacion.id;
}

const crear = async (nombre, usuarioId, instalacionId) => {
  const codigo = randomBytes(12).toString('hex');
  const dispositivo = await prisma.dispositivo.create({
    data: {
      nombre, creado_por: usuarioId, codigo_enrolamiento_hash: hash(codigo),
      instalacion_id: await validarInstalacion(instalacionId),
      codigo_expira_en: new Date(Date.now() + 15 * 60_000),
    },
    select: vista,
  });
  return { ...dispositivo, codigo };
};

const listar = async () => prisma.dispositivo.findMany({ select: vista, orderBy: { nombre: 'asc' } });

const canjear = async (codigo, contexto) => {
  const digest = hash(codigo);
  // El código aleatorio identifica la empresa antes de que exista una sesión.
  const candidato = await prismaGlobal.dispositivo.findUnique({
    where: { codigo_enrolamiento_hash: digest },
    select: { id: true, empresa_id: true, creado_por: true },
  });
  const invalido = () => error(400, 'Código de enrolamiento inválido o vencido.');
  if (!candidato) throw invalido();
  const token = randomBytes(32).toString('hex');
  const { count } = await conEmpresa(candidato.empresa_id, async () => prisma.dispositivo.updateMany({
    where: {
      id: candidato.id, estado: ACTIVO, codigo_enrolamiento_hash: digest,
      codigo_expira_en: { gt: new Date() }, empresa: { estado: ESTADO_EMPRESA.ACTIVA },
    },
    data: { token_hash: hash(token), codigo_enrolamiento_hash: null, codigo_expira_en: null, ultimo_uso: new Date() },
  }));
  if (!count) throw invalido();
  await auditar('canjear_codigo_dispositivo', candidato.id, candidato.creado_por, candidato.empresa_id, contexto, false);
  return { token };
};

const revocar = async (id) => {
  const { count } = await prisma.dispositivo.updateMany({
    where: { id },
    data: { estado: REVOCADO, token_hash: null, codigo_enrolamiento_hash: null, codigo_expira_en: null, invitacion_hash: null, invitacion_expira_en: null },
  });
  if (!count) throw error(404, 'Dispositivo no encontrado.');
};

const identificar = async (empresaId, token, id) => {
  if (!empresaId || typeof token !== 'string' || !/^[a-f0-9]{64}$/.test(token)) return null;
  const digest = hash(token);
  const clave = empresaId + ':' + digest;
  const ahora = Date.now();
  const dias = Number(process.env.DEVICE_TOKEN_MAX_INACTIVIDAD_DIAS);
  const maxInactividad = (Number.isFinite(dias) && dias > 0 ? dias : 90) * 24 * HORA;
  const almacenado = cache.get(clave);
  if (almacenado?.vence > ahora && (!id || almacenado.equipo.id === id)) return almacenado.equipo;
  const version = versionCache;
  const equipo = await conEmpresa(empresaId, async () => {
    const encontrado = await prisma.dispositivo.findFirst({
      where: {
        id, token_hash: digest, estado: ACTIVO,
        OR: [{ ultimo_uso: null }, { ultimo_uso: { gte: new Date(ahora - maxInactividad) } }],
      },
      select: { id: true, instalacion_id: true, ultimo_uso: true },
    });
    if (!encontrado) return null;
    if (!encontrado.ultimo_uso || ahora - encontrado.ultimo_uso.getTime() >= HORA) {
      const { count } = await prisma.dispositivo.updateMany({
        where: {
          id: encontrado.id, estado: ACTIVO, token_hash: digest,
          OR: [{ ultimo_uso: null }, { ultimo_uso: { lte: new Date(ahora - HORA) } }],
        },
        data: { ultimo_uso: new Date(ahora) },
      });
      if (count) encontrado.ultimo_uso = new Date(ahora);
    }
    return encontrado;
  });
  if (version !== versionCache) return null;
  if (equipo) {
    if (cache.size >= 2048) cache.delete(cache.keys().next().value);
    cache.set(clave, { equipo, empresaId, vence: Math.min(ahora + 45_000, (equipo.ultimo_uso?.getTime() ?? ahora) + maxInactividad) });
  }
  return equipo;
};

const clasificar = async (usuario, token, vinculacion) => {
  if (!habilitada()) return {};
  const equipo = vinculacion === null ? null : await identificar(usuario.empresa_id, token, vinculacion);
  if (!equipo && !GUARDIAS.includes(usuario.rol) && usuario.rol !== ROLES.SUPER_ADMIN) {
    throw error(403, 'Este rol requiere un dispositivo corporativo enrolado.');
  }
  return { dispositivo: equipo ? TIPOS.CORPORATIVO : TIPOS.PERSONAL, dispositivoId: equipo?.id ?? null };
};

module.exports = { TIPOS, GUARDIAS, habilitada, crear, listar, canjear, revocar, identificar, clasificar, validarInstalacion, invalidar, auditar };
