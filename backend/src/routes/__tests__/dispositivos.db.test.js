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
jest.mock('../../services/correo.service', () => ({ enviarCorreo: jest.fn().mockResolvedValue(true) }));
jest.mock('morgan', () => () => (_req, _res, next) => next());

const suite = process.env.RUN_LOCAL_DB_TESTS === '1' ? describe : describe.skip;

suite('Dispositivos corporativos con PostgreSQL local', () => {
  let app, db, empresa, otra, cuenta, otraAdmin, propio, ajeno;
  let admin, adminOtra, codigo, token, equipo;
  const password = randomUUID();
  const secret = randomBytes(32).toString('hex');
  const env = { ...process.env };
  const login = (u, dispositivo, invitacion) => request(app).post('/api/v1/auth/login')
    .set('X-Device-Token', dispositivo ?? '').send({ rut: u.rut, password, invitacion });
  const autenticar = (peticion, sesion, dispositivo) => peticion
    .set('Authorization', `Bearer ${sesion}`).set('X-Device-Token', dispositivo ?? '');
  const nuevo = (sesion, nombre, dispositivo) => autenticar(request(app).post('/api/v1/dispositivos'), sesion, dispositivo).send({ nombre });
  const mail = require('../../services/correo.service').enviarCorreo;
  const confirmar = (valor) => request(app).post('/api/v1/dispositivos/invitaciones/confirmar').send({ token: valor });
  const tokenDe = (enlace) => new URLSearchParams(new URL(enlace).hash.split('?')[1]).get('t');
  const sesionAdmin = async () => (await login(cuenta.admin, token).expect(200)).body.accessToken;
  const invitar = (sesion, u) => autenticar(request(app).post('/api/v1/dispositivos/invitaciones'), sesion, token)
    .send({ nombre: 'PC invitado', usuario_id: u.id });
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
    process.env.FRONTEND_URL = 'http://localhost:5173';
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
    cuenta.supervisorAjeno = await usuario(ROLES.SUPERVISOR, otra.id);
    cuenta.supervisorInactivo = await usuario(ROLES.SUPERVISOR);
    await db.usuario.update({ where: { id: cuenta.supervisorInactivo.id }, data: { estado: 'inactivo' } });
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
    for (const key of ['JWT_ACCESS_SECRET', 'JWT_REFRESH_SECRET', 'REQUIRE_2FA', 'DEVICE_POLICY', 'FRONTEND_URL', 'TWO_FACTOR_METHOD', 'TWO_FACTOR_ENCRYPTION_KEY', 'RATE_LIMIT_PUBLIC']) {
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

  test('solo ofrece supervisor y central de la empresa y permite invitar con política apagada', async () => {
    process.env.DEVICE_POLICY = 'off';
    try {
      const lista = await autenticar(request(app).get('/api/v1/dispositivos/destinatarios'), admin).expect(200);
      expect(lista.body.map(u => u.id).sort()).toEqual([cuenta.supervisor.id, cuenta.central.id].sort());
      for (const u of [cuenta.pauta, cuenta.libre, cuenta.supervisorAjeno, cuenta.supervisorInactivo, { id: randomUUID() }]) {
        const rechazo = await invitar(admin, u).expect(400);
        expect(rechazo.body.error).toBe('Selecciona un supervisor u operador central activo de tu empresa.');
      }
      for (const u of [cuenta.supervisor, cuenta.central]) {
        const { body } = await invitar(admin, u).expect(201);
        const enlace = new URL(body.enlace);
        expect(enlace.search).toBe('');
        expect(enlace.hash).toMatch(/^#\/enrolar\?t=[a-f0-9]{64}$/);
        expect(mail).toHaveBeenLastCalledWith(u.email, expect.any(String), undefined, expect.stringContaining(body.enlace), { soloSMTP: true });
        const registro = await db.dispositivo.findUnique({ where: { id: body.id } });
        expect(registro.invitacion_hash).toBe(createHash('sha256').update(tokenDe(body.enlace)).digest('hex'));
      }
    } finally { process.env.DEVICE_POLICY = 'on'; }
  });

  test('abrir el enlace, fallar contraseña y usar otra cuenta dejan la invitación pendiente', async () => {
    const { body } = await invitar(await sesionAdmin(), cuenta.supervisor).expect(201);
    const invitacion = tokenDe(body.enlace);
    const vista = await confirmar(invitacion).expect(200);
    expect(vista.body).toEqual({ empresa: empresa.nombre });
    await request(app).post('/api/v1/auth/login')
      .send({ rut: cuenta.supervisor.rut, password: 'incorrecta', invitacion }).expect(401);
    await login(cuenta.central, undefined, invitacion).expect(400);
    expect((await db.dispositivo.findUnique({ where: { id: body.id } })).token_hash).toBeNull();
    const respuestas = await Promise.all([login(cuenta.supervisor, undefined, invitacion), login(cuenta.supervisor, undefined, invitacion)]);
    expect(respuestas.map(r => r.status).sort()).toEqual([200, 400]);
    const sesion = respuestas.find(r => r.status === 200);
    expect(sesion.body.usuario.dispositivo).toBe('corporativo');
    expect(sesion.body.tokenDispositivo).toMatch(/^[a-f0-9]{64}$/);
    await login(cuenta.supervisor, undefined, invitacion).expect(400);
    const guardia = await login(cuenta.pauta, sesion.body.tokenDispositivo).expect(200);
    expect(guardia.body.usuario.dispositivo).toBe('corporativo');
    const listado = await autenticar(request(app).get('/api/v1/dispositivos'), await sesionAdmin(), token).expect(200);
    expect(listado.body.find(e => e.id === body.id)).toMatchObject({ enrolador: { nombre: cuenta.supervisor.nombre }, invitacion_expira_en: null });
  });

  test('vencimiento, reenvío y revocación invalidan el enlace correspondiente', async () => {
    const sesion = await sesionAdmin();
    const { body } = await invitar(sesion, cuenta.central).expect(201);
    const anterior = tokenDe(body.enlace);
    await db.dispositivo.update({ where: { id: body.id }, data: { invitacion_expira_en: new Date(0) } });
    await confirmar(anterior).expect(400);
    await login(cuenta.central, undefined, anterior).expect(400);
    const nuevo = await autenticar(request(app).post('/api/v1/dispositivos/' + body.id + '/invitaciones/reenviar'), sesion, token).expect(200);
    const vigente = tokenDe(nuevo.body.enlace);
    expect(vigente).not.toBe(anterior);
    await confirmar(anterior).expect(400);
    await confirmar(vigente).expect(200);
    await autenticar(request(app).patch('/api/v1/dispositivos/' + body.id + '/revocar'), sesion, token).expect(200);
    await confirmar(vigente).expect(400);
    await login(cuenta.central, undefined, vigente).expect(400);
  });

  test('el segundo factor por correo debe verificarse antes de consumir el enlace', async () => {
    const { body } = await invitar(await sesionAdmin(), cuenta.supervisor).expect(201);
    const invitacion = tokenDe(body.enlace);
    process.env.TWO_FACTOR_METHOD = 'email';
    process.env.REQUIRE_2FA = 'true';
    try {
      const pendiente = await login(cuenta.supervisor, undefined, invitacion).expect(200);
      expect(pendiente.body).toMatchObject({ requires2FA: true, method: 'email' });
      expect(pendiente.body.tokenDispositivo).toBeUndefined();
      const code = mail.mock.calls.at(-1)[3].match(/\b\d{6}\b/)[0];
      const verificar = valor => request(app).post('/api/v1/auth/2fa/verify').send({ tempToken: pendiente.body.tempToken, code: valor });
      await verificar(code === '000000' ? '000001' : '000000').expect(401);
      expect((await db.dispositivo.findUnique({ where: { id: body.id } })).token_hash).toBeNull();
      const sesion = await verificar(code).expect(200);
      expect(sesion.body.tokenDispositivo).toMatch(/^[a-f0-9]{64}$/);
      expect(sesion.body.usuario.dispositivo).toBe('corporativo');
      await confirmar(invitacion).expect(400);
    } finally {
      delete process.env.TWO_FACTOR_METHOD;
      process.env.REQUIRE_2FA = 'false';
    }
  });

  test('el modo TOTP conserva su verificación antes de enrolar el equipo', async () => {
    const { body } = await invitar(await sesionAdmin(), cuenta.supervisor).expect(201);
    const invitacion = tokenDe(body.enlace);
    process.env.TWO_FACTOR_METHOD = 'totp';
    process.env.TWO_FACTOR_ENCRYPTION_KEY = randomBytes(32).toString('hex');
    process.env.REQUIRE_2FA = 'true';
    try {
      await login(cuenta.supervisor, undefined, invitacion).expect(409);
      expect((await db.dispositivo.findUnique({ where: { id: body.id } })).token_hash).toBeNull();
      const { authenticator } = require('otplib');
      const { cifrar } = require('../../utils/cifrado');
      const secreto = authenticator.generateSecret();
      await db.usuario.update({ where: { id: cuenta.supervisor.id }, data: {
        two_factor_enabled: true, two_factor_secret: cifrar(secreto),
      } });
      const pendiente = await login(cuenta.supervisor, undefined, invitacion).expect(200);
      expect(pendiente.body.requires2FA).toBe(true);
      expect(pendiente.body.tokenDispositivo).toBeUndefined();
      const sesion = await request(app).post('/api/v1/auth/2fa/verify').send({
        tempToken: pendiente.body.tempToken, code: authenticator.generate(secreto),
      }).expect(200);
      expect(sesion.body.usuario.dispositivo).toBe('corporativo');
      expect(sesion.body.tokenDispositivo).toMatch(/^[a-f0-9]{64}$/);
    } finally {
      delete process.env.TWO_FACTOR_METHOD;
      delete process.env.TWO_FACTOR_ENCRYPTION_KEY;
      process.env.REQUIRE_2FA = 'false';
    }
  });

  describe('revisión de marcajes y reporte de cierre', () => {
    const marcaje = async (usuario, verificacion = 'por_revisar') => {
      const instalacionId = (await db.instalacion.findFirst({ where: { empresa_id: empresa.id } })).id;
      const t = await db.turno.create({ data: {
        empresa_id: empresa.id, instalacion_id: instalacionId, usuario_id: usuario.id, fecha: new Date(),
        hora_inicio: '08:00', hora_fin: '16:00',
      } });
      return db.asistencia.create({ data: {
        empresa_id: empresa.id, usuario_id: usuario.id, turno_id: t.id, instalacion_id: instalacionId,
        hora_entrada: new Date(), metodo_entrada: 'fallback_telefono', estado: 'normal', verificacion_gps: verificacion,
      } });
    };
    const revisar = (sesion, id, cuerpo) => autenticar(request(app).patch('/api/v1/asistencia/' + id + '/revisar'), sesion, token).send(cuerpo);

    test('rechazar exige comentario, conserva el GPS original y audita la decisión', async () => {
      const sesion = await sesionAdmin();
      const a = await marcaje(cuenta.pauta);
      await revisar(sesion, a.id, { decision: 'rechazar' }).expect(400);
      const { body } = await revisar(sesion, a.id, { decision: 'rechazar', comentario: 'Fuera del recinto' }).expect(200);
      expect(body).toMatchObject({ revision_estado: 'rechazado', comentario_revision: 'Fuera del recinto', verificacion_gps: 'por_revisar' });
      expect(await db.auditoria.count({ where: { accion: 'revisar_marcaje', usuario_id: cuenta.admin.id } })).toBeGreaterThan(0);
    });

    test('es idempotente para la misma decisión, 409 para otra y 400 si no requiere revisión', async () => {
      const sesion = await sesionAdmin();
      const a = await marcaje(cuenta.libre);
      const resultados = await Promise.all([
        revisar(sesion, a.id, { decision: 'aprobar' }), revisar(sesion, a.id, { decision: 'aprobar' }),
      ]);
      expect(resultados.map(r => r.status)).toEqual([200, 200]);
      await revisar(sesion, a.id, { decision: 'rechazar', comentario: 'Cambio' }).expect(409);
      const normal = await marcaje(cuenta.pauta, 'dentro');
      await revisar(sesion, normal.id, { decision: 'aprobar' }).expect(400);
    });

    test('el supervisor solo revisa marcajes de sus instalaciones', async () => {
      const supervisor = (await login(cuenta.supervisor, token).expect(200)).body.accessToken;
      const a = await marcaje(cuenta.pauta);
      await revisar(supervisor, a.id, { decision: 'aprobar' }).expect(403);
      await db.supervisor_Instalacion.create({ data: { empresa_id: empresa.id, supervisor_id: cuenta.supervisor.id, instalacion_id: a.instalacion_id } });
      await revisar(supervisor, a.id, { decision: 'aprobar' }).expect(200);
    });

    test('otra empresa no ve el marcaje y un guardia no puede revisar', async () => {
      const a = await marcaje(cuenta.pauta);
      process.env.DEVICE_POLICY = 'off';
      try {
        const r = await autenticar(request(app).patch('/api/v1/asistencia/' + a.id + '/revisar'), adminOtra).send({ decision: 'aprobar' });
        expect([403, 404]).toContain(r.status);
      } finally { process.env.DEVICE_POLICY = 'on'; }
      const guardia = (await login(cuenta.pauta, token).expect(200)).body.accessToken;
      await revisar(guardia, a.id, { decision: 'aprobar' }).expect(403);
      expect((await db.asistencia.findUnique({ where: { id: a.id } })).revision_estado).toBeNull();
    });

    test('con la política apagada la revisión no existe', async () => {
      const sesion = await sesionAdmin();
      const a = await marcaje(cuenta.pauta);
      process.env.DEVICE_POLICY = 'off';
      try {
        await autenticar(request(app).patch('/api/v1/asistencia/' + a.id + '/revisar'), sesion).send({ decision: 'aprobar' }).expect(404);
      } finally { process.env.DEVICE_POLICY = 'on'; }
    });

    test('un equipo asociado a otra instalación no acepta marcajes de tablet y la invitación valida la instalación', async () => {
      const sesion = await sesionAdmin();
      const otraInst = await db.instalacion.create({ data: { nombre: 'Otra', empresa_id: empresa.id, latitud: 1, longitud: 1 } });
      const ajena = await db.instalacion.create({ data: { nombre: 'Ajena', empresa_id: otra.id, latitud: 1, longitud: 1 } });
      const rechazo = await autenticar(request(app).post('/api/v1/dispositivos'), sesion, token).send({ nombre: 'X', instalacion_id: ajena.id });
      expect(rechazo.status).toBe(400);
      const ok = await autenticar(request(app).post('/api/v1/dispositivos'), sesion, token).send({ nombre: 'Tablet', instalacion_id: otraInst.id }).expect(201);
      expect(ok.body.instalacion).toMatchObject({ id: otraInst.id });
      const tokenTablet = (await canjear(ok.body.codigo).expect(200)).body.token;
      await db.asistencia.updateMany({ where: { usuario_id: cuenta.pauta.id }, data: { hora_salida: new Date() } });
      const guardia = (await login(cuenta.pauta, tokenTablet).expect(200)).body.accessToken;
      const r = await autenticar(request(app).post('/api/v1/asistencia/entrada-tablet'), guardia, tokenTablet)
        .send({ instalacion_id: propio.instalacion_id, metodo: 'tablet' });
      expect(r.status).toBe(403);
    });

    test('la rutina no cuenta como reporte de cierre pero «Sin novedad» sí', async () => {
      const { TIPOS_SIN_REPORTE_CIERRE } = require('../../services/priorizacion.service');
      expect(TIPOS_SIN_REPORTE_CIERRE).toEqual(expect.arrayContaining(['Ronda', 'Fin de ronda', 'Cambio de turno']));
      expect(TIPOS_SIN_REPORTE_CIERRE).not.toContain('Sin novedad');
    });
  });

  test('el destinatario acepta su invitación desde su panel y nadie más puede hacerlo', async () => {
    const admin2 = await sesionAdmin();
    const { body } = await invitar(admin2, cuenta.central).expect(201);
    const central = (await login(cuenta.central, token).expect(200)).body.accessToken;
    const supervisor = (await login(cuenta.supervisor, token).expect(200)).body.accessToken;
    const mias = await autenticar(request(app).get('/api/v1/dispositivos/mis-invitaciones'), central, token).expect(200);
    expect(mias.body.map(e => e.id)).toContain(body.id);
    expect((await autenticar(request(app).get('/api/v1/dispositivos/mis-invitaciones'), supervisor, token).expect(200)).body.map(e => e.id)).not.toContain(body.id);
    await autenticar(request(app).post('/api/v1/dispositivos/' + body.id + '/aceptar'), supervisor, token).expect(400);
    await autenticar(request(app).post('/api/v1/dispositivos/' + body.id + '/aceptar'), admin2, token).expect(403);
    const aceptada = await autenticar(request(app).post('/api/v1/dispositivos/' + body.id + '/aceptar'), central, token).expect(200);
    expect(aceptada.body.token).toMatch(/^[a-f0-9]{64}$/);
    await autenticar(request(app).post('/api/v1/dispositivos/' + body.id + '/aceptar'), central, token).expect(400);
    await confirmar(tokenDe(body.enlace)).expect(400);
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
