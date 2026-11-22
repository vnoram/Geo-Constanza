jest.mock('../../config/database', () => ({ prisma: {
  turno: { findMany: jest.fn() }, solicitud: { findMany: jest.fn() },
} }));
jest.mock('../supervisor.helper', () => ({ resolverInstalacionesSupervisor: jest.fn(), exigirAlcanceInstalacion: jest.fn() }));
const { prisma } = require('../../config/database');
const { estadoGuardias } = require('../reportes.service');
const { aFechaDB, instanteChile } = require('../../utils/fechaChile');

const admin = { rol: 'administrador' };
const turno = (fecha, inicio, fin, asistencias = [], usuario_id = 'u1') =>
  ({ fecha: aFechaDB(fecha), hora_inicio: inicio, hora_fin: fin, usuario_id, asistencias });

beforeEach(() => {
  jest.resetAllMocks();
  // Domingo 22 de noviembre, 06:00: el nocturno de ayer (19:00–07:00) sigue en curso
  jest.useFakeTimers().setSystemTime(instanteChile('2026-11-22', '06:00'));
  prisma.solicitud.findMany.mockResolvedValue([]);
});
afterEach(() => jest.useRealTimers());

describe('estado de guardias hoy', () => {
  test('el nocturno de ayer que sigue en curso y no marcó cuenta como ausente; el de hoy aún no comienza', async () => {
    prisma.turno.findMany.mockResolvedValue([
      turno('2026-11-21', '19:00', '07:00'),
      turno('2026-11-22', '19:00', '07:00'),
    ]);
    expect(await estadoGuardias(admin)).toEqual({ presentes: 0, tardios: 0, ausentes: 1, porIniciar: 1, conAusencia: 0, totalTurnos: 2 });
  });

  test('un nocturno de ayer que ya terminó no cuenta', async () => {
    jest.setSystemTime(instanteChile('2026-11-22', '08:00'));
    prisma.turno.findMany.mockResolvedValue([turno('2026-11-21', '19:00', '07:00')]);
    expect((await estadoGuardias(admin)).totalTurnos).toBe(0);
  });

  test('con marcaje es presente o tardío; con vacaciones aprobadas no es ausente', async () => {
    prisma.turno.findMany.mockResolvedValue([
      turno('2026-11-21', '19:00', '07:00', [{ estado: 'normal' }], 'u1'),
      turno('2026-11-21', '20:00', '08:00', [{ estado: 'tardio' }], 'u2'),
      turno('2026-11-21', '19:00', '07:00', [], 'u3'),
    ]);
    prisma.solicitud.findMany.mockResolvedValue([{ usuario_id: 'u3', fecha_desde: aFechaDB('2026-11-20'), fecha_hasta: aFechaDB('2026-11-25') }]);
    expect(await estadoGuardias(admin)).toEqual({ presentes: 1, tardios: 1, ausentes: 0, porIniciar: 0, conAusencia: 1, totalTurnos: 3 });
  });
});
