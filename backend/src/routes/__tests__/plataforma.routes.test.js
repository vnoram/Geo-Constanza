// Rutas de plataforma (gestión de empresas): solo el SUPER_ADMIN, con HTTP real (supertest) y la base simulada.
jest.mock('../../middlewares/auth', () => ({
  // El usuario de la petición viaja en una cabecera de prueba (en producción lo fija el token firmado)
  authenticate: (req, _res, next) => { req.user = JSON.parse(req.get('x-test-user')); next(); },
}));
jest.mock('../../config/database', () => {
  const prismaGlobal = {
    empresa: { findMany: jest.fn(), findUnique: jest.fn(), create: jest.fn(), update: jest.fn() },
    usuario: { count: jest.fn(), create: jest.fn() },
  };
  return { prisma: {}, prismaGlobal };
});
jest.mock('../../middlewares/auditLog', () => ({ registrarAuditoria: jest.fn().mockResolvedValue(undefined) }));
jest.mock('../../services/passwordReset.service', () => ({ invitar: jest.fn() }));
jest.mock('../../socket/socketManager', () => ({ desconectarEmpresa: jest.fn(), getSocketIO: jest.fn() }));
jest.mock('bcryptjs', () => ({ hash: jest.fn().mockResolvedValue('hash-simulado') }));

const express = require('express');
const request = require('supertest');
const { prismaGlobal } = require('../../config/database');
const { registrarAuditoria } = require('../../middlewares/auditLog');
const passwordReset = require('../../services/passwordReset.service');
const { desconectarEmpresa } = require('../../socket/socketManager');
const { ROLES } = require('../../constants/roles');
const { errorHandler } = require('../../middlewares/errorHandler');

const app = express();
app.use(express.json());
app.use('/plataforma', require('../plataforma.routes'));
app.use(errorHandler);

const superAdmin = { id: 'sa1', rol: ROLES.SUPER_ADMIN, empresaId: null };
const como = (user) => ({ 'x-test-user': JSON.stringify(user) });
const empresaBD = { id: 'e1', nombre: 'Alfa', rut: '76111111-1', estado: 'activa', plan: 'estandar', created_at: new Date(), _count: { usuarios: 3, instalaciones: 1 }, usuarios: [] };

beforeEach(() => {
  jest.clearAllMocks();
  prismaGlobal.empresa.findMany.mockResolvedValue([empresaBD]);
  prismaGlobal.empresa.findUnique.mockResolvedValue({ id: 'e1' });
  prismaGlobal.empresa.create.mockResolvedValue(empresaBD);
  prismaGlobal.empresa.update.mockResolvedValue(empresaBD);
  prismaGlobal.usuario.count.mockResolvedValue(0);
  prismaGlobal.usuario.create.mockResolvedValue({ id: 'u1', nombre: 'Admin', email: 'a@b.cl', rol: 'admin', estado: 'activo' });
  passwordReset.invitar.mockResolvedValue(true);
});

const RUTAS = [
  ['get', '/plataforma/empresas'], ['post', '/plataforma/empresas'], ['get', '/plataforma/empresas/e1'],
  ['put', '/plataforma/empresas/e1'], ['patch', '/plataforma/empresas/e1/estado'], ['post', '/plataforma/empresas/e1/admin'],
];

describe('quién puede entrar', () => {
  test.each([ROLES.ADMINISTRADOR, ROLES.SUPERVISOR, ROLES.OPERADOR_CENTRAL, ROLES.GGSS_EN_PAUTA, ROLES.GGSS_LIBRE])(
    'el rol %s (aunque sea de una empresa) recibe 403 en TODAS las rutas de plataforma', async (rol) => {
      for (const [metodo, ruta] of RUTAS) {
        const res = await request(app)[metodo](ruta).set(como({ id: 'x', rol, empresaId: 'e1' })).send({});
        expect(res.status).toBe(403);
      }
      expect(prismaGlobal.empresa.create).not.toHaveBeenCalled();
      expect(prismaGlobal.empresa.update).not.toHaveBeenCalled();
    },
  );

  test('el super admin puede listar', async () => {
    const res = await request(app).get('/plataforma/empresas').set(como(superAdmin));
    expect(res.status).toBe(200);
    expect(res.body.data[0]).toMatchObject({ id: 'e1', nombre: 'Alfa', total_usuarios: 3, total_instalaciones: 1 });
  });

  test('la lista muestra conteos y la cuenta de administración, nunca datos operativos', async () => {
    await request(app).get('/plataforma/empresas').set(como(superAdmin));
    const { select } = prismaGlobal.empresa.findMany.mock.calls[0][0];
    expect(Object.keys(select).sort()).toEqual(['_count', 'created_at', 'estado', 'id', 'nombre', 'plan', 'rut', 'usuarios']);
    expect(select.usuarios.where).toEqual({ rol: ROLES.ADMINISTRADOR });
    expect(select.usuarios.select).not.toHaveProperty('password_hash');
  });
});

