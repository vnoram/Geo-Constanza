// obtenerHistorial aplica el filtro de instalaciones cuando se le pasa (alcance del supervisor).
jest.mock('../../config/database', () => ({ prisma: {
  asistencia: { findMany: jest.fn(), count: jest.fn() },
} }));
jest.mock('../../socket/socketManager', () => ({ getSocketIO: jest.fn() }));
jest.mock('../dispositivos.service', () => ({ habilitada: () => false }));
const { prisma } = require('../../config/database');
const { obtenerHistorial } = require('../asistencia.service');

beforeEach(() => {
  jest.resetAllMocks();
  prisma.asistencia.findMany.mockResolvedValue([]);
  prisma.asistencia.count.mockResolvedValue(0);
});

test('con instalacionIds filtra por esas instalaciones', async () => {
  await obtenerHistorial('g', {}, { instalacionIds: ['A', 'C'] });
  expect(prisma.asistencia.findMany.mock.calls[0][0].where).toEqual({ usuario_id: 'g', instalacion_id: { in: ['A', 'C'] } });
});

test('supervisor sin instalaciones no ve nada (lista vacía)', async () => {
  await obtenerHistorial('g', {}, { instalacionIds: [] });
  expect(prisma.asistencia.findMany.mock.calls[0][0].where.instalacion_id).toEqual({ in: [] });
});

test('sin alcance (guardia, central, admin) no agrega filtro', async () => {
  await obtenerHistorial('g', {});
  expect(prisma.asistencia.findMany.mock.calls[0][0].where).toEqual({ usuario_id: 'g' });
});
