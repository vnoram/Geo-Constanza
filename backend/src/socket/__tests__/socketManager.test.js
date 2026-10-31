jest.mock('jsonwebtoken', () => ({ verify: jest.fn(token => JSON.parse(token)) }));
jest.mock('../../config/redis', () => ({ getRedis: jest.fn(() => null) }));
jest.mock('../../config/database', () => ({ prisma: {
  usuario: { findUnique: jest.fn() }, turno: { findMany: jest.fn() },
  novedad: { findUnique: jest.fn(), update: jest.fn() },
  novedadHistorial: { create: jest.fn() }, $transaction: jest.fn(),
} }));
jest.mock('../../services/supervisor.helper', () => ({ resolverInstalacionesSupervisor: jest.fn() }));
jest.mock('../../utils/azureStorage', () => ({ generarUrlLectura: jest.fn() }));
const http = require('http');
const { io: cliente } = require('socket.io-client');
const { once } = require('events');
const { initSocket } = require('../socketManager');
const { prisma } = require('../../config/database');
const { ROLES } = require('../../constants/roles');
const { ESTADO_USUARIO, ESTADO_NOVEDAD } = require('../../constants/estados');
const { SALAS } = require('../../constants/salas');
const { resolverInstalacionesSupervisor } = require('../../services/supervisor.helper');
const { escalar } = require('../../services/novedades.service');
let server, io, url;
const clientes = [];
const perfiles = {
  g1: { id: 'g1', rol: ROLES.GGSS_EN_PAUTA, estado: ESTADO_USUARIO.ACTIVO, instalacion_asignada_id: 'i1' },
  g2: { id: 'g2', rol: ROLES.GGSS_LIBRE, estado: ESTADO_USUARIO.ACTIVO, instalacion_asignada_id: 'i2' },
  s1: { id: 's1', rol: ROLES.SUPERVISOR, estado: ESTADO_USUARIO.ACTIVO },
  c1: { id: 'c1', rol: ROLES.OPERADOR_CENTRAL, estado: ESTADO_USUARIO.ACTIVO },
  a1: { id: 'a1', rol: ROLES.ADMINISTRADOR, estado: ESTADO_USUARIO.ACTIVO },
};
const conectar = async (id) => {
  const socket = cliente(url, { auth: { token: JSON.stringify(perfiles[id]) }, transports: ['websocket'], reconnection: false });
  clientes.push(socket); await once(socket, 'connect'); return socket;
};
beforeEach(async () => {
  jest.clearAllMocks();
  prisma.usuario.findUnique.mockImplementation(({ where }) => Promise.resolve(perfiles[where.id]));
  prisma.turno.findMany.mockResolvedValue([]);
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
  const barrera = once(ajeno, 'prueba:barrera');
  io.to(ajeno.id).emit('prueba:barrera'); await barrera;
  expect(recibeAjeno).not.toHaveBeenCalled();
});
test('central y admin reciben dashboard; alertas críticas solo central', async () => {
  const [guardia, central, admin] = await Promise.all([conectar('g2'), conectar('c1'), conectar('a1')]);
  const fuga = jest.fn(), alertaAdmin = jest.fn();
  guardia.on('admin:dashboard_update', fuga); guardia.on('alerta_critica_central', fuga);
  admin.on('alerta_critica_central', alertaAdmin);
  const dashboardCentral = once(central, 'admin:dashboard_update'), dashboardAdmin = once(admin, 'admin:dashboard_update');
  const alerta = once(central, 'alerta_critica_central');
  io.to([SALAS.ADMIN, SALAS.CENTRAL]).emit('admin:dashboard_update', { entity: 'novedad' });
  io.to(SALAS.CENTRAL).emit('alerta_critica_central', { id: 'n1' });
  await Promise.all([dashboardCentral, dashboardAdmin, alerta]);
  const barreras = [guardia, admin].map(s => { const p = once(s, 'prueba:barrera'); io.to(s.id).emit('prueba:barrera'); return p; });
  await Promise.all(barreras);
  expect(fuga).not.toHaveBeenCalled(); expect(alertaAdmin).not.toHaveBeenCalled();
});