describe('crear y editar empresas', () => {
  test('crea con RUT normalizado y plan por defecto, y audita como acción de plataforma', async () => {
    const res = await request(app).post('/plataforma/empresas').set(como(superAdmin)).send({ nombre: '  Alfa Seguridad  ', rut: '76.543.210-3' });
    expect(res.status).toBe(201);
    expect(prismaGlobal.empresa.create.mock.calls[0][0].data).toEqual({ nombre: 'Alfa Seguridad', rut: '76543210-3', plan: 'estandar' });
    expect(registrarAuditoria).toHaveBeenCalledWith(expect.objectContaining({ accion: 'crear_empresa', usuarioId: 'sa1', empresaId: null }));
  });

  test.each([
    [{ nombre: 'AB', rut: '76543210-3' }, /nombre/i],
    [{ nombre: 'Alfa', rut: '76543210-4' }, /RUT/],
    [{ nombre: 'Alfa', rut: 'no-es-rut' }, /RUT/],
    [{ nombre: 'Alfa', rut: '76543210-3', plan: 'gratis' }, /plan/i],
    [{}, /nombre/i],
  ])('rechaza datos inválidos %j', async (cuerpo, mensaje) => {
    const res = await request(app).post('/plataforma/empresas').set(como(superAdmin)).send(cuerpo);
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(mensaje);
    expect(prismaGlobal.empresa.create).not.toHaveBeenCalled();
  });

  test('un RUT repetido responde 409', async () => {
    prismaGlobal.empresa.create.mockRejectedValue(Object.assign(new Error('dup'), { code: 'P2002' }));
    const res = await request(app).post('/plataforma/empresas').set(como(superAdmin)).send({ nombre: 'Alfa', rut: '76543210-3' });
    expect(res.status).toBe(409);
  });

  test('edita solo los campos enviados y valida', async () => {
    const ok = await request(app).put('/plataforma/empresas/e1').set(como(superAdmin)).send({ nombre: 'Nuevo nombre', plan: 'premium' });
    expect(ok.status).toBe(200);
    expect(prismaGlobal.empresa.update.mock.calls[0][0].data).toEqual({ nombre: 'Nuevo nombre', plan: 'premium' });
    expect((await request(app).put('/plataforma/empresas/e1').set(como(superAdmin)).send({})).status).toBe(400);
    expect((await request(app).put('/plataforma/empresas/e1').set(como(superAdmin)).send({ rut: '1-1' })).status).toBe(400);
  });

  test('editar una empresa inexistente responde 404', async () => {
    prismaGlobal.empresa.update.mockRejectedValue(Object.assign(new Error('x'), { code: 'P2025' }));
    expect((await request(app).put('/plataforma/empresas/no-existe').set(como(superAdmin)).send({ nombre: 'Algo largo' })).status).toBe(404);
  });

  test('el cuerpo no puede inyectar campos internos (estado, ultimo_folio, id)', async () => {
    await request(app).put('/plataforma/empresas/e1').set(como(superAdmin)).send({ nombre: 'Valido', estado: 'suspendida', ultimo_folio: 0, id: 'otro' });
    expect(prismaGlobal.empresa.update.mock.calls[0][0].data).toEqual({ nombre: 'Valido' });
  });
});

