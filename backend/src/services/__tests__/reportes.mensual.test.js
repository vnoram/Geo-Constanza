jest.mock('../../config/database', () => ({ prisma: {
  turno: { findMany: jest.fn() }, novedad: { groupBy: jest.fn() },
  instalacion: { findMany: jest.fn() }, usuario: { findMany: jest.fn() },
} }));
jest.mock('../supervisor.helper', () => ({ resolverInstalacionesSupervisor: jest.fn(), exigirAlcanceInstalacion: jest.fn() }));
const { prisma } = require('../../config/database');
const { resumenMensual, resumenGuardias } = require('../reportes.service');
const { aFechaDB, instanteChile } = require('../../utils/fechaChile');

const admin = { rol: 'administrador' };
const marca = (retraso, horas = 11) => ({ minutos_retraso: retraso, horas_trabajadas: horas });
const turno = (usuario_id, asistencias = [], instalacion_id = 'i1', asignada = 'i1') =>
  ({ usuario_id, instalacion_id, usuario: { instalacion_asignada_id: asignada }, asistencias });

beforeEach(() => {
  jest.resetAllMocks();
  jest.useFakeTimers().setSystemTime(instanteChile('2026-11-21', '16:00'));
  prisma.novedad.groupBy.mockResolvedValue([]);
  prisma.instalacion.findMany.mockResolvedValue([{ id: 'i1', nombre: 'Inacap' }]);
  prisma.usuario.findMany.mockResolvedValue([
    { id: 'u1', nombre: 'Víctor', rut: '20340570-7' }, { id: 'u2', nombre: 'Andrea', rut: '11111111-1' },
  ]);
});
afterEach(() => jest.useRealTimers());

describe('resumen mensual por instalación', () => {
  test('solo cuenta turnos que ya comenzaron (no los días futuros del mes)', async () => {
    prisma.turno.findMany.mockResolvedValue([]);
    await resumenMensual(11, 2026, admin);
    const { where } = prisma.turno.findMany.mock.calls[0][0];
    expect(where.AND[0]).toEqual({ fecha: { gte: aFechaDB('2026-11-01'), lt: aFechaDB('2026-12-01') } });
    expect(where.AND[1].OR).toEqual([{ fecha: { lt: aFechaDB('2026-11-21') } }, { fecha: aFechaDB('2026-11-21'), hora_inicio: { lte: '16:00' } }]);
    expect(where.estado).toEqual({ not: 'cancelado' });
  });

  test('cobertura = turnos cubiertos / programados: dos marcajes en un turno no lo duplican', async () => {
    prisma.turno.findMany.mockResolvedValue([
      turno('u1', [marca(4), marca(0)]), // un turno con dos marcajes
      turno('u1', []),                   // sin marcar
    ]);
    const [fila] = await resumenMensual(11, 2026, admin);
    expect(fila).toMatchObject({ turnos_programados: 2, turnos_cubiertos: 1, cobertura: 50 });
  });

  test('un marcaje de un turno fuera del período no suma (por ejemplo, un turno extra)', async () => {
    // el marcaje ajeno nunca llega: la consulta parte de los turnos del período
    prisma.turno.findMany.mockResolvedValue([turno('u1', [marca(10)]), turno('u2', [])]);
    const [fila] = await resumenMensual(11, 2026, admin);
    expect(fila).toMatchObject({ turnos_programados: 2, turnos_cubiertos: 1, promedio_retraso_min: 10 });
  });

  test('un guardia solo cuenta en su instalación asignada: sus turnos en otra se ignoran', async () => {
    prisma.turno.findMany.mockResolvedValue([
      turno('u1', [marca(0)], 'i1', 'i1'),
      turno('u1', [marca(240)], 'i2', 'i1'), // turno programado en una instalación que no es la suya
    ]);
    const filas = await resumenGuardias(11, 2026, admin);
    expect(filas).toHaveLength(1);
    expect(filas[0]).toMatchObject({ instalacion_id: 'i1', turnos_programados: 1, turnos_cubiertos: 1, promedio_retraso_min: 0 });
  });

  test('un guardia sin instalación asignada (libre) cuenta donde tiene el turno', async () => {
    prisma.turno.findMany.mockResolvedValue([turno('u1', [marca(0)], 'i1', null)]);
    const [fila] = await resumenMensual(11, 2026, admin);
    expect(fila).toMatchObject({ turnos_programados: 1, turnos_cubiertos: 1 });
  });

  test('sin marcajes: retraso y horas quedan en 0 y la cobertura en 0', async () => {
    prisma.turno.findMany.mockResolvedValue([turno('u1', []), turno('u1', [])]);
    const [fila] = await resumenMensual(11, 2026, admin);
    expect(fila).toMatchObject({ turnos_programados: 2, turnos_cubiertos: 0, cobertura: 0, promedio_retraso_min: 0, promedio_horas: 0 });
  });
});

describe('resumen por guardia', () => {
  test('una fila por guardia con sus propios números; el que no marcó queda en 0', async () => {
    prisma.turno.findMany.mockResolvedValue([
      turno('u1', [marca(4)]), turno('u1', [marca(4)]), turno('u1', []), turno('u2', []),
    ]);
    prisma.novedad.groupBy.mockResolvedValue([{ usuario_id: 'u1', instalacion_id: 'i1', _count: { id: 2 } }]);
    const filas = await resumenGuardias(11, 2026, admin);
    expect(filas.map((f) => f.guardia)).toEqual(['Andrea', 'Víctor']);
    expect(filas[1]).toMatchObject({ instalacion: 'Inacap', turnos_programados: 3, turnos_cubiertos: 2, cobertura: 67, promedio_retraso_min: 4, novedades: 2 });
    expect(filas[0]).toMatchObject({ turnos_programados: 1, turnos_cubiertos: 0, cobertura: 0 });
  });

  test('trimestre: abarca tres meses desde el primero', async () => {
    prisma.turno.findMany.mockResolvedValue([]);
    await resumenGuardias(10, 2026, admin, 3);
    const { where } = prisma.turno.findMany.mock.calls[0][0];
    expect(where.AND[0]).toEqual({ fecha: { gte: aFechaDB('2026-10-01'), lt: aFechaDB('2027-01-01') } });
  });
});
