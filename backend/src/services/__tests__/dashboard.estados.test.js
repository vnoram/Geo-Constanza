jest.mock('../../config/database', () => ({ prisma: {
  turno: { findMany: jest.fn() }, solicitud: { findMany: jest.fn() },
  novedad: { count: jest.fn(), groupBy: jest.fn() }, usuario: { count: jest.fn() },
  instalacion: { findMany: jest.fn(), count: jest.fn() },
} }));
jest.mock('../supervisor.helper', () => ({ resolverInstalacionesSupervisor: jest.fn(), exigirAlcanceInstalacion: jest.fn() }));
const { prisma } = require('../../config/database');
const { getDashboardHoy } = require('../dashboard.service');
const { aFechaDB, instanteChile } = require('../../utils/fechaChile');

// Turno nocturno 19:00–07:00 del 21-nov (hora Chile)
const turno = { id: 't1', usuario_id: 'g1', usuario: { id: 'g1', nombre: 'Víctor' },
  instalacion: { id: 'i1', nombre: 'Inacap', tolerancia_atraso_minutos: 15 },
  estado: 'programado', fecha: aFechaDB('2026-11-21'), hora_inicio: '19:00', hora_fin: '07:00', asistencias: [] };
const solicitud = (estado, tipo = 'vacaciones', desde = '2026-11-20', hasta = '2026-12-10') =>
  ({ usuario_id: 'g1', tipo, estado, fecha_desde: aFechaDB(desde), fecha_hasta: hasta ? aFechaDB(hasta) : null });
const dashboard = () => getDashboardHoy({ rol: 'administrador' });

beforeEach(() => {
  jest.resetAllMocks();
  jest.useFakeTimers().setSystemTime(instanteChile('2026-11-21', '15:48'));
  prisma.turno.findMany.mockResolvedValue([turno]);
  prisma.solicitud.findMany.mockResolvedValue([]);
  prisma.novedad.count.mockResolvedValue(0); prisma.novedad.groupBy.mockResolvedValue([]);
  prisma.usuario.count.mockResolvedValue(1);
  prisma.instalacion.findMany.mockResolvedValue([]); prisma.instalacion.count.mockResolvedValue(1);
});
afterEach(() => jest.useRealTimers());

test('antes de la hora de inicio el turno sin entrada está "por iniciar", no faltante', async () => {
  const r = await dashboard();
  expect(r.lista[0].estado).toBe('por_iniciar');
  expect(r).toMatchObject({ porIniciar: 1, faltantes: 0 });
});

test('pasada la hora de inicio sin entrada pasa a faltante', async () => {
  jest.setSystemTime(instanteChile('2026-11-21', '19:10'));
  const r = await dashboard();
  expect(r.lista[0].estado).toBe('faltante');
  expect(r).toMatchObject({ porIniciar: 0, faltantes: 1 });
});

test('vacaciones aprobadas: se rotula con la solicitud y no cuenta como faltante', async () => {
  jest.setSystemTime(instanteChile('2026-11-21', '19:10'));
  prisma.solicitud.findMany.mockResolvedValue([solicitud('aprobada')]);
  const r = await dashboard();
  expect(r.lista[0]).toMatchObject({ estado: 'ausencia', ausencia: { tipo: 'vacaciones', etiqueta: 'Vacaciones' } });
  expect(r).toMatchObject({ faltantes: 0, conAusencia: 1 });
});

test('ausencia autorizada de un solo día (sin fecha_hasta) cubre ese día', async () => {
  prisma.solicitud.findMany.mockResolvedValue([solicitud('aprobada', 'dias_libres', '2026-11-21', null)]);
  const r = await dashboard();
  expect(r.lista[0]).toMatchObject({ estado: 'ausencia', ausencia: { etiqueta: 'Ausencia autorizada' } });
});

test('solicitud pendiente no cambia el estado, solo se avisa', async () => {
  jest.setSystemTime(instanteChile('2026-11-21', '19:10'));
  prisma.solicitud.findMany.mockResolvedValue([solicitud('pendiente')]);
  const r = await dashboard();
  expect(r.lista[0]).toMatchObject({ estado: 'faltante', ausencia: null, solicitud_pendiente: { etiqueta: 'Vacaciones' } });
});

test('una solicitud que no cubre la fecha del turno no aplica', async () => {
  prisma.solicitud.findMany.mockResolvedValue([solicitud('aprobada', 'vacaciones', '2026-11-01', '2026-11-20')]);
  const r = await dashboard();
  expect(r.lista[0]).toMatchObject({ estado: 'por_iniciar', ausencia: null });
});

test('si el guardia igual marcó entrada, manda la asistencia', async () => {
  prisma.turno.findMany.mockResolvedValue([{ ...turno, asistencias: [{ estado: 'normal', hora_entrada: new Date() }] }]);
  prisma.solicitud.findMany.mockResolvedValue([solicitud('aprobada')]);
  const r = await dashboard();
  expect(r.lista[0].estado).toBe('presente');
});
