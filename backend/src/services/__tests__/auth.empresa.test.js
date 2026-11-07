jest.mock('../../config/database', () => { const prisma = { usuario: { findUnique: jest.fn(), findFirst: jest.fn() } }; return { prisma, prismaGlobal: prisma }; });
jest.mock('bcryptjs', () => ({ compare: jest.fn() }));
jest.mock('jsonwebtoken', () => ({ sign: jest.fn(), verify: jest.fn(), decode: jest.fn() }));
jest.mock('../../config/redis', () => ({ getRedis: jest.fn() }));

const { prismaGlobal: prisma } = require('../../config/database');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { getRedis } = require('../../config/redis');
const auth = require('../auth.service');
const { ROLES } = require('../../constants/roles');

const perfil = {
  id: 'u1', rol: ROLES.GGSS_EN_PAUTA, nombre: 'Prueba', email: 'prueba@example.invalid', estado: 'activo', password_hash: 'hash',
  empresa_id: 'e1', empresa: { id: 'e1', nombre: 'Empresa Uno', estado: 'activa' },
};
const suspendida = { ...perfil, empresa: { ...perfil.empresa, estado: 'suspendida' } };

beforeEach(() => {
  jest.resetAllMocks();
  prisma.usuario.findUnique.mockResolvedValue(perfil);
  prisma.usuario.findFirst.mockResolvedValue(perfil);
  bcrypt.compare.mockResolvedValue(true);
  jwt.sign.mockReturnValue('jwt-simulado');
  jwt.verify.mockReturnValue({ id: 'u1' });
  getRedis.mockReturnValue({ get: jest.fn(), incr: jest.fn(), expire: jest.fn(), del: jest.fn(), set: jest.fn() });
});

describe('login y empresa', () => {
  test('el token de acceso y el de refresco llevan empresaId (sale de la base, no del cliente)', async () => {
    await auth.login('rut-prueba', 'clave');
    expect(jwt.sign.mock.calls.map(([payload]) => payload.empresaId)).toEqual(['e1', 'e1']);
  });

  test('la respuesta incluye la empresa para mostrarla y no filtra su estado interno', async () => {
    const { usuario } = await auth.login('rut-prueba', 'clave');
    expect(usuario.empresa).toEqual({ id: 'e1', nombre: 'Empresa Uno' });
  });

  test('una empresa suspendida no puede iniciar sesión: 403 y no se emiten tokens', async () => {
    prisma.usuario.findFirst.mockResolvedValue(suspendida);
    await expect(auth.login('rut-prueba', 'clave')).rejects.toMatchObject({ statusCode: 403, code: 'EMPRESA_SUSPENDIDA' });
    expect(jwt.sign).not.toHaveBeenCalled();
  });

  test('con contraseña incorrecta no se revela que la empresa está suspendida (sigue siendo 401)', async () => {
    prisma.usuario.findFirst.mockResolvedValue(suspendida);
    bcrypt.compare.mockResolvedValue(false);
    await expect(auth.login('rut-prueba', 'incorrecta')).rejects.toMatchObject({ statusCode: 401 });
  });

  test('el super admin (sin empresa) inicia sesión y su token lleva empresaId nulo', async () => {
    prisma.usuario.findFirst.mockResolvedValue({ ...perfil, rol: ROLES.SUPER_ADMIN, empresa_id: null, empresa: null });
    const { usuario } = await auth.login('rut-prueba', 'clave');
    expect(usuario.empresa).toBeNull();
    expect(jwt.sign.mock.calls[0][0].empresaId).toBeNull();
  });

  test('la búsqueda del login incluye la empresa en la misma consulta', async () => {
    await auth.login('rut-prueba', 'clave');
    expect(prisma.usuario.findFirst.mock.calls[0][0].include).toHaveProperty('empresa');
  });
});

describe('renovar sesión y empresa', () => {
  test('falla con 403 si la empresa fue suspendida desde que se emitió el refresh', async () => {
    prisma.usuario.findUnique.mockResolvedValue(suspendida);
    await expect(auth.refreshToken('refresh-simulado')).rejects.toMatchObject({ statusCode: 403 });
    expect(jwt.sign).not.toHaveBeenCalled();
  });

  test('con empresa activa renueva y conserva empresaId', async () => {
    await auth.refreshToken('refresh-simulado');
    expect(jwt.sign.mock.calls[0][0].empresaId).toBe('e1');
  });
});
