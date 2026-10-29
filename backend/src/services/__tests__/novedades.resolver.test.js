jest.mock('../../config/database', () => ({ prisma: { novedad: {
  update: jest.fn(), findUnique: jest.fn(),
} } }));
jest.mock('../../utils/azureStorage', () => ({ uploadFotoToAzure: jest.fn(), generarUrlLectura: jest.fn() }));
jest.mock('../../socket/socketManager', () => ({ getSocketIO: jest.fn() }));
jest.mock('../../config/logger', () => ({ logger: { error: jest.fn(), warn: jest.fn() } }));

const { prisma } = require('../../config/database');
const { ESTADO_NOVEDAD } = require('../../constants/estados');
const { resolver } = require('../novedades.service');

beforeEach(() => jest.resetAllMocks());

test.each(['', '   ', undefined, null, 12345, {}, [], 'abcd', '  abcd  '])(
  'rechaza comentario inválido %p con 400 sin modificar datos', async (comentario) => {
    await expect(resolver('n1', comentario, 's1')).rejects.toMatchObject({ statusCode: 400 });
    expect(prisma.novedad.update).not.toHaveBeenCalled();
    expect(prisma.novedad.findUnique).not.toHaveBeenCalled();
  },
);

test('responde 409 si ya está resuelta y no sobrescribe el cierre', async () => {
  prisma.novedad.update.mockRejectedValue({ code: 'P2025' });
  prisma.novedad.findUnique.mockResolvedValue({ id: 'n1', estado: ESTADO_NOVEDAD.RESUELTA });
  await expect(resolver('n1', 'Cierre válido', 's1')).rejects.toMatchObject({ statusCode: 409 });
  expect(prisma.novedad.update).toHaveBeenCalledTimes(1);
  expect(prisma.novedad.update.mock.calls[0][0].where).toEqual({
    id: 'n1', estado: { not: ESTADO_NOVEDAD.RESUELTA },
  });
});

test('responde 404 si el id no existe', async () => {
  prisma.novedad.update.mockRejectedValue({ code: 'P2025' });
  prisma.novedad.findUnique.mockResolvedValue(null);
  await expect(resolver('inexistente', 'Cierre válido', 's1')).rejects.toMatchObject({ statusCode: 404 });
  expect(prisma.novedad.findUnique).toHaveBeenCalledWith({ where: { id: 'inexistente' } });
});

test('acepta el mínimo de cinco caracteres, recorta y registra el cierre', async () => {
  const cerrada = { id: 'n1', estado: ESTADO_NOVEDAD.RESUELTA };
  prisma.novedad.update.mockResolvedValue(cerrada);
  await expect(resolver('n1', '  Listo  ', 's1')).resolves.toEqual(cerrada);
  expect(prisma.novedad.update).toHaveBeenCalledWith({
    where: { id: 'n1', estado: { not: ESTADO_NOVEDAD.RESUELTA } },
    data: { estado: ESTADO_NOVEDAD.RESUELTA, comentario_cierre: 'Listo',
      atendida_por: 's1', fecha_atencion: expect.any(Date) },
  });
});

test('conserva los errores inesperados de base de datos', async () => {
  const error = new Error('Fallo de base de datos');
  prisma.novedad.update.mockRejectedValue(error);
  await expect(resolver('n1', 'Cierre válido', 's1')).rejects.toBe(error);
  expect(prisma.novedad.findUnique).not.toHaveBeenCalled();
});
