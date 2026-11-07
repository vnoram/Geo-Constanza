const { randomBytes } = require('crypto');
process.env.JWT_ACCESS_SECRET = randomBytes(32).toString('hex');
process.env.JWT_REFRESH_SECRET = randomBytes(32).toString('hex');

jest.mock('../../config/database', () => ({ prismaGlobal: { usuario: { findFirst: jest.fn(), findUnique: jest.fn() } } }));
jest.mock('../../config/redis', () => ({ getRedis: jest.fn() }));
jest.mock('../../config/logger', () => ({ logger: { error: jest.fn() } }));
jest.mock('../../middlewares/auditLog', () => ({ registrarAuditoria: jest.fn() }));
jest.mock('../correo.service', () => ({ enviarCorreo: jest.fn() }));

const express = require('express');
const request = require('supertest');
const bcrypt = require('bcryptjs');
const { prismaGlobal } = require('../../config/database');
const { getRedis } = require('../../config/redis');
const { registrarAuditoria } = require('../../middlewares/auditLog');
const { errorHandler } = require('../../middlewares/errorHandler');
const { enviarCorreo } = require('../correo.service');
const { ROLES } = require('../../constants/roles');
const { ESTADO_USUARIO, ESTADO_EMPRESA } = require('../../constants/estados');
const twoFactor = require('../twoFactor.service');

const app = express();
app.use(express.json());
app.use('/auth', require('../../routes/auth.routes'));
app.use(errorHandler);
const login = () => request(app).post('/auth/login').send({ rut: '15678901-2', password: 'clave-de-prueba' });
const verificar = (tempToken, code) => request(app).post('/auth/2fa/verify').send({ tempToken, code });
const reenviar = (tempToken) => request(app).post('/auth/2fa/resend').send({ tempToken });
const codigo = () => enviarCorreo.mock.calls.at(-1)[3].match(/\b\d{6}\b/)[0];
const incorrecto = () => codigo() === '000000' ? '000001' : '000000';
const original = { ...process.env };
let usuario;
let reloj;

beforeEach(async () => {
  jest.resetAllMocks();
  process.env.TWO_FACTOR_METHOD = 'email';
  process.env.REQUIRE_2FA = 'true';
  delete process.env.REDIS_URL;
  delete process.env.TWO_FACTOR_ENCRYPTION_KEY;
  reloj = Date.now();
  jest.spyOn(Date, 'now').mockImplementation(() => reloj);
  usuario = {
    id: 'supervisor-prueba', rol: ROLES.SUPERVISOR, estado: ESTADO_USUARIO.ACTIVO,
    empresa_id: 'empresa-prueba', empresa: { estado: ESTADO_EMPRESA.ACTIVA },
    email: 'supervisor@example.invalid', password_hash: await bcrypt.hash('clave-de-prueba', 4),
  };
  prismaGlobal.usuario.findFirst.mockResolvedValue(usuario);
  prismaGlobal.usuario.findUnique.mockResolvedValue(usuario);
  enviarCorreo.mockResolvedValue(true);
  getRedis.mockReturnValue(null);
});

afterEach(() => {
  jest.restoreAllMocks();
  for (const key of ['TWO_FACTOR_METHOD', 'REQUIRE_2FA', 'REDIS_URL', 'TWO_FACTOR_ENCRYPTION_KEY']) {
    if (original[key] === undefined) delete process.env[key];
    else process.env[key] = original[key];
  }
});

test('envía seis dígitos y entrega sesión solo después de verificar una vez', async () => {
  const { body } = await login().expect(200);
  expect(body).toMatchObject({ requires2FA: true, method: 'email', retryAfter: 60 });
  expect(body.accessToken).toBeUndefined();
  expect(body.refreshToken).toBeUndefined();
  expect(enviarCorreo).toHaveBeenCalledWith(usuario.email, expect.any(String), undefined, expect.stringContaining('10 minutos'), { soloSMTP: true });
  const respuestas = await Promise.all([verificar(body.tempToken, codigo()), verificar(body.tempToken, codigo())]);
  expect(respuestas.map(r => r.status).sort()).toEqual([200, 401]);
  const sesion = respuestas.find(r => r.status === 200).body;
  expect(sesion).toHaveProperty('accessToken');
  expect(sesion).toHaveProperty('refreshToken');
  expect(registrarAuditoria.mock.calls.map(([evento]) => evento.accion)).toEqual(expect.arrayContaining(['enviar_2fa_email', 'login_2fa', 'fallo_2fa_email']));
});