describe('suspender y activar', () => {
  test('suspender cambia el estado, audita y desconecta los sockets de la empresa', async () => {
    const res = await request(app).patch('/plataforma/empresas/e1/estado').set(como(superAdmin)).send({ estado: 'suspendida' });
    expect(res.status).toBe(200);
    expect(prismaGlobal.empresa.update.mock.calls[0][0]).toMatchObject({ where: { id: 'e1' }, data: { estado: 'suspendida' } });
    expect(registrarAuditoria).toHaveBeenCalledWith(expect.objectContaining({ accion: 'suspender_empresa', empresaId: null }));
    expect(desconectarEmpresa).toHaveBeenCalledWith('e1');
  });

  test('activar NO desconecta a nadie', async () => {
    await request(app).patch('/plataforma/empresas/e1/estado').set(como(superAdmin)).send({ estado: 'activa' });
    expect(registrarAuditoria).toHaveBeenCalledWith(expect.objectContaining({ accion: 'activar_empresa' }));
    expect(desconectarEmpresa).not.toHaveBeenCalled();
  });

  test('un estado inválido responde 400 y no cambia nada', async () => {
    const res = await request(app).patch('/plataforma/empresas/e1/estado').set(como(superAdmin)).send({ estado: 'borrada' });
    expect(res.status).toBe(400);
    expect(prismaGlobal.empresa.update).not.toHaveBeenCalled();
  });

  test('una empresa inexistente responde 404', async () => {
    prismaGlobal.empresa.update.mockRejectedValue(Object.assign(new Error('x'), { code: 'P2025' }));
    expect((await request(app).patch('/plataforma/empresas/zzz/estado').set(como(superAdmin)).send({ estado: 'suspendida' })).status).toBe(404);
    expect(desconectarEmpresa).not.toHaveBeenCalled();
  });
});

describe('primer administrador de la empresa', () => {
  const datos = { nombre: 'Primera Admin', rut: '12.345.678-5', email: 'Primera@Alfa.cl' };

  test('crea un administrador de ESA empresa con clave aleatoria e invitación por correo', async () => {
    const res = await request(app).post('/plataforma/empresas/e1/admin').set(como(superAdmin)).send(datos);
    expect(res.status).toBe(201);
    const { data } = prismaGlobal.usuario.create.mock.calls[0][0];
    expect(data).toMatchObject({ empresa_id: 'e1', rol: ROLES.ADMINISTRADOR, rut: '12345678-5', email: 'primera@alfa.cl', password_hash: 'hash-simulado' });
    expect(data.password).toBeUndefined();
    expect(passwordReset.invitar).toHaveBeenCalled();
    expect(res.body.invitacion_enviada).toBe(true);
    expect(res.body).not.toHaveProperty('password_hash');
  });

  test('el rol y la empresa salen de la URL y del servidor, no del cuerpo', async () => {
    await request(app).post('/plataforma/empresas/e1/admin').set(como(superAdmin)).send({ ...datos, rol: 'super_admin', empresa_id: 'otra', password: 'mia' });
    const { data } = prismaGlobal.usuario.create.mock.calls[0][0];
    expect(data.rol).toBe(ROLES.ADMINISTRADOR);
    expect(data.empresa_id).toBe('e1');
    expect(data.password).toBeUndefined();
  });

  test('si la empresa ya tiene un administrador activo responde 409', async () => {
    prismaGlobal.usuario.count.mockResolvedValue(1);
    const res = await request(app).post('/plataforma/empresas/e1/admin').set(como(superAdmin)).send(datos);
    expect(res.status).toBe(409);
    expect(prismaGlobal.usuario.create).not.toHaveBeenCalled();
  });

  test.each([
    [{ ...datos, nombre: '' }], [{ ...datos, rut: '12345678-0' }], [{ ...datos, email: 'no-es-correo' }], [{}],
  ])('rechaza datos inválidos %j', async (cuerpo) => {
    expect((await request(app).post('/plataforma/empresas/e1/admin').set(como(superAdmin)).send(cuerpo)).status).toBe(400);
    expect(prismaGlobal.usuario.create).not.toHaveBeenCalled();
  });

  test('una empresa inexistente responde 404', async () => {
    prismaGlobal.empresa.findUnique.mockResolvedValue(null);
    expect((await request(app).post('/plataforma/empresas/zzz/admin').set(como(superAdmin)).send(datos)).status).toBe(404);
  });

  test('un RUT o correo ya usado responde 409', async () => {
    prismaGlobal.usuario.create.mockRejectedValue(Object.assign(new Error('dup'), { code: 'P2002' }));
    expect((await request(app).post('/plataforma/empresas/e1/admin').set(como(superAdmin)).send(datos)).status).toBe(409);
  });

  test('si la invitación falla el administrador igual queda creado y se informa', async () => {
    passwordReset.invitar.mockRejectedValue(new Error('SMTP caído'));
    const res = await request(app).post('/plataforma/empresas/e1/admin').set(como(superAdmin)).send(datos);
    expect(res.status).toBe(201);
    expect(res.body.invitacion_enviada).toBe(false);
  });
});
