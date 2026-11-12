const { randomBytes, randomUUID, createHash } = require('node:crypto');
const bcrypt = require('bcryptjs');
const request = require('supertest');
const jwt = require('jsonwebtoken');
const { ROLES } = require('../../constants/roles');

jest.mock('../../config/logger', () => ({ logger: { error: jest.fn(), warn: jest.fn(), info: jest.fn() } }));
jest.mock('../../config/redis', () => ({ getRedis: () => null }));
jest.mock('pg', () => {
  const pg = jest.requireActual('pg');
  const pools = [];
  class Pool extends pg.Pool {
    constructor(...args) { super(...args); pools.push(this); }
  }
  return { ...pg, Pool, pools };
});
jest.mock('morgan', () => () => (_req, _res, next) => next());

const suite = process.env.RUN_LOCAL_DB_TESTS === '1' ? describe : describe.skip;

suite('Dispositivos corporativos con PostgreSQL local', () => {
  let app, db, empresa, otra, cuenta, otraAdmin, propio, ajeno;
  let admin, adminOtra, codigo, token, equipo;
  const password = randomUUID();
  const secret = randomBytes(32).toString('hex');
  const env = { ...process.env };
  const login = (u, dispositivo) => request(app).post('/api/v1/auth/login')
    .set('X-Device-Token', dispositivo ?? '').send({ rut: u.rut, password });
  const autenticar = (peticion, sesion, dispositivo) => peticion
    .set('Authorization', `Bearer ${sesion}`).set('X-Device-Token', dispositivo ?? '');
  const nuevo = (sesion, nombre, dispositivo) => autenticar(request(app).post('/api/v1/dispositivos'), sesion, dispositivo).send({ nombre });
  const canjear = (valor) => request(app).post('/api/v1/dispositivos/canjear').send({ codigo: valor });

  beforeAll(async () => {
    const url = new URL(process.env.DATABASE_URL);
    if (process.env.NODE_ENV !== 'test' || !['localhost', '127.0.0.1'].includes(url.hostname) || !url.pathname.startsWith('/geo_')) {
      throw new Error('Se requiere PostgreSQL desechable local.');
    }
    process.env.JWT_ACCESS_SECRET = secret;
    process.env.JWT_REFRESH_SECRET = randomBytes(32).toString('hex');
    process.env.REQUIRE_2FA = 'false';
    process.env.DEVICE_POLICY = 'off';
    process.env.RATE_LIMIT_PUBLIC = '1000';
    app = require('../../app');
    db = require('../../config/database').prismaGlobal;
    const crearEmpresa = () => db.empresa.create({ data: { nombre: 'Prueba dispositivos', rut: randomUUID() } });
    empresa = await crearEmpresa();
    otra = await crearEmpresa();
    const hash = await bcrypt.hash(password, 4);
    const usuario = (rol, empresaId = empresa.id) => db.usuario.create({
      data: { nombre: rol, rut: randomBytes(6).toString('hex'), email: `${randomUUID()}@example.invalid`, empresa_id: empresaId, rol, password_hash: hash },
    });
    cuenta = {
      admin: await usuario(ROLES.ADMINISTRADOR), supervisor: await usuario(ROLES.SUPERVISOR),
      central: await usuario(ROLES.OPERADOR_CENTRAL), pauta: await usuario(ROLES.GGSS_EN_PAUTA),
      libre: await usuario(ROLES.GGSS_LIBRE), plataforma: await usuario(ROLES.SUPER_ADMIN, null),
    };
    otraAdmin = await usuario(ROLES.ADMINISTRADOR, otra.id);
    const instalacion = await db.instalacion.create({ data: { nombre: 'Prueba', empresa_id: empresa.id, latitud: 0, longitud: 0 } });
    const turno = (u) => db.turno.create({ data: {
      empresa_id: empresa.id, instalacion_id: instalacion.id, usuario_id: u.id, fecha: new Date(),
      hora_inicio: '08:00', hora_fin: '16:00',
    } });
    propio = await turno(cuenta.pauta);
    ajeno = await turno(cuenta.libre);
    admin = (await login(cuenta.admin).expect(200)).body.accessToken;
    adminOtra = (await login(otraAdmin).expect(200)).body.accessToken;
    const creado = await nuevo(admin, 'PC de prueba').expect(201);
    codigo = creado.body.codigo;
    equipo = creado.body.id;
    token = (await canjear(codigo).expect(200)).body.token;
    process.env.DEVICE_POLICY = 'on';
  });

  afterAll(async () => {
    if (db && empresa && otra) {
      await db.dispositivo.deleteMany({ where: { empresa_id: { in: [empresa.id, otra.id] } } });
      const { borrarEmpresaDePrueba } = require('../../test-utils/empresaDePrueba');
      await borrarEmpresaDePrueba(empresa.id);
      await borrarEmpresaDePrueba(otra.id);
      if (cuenta?.plataforma) {
        await db.auditoria.deleteMany({ where: { usuario_id: cuenta.plataforma.id } });
        await db.usuario.delete({ where: { id: cuenta.plataforma.id } });
      }
    }
    if (db) await db.$disconnect();
    await Promise.all(require('pg').pools.map(pool => pool.end()));
    for (const key of ['JWT_ACCESS_SECRET', 'JWT_REFRESH_SECRET', 'REQUIRE_2FA', 'DEVICE_POLICY', 'RATE_LIMIT_PUBLIC']) {
      if (env[key] === undefined) delete process.env[key];
      else process.env[key] = env[key];
    }
  });

  test('canje único, hash almacenado y ningún secreto en el listado', async () => {
    expect(codigo).toMatch(/^[a-f0-9]{24}$/);
    expect(token).toMatch(/^[a-f0-9]{64}$/);
    await canjear(codigo).expect(400);
    const registro = await db.dispositivo.findUnique({ where: { id: equipo } });
    expect(registro.token_hash).toBe(createHash('sha256').update(token).digest('hex'));
    expect(registro.codigo_enrolamiento_hash).toBeNull();
    const sesion = (await login(cuenta.admin, token).expect(200)).body.accessToken;
    const { body } = await autenticar(request(app).get('/api/v1/dispositivos'), sesion, token).expect(200);
    expect(body).toHaveLength(1);
    expect(body[0]).not.toHaveProperty('token_hash');
    expect(body[0]).not.toHaveProperty('codigo_enrolamiento_hash');
  });

  test('un código vencido no se puede canjear y dos canjes simultáneos solo emiten un token', async () => {
    const sesion = (await login(cuenta.admin, token).expect(200)).body.accessToken;
    const vencido = (await nuevo(sesion, 'Vencido', token).expect(201)).body;
    await db.dispositivo.update({ where: { id: vencido.id }, data: { codigo_expira_en: new Date(0) } });
    await canjear(vencido.codigo).expect(400);
    const nuevoCodigo = (await nuevo(sesion, 'Simultáneo', token).expect(201)).body.codigo;
    const resultados = await Promise.all([canjear(nuevoCodigo), canjear(nuevoCodigo)]);
    expect(resultados.map(r => r.status).sort()).toEqual([200, 400]);
  });

  test.each(['supervisor', 'central', 'admin'])('bloquea %s en personal y permite corporativo', async (rol) => {
    await login(cuenta[rol]).expect(403);
    await login(cuenta[rol], token).expect(200);
  });

  test('super_admin queda fuera de la restricción', async () => {
    const { body } = await login(cuenta.plataforma).expect(200);
    await autenticar(request(app).get('/api/v1/plataforma/empresas'), body.accessToken).expect(200);
  });

  test('el mismo guardia ve turnos propios y solicitudes en personal, con 403 para operaciones restringidas', async () => {
    const personal = (await login(cuenta.pauta, 'inválido').expect(200)).body;
    const corporativo = (await login(cuenta.pauta, token).expect(200)).body;
    expect(personal.usuario.dispositivo).toBe('personal');
    expect(jwt.verify(corporativo.accessToken, secret).dispositivo).toBe('corporativo');
    const acceso = (peticion) => autenticar(peticion, personal.accessToken, token);
    const { body } = await acceso(request(app).get('/api/v1/turnos').query({ usuario_id: cuenta.libre.id })).expect(200);
    expect(body.map(t => t.id)).toEqual([propio.id]);
    await acceso(request(app).get('/api/v1/turnos/' + ajeno.id)).expect(403);
    const creada = await acceso(request(app).post('/api/v1/solicitudes')).send({
      tipo: 'dias_libres', fecha_desde: '2026-11-12', usuario_id: cuenta.libre.id,
    }).expect(201);
    expect(creada.body.usuario_id).toBe(cuenta.pauta.id);
    const solicitudes = await acceso(request(app).get('/api/v1/solicitudes')).expect(200);
    expect(solicitudes.body.data.every(s => s.usuario_id === cuenta.pauta.id)).toBe(true);
    for (const ruta of ['asistencia/entrada', 'asistencia/sync', 'novedades']) {
      const bloqueado = await acceso(request(app).post('/api/v1/' + ruta)).expect(403);
      expect(bloqueado.body.error).toMatch(/dispositivo corporativo/);
    }
    await acceso(request(app).patch('/api/v1/novedades/una/resolver')).expect(403);
    await acceso(request(app).get('/api/v1/novedades')).expect(403);
    const libre = (await login(cuenta.libre).expect(200)).body.accessToken;
    await autenticar(request(app).get('/api/v1/turnos/DISPONIBLES'), libre).expect(403);
    await autenticar(request(app).get('/api/v1/novedades'), corporativo.accessToken, token).expect(200);
    await autenticar(request(app).get('/api/v1/novedades'), corporativo.accessToken).expect(403);
  });

  test('respeta empresa en login, listado y revocación', async () => {
    await login(otraAdmin, token).expect(403);
    process.env.DEVICE_POLICY = 'off';
    try {
      const listado = await autenticar(request(app).get('/api/v1/dispositivos'), adminOtra).expect(200);
      expect(listado.body).toEqual([]);
      await autenticar(request(app).patch('/api/v1/dispositivos/' + equipo + '/revocar'), adminOtra).expect(404);
    } finally { process.env.DEVICE_POLICY = 'on'; }
  });

  test('revocar corta sesiones vigentes y el guardia puede volver a entrar como personal', async () => {
    const sesion = (await login(cuenta.admin, token).expect(200)).body;
    const guardia = (await login(cuenta.pauta, token).expect(200)).body;
    await autenticar(request(app).patch('/api/v1/dispositivos/' + equipo + '/revocar'), sesion.accessToken, token).expect(200);
    await autenticar(request(app).get('/api/v1/dispositivos'), sesion.accessToken, token).expect(403);
    await autenticar(request(app).get('/api/v1/novedades'), guardia.accessToken, token).expect(403);
    await autenticar(request(app).get('/api/v1/turnos'), guardia.accessToken, token)
      .expect('X-Device-Class', 'personal').expect(200);
    await request(app).post('/api/v1/auth/refresh').set('X-Device-Token', token)
      .send({ refreshToken: sesion.refreshToken }).expect(403);
    const personal = (await login(cuenta.pauta, token).expect(200)).body;
    expect(personal.usuario.dispositivo).toBe('personal');
    await login(cuenta.admin, token).expect(403);
  });
});
