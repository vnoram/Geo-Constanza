process.env.JWT_ACCESS_SECRET = 'secreto-acceso-solo-pruebas';
process.env.JWT_REFRESH_SECRET = 'secreto-refresh-solo-pruebas';

jest.mock('../../config/database', () => ({ prisma: { usuario: { findUnique: jest.fn() } } }));
jest.mock('../../config/redis', () => ({ getRedis: jest.fn(() => null) }));

const jwt = require('jsonwebtoken');
const { prisma } = require('../../config/database');
const { authenticate } = require('../auth');
const { validarBody, loginSchema, resetConfirmSchema } = require('../../validators/auth.validators');

const correr = async (token) => {
  const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
  const next = jest.fn();
  await authenticate({ headers: { authorization: `Bearer ${token}` } }, res, next);
  return { res, next };
};
const firmar = (extra = {}) => jwt.sign({ id: 'u1', rol: 'supervisor', ...extra }, process.env.JWT_ACCESS_SECRET, { expiresIn: '1h' });

beforeEach(() => jest.resetAllMocks());

describe('authenticate confirma el estado actual del usuario', () => {
  test('deja pasar a un usuario activo con el mismo rol', async () => {
    prisma.usuario.findUnique.mockResolvedValue({ estado: 'activo', rol: 'supervisor' });
    const { next } = await correr(firmar());
    expect(next).toHaveBeenCalled();
  });

  test('un usuario desactivado pierde el acceso aunque su token no haya vencido', async () => {
    prisma.usuario.findUnique.mockResolvedValue({ estado: 'inactivo', rol: 'supervisor' });
    const { res, next } = await correr(firmar());
    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(401);
  });

  test('un usuario eliminado o con otro rol ya no entra con el token viejo', async () => {
    prisma.usuario.findUnique.mockResolvedValue(null);
    expect((await correr(firmar())).res.status).toHaveBeenCalledWith(401);
    prisma.usuario.findUnique.mockResolvedValue({ estado: 'activo', rol: 'pauta' });
    expect((await correr(firmar())).res.status).toHaveBeenCalledWith(401);
  });

  test('el token temporal de 2FA sigue sin servir como sesión', async () => {
    prisma.usuario.findUnique.mockResolvedValue({ estado: 'activo', rol: 'supervisor' });
    const { res, next } = await correr(firmar({ tipo: '2fa_pending' }));
    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(401);
  });
});

describe('validación de entrada de autenticación', () => {
  const ejecutar = (schema, body) => {
    const req = { body };
    const next = jest.fn();
    validarBody(schema)(req, {}, next);
    return { req, next };
  };

  test('rechaza objetos o arreglos donde se espera texto', () => {
    for (const rut of [{ contains: '1' }, ['1'], 123, null, '']) {
      const { next } = ejecutar(loginSchema, { rut, password: 'x' });
      expect(next.mock.calls[0][0]).toMatchObject({ name: 'ZodError' });
    }
  });

  test('acepta datos válidos y descarta campos desconocidos', () => {
    const { req, next } = ejecutar(loginSchema, { rut: ' 12345678-9 ', password: 'clave', rol: 'admin' });
    expect(next).toHaveBeenCalledWith();
    expect(req.body).toEqual({ rut: '12345678-9', password: 'clave' });
  });

  test('limita el largo de contraseña y token en el reset', () => {
    const { next } = ejecutar(resetConfirmSchema, { token: 'a'.repeat(201), password: 'x' });
    expect(next.mock.calls[0][0]).toMatchObject({ name: 'ZodError' });
    expect(ejecutar(resetConfirmSchema, { token: 'a'.repeat(43), password: 'p'.repeat(129) }).next.mock.calls[0][0]).toBeDefined();
  });
});
