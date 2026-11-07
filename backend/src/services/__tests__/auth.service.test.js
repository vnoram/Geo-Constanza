// Login, renovar sesión y 2FA ocurren antes de conocer la empresa: usan el cliente global.
jest.mock('../../config/database', () => { const prisma = { usuario: { findUnique: jest.fn(), findFirst: jest.fn() } }; return { prisma, prismaGlobal: prisma }; });
jest.mock('bcryptjs', () => ({ compare: jest.fn() }));
jest.mock('jsonwebtoken', () => ({ sign: jest.fn(), verify: jest.fn(), decode: jest.fn() }));
jest.mock('../../config/redis', () => ({ getRedis: jest.fn() }));
const { prisma } = require('../../config/database');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { getRedis } = require('../../config/redis');
const auth = require('../auth.service');
const { ROLES } = require('../../constants/roles');
const { ESTADO_USUARIO } = require('../../constants/estados');
const perfil = { id: 'u1', rol: ROLES.GGSS_EN_PAUTA, nombre: 'Prueba', email: 'prueba@example.invalid', estado: ESTADO_USUARIO.ACTIVO,
  password_hash: 'hash-simulado', two_factor_secret: 'dato-simulado-no-operativo',
  empresa_id: 'e1', empresa: { id: 'e1', nombre: 'Empresa Uno', estado: 'activa' } };
let redis;
beforeEach(() => {
  jest.resetAllMocks();
  prisma.usuario.findUnique.mockResolvedValue(perfil); prisma.usuario.findFirst.mockResolvedValue(perfil); bcrypt.compare.mockResolvedValue(true);
  jwt.sign.mockReturnValue('jwt-simulado'); jwt.verify.mockReturnValue({ id: 'u1' });
  redis = { get: jest.fn(), incr: jest.fn(), expire: jest.fn(), del: jest.fn(), set: jest.fn() }; getRedis.mockReturnValue(redis);
});
test('login válido devuelve tokens sin hash ni secreto 2FA', async () => {
  const respuesta = await auth.login('rut-prueba', 'entrada-simulada');
  expect(respuesta).toHaveProperty('accessToken', 'jwt-simulado');
  expect(respuesta.usuario).not.toHaveProperty('password_hash'); expect(respuesta.usuario).not.toHaveProperty('two_factor_secret');
  expect(redis.del).toHaveBeenCalledWith('login_attempts:u1'); expect(jwt.sign).toHaveBeenCalledTimes(2);
});
test.each([null, { ...perfil, estado: ESTADO_USUARIO.INACTIVO }])('usuario inexistente/inactivo recibe 401', async usuario => {
  prisma.usuario.findFirst.mockResolvedValue(usuario);
  await expect(auth.login('rut-prueba', 'entrada-simulada')).rejects.toMatchObject({ statusCode: 401 });
});
test('el login encuentra al usuario con RUT con o sin puntos', async () => {
  await auth.login('22222222-2', 'entrada-simulada');
  expect(prisma.usuario.findFirst.mock.calls[0][0].where.rut.in).toEqual(expect.arrayContaining(['22222222-2', '22.222.222-2']));
});
test('contraseña incorrecta incrementa intentos y TTL de bloqueo', async () => {
  bcrypt.compare.mockResolvedValue(false);
  await expect(auth.login('rut-prueba', 'entrada-simulada')).rejects.toMatchObject({ statusCode: 401 });
  expect(redis.incr).toHaveBeenCalledWith('login_attempts:u1'); expect(redis.expire).toHaveBeenCalledWith('login_attempts:u1', 900);
  expect(jwt.sign).not.toHaveBeenCalled();
});
test('cinco intentos bloquean con 429 antes de comparar contraseña', async () => {
  redis.get.mockResolvedValue('5');
  await expect(auth.login('rut-prueba', 'entrada-simulada')).rejects.toMatchObject({ statusCode: 429 });
  expect(bcrypt.compare).not.toHaveBeenCalled();
});
test('fallos Redis no rompen login válido ni cambian un rechazo de credenciales', async () => {
  redis.get.mockRejectedValue(new Error('Redis simulado no disponible')); redis.del.mockRejectedValue(new Error('Redis simulado'));
  await expect(auth.login('rut-prueba', 'entrada-simulada')).resolves.toHaveProperty('accessToken');
  bcrypt.compare.mockResolvedValue(false); redis.incr.mockRejectedValue(new Error('Redis simulado'));
  await expect(auth.login('rut-prueba', 'entrada-simulada')).rejects.toMatchObject({ statusCode: 401 });
});
test('sin Redis puede iniciar sesión', async () => {
  getRedis.mockReturnValue(null);
  await expect(auth.login('rut-prueba', 'entrada-simulada')).resolves.toHaveProperty('accessToken');
});
test('verify2FA con token temporal inválido responde 401 y no emite tokens', async () => {
  jwt.verify.mockImplementation(() => { throw new Error('token inválido'); });
  await expect(auth.verify2FA('temporal-simulado', 'codigo-simulado')).rejects.toMatchObject({ statusCode: 401 });
  expect(jwt.sign).not.toHaveBeenCalled();
});
test('refresh valida usuario activo y firma nueva pareja', async () => {
  await expect(auth.refreshToken('refresh-simulado')).resolves.toHaveProperty('refreshToken');
  prisma.usuario.findUnique.mockResolvedValue(null);
  await expect(auth.refreshToken('refresh-simulado')).rejects.toMatchObject({ statusCode: 401 });
  jwt.verify.mockImplementation(() => { throw new Error('Token inválido simulado'); });
  await expect(auth.refreshToken('refresh-simulado')).rejects.toMatchObject({ statusCode: 401, message: 'Token inválido' });
});
test('logout agrega token vigente a blacklist y omite uno expirado', async () => {
  jwt.decode.mockReturnValue({ exp: Math.floor(Date.now()/1000) + 120 });
  await auth.logout('jwt-simulado', 'u1'); expect(redis.set).toHaveBeenCalledWith('bl:jwt-simulado', '1', 'EX', expect.any(Number));
  redis.set.mockClear(); jwt.decode.mockReturnValue({ exp: 1 }); await auth.logout('vencido-simulado', 'u1'); expect(redis.set).not.toHaveBeenCalled();
});
test('logout degrada si falla Redis', async () => {
  jwt.decode.mockImplementation(() => { throw new Error('Simulado'); });
  await expect(auth.logout('jwt-simulado', 'u1')).resolves.toBeUndefined();
});
