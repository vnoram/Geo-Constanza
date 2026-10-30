process.env.JWT_ACCESS_SECRET = 'secreto-acceso-solo-pruebas';
process.env.JWT_REFRESH_SECRET = 'secreto-refresh-solo-pruebas';
process.env.FRONTEND_URL = 'https://app.example.invalid';

const mockRedis = (() => {
  const datos = new Map();
  return {
    datos,
    get: async (k) => datos.get(k) ?? null,
    set: async (k, v) => { datos.set(k, String(v)); },
    del: async (k) => { datos.delete(k); },
    incr: async (k) => { const n = (parseInt(datos.get(k), 10) || 0) + 1; datos.set(k, String(n)); return n; },
    expire: async () => 1,
  };
})();
jest.mock('../../config/redis', () => ({ getRedis: () => mockRedis }));
jest.mock('../../config/logger', () => ({ logger: { error: jest.fn(), warn: jest.fn(), info: jest.fn() } }));
jest.mock('../correo.service', () => ({ enviarCorreo: jest.fn().mockResolvedValue(true) }));
jest.mock('pg', () => {
  const pg = jest.requireActual('pg');
  const pools = [];
  class Pool extends pg.Pool { constructor(...args) { super(...args); pools.push(this); } }
  return { ...pg, Pool, pools };
});

const { randomUUID } = require('crypto');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { prisma } = require('../../config/database');
const auth = require('../auth.service');
const reset = require('../passwordReset.service');
const { enviarCorreo } = require('../correo.service');
const { authenticate } = require('../../middlewares/auth');
const { hashSha256 } = require('../../utils/cifrado');
const { ROLES } = require('../../constants/roles');

// Opt-in explícito y solo contra una base local desechable.
const ejecutar = process.env.RUN_LOCAL_DB_TESTS === '1';
const suite = ejecutar ? describe : describe.skip;