test('un código incorrecto permite corregirlo hasta que se agotan cinco intentos', async () => {
  const { body: primero } = await login().expect(200);
  await verificar(primero.tempToken, incorrecto()).expect(401);
  await verificar(primero.tempToken, codigo()).expect(200);
  const { body } = await login().expect(200);
  for (let i = 0; i < 5; i += 1) await verificar(body.tempToken, incorrecto()).expect(401);
  await verificar(body.tempToken, codigo()).expect(401);
  await reenviar(body.tempToken).expect(401);
});

test('el desafío vence a los diez minutos', async () => {
  const { body } = await login().expect(200);
  reloj += 600000;
  await verificar(body.tempToken, codigo()).expect(401);
  await reenviar(body.tempToken).expect(401);
});

test('el reenvío espera 60 segundos, reemplaza el código y se limita a tres', async () => {
  const { body } = await login().expect(200);
  await reenviar(body.tempToken).expect(429);
  for (let i = 0; i < 3; i += 1) {
    const anterior = codigo();
    reloj += 60000;
    const respuestas = await Promise.all([reenviar(body.tempToken), reenviar(body.tempToken)]);
    expect(respuestas.map(r => r.status).sort()).toEqual([200, 429]);
    await verificar(body.tempToken, anterior).expect(401);
  }
  reloj += 60000;
  await reenviar(body.tempToken).expect(429);
  expect(enviarCorreo).toHaveBeenCalledTimes(4);
  await verificar(body.tempToken, codigo()).expect(200);
});

test('si falla SMTP, el login devuelve un error claro sin sesión ni desafío', async () => {
  enviarCorreo.mockResolvedValue(false);
  const { body } = await login().expect(503);
  expect(body.error).toMatch(/No pudimos enviar/);
  expect(body.tempToken).toBeUndefined();
  expect(body.accessToken).toBeUndefined();
  expect(registrarAuditoria).not.toHaveBeenCalled();
});

test('si falla el envío de un reenvío, el desafío ya no se acepta', async () => {
  const { body } = await login().expect(200);
  const anterior = codigo();
  reloj += 60000;
  enviarCorreo.mockRejectedValue(new Error('SMTP caído'));
  await reenviar(body.tempToken).expect(503);
  await verificar(body.tempToken, anterior).expect(401);
});

test('Redis configurado pero caído devuelve 503 sin enviar correo', async () => {
  process.env.REDIS_URL = 'redis://localhost:6379';
  await login().expect(503);
  getRedis.mockReturnValue({
    get: jest.fn().mockResolvedValue(null),
    del: jest.fn().mockResolvedValue(0),
    set: jest.fn().mockRejectedValue(new Error('Redis caído')),
  });
  await login().expect(503);
  expect(enviarCorreo).not.toHaveBeenCalled();
});

test.each([undefined, 'totp'])('el modo %s conserva el desafío y verificación TOTP', async (metodo) => {
  if (metodo === undefined) delete process.env.TWO_FACTOR_METHOD;
  else process.env.TWO_FACTOR_METHOD = metodo;
  process.env.TWO_FACTOR_ENCRYPTION_KEY = randomBytes(32).toString('hex');
  usuario.two_factor_enabled = true;
  const validar = jest.spyOn(twoFactor, 'verificarLogin').mockResolvedValue(usuario);
  const { body } = await login().expect(200);
  expect(Object.keys(body).sort()).toEqual(['requires2FA', 'tempToken']);
  await verificar(body.tempToken, '012345').expect(200);
  expect(validar).toHaveBeenCalledWith(body.tempToken, '012345');
  expect(enviarCorreo).not.toHaveBeenCalled();
});

test('los demás roles y REQUIRE_2FA=false mantienen el login directo', async () => {
  usuario.rol = ROLES.OPERADOR_CENTRAL;
  expect((await login().expect(200)).body).toHaveProperty('accessToken');
  usuario.rol = ROLES.ADMINISTRADOR;
  process.env.REQUIRE_2FA = 'false';
  expect((await login().expect(200)).body).toHaveProperty('accessToken');
  expect(enviarCorreo).not.toHaveBeenCalled();
});
