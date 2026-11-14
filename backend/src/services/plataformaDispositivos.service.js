/**
 * Equipos principales de cada empresa, vistos desde la consola de plataforma (solo SUPER_ADMIN).
 * Expone únicamente estado de los equipos; nunca hashes ni datos operativos.
 */
const { prismaGlobal } = require('../config/database');
const { conEmpresa } = require('../config/tenant');
const { ESTADO_USUARIO } = require('../constants/estados');
const { ROLES } = require('../constants/roles');
const invitaciones = require('./invitacionesDispositivo.service');
const equipos = require('./dispositivos.service');

const estadoDe = (d, ahora) => {
  if (d.estado !== 'activo') return 'revocado';
  if (d.token_hash) return 'enrolado';
  return d.invitacion_hash && d.invitacion_expira_en > ahora ? 'pendiente' : 'vencido';
};

const listar = async () => {
  const ahora = new Date();
  const empresas = await prismaGlobal.empresa.findMany({
    orderBy: { nombre: 'asc' },
    select: {
      id: true, nombre: true, estado: true,
      usuarios: { where: { rol: ROLES.ADMINISTRADOR, estado: ESTADO_USUARIO.ACTIVO }, select: { nombre: true, email: true }, take: 1 },
      dispositivos: {
        orderBy: { id: 'desc' },
        select: {
          id: true, nombre: true, estado: true, ultimo_uso: true, token_hash: true, invitacion_hash: true, invitacion_expira_en: true,
          instalacion: { select: { nombre: true } }, invitado: { select: { nombre: true, rol: true } },
        },
      },
    },
  });
  return empresas.map(({ usuarios, dispositivos, ...empresa }) => ({
    ...empresa,
    administrador: usuarios[0] ?? null,
    equipos: dispositivos.map(({ token_hash, invitacion_hash, invitado, instalacion, ...d }) => ({
      ...d, estado: estadoDe({ ...d, token_hash, invitacion_hash }, ahora),
      instalacion: instalacion?.nombre ?? null, destinatario: invitado ? { nombre: invitado.nombre, rol: invitado.rol } : null,
      principal: !invitado || invitado.rol === ROLES.ADMINISTRADOR,
    })),
  }));
};

const invitar = (empresaId, nombre) => invitaciones.invitarPrincipal(empresaId, nombre);

const revocar = async (empresaId, id) => {
  // La plataforma puede revocar cualquier equipo de la empresa (p. ej. un duplicado del principal).
  const equipo = await conEmpresa(empresaId, () => prismaGlobal.dispositivo.findFirst({
    where: { id, empresa_id: empresaId }, select: { id: true },
  }));
  if (!equipo) throw Object.assign(new Error('Equipo no encontrado.'), { statusCode: 404 });
  await conEmpresa(empresaId, () => equipos.revocar(id));
  equipos.invalidar(id, empresaId);
};

module.exports = { listar, invitar, revocar };
