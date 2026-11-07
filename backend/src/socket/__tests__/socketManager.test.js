jest.mock('jsonwebtoken', () => ({ verify: jest.fn(token => JSON.parse(token)) }));
jest.mock('../../config/redis', () => ({ getRedis: jest.fn(() => null) }));
jest.mock('../../config/database', () => {
  const prisma = {
    usuario: { findUnique: jest.fn() }, turno: { findMany: jest.fn() }, instalacion: { findUnique: jest.fn() },
    novedad: { findUnique: jest.fn(), update: jest.fn() },
    novedadHistorial: { create: jest.fn() }, $transaction: jest.fn(),
  };
  // El arranque del socket consulta al usuario con el cliente global; el resto usa el cliente con alcance.
  return { prisma, prismaGlobal: { usuario: prisma.usuario } };
});
jest.mock('../../services/supervisor.helper', () => ({ resolverInstalacionesSupervisor: jest.fn() }));
jest.mock('../../utils/azureStorage', () => ({ generarUrlLectura: jest.fn() }));
const http = require('http');
const { io: cliente } = require('socket.io-client');
const { once } = require('events');
const { initSocket, desconectarEmpresa } = require('../socketManager');
const { prisma } = require('../../config/database');
const { empresaActual } = require('../../config/tenant');
const { ROLES } = require('../../constants/roles');
const { ESTADO_USUARIO, ESTADO_NOVEDAD } = require('../../constants/estados');
const { salaAdmin, salaCentral } = require('../../constants/salas');
const { resolverInstalacionesSupervisor } = require('../../services/supervisor.helper');
const { escalar } = require('../../services/novedades.service');

let server, io, url;
const clientes = [];
const activa = { estado: 'activa' };
const perfiles = {
  g1: { id: 'g1', rol: ROLES.GGSS_EN_PAUTA, estado: ESTADO_USUARIO.ACTIVO, instalacion_asignada_id: 'i1', empresa_id: 'e1', empresa: activa },
  g2: { id: 'g2', rol: ROLES.GGSS_LIBRE, estado: ESTADO_USUARIO.ACTIVO, instalacion_asignada_id: 'i2', empresa_id: 'e1', empresa: activa },
  s1: { id: 's1', rol: ROLES.SUPERVISOR, estado: ESTADO_USUARIO.ACTIVO, empresa_id: 'e1', empresa: activa },
  c1: { id: 'c1', rol: ROLES.OPERADOR_CENTRAL, estado: ESTADO_USUARIO.ACTIVO, empresa_id: 'e1', empresa: activa },
  a1: { id: 'a1', rol: ROLES.ADMINISTRADOR, estado: ESTADO_USUARIO.ACTIVO, empresa_id: 'e1', empresa: activa },
  // Otra empresa (e2)
  c2: { id: 'c2', rol: ROLES.OPERADOR_CENTRAL, estado: ESTADO_USUARIO.ACTIVO, empresa_id: 'e2', empresa: activa },
  a2: { id: 'a2', rol: ROLES.ADMINISTRADOR, estado: ESTADO_USUARIO.ACTIVO, empresa_id: 'e2', empresa: activa },
  // Casos que deben rechazarse
  suspendida: { id: 'x1', rol: ROLES.OPERADOR_CENTRAL, estado: ESTADO_USUARIO.ACTIVO, empresa_id: 'e3', empresa: { estado: 'suspendida' } },
  plataforma: { id: 'p1', rol: ROLES.SUPER_ADMIN, estado: ESTADO_USUARIO.ACTIVO, empresa_id: null, empresa: null },
};
// Instalaciones que existen en cada empresa (las de otra empresa no se ven con el cliente con alcance)
const instalacionesPorEmpresa = { e1: ['i1', 'i2'], e2: ['i9'], e3: [] };

const conectar = async (id) => {
  const perfil = perfiles[id];
  const socket = cliente(url, { auth: { token: JSON.stringify({ ...perfil, empresaId: perfil.empresa_id }) }, transports: ['websocket'], reconnection: false });
  clientes.push(socket); await once(socket, 'connect'); return socket;
};
const intentarConectar = async (id, empresaIdEnToken) => {
  const perfil = perfiles[id];
  const empresaId = empresaIdEnToken === undefined ? perfil.empresa_id : empresaIdEnToken;
  const s = cliente(url, { auth: { token: JSON.stringify({ ...perfil, empresaId }) }, transports: ['websocket'], reconnection: false });
  clientes.push(s);
  return (await once(s, 'connect_error'))[0];
};
const barrera = async (...sockets) => {
  await Promise.all(sockets.map((s) => { const p = once(s, 'prueba:barrera'); io.to(s.id).emit('prueba:barrera'); return p; }));
};

beforeEach(async () => {
  jest.clearAllMocks();
  prisma.usuario.findUnique.mockImplementation(({ where }) => Promise.resolve(Object.values(perfiles).find(p => p.id === where.id)));
  prisma.turno.findMany.mockResolvedValue([]);
  prisma.instalacion.findUnique.mockImplementation(({ where }) => Promise.resolve(
    (instalacionesPorEmpresa[empresaActual()] || []).includes(where.id) ? { id: where.id } : null,
  ));
  resolverInstalacionesSupervisor.mockResolvedValue(['i1']);
  prisma.$transaction.mockImplementation(fn => fn(prisma));
  prisma.novedad.findUnique.mockResolvedValue({ id: 'n1', instalacion_id: 'i1', estado: ESTADO_NOVEDAD.ABIERTA });
  prisma.novedad.update.mockResolvedValue({ id: 'n1', instalacion_id: 'i1', estado: ESTADO_NOVEDAD.ESCALADA });
  server = http.createServer(); io = initSocket(server);
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  url = `http://127.0.0.1:${server.address().port}`;
});
afterEach(async () => {
  clientes.splice(0).forEach(s => s.disconnect());
  await new Promise(resolve => io.close(resolve));
});

