// Reportar una novedad exige tener la entrada marcada (y sin salida) en el turno vigente.
jest.mock('../../config/database', () => ({ prisma: {
  $transaction: jest.fn(),
  novedad: { create: jest.fn() },
  novedadHistorial: { create: jest.fn() },
  turno: { findMany: jest.fn() },
  asistencia: { findFirst: jest.fn() },
  empresa: { update: jest.fn() },
} }));
jest.mock('../../config/tenant', () => ({ empresaActual: () => 'e1', conEmpresa: (_e, fn) => fn() }));
jest.mock('../../socket/socketManager', () => ({ getSocketIO: jest.fn() }));
jest.mock('../../utils/azureStorage', () => ({ generarUrlLectura: jest.fn(), uploadFotoToAzure: jest.fn() }));
jest.mock('../../config/logger', () => ({ logger: { error: jest.fn(), warn: jest.fn() } }));
jest.mock('../supervisor.helper', () => ({ resolverInstalacionesSupervisor: jest.fn(), exigirAlcanceInstalacion: jest.fn() }));
jest.mock('../../utils/fechaChile', () => ({ ...jest.requireActual('../../utils/fechaChile'),
  turnosDeHoy: () => ({ where: {}, incluir: () => true }),
}));
const { prisma } = require('../../config/database');
const service = require('../novedades.service');
const { ROLES } = require('../../constants/roles');

const guardia = { id: 'g1', rol: ROLES.GGSS };
beforeEach(() => {
  jest.resetAllMocks();
  prisma.$transaction.mockImplementation(fn => fn(prisma));
  prisma.empresa.update.mockResolvedValue({ ultimo_folio: 1 });
  prisma.turno.findMany.mockResolvedValue([{ id: 't1', instalacion_id: 'i1', instalacion: {} }]);
  prisma.novedad.create.mockResolvedValue({ id: 'n1', numero: 1, created_at: new Date(), instalacion_id: 'i1', usuario_id: 'g1', estado: 'abierta' });
});

test('sin entrada marcada en el turno se rechaza con 400 y no se crea la novedad', async () => {
  prisma.asistencia.findFirst.mockResolvedValue(null);
  await expect(service.crear({ tipo: 'Robo', descripcion: 'x' }, null, guardia))
    .rejects.toMatchObject({ statusCode: 400, message: expect.stringContaining('Marca tu entrada') });
  expect(prisma.novedad.create).not.toHaveBeenCalled();
});

test('busca una entrada abierta del mismo guardia en ese turno', async () => {
  prisma.asistencia.findFirst.mockResolvedValue({ id: 'a1' });
  await service.crear({ tipo: 'Robo', descripcion: 'x' }, null, guardia);
  expect(prisma.asistencia.findFirst.mock.calls[0][0].where).toEqual({ usuario_id: 'g1', turno_id: 't1', hora_salida: null });
  expect(prisma.novedad.create).toHaveBeenCalled();
});
