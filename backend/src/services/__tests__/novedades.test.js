jest.mock('../../utils/azureStorage', () => ({ uploadFotoToAzure: jest.fn(), generarUrlLectura: jest.fn() }));
jest.mock('../../socket/socketManager', () => ({ getSocketIO: jest.fn() }));
jest.mock('../../config/logger', () => ({ logger: { error: jest.fn(), warn: jest.fn() } }));
jest.mock('pg', () => {
  const pg = jest.requireActual('pg');
  const pools = [];
  class Pool extends pg.Pool {
    constructor(...args) { super(...args); pools.push(this); }
  }
  return { ...pg, Pool, pools };
});

const { randomUUID } = require('crypto');
const { prisma } = require('../../config/database');
const service = require('../novedades.service');
const { uploadFotoToAzure, generarUrlLectura } = require('../../utils/azureStorage');
const { getSocketIO } = require('../../socket/socketManager');
const { ahoraChile, aFechaDB, sumarDias } = require('../../utils/fechaChile');
const { ROLES } = require('../../constants/roles');
const { ESTADO_NOVEDAD, ESTADO_USUARIO } = require('../../constants/estados');
const { ACCION_NOVEDAD } = require('../../constants/accionesNovedad');

// Opt-in explícito: esta suite nunca utiliza la base configurada en un .env.
const ejecutar = process.env.RUN_LOCAL_DB_TESTS === '1';
const suite = ejecutar ? describe : describe.skip;
suite('HU-02 / HU-08 con PostgreSQL Docker local', () => {
  let habilitada = false;
  const instalacionId = randomUUID();
  const guardia = { id: randomUUID(), rol: ROLES.GGSS_EN_PAUTA };
  const libre = { id: randomUUID(), rol: ROLES.GGSS_LIBRE };
  const supervisor = { id: randomUUID(), rol: ROLES.SUPERVISOR };
  const central = { id: randomUUID(), rol: ROLES.OPERADOR_CENTRAL };
  const ids = [guardia.id, libre.id, supervisor.id, central.id];
  const turnoId = randomUUID();
  const datos = { tipo: 'Ronda', descripcion: 'Prueba funcional local', latitud: -33.45, longitud: -70.66, precision_m: 10 };
  const foto = { originalname: 'foto.png', mimetype: 'image/png', size: 4, buffer: Buffer.from([137, 80, 78, 71]) };
  beforeAll(async () => {
    const url = new URL(process.env.DATABASE_URL);
    if (process.env.NODE_ENV !== 'test' || url.hostname !== 'geo-sprint5-db' || url.pathname !== '/geo_sprint5') {
      throw new Error('Esta suite exige PostgreSQL Docker desechable geo-sprint5-db/geo_sprint5.');
    }
    habilitada = true;
    await prisma.instalacion.create({ data: { id: instalacionId, nombre: 'Prueba Sprint 5', latitud: datos.latitud, longitud: datos.longitud, nivel_criticidad: 'Alta' } });
    for (const user of [guardia, libre, supervisor, central]) {
      await prisma.usuario.create({ data: { ...user, rut: randomUUID(), nombre: 'Usuario de prueba', email: `${user.id}@example.invalid`,
        password_hash: randomUUID(), estado: ESTADO_USUARIO.ACTIVO, instalacion_asignada_id: instalacionId,
      } });
    }
    await prisma.turno.create({ data: { id: turnoId, usuario_id: guardia.id, instalacion_id: instalacionId,
      fecha: aFechaDB(ahoraChile().fecha), hora_inicio: '00:00', hora_fin: '23:59',
    } });
  });
  afterAll(async () => {
    if (!habilitada) {
      await prisma.$disconnect();
      await Promise.all(require('pg').pools.map(pool => pool.end()));
      return;
    }
    await prisma.novedadHistorial.deleteMany({ where: { novedad: { instalacion_id: instalacionId } } });
    await prisma.novedad.deleteMany({ where: { instalacion_id: instalacionId } });
    await prisma.solicitud.deleteMany({ where: { usuario_id: { in: ids } } });
    await prisma.turno.deleteMany({ where: { instalacion_id: instalacionId } });
    await prisma.usuario.deleteMany({ where: { id: { in: ids } } });
    await prisma.instalacion.deleteMany({ where: { id: instalacionId } });
    await prisma.$disconnect();
    await Promise.all(require('pg').pools.map(pool => pool.end()));
  });
  beforeEach(() => {
    jest.clearAllMocks();
    uploadFotoToAzure.mockResolvedValue('pruebas/foto.png');
    generarUrlLectura.mockImplementation(async url => url ? 'foto-firmada-local' : null);
    getSocketIO.mockReturnValue({ to: () => ({ emit: jest.fn() }) });
  });
  test('crea con y sin foto; expone folio en crear, listar y obtener', async () => {
    const sin = await service.crear(datos, null, guardia);
    const con = await service.crear(datos, foto, guardia);
    expect(sin.foto_url).toBeNull(); expect(con.foto_url).toBe('pruebas/foto.png');
    expect(con.folio).toMatch(/^NOV-\d{4}-\d{5,}$/);
    expect(con.folio).not.toBe(sin.folio);
    expect((await service.obtenerPorId(con.id, guardia)).folio).toBe(con.folio);
    expect((await service.listar({}, guardia)).data.map(n => n.folio)).toContain(con.folio);
  });
  test('la base rechaza un numero duplicado', async () => {
    const n = await service.crear(datos, null, guardia);
    await expect(prisma.novedad.create({ data: { numero: n.numero, usuario_id: guardia.id, instalacion_id: instalacionId,
      turno_id: turnoId, tipo: n.tipo, descripcion: n.descripcion, urgencia: n.urgencia,
    } })).rejects.toMatchObject({ code: 'P2002' });
  });
  test('GGSS libre sin turno aprobado recibe 403', async () => {
    await expect(service.crear(datos, null, libre)).rejects.toMatchObject({ statusCode: 403 });
  });
  test('GGSS en pauta sin turno recibe 400', async () => {
    await expect(service.crear(datos, null, { ...libre, rol: ROLES.GGSS_EN_PAUTA })).rejects.toMatchObject({ statusCode: 400 });
  });
  test('foto superior a 10 MB devuelve 413 y no crea novedad', async () => {
    const total = await prisma.novedad.count({ where: { instalacion_id: instalacionId } });
    await expect(service.crear(datos, { ...foto, size: 10 * 1024 * 1024 + 1 }, guardia)).rejects.toMatchObject({ statusCode: 413 });
    expect(await prisma.novedad.count({ where: { instalacion_id: instalacionId } })).toBe(total);
    expect(uploadFotoToAzure).not.toHaveBeenCalled();
  });
  test('foto exactamente de 10 MB se admite; tipo no imagen se rechaza', async () => {
    await expect(service.crear(datos, { ...foto, size: 10 * 1024 * 1024 }, guardia)).resolves.toHaveProperty('foto_url', 'pruebas/foto.png');
    await expect(service.crear(datos, { ...foto, mimetype: 'text/plain' }, guardia)).rejects.toMatchObject({ statusCode: 400 });
  });
  test('GPS fuera de rango se registra como false', async () => {
    const n = await service.crear({ ...datos, latitud: -34.45 }, null, guardia);
    expect(n.gps_dentro_rango).toBe(false);
  });
  test('flujo crear → asignar → escalar → resolver deja exactamente cuatro entradas', async () => {
    const n = await service.crear(datos, null, guardia);
    const asignada = await service.asignar(n.id, central.id, supervisor);
    expect(asignada.estado).toBe(ESTADO_NOVEDAD.EN_ATENCION);
    expect(asignada.responsable.id).toBe(central.id);
    expect((await service.escalar(n.id, supervisor)).estado).toBe(ESTADO_NOVEDAD.ESCALADA);
    expect((await service.resolver(n.id, '  Situación controlada  ', central)).estado).toBe(ESTADO_NOVEDAD.RESUELTA);
    const historia = await service.historial(n.id, supervisor);
    expect(historia.map(h => h.accion)).toEqual([ACCION_NOVEDAD.CREAR, ACCION_NOVEDAD.ASIGNAR, ACCION_NOVEDAD.ESCALAR, ACCION_NOVEDAD.RESOLVER]);
    expect(historia[3].comentario).toBe('Situación controlada');
    await expect(service.resolver(n.id, 'Otro cierre', central)).rejects.toMatchObject({ statusCode: 409 });
    expect(await prisma.novedadHistorial.count({ where: { novedad_id: n.id } })).toBe(4);
  });
  test('fallo de historial revierte el cambio de estado en PostgreSQL', async () => {
    const n = await service.crear(datos, null, guardia);
    const transaccion = prisma.$transaction.bind(prisma);
    const spy = jest.spyOn(prisma, '$transaction').mockImplementationOnce(fn => transaccion(tx => fn({
      ...tx, novedadHistorial: { create: () => { throw new Error('Fallo de historial simulado'); } },
    })));
    try {
      await expect(service.resolver(n.id, 'Situación controlada', supervisor)).rejects.toThrow('Fallo de historial simulado');
    } finally { spy.mockRestore(); }
    expect((await prisma.novedad.findUnique({ where: { id: n.id } })).estado).toBe(ESTADO_NOVEDAD.ABIERTA);
    expect(await prisma.novedadHistorial.count({ where: { novedad_id: n.id } })).toBe(1);
  });
  test('dos cierres simultáneos solo guardan un cierre y una fila de historial', async () => {
    const n = await service.crear(datos, null, guardia);
    const resultados = await Promise.allSettled([
      service.resolver(n.id, 'Primer cierre', supervisor), service.resolver(n.id, 'Segundo cierre', central),
    ]);
    expect(resultados.filter(r => r.status === 'fulfilled')).toHaveLength(1);
    expect(resultados.find(r => r.status === 'rejected').reason.statusCode).toBe(409);
    expect(await prisma.novedadHistorial.count({ where: { novedad_id: n.id, accion: ACCION_NOVEDAD.RESOLVER } })).toBe(1);
  });
  test('sin tipo/descripción devuelve 400; fallo de almacenamiento no impide crear', async () => {
    await expect(service.crear({}, null, guardia)).rejects.toMatchObject({ statusCode: 400 });
    await expect(service.crear({ tipo: 'Ronda' }, null, guardia)).rejects.toMatchObject({ statusCode: 400 });
    uploadFotoToAzure.mockRejectedValueOnce(new Error('Almacenamiento de prueba no disponible'));
    await expect(service.crear(datos, foto, guardia)).resolves.toHaveProperty('foto_url', null);
  });
  test('cobertura vincula solicitud y asigna la vacante en PostgreSQL real', async () => {
    const vacantes = require('../vacantes.service');
    const solicitudes = require('../solicitudes.service');
    const politica = require('../../constants/cobertura');
    const anterior = politica.MAX_HORAS_SEMANALES;
    politica.MAX_HORAS_SEMANALES = 24; // Valor exclusivo del caso de prueba, no política operativa.
    try {
      const vacante = await prisma.turno.create({ data: { instalacion_id: instalacionId,
        fecha: aFechaDB(sumarDias(ahoraChile().fecha, 1)), hora_inicio: '08:00', hora_fin: '20:00' } });
      const solicitud = await vacantes.solicitar(vacante.id, libre, 'Disponible');
      expect(solicitud.vacante_turno_id).toBe(vacante.id);
      expect((await solicitudes.aprobar(solicitud.id, supervisor.id, 'Aceptada')).estado).toBe('aprobada');
      expect((await prisma.turno.findUnique({ where: { id: vacante.id } })).usuario_id).toBe(libre.id);
      expect((await vacantes.listarCompatibles(libre)).map(t => t.id)).not.toContain(vacante.id);
    } finally { politica.MAX_HORAS_SEMANALES = anterior; }
  });
});
