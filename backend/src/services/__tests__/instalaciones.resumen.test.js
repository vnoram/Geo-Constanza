jest.mock('../../config/database', () => ({ prisma: {
  instalacion: { findUniqueOrThrow: jest.fn() }, turno: { findMany: jest.fn() }, novedad: { findMany: jest.fn(), groupBy: jest.fn() },
} }));
jest.mock('../supervisor.helper', () => ({ resolverInstalacionesSupervisor: jest.fn(), exigirAlcanceInstalacion: jest.fn() }));
const { resolverInstalacionesSupervisor } = require('../supervisor.helper');
const { prisma } = require('../../config/database');
const { exigirAlcanceInstalacion } = require('../supervisor.helper');
const service = require('../instalaciones.service');
const { ROLES } = require('../../constants/roles');

// 2026-11-18 15:00 en Chile (verano, UTC-3)
const ahora = new Date('2026-11-18T18:00:00Z');
const fecha = new Date('2026-11-18T00:00:00Z');
const turno = (id, nombre, ini, fin, asistencias = []) => ({ id, fecha, hora_inicio: ini, hora_fin: fin, usuario: nombre ? { nombre } : null, asistencias });

beforeEach(() => {
  jest.resetAllMocks();
  prisma.instalacion.findUniqueOrThrow.mockResolvedValue({
    id: 'i1', nombre: 'Plaza Sur', supervisores: [{ supervisor: { nombre: 'Sandra' } }],
  });
  prisma.novedad.findMany.mockResolvedValue([
    { numero: 3, tipo: 'Intrusión', urgencia: 'rojo', estado: 'abierta', created_at: new Date() },
    { numero: 2, tipo: 'Ruido', urgencia: 'verde', estado: 'en_atencion', created_at: new Date() },
  ]);
});

test('clasifica el estado de cada turno de hoy y cuenta novedades abiertas por urgencia', async () => {
  prisma.turno.findMany.mockResolvedValue([
    turno('t1', 'Ana', '07:00', '14:00', [{ estado: 'normal', hora_entrada: new Date(), hora_salida: new Date() }]),
    turno('t2', 'Beto', '14:00', '22:00', [{ estado: 'tardio', hora_entrada: new Date(), hora_salida: null }]),
    turno('t3', 'Carla', '14:00', '22:00'),
    turno('t4', null, '19:00', '07:00'),
  ]);
  const r = await service.resumen('i1', { id: 'c1', rol: ROLES.OPERADOR_CENTRAL }, ahora);
  expect(r.turnos_hoy.map((t) => [t.guardia, t.estado])).toEqual([
    ['Ana', 'finalizado'], ['Beto', 'tardio'], ['Carla', 'faltante'], ['Sin asignar', 'por_iniciar'],
  ]);
  expect(r.novedades_abiertas).toMatchObject({ total: 2, rojo: 1, amarillo: 0, verde: 1 });
  expect(r.supervisores).toEqual(['Sandra']);
});

test('excluye novedades resueltas y turnos cancelados en la consulta', async () => {
  prisma.turno.findMany.mockResolvedValue([]);
  await service.resumen('i1', { id: 'c1', rol: ROLES.OPERADOR_CENTRAL }, ahora);
  expect(prisma.turno.findMany.mock.calls[0][0].where).toMatchObject({ instalacion_id: 'i1', estado: { not: 'cancelado' } });
  expect(prisma.novedad.findMany.mock.calls[0][0].where).toEqual({ instalacion_id: 'i1', tipo: { notIn: expect.any(Array) }, estado: { not: 'resuelta' } });
});

test('respeta el alcance del supervisor antes de consultar', async () => {
  exigirAlcanceInstalacion.mockRejectedValue(Object.assign(new Error('No tienes acceso a esta instalación'), { statusCode: 403 }));
  await expect(service.resumen('i9', { id: 's1', rol: ROLES.SUPERVISOR }, ahora)).rejects.toMatchObject({ statusCode: 403 });
  expect(prisma.instalacion.findUniqueOrThrow).not.toHaveBeenCalled();
});

test('estado de novedades agrupa por instalación y urgencia, sin resueltas ni rutina', async () => {
  prisma.novedad.groupBy.mockResolvedValue([
    { instalacion_id: 'i1', urgencia: 'rojo', _count: { _all: 2 } },
    { instalacion_id: 'i1', urgencia: 'verde', _count: { _all: 1 } },
    { instalacion_id: 'i2', urgencia: 'amarillo', _count: { _all: 3 } },
  ]);
  const r = await service.estadoNovedades({ id: 'c1', rol: ROLES.OPERADOR_CENTRAL });
  expect(r).toEqual({ i1: { total: 3, rojo: 2, amarillo: 0, verde: 1 }, i2: { total: 3, rojo: 0, amarillo: 3, verde: 0 } });
  const arg = prisma.novedad.groupBy.mock.calls[0][0];
  expect(arg.by).toEqual(['instalacion_id', 'urgencia']);
  expect(arg.where).toMatchObject({ estado: { not: 'resuelta' }, tipo: { notIn: expect.any(Array) } });
  expect(arg.where.instalacion_id).toBeUndefined();
});

test('el supervisor solo cuenta sus instalaciones', async () => {
  resolverInstalacionesSupervisor.mockResolvedValue(['i1']);
  prisma.novedad.groupBy.mockResolvedValue([]);
  await service.estadoNovedades({ id: 's1', rol: ROLES.SUPERVISOR });
  expect(prisma.novedad.groupBy.mock.calls[0][0].where.instalacion_id).toEqual({ in: ['i1'] });
});
