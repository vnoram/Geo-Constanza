process.env.JWT_ACCESS_SECRET = 'secreto-acceso-solo-pruebas';
process.env.JWT_REFRESH_SECRET = 'secreto-refresh-solo-pruebas';
process.env.TWO_FACTOR_ENCRYPTION_KEY = 'clave-de-cifrado-solo-pruebas-0123456789';
process.env.REQUIRE_2FA = 'true';

jest.mock('../../config/redis', () => ({ getRedis: () => null }));
jest.mock('../../config/logger', () => ({ logger: { error: jest.fn(), warn: jest.fn(), info: jest.fn() } }));
jest.mock('pg', () => {
  const pg = jest.requireActual('pg');
  const pools = [];
  class Pool extends pg.Pool { constructor(...args) { super(...args); pools.push(this); } }
  return { ...pg, Pool, pools };
});

const { randomUUID } = require('crypto');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { authenticator } = require('otplib');
const { prisma } = require('../../config/database');
const auth = require('../auth.service');
const twoFactor = require('../twoFactor.service');
const { authenticate } = require('../../middlewares/auth');
const { descifrar } = require('../../utils/cifrado');
const { ROLES } = require('../../constants/roles');

// Opt-in explícito y solo contra una base local desechable (nunca la de un .env).
const ejecutar = process.env.RUN_LOCAL_DB_TESTS === '1';
const suite = ejecutar ? describe : describe.skip;

