jest.mock('../../config/database', () => ({ prisma: {
  instalacion: { findMany: jest.fn(), findUniqueOrThrow: jest.fn(), create: jest.fn(), update: jest.fn() },
  supervisor_Instalacion: { createMany: jest.fn(), deleteMany: jest.fn() }, $transaction: jest.fn(),
} }));
jest.mock('../supervisor.helper', () => ({ resolverInstalacionesSupervisor: jest.fn() }));
const { prisma } = require('../../config/database');
const { resolverInstalacionesSupervisor } = require('../supervisor.helper');
const service = require('../instalaciones.service');
const { ROLES } = require('../../constants/roles');
const { ESTADO_USUARIO } = require('../../constants/estados');
const datos = { nombre: 'Instalación de prueba', latitud: '-33.45', longitud: '-70.66', radio_geofence_m: '100' };
beforeEach(() => {
  jest.resetAllMocks(); prisma.$transaction.mockImplementation(fn => fn(prisma));
  prisma.instalacion.create.mockResolvedValue({ id: 'i1' }); prisma.instalacion.update.mockResolvedValue({ id: 'i1' });
  resolverInstalacionesSupervisor.mockResolvedValue(['i1']);
});
test('listado aplica filtros y alcance del supervisor', async () => {
  await service.listar({ estado: ESTADO_USUARIO.ACTIVO, tipo_recinto: 'Prueba' }, { id: 's1', rol: ROLES.SUPERVISOR });
  expect(prisma.instalacion.findMany.mock.calls[0][0].where).toEqual({ estado: ESTADO_USUARIO.ACTIVO, tipo_recinto: 'Prueba', id: { in: ['i1'] } });
  resolverInstalacionesSupervisor.mockResolvedValue([]);
  await service.listar({}, { id: 's1', rol: ROLES.SUPERVISOR });
  expect(prisma.instalacion.findMany.mock.calls[1][0].where).toEqual({ id: { in: [] } });
  await service.listar({}, { id: 'a1', rol: ROLES.ADMINISTRADOR });
  expect(prisma.instalacion.findMany.mock.calls[2][0].where).toEqual({});
});
test('consulta por id conserva relación de supervisores', async () => {
  await service.obtenerPorId('i1');
  expect(prisma.instalacion.findUniqueOrThrow).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'i1' } }));
});
test('creación transforma coordenadas/radio y asigna supervisores', async () => {
  await service.crear({ ...datos, supervisorIds: ['s1'] });
  expect(prisma.instalacion.create.mock.calls[0][0].data).toMatchObject({ latitud: -33.45, longitud: -70.66, radio_geofence_m: 100 });
  expect(prisma.supervisor_Instalacion.createMany).toHaveBeenCalledWith({ data: [{ supervisor_id: 's1', instalacion_id: 'i1' }], skipDuplicates: true });
});
test('edición sincroniza supervisores y admite baja lógica', async () => {
  await service.editar('i1', { ...datos, supervisorIds: ['s2'], estado: ESTADO_USUARIO.INACTIVO, tolerancia_atraso_minutos: '5' });
  expect(prisma.instalacion.update.mock.calls[0][0].data).toMatchObject({ latitud: -33.45, longitud: -70.66, radio_geofence_m: 100,
    tolerancia_atraso_minutos: 5, estado: ESTADO_USUARIO.INACTIVO });
  expect(prisma.supervisor_Instalacion.deleteMany).toHaveBeenCalledWith({ where: { instalacion_id: 'i1' } });
  expect(prisma.supervisor_Instalacion.createMany).toHaveBeenCalledWith({ data: [{ supervisor_id: 's2', instalacion_id: 'i1' }], skipDuplicates: true });
});
test('edición parcial conserva coordenadas y permite limpiar supervisores', async () => {
  await service.editar('i1', { nombre: 'Otro', supervisorIds: [] });
  expect(prisma.instalacion.update.mock.calls[0][0].data).toEqual({ nombre: 'Otro' });
  expect(prisma.supervisor_Instalacion.createMany).not.toHaveBeenCalled();
  await service.editar('i1', { nombre: 'Otro' });
  expect(prisma.supervisor_Instalacion.deleteMany).toHaveBeenCalledTimes(1);
});
test.each([
  { latitud: 91 }, { latitud: -91 }, { longitud: 181 }, { longitud: -181 },
  { latitud: '' }, { longitud: 'texto' }, { latitud: false }, { radio_geofence_m: 0 },
  { radio_geofence_m: -1 }, { radio_geofence_m: 1.2 }, { radio_geofence_m: '10x' },
])('rechaza geocerca inválida %p antes de escribir', async cambio => {
  await expect(service.crear({ ...datos, ...cambio })).rejects.toMatchObject({ statusCode: 400 });
  await expect(service.editar('i1', cambio)).rejects.toMatchObject({ statusCode: 400 });
  expect(prisma.instalacion.create).not.toHaveBeenCalled(); expect(prisma.instalacion.update).not.toHaveBeenCalled();
});
test('permite coordenadas límite y radio por defecto', async () => {
  await service.crear({ nombre: 'Polo', latitud: 90, longitud: -180 });
  expect(prisma.instalacion.create.mock.calls[0][0].data.radio_geofence_m).toBe(100);
});
