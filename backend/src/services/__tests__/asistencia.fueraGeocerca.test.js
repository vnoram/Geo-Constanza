jest.mock('../../config/database', () => ({ prisma: {
  usuario: { findUnique: jest.fn() },
  turno: { findMany: jest.fn() },
  asistencia: { findMany: jest.fn(), create: jest.fn(), update: jest.fn() },
  solicitud: { findFirst: jest.fn(), findMany: jest.fn() },
  novedad: { count: jest.fn() },
  $transaction: jest.fn(), $executeRaw: jest.fn(),
} }));
jest.mock('../../socket/socketManager', () => ({ getSocketIO: jest.fn() }));
jest.mock('../supervisor.helper', () => ({ resolverInstalacionesSupervisor: jest.fn(), exigirAlcanceInstalacion: jest.fn() }));
const { prisma } = require('../../config/database');
const { instanteChile } = require('../../utils/fechaChile');
const asistencia = require('../asistencia.service');
const { getSocketIO } = require('../../socket/socketManager');

// Instalación en (0,0) con radio 100 m; el guardia marca a ~1,1 km.
const inst = { id: 'i', nombre: 'Norte', latitud: '0', longitud: '0', radio_geofence_m: 100, estado: 'activo' };
const turno = { id: 'T', fecha: new Date('2026-09-27T00:00:00Z'), hora_inicio: '00:00', hora_fin: '14:00',
  usuario_id: 'u', instalacion_id: 'i', instalacion: inst, estado: 'programado' };
const marcar = (extra = {}) => asistencia.registrarEntrada(
  { instalacion_id: 'i', metodo: 'fallback_telefono', latitud: 0.01, longitud: 0, precision_m: 10, ...extra }, { id: 'u' }, true,
);
let emit;
const politica = process.env.DEVICE_POLICY;
beforeEach(() => {
  jest.resetAllMocks();
  jest.useFakeTimers().setSystemTime(instanteChile('2026-09-27', '00:05'));
  prisma.$transaction.mockImplementation((cb) => cb(prisma));
  prisma.$executeRaw.mockResolvedValue(1);
  prisma.turno.findMany.mockResolvedValue([turno]);
  prisma.usuario.findUnique.mockResolvedValue({ instalacion_asignada_id: null });
  prisma.asistencia.findMany.mockResolvedValue([]);
  prisma.solicitud.findFirst.mockResolvedValue(null);
  prisma.solicitud.findMany.mockResolvedValue([]);
  prisma.asistencia.create.mockImplementation(async ({ data }) => ({ id: 'nueva', ...data }));
  emit = jest.fn();
  getSocketIO.mockReturnValue({ emit, to: () => ({ emit }) });
});
afterEach(() => {
  jest.useRealTimers();
  if (politica === undefined) delete process.env.DEVICE_POLICY; else process.env.DEVICE_POLICY = politica;
});

test('con la política activa, un marcaje fuera de la geocerca queda pendiente del supervisor', async () => {
  process.env.DEVICE_POLICY = 'on';
  const res = await marcar();
  expect(res).toMatchObject({ verificacion_gps: 'por_revisar' });
  expect(res.distancia_entrada_m).toBeGreaterThan(1000);
  expect(prisma.asistencia.create).toHaveBeenCalledTimes(1);
  expect(emit).toHaveBeenCalledWith('guardia:marcaje_por_revisar', expect.objectContaining({ verificacion: 'por_revisar' }));
});

test('sin la política, un marcaje fuera de la geocerca se sigue rechazando con 400', async () => {
  delete process.env.DEVICE_POLICY;
  await expect(marcar()).rejects.toMatchObject({ statusCode: 400 });
  expect(prisma.asistencia.create).not.toHaveBeenCalled();
});

test('un marcaje dentro de la geocerca sigue verificado', async () => {
  process.env.DEVICE_POLICY = 'on';
  const res = await marcar({ latitud: 0.0002 });
  expect(res).toMatchObject({ verificacion_gps: 'verificado' });
});
