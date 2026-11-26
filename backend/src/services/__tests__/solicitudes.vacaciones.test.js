// Vacaciones: se piden con al menos 30 días de anticipación.
jest.mock('../../config/database', () => ({ prisma: { solicitud: { create: jest.fn() } } }));
jest.mock('../notificacion.service', () => ({ enviarNotificacion: jest.fn() }));
jest.mock('../supervisor.helper', () => ({ exigirAlcanceInstalacion: jest.fn(), resolverInstalacionesSupervisor: jest.fn() }));
jest.mock('../../utils/azureStorage', () => ({ uploadAdjuntoToAzure: jest.fn(), generarUrlLectura: jest.fn() }));

const { prisma } = require('../../config/database');
const { instanteChile } = require('../../utils/fechaChile');
const { crear } = require('../solicitudes.service');

beforeEach(() => {
  jest.resetAllMocks();
  jest.useFakeTimers().setSystemTime(instanteChile('2026-11-26', '13:00'));
  prisma.solicitud.create.mockImplementation(async ({ data }) => ({ id: 's', ...data }));
});
afterEach(() => jest.useRealTimers());

test('vacaciones para mañana se rechazan con 400 y no se guardan', async () => {
  await expect(crear({ tipo: 'vacaciones', fecha_desde: '2026-11-27', fecha_hasta: '2026-12-17' }, 'u'))
    .rejects.toMatchObject({ statusCode: 400, message: expect.stringContaining('26-12-2026') });
  expect(prisma.solicitud.create).not.toHaveBeenCalled();
});

test('vacaciones a 29 días se rechazan; a 30 días se aceptan', async () => {
  await expect(crear({ tipo: 'vacaciones', fecha_desde: '2026-12-25' }, 'u')).rejects.toMatchObject({ statusCode: 400 });
  await expect(crear({ tipo: 'vacaciones', fecha_desde: '2026-12-26', fecha_hasta: '2027-01-15' }, 'u'))
    .resolves.toMatchObject({ tipo: 'vacaciones', estado: 'pendiente' });
});

test('otros tipos (ausentarse) no tienen anticipación mínima', async () => {
  await expect(crear({ tipo: 'dias_libres', fecha_desde: '2026-11-27' }, 'u')).resolves.toMatchObject({ tipo: 'dias_libres' });
});