suite('Reset de contraseña con PostgreSQL local', () => {
  const PASSWORD = 'Clave-actual-123';
  const NUEVA = 'Clave-nueva-segura-456';
  const creados = [];
  let habilitada = false;
  let ipN = 0;
  const ip = () => `10.0.0.${++ipN}`; // IP distinta por prueba para no mezclar cuotas

  const crearUsuario = async (extra = {}) => {
    const id = randomUUID();
    const usuario = await prisma.usuario.create({ data: {
      id, rut: `r-${id}`, nombre: 'Usuario Reset', email: `${id}@example.invalid`,
      password_hash: await bcrypt.hash(PASSWORD, 4), rol: ROLES.SUPERVISOR, estado: 'activo', ...extra,
    } });
    creados.push(id);
    return usuario;
  };

  // Solicita el reset y rescata el token del enlace que se habría enviado por correo.
  const pedirToken = async (usuario) => {
    enviarCorreo.mockClear();
    await reset.solicitar(usuario.email, ip());
    const texto = enviarCorreo.mock.calls[0][3];
    return texto.match(/token=([\w-]+)/)[1];
  };

  beforeAll(() => {
    const url = new URL(process.env.DATABASE_URL || 'postgresql://invalida');
    const hostOk = ['localhost', '127.0.0.1', 'geo-sprint5-db'].includes(url.hostname);
    if (process.env.NODE_ENV !== 'test' || !hostOk || !/^\/geo_/.test(url.pathname)) {
      throw new Error('Esta suite exige NODE_ENV=test y una base local desechable cuyo nombre empiece con geo_.');
    }
    habilitada = true;
  });

  beforeEach(() => mockRedis.datos.clear());

  afterAll(async () => {
    if (habilitada && creados.length) await prisma.usuario.deleteMany({ where: { id: { in: creados } } });
    await prisma.$disconnect();
    await Promise.all(require('pg').pools.map((pool) => pool.end()));
  });

  test('responde lo mismo para un correo registrado y uno inexistente, y solo envía al registrado', async () => {
    const usuario = await crearUsuario();
    enviarCorreo.mockClear();
    const real = await reset.solicitar(usuario.email, ip());
    const falso = await reset.solicitar(`nadie-${randomUUID()}@example.invalid`, ip());
    expect(real.mensaje).toBe(falso.mensaje);
    expect(enviarCorreo).toHaveBeenCalledTimes(1);
    expect(enviarCorreo.mock.calls[0][0]).toBe(usuario.email);
  });

  test('guarda solo el hash del token, con vigencia de 30 minutos', async () => {
    const usuario = await crearUsuario();
    const token = await pedirToken(usuario);
    expect(await prisma.passwordReset.count({ where: { token_hash: token } })).toBe(0);
    const fila = await prisma.passwordReset.findUnique({ where: { token_hash: hashSha256(token) } });
    expect(fila.usuario_id).toBe(usuario.id);
    const minutos = (fila.expira_en.getTime() - Date.now()) / 60000;
    expect(minutos).toBeGreaterThan(29);
    expect(minutos).toBeLessThanOrEqual(30);
  });

  test('cambia la contraseña: la nueva entra y la anterior deja de servir', async () => {
    const usuario = await crearUsuario();
    const token = await pedirToken(usuario);
    await reset.confirmar(token, NUEVA);
    await expect(auth.login(usuario.rut, PASSWORD)).rejects.toMatchObject({ statusCode: 401 });
    await expect(auth.login(usuario.rut, NUEVA)).resolves.toHaveProperty('accessToken');
  });

  test('un token ya usado no sirve una segunda vez', async () => {
    const usuario = await crearUsuario();
    const token = await pedirToken(usuario);
    await reset.confirmar(token, NUEVA);
    await expect(reset.confirmar(token, 'Otra-clave-distinta-789')).rejects.toMatchObject({ statusCode: 400 });
  });

  test('dos confirmaciones simultáneas con el mismo token: solo una prospera', async () => {
    const usuario = await crearUsuario();
    const token = await pedirToken(usuario);
    const resultados = await Promise.allSettled([reset.confirmar(token, NUEVA), reset.confirmar(token, 'Clave-paralela-789')]);
    expect(resultados.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
  });

  test('un token vencido se rechaza', async () => {
    const usuario = await crearUsuario();
    const token = await pedirToken(usuario);
    await prisma.passwordReset.update({ where: { token_hash: hashSha256(token) }, data: { expira_en: new Date(Date.now() - 1000) } });
    await expect(reset.confirmar(token, NUEVA)).rejects.toMatchObject({ statusCode: 400 });
  });

  test('rechaza contraseña débil o igual a la actual sin consumir el token', async () => {
    const usuario = await crearUsuario();
    const token = await pedirToken(usuario);
    await expect(reset.confirmar(token, 'corta')).rejects.toMatchObject({ statusCode: 400 });
    await expect(reset.confirmar(token, PASSWORD)).rejects.toMatchObject({ statusCode: 400 });
    await expect(reset.confirmar(token, NUEVA)).resolves.toHaveProperty('usuarioId', usuario.id);
  });

  test('un token inventado se rechaza', async () => {
    await expect(reset.confirmar('x'.repeat(43), NUEVA)).rejects.toMatchObject({ statusCode: 400 });
  });

  test('una cuenta inactiva no recibe enlace', async () => {
    const usuario = await crearUsuario({ estado: 'inactivo' });
    enviarCorreo.mockClear();
    await reset.solicitar(usuario.email, ip());
    expect(enviarCorreo).not.toHaveBeenCalled();
  });

  test('una nueva solicitud no invalida la anterior, pero al usar una se anulan las demás', async () => {
    const usuario = await crearUsuario();
    const t1 = await pedirToken(usuario);
    const t2 = await pedirToken(usuario);
    await reset.confirmar(t2, NUEVA);
    await expect(reset.confirmar(t1, 'Clave-tardia-789')).rejects.toMatchObject({ statusCode: 400 });
  });

  test('revoca sesiones abiertas: access token (Redis) y refresh token (BD)', async () => {
    const usuario = await crearUsuario();
    const antes = Math.floor(Date.now() / 1000) - 60;
    const access = jwt.sign({ id: usuario.id, rol: usuario.rol, iat: antes }, process.env.JWT_ACCESS_SECRET, { expiresIn: '1h' });
    const refresh = jwt.sign({ id: usuario.id, iat: antes }, process.env.JWT_REFRESH_SECRET, { expiresIn: '1h' });

    const correr = async (token) => {
      const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
      const next = jest.fn();
      await authenticate({ headers: { authorization: `Bearer ${token}` } }, res, next);
      return { res, next };
    };
    expect((await correr(access)).next).toHaveBeenCalled();
    await expect(auth.refreshToken(refresh)).resolves.toHaveProperty('accessToken');

    await reset.confirmar(await pedirToken(usuario), NUEVA);

    const tras = await correr(access);
    expect(tras.next).not.toHaveBeenCalled();
    expect(tras.res.status).toHaveBeenCalledWith(401);
    await expect(auth.refreshToken(refresh)).rejects.toMatchObject({ statusCode: 401 });
    // Una sesión nueva, iniciada después del cambio, sí funciona.
    const nueva = await auth.login(usuario.rut, NUEVA);
    expect((await correr(nueva.accessToken)).next).toHaveBeenCalled();
  });

  test('limita a 3 solicitudes por hora por correo (sin delatar que existe)', async () => {
    const usuario = await crearUsuario();
    enviarCorreo.mockClear();
    for (let i = 0; i < 5; i += 1) await reset.solicitar(usuario.email, ip());
    expect(enviarCorreo).toHaveBeenCalledTimes(3);
  });

  test('limita a 10 solicitudes por hora por IP con 429', async () => {
    const mismaIp = ip();
    for (let i = 0; i < 10; i += 1) await reset.solicitar(`x${i}-${randomUUID()}@example.invalid`, mismaIp);
    await expect(reset.solicitar('otro@example.invalid', mismaIp)).rejects.toMatchObject({ statusCode: 429 });
  });
});
