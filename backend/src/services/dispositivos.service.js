const { createHash, randomBytes } = require('node:crypto');
const { prisma, prismaGlobal } = require('../config/database');
const { conEmpresa } = require('../config/tenant');
const { ESTADO_EMPRESA } = require('../constants/estados');
const { ROLES } = require('../constants/roles');

const TIPOS = { CORPORATIVO: 'corporativo', PERSONAL: 'personal' };
const GUARDIAS = [ROLES.GGSS_EN_PAUTA, ROLES.GGSS_LIBRE];
const ACTIVO = 'activo';
const REVOCADO = 'revocado';
const habilitada = () => process.env.DEVICE_POLICY === 'on';
const hash = (valor) => createHash('sha256').update(valor).digest('hex');
const error = (statusCode, message) => Object.assign(new Error(message), { statusCode });
const vista = { id: true, nombre: true, tipo: true, estado: true, codigo_expira_en: true, ultimo_uso: true };

const crear = async (nombre, usuarioId) => {
  const codigo = randomBytes(12).toString('hex');
  const dispositivo = await prisma.dispositivo.create({
    data: {
      nombre, creado_por: usuarioId, codigo_enrolamiento_hash: hash(codigo),
      codigo_expira_en: new Date(Date.now() + 15 * 60_000),
    },
    select: vista,
  });
  return { ...dispositivo, codigo };
};

const listar = async () => prisma.dispositivo.findMany({ select: vista, orderBy: { nombre: 'asc' } });

const canjear = async (codigo) => {
  const digest = hash(codigo);
  // El código aleatorio identifica la empresa antes de que exista una sesión.
  const candidato = await prismaGlobal.dispositivo.findUnique({
    where: { codigo_enrolamiento_hash: digest },
    select: { id: true, empresa_id: true },
  });
  const invalido = () => error(400, 'Código de enrolamiento inválido o vencido.');
  if (!candidato) throw invalido();
  const token = randomBytes(32).toString('hex');
  const { count } = await conEmpresa(candidato.empresa_id, async () => prisma.dispositivo.updateMany({
    where: {
      id: candidato.id, estado: ACTIVO, codigo_enrolamiento_hash: digest,
      codigo_expira_en: { gt: new Date() }, empresa: { estado: ESTADO_EMPRESA.ACTIVA },
    },
    data: { token_hash: hash(token), codigo_enrolamiento_hash: null, codigo_expira_en: null },
  }));
  if (!count) throw invalido();
  return { token };
};

const revocar = async (id) => {
  const { count } = await prisma.dispositivo.updateMany({
    where: { id },
    data: { estado: REVOCADO, token_hash: null, codigo_enrolamiento_hash: null, codigo_expira_en: null },
  });
  if (!count) throw error(404, 'Dispositivo no encontrado.');
};

const identificar = async (empresaId, token, id) => {
  if (!empresaId || typeof token !== 'string' || !/^[a-f0-9]{64}$/.test(token)) return null;
  return conEmpresa(empresaId, async () => prisma.dispositivo.findFirst({
    where: { id, token_hash: hash(token), estado: ACTIVO }, select: { id: true },
  }));
};

const clasificar = async (usuario, token, vinculacion) => {
  if (!habilitada()) return {};
  const equipo = vinculacion === null ? null : await identificar(usuario.empresa_id, token, vinculacion);
  if (!equipo && !GUARDIAS.includes(usuario.rol) && usuario.rol !== ROLES.SUPER_ADMIN) {
    throw error(403, 'Este rol requiere un dispositivo corporativo enrolado.');
  }
  if (equipo) await conEmpresa(usuario.empresa_id, async () => prisma.dispositivo.updateMany({
    where: { id: equipo.id, estado: ACTIVO }, data: { ultimo_uso: new Date() },
  }));
  return { dispositivo: equipo ? TIPOS.CORPORATIVO : TIPOS.PERSONAL, dispositivoId: equipo?.id ?? null };
};

module.exports = { TIPOS, GUARDIAS, habilitada, crear, listar, canjear, revocar, identificar, clasificar };