suite('2FA TOTP con PostgreSQL local', () => {
  const PASSWORD = 'Clave-de-prueba-123';
  const base = Date.now();
  let habilitada = false;
  let paso = 0;
  const creados = [];

  // Avanza el reloj en pasos de 30 s para que cada código TOTP sea distinto y válido.
  const siguienteMomento = () => { paso += 1; return base + paso * 30000; };
  const codigoEn = (secreto, momento) => {
    jest.spyOn(Date, 'now').mockReturnValue(momento);
    const codigo = authenticator.generate(secreto);
    return codigo;
  };

  const crearUsuario = async (rol) => {
    const id = randomUUID();
    const usuario = await prisma.usuario.create({ data: {
      id, rut: `t-${id}`, nombre: 'Usuario 2FA prueba', email: `${id}@example.invalid`,
      password_hash: await bcrypt.hash(PASSWORD, 4), rol, estado: 'activo',
    } });
    creados.push(id);
    return usuario;
  };

  const enrolar = async (usuario) => {
    const { secreto } = await twoFactor.iniciarEnrolamiento(usuario.id);
    const { codigos_recuperacion: codigos } = await twoFactor.confirmarEnrolamiento(usuario.id, codigoEn(secreto, siguienteMomento()));
    return { secreto, codigos };
  };

  beforeAll(() => {
    const url = new URL(process.env.DATABASE_URL || 'postgresql://invalida');
    const hostOk = ['localhost', '127.0.0.1', 'geo-sprint5-db'].includes(url.hostname);
    if (process.env.NODE_ENV !== 'test' || !hostOk || !/^\/geo_/.test(url.pathname)) {
      throw new Error('Esta suite exige NODE_ENV=test y una base local desechable cuyo nombre empiece con geo_.');
    }
    habilitada = true;
  });

  afterEach(() => jest.restoreAllMocks());

  afterAll(async () => {
    if (habilitada && creados.length) await prisma.usuario.deleteMany({ where: { id: { in: creados } } });
    await prisma.$disconnect();
    await Promise.all(require('pg').pools.map((pool) => pool.end()));
  });

  test('el secreto se guarda cifrado y no sale en el perfil devuelto por el login', async () => {
    const usuario = await crearUsuario(ROLES.SUPERVISOR);
    const { secreto, otpauth_url: url } = await twoFactor.iniciarEnrolamiento(usuario.id);
    expect(url).toContain('otpauth://totp/');
    expect(url).toContain('issuer=Geo%20Constanza');
    const guardado = await prisma.usuario.findUnique({ where: { id: usuario.id } });
    expect(guardado.two_factor_secret).not.toContain(secreto);
    expect(descifrar(guardado.two_factor_secret)).toBe(secreto);
    expect(guardado.two_factor_enabled).toBe(false);
    const sesion = await auth.login(usuario.rut, PASSWORD);
    expect(JSON.stringify(sesion)).not.toContain(secreto);
    expect(JSON.stringify(sesion)).not.toContain('two_factor');
  });

  test('un código incorrecto no activa el 2FA y uno correcto sí, entregando 8 códigos de recuperación', async () => {
    const usuario = await crearUsuario(ROLES.ADMINISTRADOR);
    const { secreto } = await twoFactor.iniciarEnrolamiento(usuario.id);
    await expect(twoFactor.confirmarEnrolamiento(usuario.id, '000000')).rejects.toMatchObject({ statusCode: 400 });
    expect((await prisma.usuario.findUnique({ where: { id: usuario.id } })).two_factor_enabled).toBe(false);
    const { codigos_recuperacion: codigos } = await twoFactor.confirmarEnrolamiento(usuario.id, codigoEn(secreto, siguienteMomento()));
    expect(codigos).toHaveLength(8);
    const guardado = await prisma.usuario.findUnique({ where: { id: usuario.id } });
    expect(guardado.two_factor_enabled).toBe(true);
    expect(JSON.stringify(guardado.two_factor_recovery)).not.toContain(codigos[0]); // solo hashes
    await expect(twoFactor.iniciarEnrolamiento(usuario.id)).rejects.toMatchObject({ statusCode: 409 });
  });

  test('un rol sin 2FA no puede enrolarse ni recibe desafío al iniciar sesión', async () => {
    const guardia = await crearUsuario(ROLES.GGSS_EN_PAUTA);
    await expect(twoFactor.iniciarEnrolamiento(guardia.id)).rejects.toMatchObject({ statusCode: 403 });
    const sesion = await auth.login(guardia.rut, PASSWORD);
    expect(sesion.accessToken).toBeTruthy();
    expect(sesion.requires2FA).toBeUndefined();
    expect(sesion.mustEnroll2FA).toBeUndefined();
  });

  test('supervisor sin enrolar entra con aviso mustEnroll2FA (nadie queda fuera)', async () => {
    const supervisor = await crearUsuario(ROLES.SUPERVISOR);
    const sesion = await auth.login(supervisor.rut, PASSWORD);
    expect(sesion.accessToken).toBeTruthy();
    expect(sesion.mustEnroll2FA).toBe(true);
  });

  test('con REQUIRE_2FA=false no hay desafío ni aviso (desarrollo local)', async () => {
    const usuario = await crearUsuario(ROLES.ADMINISTRADOR);
    await enrolar(usuario);
    process.env.REQUIRE_2FA = 'false';
    try {
      const sesion = await auth.login(usuario.rut, PASSWORD);
      expect(sesion.accessToken).toBeTruthy();
      expect(sesion.requires2FA).toBeUndefined();
    } finally { process.env.REQUIRE_2FA = 'true'; }
  });

  test('login enrolado: devuelve tempToken, no sesión; el código correcto emite los tokens', async () => {
    const usuario = await crearUsuario(ROLES.SUPERVISOR);
    const { secreto } = await enrolar(usuario);
    const parcial = await auth.login(usuario.rut, PASSWORD);
    expect(parcial.requires2FA).toBe(true);
    expect(parcial.accessToken).toBeUndefined();
    expect(parcial.usuario).toBeUndefined();
    const completo = await auth.verify2FA(parcial.tempToken, codigoEn(secreto, siguienteMomento()));
    expect(completo.accessToken).toBeTruthy();
    expect(completo.refreshToken).toBeTruthy();
    expect(completo.usuario.id).toBe(usuario.id);
  });

  test('el tempToken no sirve como access token', async () => {
    const usuario = await crearUsuario(ROLES.ADMINISTRADOR);
    await enrolar(usuario);
    const { tempToken } = await auth.login(usuario.rut, PASSWORD);
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    const next = jest.fn();
    await authenticate({ headers: { authorization: `Bearer ${tempToken}` } }, res, next);
    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(401);
    // Defensa en profundidad: aun firmado con la clave de acceso, el tipo 2fa_pending se rechaza.
    const forjado = jwt.sign({ id: usuario.id, tipo: '2fa_pending' }, process.env.JWT_ACCESS_SECRET, { expiresIn: '5m' });
    const res2 = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    const next2 = jest.fn();
    await authenticate({ headers: { authorization: `Bearer ${forjado}` } }, res2, next2);
    expect(next2).not.toHaveBeenCalled();
    expect(res2.status).toHaveBeenCalledWith(401);
  });

  test('un token de acceso normal no sirve como tempToken', async () => {
    const usuario = await crearUsuario(ROLES.SUPERVISOR);
    await enrolar(usuario);
    const acceso = jwt.sign({ id: usuario.id, rol: usuario.rol }, process.env.JWT_ACCESS_SECRET, { expiresIn: '5m' });
    await expect(auth.verify2FA(acceso, '123456')).rejects.toMatchObject({ statusCode: 401 });
  });

  test('el mismo código TOTP no se puede usar dos veces', async () => {
    const usuario = await crearUsuario(ROLES.SUPERVISOR);
    const { secreto } = await enrolar(usuario);
    const { tempToken } = await auth.login(usuario.rut, PASSWORD);
    const momento = siguienteMomento();
    const codigo = codigoEn(secreto, momento);
    await expect(auth.verify2FA(tempToken, codigo)).resolves.toHaveProperty('accessToken');
    jest.spyOn(Date, 'now').mockReturnValue(momento);
    await expect(auth.verify2FA(tempToken, codigo)).rejects.toMatchObject({ statusCode: 401 });
  });

  test('cada código de recuperación sirve una sola vez', async () => {
    const usuario = await crearUsuario(ROLES.ADMINISTRADOR);
    const { codigos } = await enrolar(usuario);
    const { tempToken } = await auth.login(usuario.rut, PASSWORD);
    await expect(auth.verify2FA(tempToken, codigos[0].toLowerCase())).resolves.toHaveProperty('accessToken');
    await expect(auth.verify2FA(tempToken, codigos[0])).rejects.toMatchObject({ statusCode: 401 });
    await expect(auth.verify2FA(tempToken, codigos[1])).resolves.toHaveProperty('accessToken');
    const restantes = (await prisma.usuario.findUnique({ where: { id: usuario.id } })).two_factor_recovery;
    expect(restantes).toHaveLength(6);
  });

  test('tras 5 códigos inválidos la cuenta se bloquea (429) incluso con el código correcto', async () => {
    const usuario = await crearUsuario(ROLES.SUPERVISOR);
    const { secreto } = await enrolar(usuario);
    const { tempToken } = await auth.login(usuario.rut, PASSWORD);
    for (let i = 0; i < 5; i += 1) {
      await expect(auth.verify2FA(tempToken, '111111')).rejects.toMatchObject({ statusCode: 401 });
    }
    await expect(auth.verify2FA(tempToken, codigoEn(secreto, siguienteMomento()))).rejects.toMatchObject({ statusCode: 429 });
  });

  test('reiniciar desactiva el 2FA y limpia secreto y códigos', async () => {
    const usuario = await crearUsuario(ROLES.SUPERVISOR);
    await enrolar(usuario);
    await twoFactor.reiniciar(usuario.id);
    const guardado = await prisma.usuario.findUnique({ where: { id: usuario.id } });
    expect(guardado).toMatchObject({ two_factor_enabled: false, two_factor_secret: null, two_factor_recovery: null, two_factor_ultimo_paso: null });
    const sesion = await auth.login(usuario.rut, PASSWORD);
    expect(sesion.mustEnroll2FA).toBe(true);
  });

  test('un usuario inactivo no puede completar la verificación', async () => {
    const usuario = await crearUsuario(ROLES.SUPERVISOR);
    const { secreto } = await enrolar(usuario);
    const { tempToken } = await auth.login(usuario.rut, PASSWORD);
    await prisma.usuario.update({ where: { id: usuario.id }, data: { estado: 'inactivo' } });
    await expect(auth.verify2FA(tempToken, codigoEn(secreto, siguienteMomento()))).rejects.toMatchObject({ statusCode: 401 });
  });
});
