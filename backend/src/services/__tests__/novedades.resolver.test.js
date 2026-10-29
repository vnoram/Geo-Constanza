jest.mock('../../config/database', () => ({ prisma: { novedad: {
  update: jest.fn(), findUnique: jest.fn(),
} } }));
jest.mock('../../utils/azureStorage', () => ({ uploadFotoToAzure: jest.fn(), generarUrlLectura: jest.fn() }));
jest.mock('../../socket/socketManager', () => ({ getSocketIO: jest.fn() }));
jest.mock('../../config/logger', () => ({ logger: { error: jest.fn(), warn: jest.fn() } }));
jest.mock('../supervisor.helper', () => ({ resolverInstalacionesSupervisor: jest.fn() }));

const { prisma } = require('../../config/database');
const { ESTADO_NOVEDAD } = require('../../constants/estados');
const { ROLES } = require('../../constants/roles');
const { resolver, escalar } = require('../novedades.service');
const { resolverInstalacionesSupervisor } = require('../supervisor.helper');
const user = { id: 's1', rol: ROLES.SUPERVISOR };

beforeEach(() => {
  jest.resetAllMocks();
  prisma.novedad.findUnique.mockResolvedValue({ id: 'n1', instalacion_id: 'i1', estado: ESTADO_NOVEDAD.ABIERTA });
  resolverInstalacionesSupervisor.mockResolvedValue(['i1']);
});

test.each(['', '   ', undefined, null, 12345, {}, [], 'abcd', '  abcd  '])(
  'rechaza comentario inválido %p con 400 sin modificar datos', async (comentario) => {
    await expect(resolver('n1', comentario, user)).rejects.toMatchObject({ statusCode: 400 });
    expect(prisma.novedad.update).not.toHaveBeenCalled();
    expect(prisma.novedad.findUnique).not.toHaveBeenCalled();
  },
);

test('responde 409 si ya está resuelta y no sobrescribe el cierre', async () => {
  prisma.novedad.update.mockRejectedValue({ code: 'P2025' });
  prisma.novedad.findUnique.mockResolvedValue({ id: 'n1', instalacion_id: 'i1', estado: ESTADO_NOVEDAD.RESUELTA });
  await expect(resolver('n1', 'Cierre válido', user)).rejects.toMatchObject({ statusCode: 409 });
  expect(prisma.novedad.update).toHaveBeenCalledTimes(1);
  expect(prisma.novedad.update.mock.calls[0][0].where).toEqual({
    id: 'n1', estado: { not: ESTADO_NOVEDAD.RESUELTA },
  });
});

test('responde 404 si el id no existe', async () => {
  prisma.novedad.update.mockRejectedValue({ code: 'P2025' });
  prisma.novedad.findUnique.mockResolvedValue(null);
  await expect(resolver('inexistente', 'Cierre válido', user)).rejects.toMatchObject({ statusCode: 404 });
  expect(prisma.novedad.findUnique).toHaveBeenCalledWith({ where: { id: 'inexistente' } });
});

test('acepta el mínimo de cinco caracteres, recorta y registra el cierre', async () => {
  const cerrada = { id: 'n1', estado: ESTADO_NOVEDAD.RESUELTA };
  prisma.novedad.update.mockResolvedValue(cerrada);
  await expect(resolver('n1', '  Listo  ', user)).resolves.toEqual(cerrada);
  expect(prisma.novedad.update).toHaveBeenCalledWith({
    where: { id: 'n1', estado: { not: ESTADO_NOVEDAD.RESUELTA } },
    data: { estado: ESTADO_NOVEDAD.RESUELTA, comentario_cierre: 'Listo',
      atendida_por: 's1', fecha_atencion: expect.any(Date) },
  });
});

test('conserva los errores inesperados de base de datos', async () => {
  const error = new Error('Fallo de base de datos');
  prisma.novedad.update.mockRejectedValue(error);
  await expect(resolver('n1', 'Cierre válido', user)).rejects.toBe(error);
});

describe.each([
  ['resolver', (actor) => resolver('n1', 'Cierre válido', actor)],
  ['escalar', (actor) => escalar('n1', actor)],
])('%s: permisos por rol', (_nombre, ejecutar) => {
  test('supervisor de otra instalación recibe 403 sin escribir', async () => {
    resolverInstalacionesSupervisor.mockResolvedValue(['otra']);
    await expect(ejecutar(user)).rejects.toMatchObject({ statusCode: 403 });
    expect(prisma.novedad.update).not.toHaveBeenCalled();
  });
  test.each([ROLES.SUPERVISOR, ROLES.OPERADOR_CENTRAL, ROLES.ADMINISTRADOR])('permite %s autorizado', async (rol) => {
    prisma.novedad.update.mockResolvedValue({ id: 'n1' });
    await expect(ejecutar({ id: 's1', rol })).resolves.toMatchObject({ id: 'n1' });
    expect(resolverInstalacionesSupervisor).toHaveBeenCalledTimes(rol === ROLES.SUPERVISOR ? 1 : 0);
  });
  test.each([ROLES.GGSS_EN_PAUTA, ROLES.GGSS_LIBRE])('rechaza %s', async (rol) => {
    await expect(ejecutar({ id: 'u1', rol })).rejects.toMatchObject({ statusCode: 403 });
  });
});

test.each([ESTADO_NOVEDAD.RESUELTA, ESTADO_NOVEDAD.ESCALADA])('escalar rechaza estado %s con 409', async (estado) => {
  prisma.novedad.findUnique.mockResolvedValue({ id: 'n1', instalacion_id: 'i1', estado });
  prisma.novedad.update.mockRejectedValue({ code: 'P2025' });
  await expect(escalar('n1', user)).rejects.toMatchObject({ statusCode: 409 });
  expect(prisma.novedad.update.mock.calls[0][0].where.estado).toEqual({ in: [ESTADO_NOVEDAD.ABIERTA, ESTADO_NOVEDAD.EN_ATENCION] });
});

test('escalar responde 404 al id inexistente', async () => {
  prisma.novedad.findUnique.mockResolvedValue(null);
  await expect(escalar('no-existe', user)).rejects.toMatchObject({ statusCode: 404 });
  expect(prisma.novedad.update).not.toHaveBeenCalled();
});
