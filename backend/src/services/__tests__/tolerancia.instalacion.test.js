jest.mock('../../config/database', () => ({ prisma: {
  turno: { findMany: jest.fn() }, novedad: { count: jest.fn() },
  instalacion: { findMany: jest.fn(), count: jest.fn(), create: jest.fn(), update: jest.fn() },
  $transaction: jest.fn(),
} }));
jest.mock('../supervisor.helper', () => ({ resolverInstalacionesSupervisor: jest.fn() }));
const { prisma } = require('../../config/database');
const { getDashboardHoy } = require('../dashboard.service');
const instalaciones = require('../instalaciones.service');
const { resolverInstalacionesSupervisor } = require('../supervisor.helper');
const { sinCobertura } = require('../../utils/cobertura');
const { esVacante } = require('../vacantes.service');
const { ROLES } = require('../../constants/roles');
const { ESTADO_TURNO } = require('../../constants/estados');
const { aFechaDB, instanteChile } = require('../../utils/fechaChile');
const turno = tolerancia => ({ id: `t${tolerancia}`, usuario_id: 'g1', usuario: { nombre: 'Guardia' },
  instalacion: { id: 'i1', nombre: 'Instalación', tolerancia_atraso_minutos: tolerancia },
  estado: ESTADO_TURNO.PROGRAMADO, fecha: aFechaDB('2026-10-30'), hora_inicio: '08:00', hora_fin: '20:00', asistencias: [],
});
beforeEach(() => {
  jest.resetAllMocks(); jest.useFakeTimers().setSystemTime(instanteChile('2026-10-30', '08:20'));
  prisma.turno.findMany.mockResolvedValue([turno(5), turno(30)]);
  prisma.novedad.count.mockResolvedValue(0); prisma.instalacion.findMany.mockResolvedValue([]); prisma.instalacion.count.mockResolvedValue(1);
  resolverInstalacionesSupervisor.mockResolvedValue(['i1']);
  prisma.$transaction.mockImplementation(fn => fn(prisma));
  prisma.instalacion.create.mockImplementation(({ data }) => Promise.resolve(data));
});
afterEach(() => jest.useRealTimers());
test('vacante y puesto descubierto usan la misma tolerancia por instalación', () => {
  expect(esVacante(turno(5))).toBe(true); expect(esVacante(turno(30))).toBe(false);
  expect(sinCobertura(turno(5))).toBe(true); expect(sinCobertura(turno(30))).toBe(false);
  expect(sinCobertura({ ...turno(5), asistencias: [{ id: 'a1' }] })).toBe(false);
});
test.each([ROLES.SUPERVISOR, ROLES.OPERADOR_CENTRAL])('panel %s cuenta puestos sin cobertura', async rol => {
  const panel = await getDashboardHoy({ id: 's1', rol });
  expect(panel.sinCobertura).toBe(1);
  expect(panel.lista.map(t => t.sin_cobertura)).toEqual([true, false]);
});
test('instalaciones nuevas usan default 15 y permiten cero', async () => {
  await expect(instalaciones.crear({ nombre: 'Prueba', latitud: 0, longitud: 0 })).resolves.toHaveProperty('tolerancia_atraso_minutos', 15);
  await expect(instalaciones.crear({ nombre: 'Prueba', latitud: 0, longitud: 0, tolerancia_atraso_minutos: 0 })).resolves.toHaveProperty('tolerancia_atraso_minutos', 0);
});
test.each([-1, 1.5, 'no', false, ''])('rechaza tolerancia inválida %p al editar', async tolerancia => {
  await expect(instalaciones.editar('i1', { tolerancia_atraso_minutos: tolerancia })).rejects.toMatchObject({ statusCode: 400 });
});
