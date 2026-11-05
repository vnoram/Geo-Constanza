// El servicio trabaja por identidad (id del token) con el cliente global; ambos nombres apuntan al mismo doble.
jest.mock('../../config/database', () => { const prisma = { usuario: { findUnique: jest.fn(), update: jest.fn() } }; return { prisma, prismaGlobal: prisma }; });
jest.mock('bcryptjs', () => ({ compare: jest.fn(), hash: jest.fn() }));
jest.mock('../../config/redis', () => ({ getRedis: jest.fn() }));
jest.mock('../correo.service', () => ({ enviarCorreo: jest.fn() }));
const { prisma } = require('../../config/database');
const bcrypt = require('bcryptjs');
const { getRedis } = require('../../config/redis');
const { cambiar } = require('../passwordReset.service');

const usuario = { id: 'u1', estado: 'activo', password_hash: 'hash-actual' };
let redis;
beforeEach(() => {
  jest.resetAllMocks();
  prisma.usuario.findUnique.mockResolvedValue(usuario);
  bcrypt.compare.mockResolvedValue(true); bcrypt.hash.mockResolvedValue('hash-nuevo');
  redis = { set: jest.fn() }; getRedis.mockReturnValue(redis);
});

test('cambia la contraseña, guarda el hash nuevo y revoca sesiones', async () => {
  await expect(cambiar('u1', 'actual-simulada', 'nueva-simulada-1')).resolves.toEqual({ usuarioId: 'u1' });
  expect(prisma.usuario.update).toHaveBeenCalledWith(expect.objectContaining({
    where: { id: 'u1' }, data: expect.objectContaining({ password_hash: 'hash-nuevo' }),
  }));
  expect(redis.set).toHaveBeenCalledWith('pwd_changed:u1', expect.any(String), 'EX', expect.any(Number));
});

test('rechaza si la contraseña actual es incorrecta', async () => {
  bcrypt.compare.mockResolvedValue(false);
  await expect(cambiar('u1', 'mala', 'nueva-simulada-1')).rejects.toMatchObject({ statusCode: 400 });
  expect(prisma.usuario.update).not.toHaveBeenCalled();
});

test('rechaza una nueva muy corta o igual a la actual', async () => {
  await expect(cambiar('u1', 'actual-simulada', 'corta')).rejects.toMatchObject({ statusCode: 400 });
  await expect(cambiar('u1', 'misma-clave-123', 'misma-clave-123')).rejects.toMatchObject({ statusCode: 400 });
  expect(prisma.usuario.update).not.toHaveBeenCalled();
});

test('usuario inactivo o inexistente recibe 401', async () => {
  prisma.usuario.findUnique.mockResolvedValue({ ...usuario, estado: 'inactivo' });
  await expect(cambiar('u1', 'a', 'nueva-simulada-1')).rejects.toMatchObject({ statusCode: 401 });
});