test('sin token no conecta', async () => {
  const s = cliente(url, { transports: ['websocket'], reconnection: false }); clientes.push(s);
  const [error] = await once(s, 'connect_error');
  expect(error.message).toBe('No autorizado');
});
test('un guardia no puede unirse a otra instalación', async () => {
  const s = await conectar('g2');
  await expect(s.timeout(1000).emitWithAck('join:instalacion', 'i1')).resolves.toEqual({ ok: false });
  expect(io.sockets.adapter.rooms.get('instalacion:i1')).toBeUndefined();
});
test('escalamiento real llega a la instalación correcta y no a otro guardia', async () => {
  const [propio, ajeno, supervisor] = await Promise.all([conectar('g1'), conectar('g2'), conectar('s1')]);
  const recibeAjeno = jest.fn(); ajeno.on('novedad:escalada', recibeAjeno);
  const eventoPropio = once(propio, 'novedad:escalada');
  const eventoSupervisor = once(supervisor, 'novedad:escalada');
  await escalar('n1', perfiles.s1);
  expect((await eventoPropio)[0].id).toBe('n1');
  expect((await eventoSupervisor)[0].id).toBe('n1');
  await barrera(ajeno);
  expect(recibeAjeno).not.toHaveBeenCalled();
});
test('central y admin reciben dashboard; alertas críticas solo central', async () => {
  const [guardia, central, admin] = await Promise.all([conectar('g2'), conectar('c1'), conectar('a1')]);
  const fuga = jest.fn(), alertaAdmin = jest.fn();
  guardia.on('admin:dashboard_update', fuga); guardia.on('alerta_critica_central', fuga);
  admin.on('alerta_critica_central', alertaAdmin);
  const dashboardCentral = once(central, 'admin:dashboard_update'), dashboardAdmin = once(admin, 'admin:dashboard_update');
  const alerta = once(central, 'alerta_critica_central');
  io.to([salaAdmin('e1'), salaCentral('e1')]).emit('admin:dashboard_update', { entity: 'novedad' });
  io.to(salaCentral('e1')).emit('alerta_critica_central', { id: 'n1' });
  await Promise.all([dashboardCentral, dashboardAdmin, alerta]);
  await barrera(guardia, admin);
  expect(fuga).not.toHaveBeenCalled(); expect(alertaAdmin).not.toHaveBeenCalled();
});

describe('aislamiento por empresa', () => {
  test('Central y Admin de OTRA empresa no reciben los eventos de la empresa e1', async () => {
    const [central1, admin1, central2, admin2] = await Promise.all([conectar('c1'), conectar('a1'), conectar('c2'), conectar('a2')]);
    const filtracion = jest.fn();
    for (const s of [central2, admin2]) {
      s.on('admin:dashboard_update', filtracion); s.on('alerta_critica_central', filtracion); s.on('guardia:ubicacion', filtracion);
    }
    const llegan = [once(central1, 'admin:dashboard_update'), once(admin1, 'admin:dashboard_update'), once(central1, 'alerta_critica_central')];
    io.to([salaAdmin('e1'), salaCentral('e1')]).emit('admin:dashboard_update', { entity: 'novedad' });
    io.to(salaCentral('e1')).emit('alerta_critica_central', { id: 'n1' });
    await Promise.all(llegan);
    await barrera(central2, admin2);
    expect(filtracion).not.toHaveBeenCalled();
  });

  test('un evento de la empresa e2 tampoco llega a la empresa e1', async () => {
    const [central1, central2] = await Promise.all([conectar('c1'), conectar('c2')]);
    const filtracion = jest.fn(); central1.on('admin:dashboard_update', filtracion);
    const llega = once(central2, 'admin:dashboard_update');
    io.to([salaAdmin('e2'), salaCentral('e2')]).emit('admin:dashboard_update', { entity: 'turno' });
    await llega; await barrera(central1);
    expect(filtracion).not.toHaveBeenCalled();
  });

  test('Central de e2 no puede unirse a una instalación de e1 (se valida contra su empresa)', async () => {
    const s = await conectar('c2');
    await expect(s.timeout(1000).emitWithAck('join:instalacion', 'i1')).resolves.toEqual({ ok: false });
    expect(io.sockets.adapter.rooms.get('instalacion:i1')).toBeUndefined();
  });

  test('Central de e2 sí puede unirse a una instalación de SU empresa', async () => {
    const s = await conectar('c2');
    await expect(s.timeout(1000).emitWithAck('join:instalacion', 'i9')).resolves.toEqual({ ok: true });
  });

  test('un socket de empresa suspendida no conecta', async () => {
    expect((await intentarConectar('suspendida')).message).toBe('No autorizado');
  });

  test('el nivel de plataforma (super admin, sin empresa) no recibe eventos operativos', async () => {
    expect((await intentarConectar('plataforma')).message).toBe('No autorizado');
  });

  test('un token con otra empresa que la de la base no conecta', async () => {
    expect((await intentarConectar('c1', 'e2')).message).toBe('No autorizado');
  });

  test('desconectarEmpresa saca a todos los sockets de esa empresa y deja a las demás', async () => {
    const [de1, otroDe1, de2] = await Promise.all([conectar('c1'), conectar('g1'), conectar('c2')]);
    const caidos = [once(de1, 'disconnect'), once(otroDe1, 'disconnect')];
    desconectarEmpresa('e1');
    await Promise.all(caidos);
    expect(de1.connected).toBe(false);
    expect(otroDe1.connected).toBe(false);
    expect(de2.connected).toBe(true);
  });
});
