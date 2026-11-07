process.env.JWT_ACCESS_SECRET = 'secreto-acceso-solo-pruebas';
process.env.JWT_REFRESH_SECRET = 'secreto-refresh-solo-pruebas';

jest.mock('../../config/database', () => { const prisma = { usuario: { findUnique: jest.fn() } }; return { prisma, prismaGlobal: prisma }; });
jest.mock('../../config/redis', () => ({ getRedis: jest.fn(() => null) }));

const jwt = require('jsonwebtoken');
const { prismaGlobal: prisma } = require('../../config/database');
const { authenticate } = require('../auth');
const { exigirEmpresa } = require('../rbac');
const { empresaActual } = require('../../config/tenant');

const firmar = (extra = {}) => jwt.sign({ id: 'u1', rol: 'supervisor', empresaId: 'e1', ...extra }, process.env.JWT_ACCESS_SECRET, { expiresIn: '1h' });
const vigente = (extra = {}) => ({ estado: 'activo', rol: 'supervisor', empresa_id: 'e1', empresa: { estado: 'activa' }, ...extra });
const resSimulada = () => ({ status: jest.fn().mockReturnThis(), json: jest.fn() });
const correr = async (token, alSeguir) => {
  const res = resSimulada();
  const next = jest.fn(alSeguir);
  await authenticate({ headers: { authorization: `Bearer ${token}` } }, res, next);
  return { res, next };
};

beforeEach(() => jest.resetAllMocks());

describe('authenticate y la empresa del token', () => {
  test('abre el contexto de empresa con la empresa del TOKEN para todo lo que viene después', async () => {
    prisma.usuario.findUnique.mockResolvedValue(vigente());
    let vista = null;
    await correr(firmar(), () => { vista = empresaActual(); });
    expect(vista).toBe('e1');
    expect(empresaActual()).toBeNull(); // fuera de la petición no queda contexto
  });

  test('una empresa suspendida corta el acceso de inmediato con 403 aunque el token siga vigente', async () => {
    prisma.usuario.findUnique.mockResolvedValue(vigente({ empresa: { estado: 'suspendida' } }));
    const { res, next } = await correr(firmar());
    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ code: 'EMPRESA_SUSPENDIDA' }));
  });

  test('un token con otra empresa que la de la base se rechaza (401)', async () => {
    prisma.usuario.findUnique.mockResolvedValue(vigente());
    const { res, next } = await correr(firmar({ empresaId: 'otra-empresa' }));
    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(401);
  });

  test('un token anterior a multiempresa (sin empresaId) debe volver a iniciar sesión', async () => {
    prisma.usuario.findUnique.mockResolvedValue(vigente());
    const { res, next } = await correr(firmar({ empresaId: undefined }));
    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(401);
  });

  test('el super admin pasa sin contexto de empresa', async () => {
    prisma.usuario.findUnique.mockResolvedValue(vigente({ rol: 'super_admin', empresa_id: null, empresa: null }));
    let vista = 'sin-llamar';
    const { next } = await correr(firmar({ rol: 'super_admin', empresaId: null }), () => { vista = empresaActual(); });
    expect(next).toHaveBeenCalled();
    expect(vista).toBeNull();
  });

  test('la empresa que manda el cliente en el cuerpo o la cabecera no influye', async () => {
    prisma.usuario.findUnique.mockResolvedValue(vigente());
    let vista = null;
    const res = resSimulada();
    const req = {
      headers: { authorization: `Bearer ${firmar()}`, 'x-empresa-id': 'otra' },
      body: { empresa_id: 'otra', empresaId: 'otra' },
      query: { empresa_id: 'otra' },
    };
    await authenticate(req, res, () => { vista = empresaActual(); });
    expect(vista).toBe('e1');
  });
});

describe('exigirEmpresa', () => {
  const ejecutar = (user) => {
    const res = resSimulada();
    const next = jest.fn();
    exigirEmpresa({ user }, res, next);
    return { res, next };
  };

  test('deja pasar a un usuario con empresa', () => {
    expect(ejecutar({ id: 'u1', rol: 'admin', empresaId: 'e1' }).next).toHaveBeenCalled();
  });

  test('el super admin (sin empresa) no puede operar rutas de empresa: 403', () => {
    const { res, next } = ejecutar({ id: 's1', rol: 'super_admin', empresaId: null });
    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(403);
  });

  test('sin usuario autenticado responde 401', () => {
    const { res, next } = ejecutar(undefined);
    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(401);
  });
});
