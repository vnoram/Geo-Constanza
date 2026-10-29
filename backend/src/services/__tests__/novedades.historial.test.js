jest.mock('../../config/database', () => ({ prisma: {
  $transaction: jest.fn(),
  novedad: { create: jest.fn(), update: jest.fn(), findUnique: jest.fn(), findUniqueOrThrow: jest.fn() },
  novedadHistorial: { create: jest.fn(), findMany: jest.fn() },
  usuario: { findUnique: jest.fn() }, turno: { findMany: jest.fn() },
} }));
jest.mock('../../socket/socketManager', () => ({ getSocketIO: jest.fn() }));
jest.mock('../../utils/azureStorage', () => ({ generarUrlLectura: jest.fn() }));
jest.mock('../../config/logger', () => ({ logger: { error: jest.fn(), warn: jest.fn() } }));
jest.mock('../supervisor.helper', () => ({ resolverInstalacionesSupervisor: jest.fn() }));
jest.mock('../../utils/fechaChile', () => ({ ...jest.requireActual('../../utils/fechaChile'),
  turnosDeHoy: () => ({ where: {}, incluir: () => true }),
}));
const { prisma } = require('../../config/database');
const service = require('../novedades.service');
const { ROLES } = require('../../constants/roles');
const { ESTADO_NOVEDAD, ESTADO_USUARIO } = require('../../constants/estados');
const { ACCION_NOVEDAD } = require('../../constants/accionesNovedad');
const { resolverInstalacionesSupervisor } = require('../supervisor.helper');
const supervisor = { id: 's1', rol: ROLES.SUPERVISOR };
beforeEach(() => {
  jest.resetAllMocks();
  prisma.$transaction.mockImplementation(fn => fn(prisma));
  const novedad = { id: 'n1', numero: 1, created_at: new Date(), instalacion_id: 'i1', usuario_id: 'g1', estado: ESTADO_NOVEDAD.ABIERTA };
  prisma.novedad.create.mockResolvedValue(novedad);
  prisma.novedad.update.mockResolvedValue(novedad);
  prisma.novedad.findUnique.mockResolvedValue(novedad);
  prisma.novedad.findUniqueOrThrow.mockResolvedValue(novedad);
  prisma.turno.findMany.mockResolvedValue([{ id: 't1', instalacion_id: 'i1', instalacion: {} }]);
  prisma.usuario.findUnique.mockResolvedValue({ id: 's1', rol: ROLES.SUPERVISOR, estado: ESTADO_USUARIO.ACTIVO });
  resolverInstalacionesSupervisor.mockResolvedValue(['i1']);
});
test.each([
  [ACCION_NOVEDAD.CREAR, () => service.crear({ tipo: 'Ronda', descripcion: 'Todo bien' }, null, { id: 'g1', rol: ROLES.GGSS_EN_PAUTA }), null, ESTADO_NOVEDAD.ABIERTA],
  [ACCION_NOVEDAD.ASIGNAR, () => service.asignar('n1', 's1', supervisor), ESTADO_NOVEDAD.ABIERTA, ESTADO_NOVEDAD.EN_ATENCION],
  [ACCION_NOVEDAD.ESCALAR, () => service.escalar('n1', supervisor), ESTADO_NOVEDAD.ABIERTA, ESTADO_NOVEDAD.ESCALADA],
  [ACCION_NOVEDAD.RESOLVER, () => service.resolver('n1', 'Cierre correcto', supervisor), ESTADO_NOVEDAD.ABIERTA, ESTADO_NOVEDAD.RESUELTA],
])('%s deja exactamente una fila dentro de la transacción', async (accion, ejecutar, anterior, nuevo) => {
  await ejecutar();
  expect(prisma.$transaction).toHaveBeenCalledTimes(1);
  expect(prisma.novedadHistorial.create).toHaveBeenCalledTimes(1);
  expect(prisma.novedadHistorial.create).toHaveBeenCalledWith({ data: expect.objectContaining({
    novedad_id: 'n1', accion, estado_anterior: anterior, estado_nuevo: nuevo,
  }) });
});
test('un fallo de historial propaga error y no informa éxito', async () => {
  prisma.novedadHistorial.create.mockRejectedValue(new Error('Historial no disponible'));
  await expect(service.resolver('n1', 'Cierre correcto', supervisor)).rejects.toThrow('Historial no disponible');
});
test('historial de otro guardia está prohibido', async () => {
  await expect(service.historial('n1', { id: 'otro', rol: ROLES.GGSS_EN_PAUTA })).rejects.toMatchObject({ statusCode: 403 });
  expect(prisma.novedadHistorial.findMany).not.toHaveBeenCalled();
});
test('historial exige instalación del supervisor', async () => {
  resolverInstalacionesSupervisor.mockResolvedValue(['otra']);
  await expect(service.historial('n1', supervisor)).rejects.toMatchObject({ statusCode: 403 });
});
test('autor autorizado puede leer historial en orden', async () => {
  prisma.novedadHistorial.findMany.mockResolvedValue([]);
  await expect(service.historial('n1', { id: 'g1', rol: ROLES.GGSS_EN_PAUTA })).resolves.toEqual([]);
  expect(prisma.novedadHistorial.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { novedad_id: 'n1' }, orderBy: [{ created_at: 'asc' }, { id: 'asc' }] }));
});
