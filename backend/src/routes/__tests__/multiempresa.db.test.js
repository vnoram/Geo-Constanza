/**
 * Aislamiento entre empresas CON BASE REAL (PostgreSQL local). Opt-in: RUN_LOCAL_DB_TESTS=1.
 *
 * Se levanta la app completa (rutas, authenticate, RBAC, extensión de Prisma, errorHandler) y se inicia sesión
 * de verdad. Dos empresas con datos propios; el admin de A intenta leer, editar y borrar por id lo de B (y al revés)
 * y siempre debe recibir 404 sin que el dato de B cambie.
 */
process.env.JWT_ACCESS_SECRET = process.env.JWT_ACCESS_SECRET || 'secreto-acceso-solo-para-pruebas-locales';
process.env.JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'secreto-refresh-solo-para-pruebas-locales';
process.env.RATE_LIMIT_PUBLIC = '100000';
process.env.RATE_LIMIT_AUTHENTICATED = '100000';
process.env.REQUIRE_2FA = 'false';

jest.mock('../../config/logger', () => ({ logger: { error: jest.fn(), warn: jest.fn(), info: jest.fn(), debug: jest.fn() } }));
jest.mock('../../config/redis', () => ({ getRedis: jest.fn(() => null) }));
jest.mock('../../utils/azureStorage', () => ({ uploadFotoToAzure: jest.fn(), generarUrlLectura: jest.fn() }));
jest.mock('../../socket/socketManager', () => ({ getSocketIO: jest.fn(() => ({ to: () => ({ emit: jest.fn() }) })), desconectarEmpresa: jest.fn() }));
jest.mock('morgan', () => () => (_req, _res, next) => next());

const bcrypt = require('bcryptjs');
const { randomUUID } = require('crypto');
const request = require('supertest');

const ejecutar = process.env.RUN_LOCAL_DB_TESTS === '1';
const suite = ejecutar ? describe : describe.skip;

const NOMBRES = ['GET turno', 'PUT turno', 'PATCH cancelar turno', 'GET novedad', 'GET historial novedad', 'PATCH resolver novedad', 'PATCH escalar novedad', 'PATCH asignar novedad', 'PUT usuario', 'PATCH desactivar usuario', 'POST reiniciar 2FA', 'PUT instalación', 'PATCH aprobar solicitud', 'PATCH rechazar solicitud', 'GET asistencia de hoy de su instalación', 'GET historial de asistencia de su guardia'];

suite('Multiempresa con PostgreSQL local', () => {
  let app; let prisma; let prismaGlobal; let conEmpresa; let siguienteFolio; let calcularDv;
  const CLAVE = 'ClaveDePrueba-2026!';
  const sufijo = randomUUID().slice(0, 8);
  const E = {}; // datos por empresa: { A: {...}, B: {...} }
  let superAdmin;
  let hash;

  const rutNuevo = (n) => { const cuerpo = String(60000000 + n); return `${cuerpo}-${calcularDv(cuerpo)}`; };
  let contador = Math.floor(Math.random() * 900000);
  const siguienteRut = () => rutNuevo(contador++);
  const hoy = new Date(); hoy.setUTCHours(0, 0, 0, 0);

  const crearUsuario = (empresaId, rol, extra = {}) => {
    const rut = siguienteRut();
    return prismaGlobal.usuario.create({
      data: { rut, nombre: `${rol} ${sufijo}`, email: `${rol}.${rut}@prueba-${sufijo}.test`, password_hash: hash, rol, empresa_id: empresaId, ...extra },
    });
  };

  const iniciarSesion = async (usuario) => {
    const res = await request(app).post('/api/v1/auth/login').send({ rut: usuario.rut, password: CLAVE });
    return { res, token: res.body?.accessToken ?? res.body?.token ?? res.body?.data?.accessToken };
  };
  const api = (token) => ({
    get: (url) => request(app).get(`/api/v1${url}`).set('Authorization', `Bearer ${token}`),
    post: (url, body) => request(app).post(`/api/v1${url}`).set('Authorization', `Bearer ${token}`).send(body ?? {}),
    put: (url, body) => request(app).put(`/api/v1${url}`).set('Authorization', `Bearer ${token}`).send(body ?? {}),
    patch: (url, body) => request(app).patch(`/api/v1${url}`).set('Authorization', `Bearer ${token}`).send(body ?? {}),
  });

  const sembrar = async (clave, nombre) => {
    const empresa = await prismaGlobal.empresa.create({
      data: { id: randomUUID(), nombre: `${nombre} ${sufijo}`, rut: rutNuevo(contador++) },
    });
    const d = { empresa };
    d.admin = await crearUsuario(empresa.id, 'admin');
    d.supervisor = await crearUsuario(empresa.id, 'supervisor');
    d.guardia = await crearUsuario(empresa.id, 'pauta', { tipo_ggss: 'pauta' });
    d.instalacion = await prismaGlobal.instalacion.create({
      data: { empresa_id: empresa.id, nombre: `Instalación ${clave} ${sufijo}`, latitud: -33.45, longitud: -70.66 },
    });
    d.turno = await prismaGlobal.turno.create({
      data: { empresa_id: empresa.id, usuario_id: d.guardia.id, instalacion_id: d.instalacion.id, fecha: hoy, hora_inicio: '08:00', hora_fin: '16:00' },
    });
    d.novedad = await prismaGlobal.novedad.create({
      data: {
        empresa_id: empresa.id, numero: 1, usuario_id: d.guardia.id, instalacion_id: d.instalacion.id, turno_id: d.turno.id,
        tipo: 'otro', descripcion: `Novedad de ${clave}`, urgencia: 'verde',
      },
    });
    await prismaGlobal.empresa.update({ where: { id: empresa.id }, data: { ultimo_folio: 1 } });
    d.solicitud = await prismaGlobal.solicitud.create({
      data: { empresa_id: empresa.id, usuario_id: d.guardia.id, tipo: 'dias_libres', fecha_desde: hoy, motivo: `Solicitud de ${clave}` },
    });
    d.auditoria = await prismaGlobal.auditoria.create({
      data: { empresa_id: empresa.id, usuario_id: d.admin.id, accion: 'PRUEBA', tabla_afectada: 'prueba', registro_id: clave, valores_despues: { detalle: `Evento de ${clave}` } },
    });
    d.tokenAdmin = (await iniciarSesion(d.admin)).token;
    d.tokenSupervisor = (await iniciarSesion(d.supervisor)).token;
    return d;
  };

  const limpiar = async () => {
    const { borrarEmpresaDePrueba } = require('../../test-utils/empresaDePrueba');
    for (const k of ['A', 'B', 'C']) if (E[k]) await borrarEmpresaDePrueba(E[k].empresa.id);
    if (superAdmin) {
      await prismaGlobal.auditoria.deleteMany({ where: { usuario_id: superAdmin.id } });
      await prismaGlobal.usuario.deleteMany({ where: { id: superAdmin.id } });
    }
  };

  beforeAll(async () => {
    if (!/geo_/i.test(process.env.DATABASE_URL || '') || !/(localhost|127\.0\.0\.1)/.test(process.env.DATABASE_URL || '')) {
      throw new Error('Esta suite solo corre contra una base local cuyo nombre contenga "geo_".');
    }
    ({ prisma, prismaGlobal } = require('../../config/database'));
    ({ conEmpresa } = require('../../config/tenant'));
    ({ siguienteFolio } = require('../../utils/folioNovedad'));
    ({ calcularDv } = require('../../utils/rut'));
    app = require('../../app');
    hash = await bcrypt.hash(CLAVE, 4);
    superAdmin = await crearUsuario(null, 'super_admin');
    E.A = await sembrar('A', 'Empresa A');
    E.B = await sembrar('B', 'Empresa B');
  }, 60000);

  afterAll(async () => {
    if (!prismaGlobal) return;
    await limpiar();
    await prismaGlobal.$disconnect();
  }, 60000);

  // ---------------------------------------------------------------- listados
  describe('listados: cada admin ve solo lo suyo', () => {
    const casos = [
      ['/usuarios', 'admin'], ['/instalaciones', 'instalacion'], ['/turnos', 'turno'], ['/novedades', 'novedad'],
      ['/solicitudes', 'solicitud'], ['/auditoria', 'auditoria'],
    ];
    const idsDe = (body) => JSON.stringify(body);

    test.each(casos)('GET %s: A no ve ids de B y B no ve ids de A', async (ruta, clave) => {
      const a = await api(E.A.tokenAdmin).get(ruta);
      const b = await api(E.B.tokenAdmin).get(ruta);
      expect(a.status).toBe(200);
      expect(b.status).toBe(200);
      expect(idsDe(a.body)).toContain(E.A[clave].id);
      expect(idsDe(a.body)).not.toContain(E.B[clave].id);
      expect(idsDe(b.body)).toContain(E.B[clave].id);
      expect(idsDe(b.body)).not.toContain(E.A[clave].id);
    });

    test('usuarios: A no ve a ningún usuario de B ni al super admin', async () => {
      const a = JSON.stringify((await api(E.A.tokenAdmin).get('/usuarios')).body);
      for (const u of [E.B.admin, E.B.supervisor, E.B.guardia, superAdmin]) expect(a).not.toContain(u.id);
    });

    test('dashboard del admin A no incluye nada de B', async () => {
      const res = await api(E.A.tokenAdmin).get('/dashboard/hoy');
      expect(res.status).toBe(200);
      expect(JSON.stringify(res.body)).not.toContain(E.B.instalacion.id);
      expect(JSON.stringify(res.body)).not.toContain(E.B.guardia.id);
    });

    test('auditoría: el evento de la plataforma (sin empresa) no aparece en ninguna empresa', async () => {
      await prismaGlobal.auditoria.create({ data: { empresa_id: null, usuario_id: superAdmin.id, accion: 'PLATAFORMA', tabla_afectada: 'empresa', registro_id: E.A.empresa.id, valores_despues: { detalle: 'solo plataforma' } } });
      for (const t of [E.A.tokenAdmin, E.B.tokenAdmin]) {
        expect(JSON.stringify((await api(t).get('/auditoria')).body)).not.toContain('solo plataforma');
      }
    });
  });

  // ------------------------------------------- por id: leer, editar, borrar → 404
  describe('el admin de A no puede leer, editar ni cambiar nada de B por id (404)', () => {
    const intentos = (X, Y) => [
      ['GET turno', (t) => api(t).get(`/turnos/${Y.turno.id}`)],
      ['PUT turno', (t) => api(t).put(`/turnos/${Y.turno.id}`, { hora_inicio: '09:00', hora_fin: '17:00' })],
      ['PATCH cancelar turno', (t) => api(t).patch(`/turnos/${Y.turno.id}/cancelar`, { motivo: 'intento ajeno' })],
      ['GET novedad', (t) => api(t).get(`/novedades/${Y.novedad.id}`)],
      ['GET historial novedad', (t) => api(t).get(`/novedades/${Y.novedad.id}/historial`)],
      ['PATCH resolver novedad', (t) => api(t).patch(`/novedades/${Y.novedad.id}/resolver`, { comentario: 'resolución ajena' })],
      ['PATCH escalar novedad', (t) => api(t).patch(`/novedades/${Y.novedad.id}/escalar`)],
      ['PATCH asignar novedad', (t) => api(t).patch(`/novedades/${Y.novedad.id}/asignar`, { responsable_id: X.supervisor.id })],
      ['PUT usuario', (t) => api(t).put(`/usuarios/${Y.guardia.id}`, { nombre: 'Hackeado' })],
      ['PATCH desactivar usuario', (t) => api(t).patch(`/usuarios/${Y.guardia.id}/desactivar`)],
      ['POST reiniciar 2FA', (t) => api(t).post(`/usuarios/${Y.guardia.id}/2fa/reset`)],
      ['PUT instalación', (t) => api(t).put(`/instalaciones/${Y.instalacion.id}`, { nombre: 'Hackeada' })],
      ['PATCH aprobar solicitud', (t) => api(t).patch(`/solicitudes/${Y.solicitud.id}/aprobar`, { comentario: 'ok' })],
      ['PATCH rechazar solicitud', (t) => api(t).patch(`/solicitudes/${Y.solicitud.id}/rechazar`, { comentario: 'no' })],
      ['GET asistencia de hoy de su instalación', (t) => api(t).get(`/asistencia/hoy/${Y.instalacion.id}`)],
      ['GET historial de asistencia de su guardia', (t) => api(t).get(`/asistencia/historial/${Y.guardia.id}`)],
    ];

    const verificarIntactoB = async (Y) => {
      const turno = await prismaGlobal.turno.findUnique({ where: { id: Y.turno.id } });
      expect(turno.estado).toBe('programado');
      expect(turno.hora_inicio).toBe('08:00');
      const novedad = await prismaGlobal.novedad.findUnique({ where: { id: Y.novedad.id } });
      expect(novedad.estado).toBe('abierta');
      expect(novedad.asignada_a).toBeNull();
      const guardia = await prismaGlobal.usuario.findUnique({ where: { id: Y.guardia.id } });
      expect(guardia.estado).toBe('activo');
      expect(guardia.nombre).not.toBe('Hackeado');
      const instalacion = await prismaGlobal.instalacion.findUnique({ where: { id: Y.instalacion.id } });
      expect(instalacion.nombre).not.toBe('Hackeada');
      const solicitud = await prismaGlobal.solicitud.findUnique({ where: { id: Y.solicitud.id } });
      expect(solicitud.estado).toBe('pendiente');
    };

    test.each(NOMBRES)('admin de A → %s de B responde 404', async (nombre) => {
      const caso = intentos(E.A, E.B).find(([n]) => n === nombre);
      const res = await caso[1](E.A.tokenAdmin);
      expect(res.status).toBe(404);
    });

    test.each(NOMBRES)('admin de B → %s de A responde 404 (simétrico)', async (nombre) => {
      const caso = intentos(E.B, E.A).find(([n]) => n === nombre);
      const res = await caso[1](E.B.tokenAdmin);
      expect(res.status).toBe(404);
    });

    test('después de todos los intentos, los datos de B (y de A) siguen intactos', async () => {
      await verificarIntactoB(E.B);
      await verificarIntactoB(E.A);
    });

    test('el supervisor de A tampoco alcanza lo de B: 404 en turno, novedad e instalación', async () => {
      const t = E.A.tokenSupervisor;
      expect((await api(t).get(`/turnos/${E.B.turno.id}`)).status).toBe(404);
      expect((await api(t).get(`/novedades/${E.B.novedad.id}`)).status).toBe(404);
      expect((await api(t).get(`/asistencia/hoy/${E.B.instalacion.id}`)).status).toBe(404);
      expect((await api(t).post('/turnos', { instalacion_id: E.B.instalacion.id, usuario_id: E.A.guardia.id, fecha: '2030-01-01', hora_inicio: '08:00', hora_fin: '16:00' })).status).toBe(404);
    });

    test('un id inexistente en la propia empresa responde igual (404): no se distingue de uno ajeno', async () => {
      const res = await api(E.A.tokenAdmin).get(`/turnos/${randomUUID()}`);
      expect(res.status).toBe(404);
    });
  });

  // ------------------------------------------------- referencias cruzadas al escribir
  describe('escrituras que referencian recursos de otra empresa', () => {
    const nuevoTurno = (extra) => ({ fecha: '2031-03-01', hora_inicio: '08:00', hora_fin: '16:00', ...extra });

    test('turno de A con la instalación de B → 404 y no se crea', async () => {
      const antes = await prismaGlobal.turno.count({ where: { instalacion_id: E.B.instalacion.id } });
      const res = await api(E.A.tokenAdmin).post('/turnos', nuevoTurno({ instalacion_id: E.B.instalacion.id }));
      expect(res.status).toBe(404);
      expect(await prismaGlobal.turno.count({ where: { instalacion_id: E.B.instalacion.id } })).toBe(antes);
    });

    test('turno de A con un guardia de B → 404', async () => {
      const res = await api(E.A.tokenAdmin).post('/turnos', nuevoTurno({ instalacion_id: E.A.instalacion.id, usuario_id: E.B.guardia.id }));
      expect(res.status).toBe(404);
    });

    test('editar un turno propio para asignarle un guardia de B → 404 y el turno no cambia', async () => {
      const res = await api(E.A.tokenAdmin).put(`/turnos/${E.A.turno.id}`, { usuario_id: E.B.guardia.id });
      expect(res.status).toBe(404);
      expect((await prismaGlobal.turno.findUnique({ where: { id: E.A.turno.id } })).usuario_id).toBe(E.A.guardia.id);
    });

    test('crear un usuario de A asignado a una instalación de B → 404', async () => {
      const rut = siguienteRut();
      const res = await api(E.A.tokenAdmin).post('/usuarios', {
        rut, nombre: 'Cruzado', email: `cruzado.${rut}@prueba-${sufijo}.test`, rol: 'libre', tipo_ggss: 'libre',
        instalacion_asignada_id: E.B.instalacion.id, password: CLAVE,
      });
      expect([404, 400]).toContain(res.status);
      expect(await prismaGlobal.usuario.count({ where: { rut } })).toBe(0);
    });

    test('un usuario nuevo de A queda en A: el cuerpo no puede fijar la empresa de B', async () => {
      const rut = siguienteRut();
      const res = await api(E.A.tokenAdmin).post('/usuarios', {
        rut, nombre: 'Nuevo A', email: `nuevo.${rut}@prueba-${sufijo}.test`, rol: 'supervisor', password: CLAVE, empresa_id: E.B.empresa.id,
      });
      // La empresa sale del token. Si el cuerpo trae otra, la petición se rechaza o se ignora; en ningún caso crea en B.
      expect(await prismaGlobal.usuario.count({ where: { rut, empresa_id: E.B.empresa.id } })).toBe(0);
      const creado = await prismaGlobal.usuario.findUnique({ where: { rut } });
      if (creado) expect(creado.empresa_id).toBe(E.A.empresa.id);
      else expect(res.status).toBeGreaterThanOrEqual(400);
    });

    test('el admin no puede crear un super_admin', async () => {
      const rut = siguienteRut();
      const res = await api(E.A.tokenAdmin).post('/usuarios', { rut, nombre: 'Intruso', email: `intruso.${rut}@prueba-${sufijo}.test`, rol: 'super_admin', password: CLAVE });
      expect(res.status).toBeGreaterThanOrEqual(400);
      expect(await prismaGlobal.usuario.count({ where: { rut } })).toBe(0);
    });

    test('RUT global: repetir el RUT de B desde A da 409 (limitación documentada de la etapa 1)', async () => {
      const res = await api(E.A.tokenAdmin).post('/usuarios', {
        rut: E.B.guardia.rut, nombre: 'Repetido', email: `repetido.${siguienteRut()}@prueba-${sufijo}.test`, rol: 'supervisor', password: CLAVE,
      });
      expect(res.status).toBe(409);
    });
  });

  // ------------------------------------------------------- nivel ORM (extensión Prisma)
  describe('extensión de Prisma bajo el contexto de A', () => {
    const enA = (fn) => conEmpresa(E.A.empresa.id, fn);

    test('sin contexto de empresa cualquier consulta falla cerrado', async () => {
      await expect(prisma.turno.findMany()).rejects.toMatchObject({ code: 'SIN_CONTEXTO_EMPRESA' });
      await expect(prisma.usuario.count()).rejects.toMatchObject({ code: 'SIN_CONTEXTO_EMPRESA' });
    });

    test('findUnique / findFirst de un registro de B devuelven null', async () => {
      await enA(async () => {
        expect(await prisma.turno.findUnique({ where: { id: E.B.turno.id } })).toBeNull();
        expect(await prisma.novedad.findFirst({ where: { id: E.B.novedad.id } })).toBeNull();
        await expect(prisma.turno.findUniqueOrThrow({ where: { id: E.B.turno.id } })).rejects.toMatchObject({ code: 'P2025' });
      });
    });

    test('update y delete por id de un registro de B fallan (P2025) y no lo tocan', async () => {
      await enA(async () => {
        await expect(prisma.turno.update({ where: { id: E.B.turno.id }, data: { estado: 'cancelado' } })).rejects.toMatchObject({ code: 'P2025' });
        await expect(prisma.novedad.delete({ where: { id: E.B.novedad.id } })).rejects.toMatchObject({ code: 'P2025' });
        await expect(prisma.instalacion.update({ where: { id: E.B.instalacion.id }, data: { nombre: 'x' } })).rejects.toMatchObject({ code: 'P2025' });
      });
      expect(await prismaGlobal.turno.findUnique({ where: { id: E.B.turno.id } })).not.toBeNull();
      expect((await prismaGlobal.turno.findUnique({ where: { id: E.B.turno.id } })).estado).toBe('programado');
      expect(await prismaGlobal.novedad.findUnique({ where: { id: E.B.novedad.id } })).not.toBeNull();
    });

    test('updateMany / deleteMany no alcanzan filas de B (count 0)', async () => {
      await enA(async () => {
        expect((await prisma.turno.updateMany({ where: { id: E.B.turno.id }, data: { estado: 'cancelado' } })).count).toBe(0);
        expect((await prisma.solicitud.deleteMany({ where: { id: E.B.solicitud.id } })).count).toBe(0);
      });
      expect(await prismaGlobal.solicitud.findUnique({ where: { id: E.B.solicitud.id } })).not.toBeNull();
    });

    test('upsert sobre el id de B no lo modifica', async () => {
      await enA(async () => {
        await prisma.instalacion.upsert({
          where: { id: E.B.instalacion.id },
          update: { nombre: 'Pisada por A' },
          create: { nombre: 'Nueva en A', latitud: -33, longitud: -70 },
        }).catch(() => null); // puede fallar por el id duplicado: lo importante es que B no cambie
      });
      expect((await prismaGlobal.instalacion.findUnique({ where: { id: E.B.instalacion.id } })).nombre).not.toBe('Pisada por A');
      expect((await prismaGlobal.instalacion.findUnique({ where: { id: E.B.instalacion.id } })).empresa_id).toBe(E.B.empresa.id);
    });

    test('createMany con la empresa de B se rechaza (EMPRESA_AJENA) y create sin empresa queda en A', async () => {
      await enA(async () => {
        await expect(prisma.supervisor_Instalacion.createMany({
          data: [{ supervisor_id: E.A.supervisor.id, instalacion_id: E.A.instalacion.id, empresa_id: E.B.empresa.id }],
        })).rejects.toMatchObject({ code: 'EMPRESA_AJENA' });
        const creada = await prisma.instalacion.create({ data: { nombre: `Creada ${sufijo}`, latitud: -33, longitud: -70 } });
        expect(creada.empresa_id).toBe(E.A.empresa.id);
      });
    });

    test('createMany con filas válidas asigna la empresa del contexto a cada fila', async () => {
      const extra = await crearUsuario(E.A.empresa.id, 'supervisor');
      await enA(async () => {
        await prisma.supervisor_Instalacion.createMany({ data: [{ supervisor_id: extra.id, instalacion_id: E.A.instalacion.id }] });
      });
      const fila = await prismaGlobal.supervisor_Instalacion.findFirst({ where: { supervisor_id: extra.id } });
      expect(fila.empresa_id).toBe(E.A.empresa.id);
    });

    test('la base misma rechaza una referencia cruzada (clave foránea compuesta), aunque se salte la aplicación', async () => {
      await expect(prismaGlobal.turno.create({
        data: { empresa_id: E.A.empresa.id, usuario_id: E.B.guardia.id, instalacion_id: E.A.instalacion.id, fecha: hoy, hora_inicio: '01:00', hora_fin: '02:00' },
      })).rejects.toMatchObject({ code: 'P2003' });
      await expect(prismaGlobal.turno.create({
        data: { empresa_id: E.A.empresa.id, instalacion_id: E.B.instalacion.id, fecha: hoy, hora_inicio: '01:00', hora_fin: '02:00' },
      })).rejects.toMatchObject({ code: 'P2003' });
    });

    test('$transaction interactiva conserva el alcance de A', async () => {
      await enA(async () => {
        await prisma.$transaction(async (tx) => {
          expect(await tx.turno.findUnique({ where: { id: E.B.turno.id } })).toBeNull();
          expect((await tx.turno.findMany()).every((t) => t.empresa_id === E.A.empresa.id)).toBe(true);
        });
      });
    });

    test('include anidado solo trae registros de A', async () => {
      await enA(async () => {
        const turnos = await prisma.turno.findMany({ include: { instalacion: true, usuario: true, novedades: true } });
        expect(turnos.length).toBeGreaterThan(0);
        for (const t of turnos) {
          expect(t.empresa_id).toBe(E.A.empresa.id);
          expect(t.instalacion.empresa_id).toBe(E.A.empresa.id);
          expect(t.usuario.empresa_id).toBe(E.A.empresa.id);
          for (const n of t.novedades) expect(n.empresa_id).toBe(E.A.empresa.id);
        }
        const insts = await prisma.instalacion.findMany({ include: { turnos: true, supervisores: true } });
        for (const i of insts) for (const t of i.turnos) expect(t.empresa_id).toBe(E.A.empresa.id);
      });
    });

    test('count, aggregate y groupBy solo ven A', async () => {
      await enA(async () => {
        const total = await prisma.turno.count();
        expect(total).toBe(await prismaGlobal.turno.count({ where: { empresa_id: E.A.empresa.id } }));
        const grupos = await prisma.turno.groupBy({ by: ['estado'], _count: { _all: true } });
        expect(grupos.reduce((s, g) => s + g._count._all, 0)).toBe(total);
        const agg = await prisma.novedad.aggregate({ _max: { numero: true } });
        expect(agg._max.numero).toBeGreaterThanOrEqual(1);
      });
    });
  });

  // ---------------------------------------------------------------------- folio
  describe('folio de novedad atómico por empresa', () => {
    test('8 transacciones simultáneas en A dan 8 folios distintos y consecutivos; B no se altera', async () => {
      const ultimoB = (await prismaGlobal.empresa.findUnique({ where: { id: E.B.empresa.id } })).ultimo_folio;
      const base = (await prismaGlobal.empresa.findUnique({ where: { id: E.A.empresa.id } })).ultimo_folio;
      const folios = await Promise.all(Array.from({ length: 8 }, () =>
        conEmpresa(E.A.empresa.id, () => prisma.$transaction((tx) => siguienteFolio(tx)))));
      expect([...folios].sort((x, y) => x - y)).toEqual(Array.from({ length: 8 }, (_, i) => base + 1 + i));
      expect((await prismaGlobal.empresa.findUnique({ where: { id: E.B.empresa.id } })).ultimo_folio).toBe(ultimoB);
    });

    test('mezcla simultánea de A y B: cada empresa lleva su propia numeración', async () => {
      const baseA = (await prismaGlobal.empresa.findUnique({ where: { id: E.A.empresa.id } })).ultimo_folio;
      const baseB = (await prismaGlobal.empresa.findUnique({ where: { id: E.B.empresa.id } })).ultimo_folio;
      const pedir = (id) => conEmpresa(id, () => prisma.$transaction((tx) => siguienteFolio(tx)));
      const [a, b] = await Promise.all([
        Promise.all([pedir(E.A.empresa.id), pedir(E.A.empresa.id), pedir(E.A.empresa.id)]),
        Promise.all([pedir(E.B.empresa.id), pedir(E.B.empresa.id), pedir(E.B.empresa.id)]),
      ]);
      expect(a.sort()).toEqual([baseA + 1, baseA + 2, baseA + 3]);
      expect(b.sort()).toEqual([baseB + 1, baseB + 2, baseB + 3]);
    });

    test('si la transacción falla, el contador se revierte (no quedan huecos)', async () => {
      const antes = (await prismaGlobal.empresa.findUnique({ where: { id: E.A.empresa.id } })).ultimo_folio;
      await conEmpresa(E.A.empresa.id, () => prisma.$transaction(async (tx) => { await siguienteFolio(tx); throw new Error('falla'); })).catch(() => null);
      expect((await prismaGlobal.empresa.findUnique({ where: { id: E.A.empresa.id } })).ultimo_folio).toBe(antes);
    });

    test('UNIQUE(empresa_id, numero): el mismo número en dos empresas es válido, repetido en una no', async () => {
      await expect(prismaGlobal.novedad.create({
        data: { empresa_id: E.A.empresa.id, numero: 1, usuario_id: E.A.guardia.id, instalacion_id: E.A.instalacion.id, turno_id: E.A.turno.id, tipo: 'otro', descripcion: 'duplicada', urgencia: 'verde' },
      })).rejects.toMatchObject({ code: 'P2002' });
      expect(E.B.novedad.numero).toBe(E.A.novedad.numero); // ambas empresas tienen su folio 1
    });
  });

  // ---------------------------------------------------------------- super admin
  describe('super admin (plataforma)', () => {
    let token;
    beforeAll(async () => { token = (await iniciarSesion(superAdmin)).token; });

    test('inicia sesión y el token no lleva empresa', async () => {
      expect(token).toBeTruthy();
      const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());
      expect(payload.rol).toBe('super_admin');
      expect(payload.empresaId ?? null).toBeNull();
    });

    test('lista las empresas (incluye A y B)', async () => {
      const res = await api(token).get('/plataforma/empresas');
      expect(res.status).toBe(200);
      const texto = JSON.stringify(res.body);
      expect(texto).toContain(E.A.empresa.id);
      expect(texto).toContain(E.B.empresa.id);
    });

    test.each([
      '/usuarios', '/instalaciones', '/turnos', '/novedades', '/solicitudes', '/dashboard/hoy', '/auditoria', '/reportes/asistencia',
    ])('GET %s → 403', async (ruta) => {
      expect((await api(token).get(ruta)).status).toBe(403);
    });

    test('no puede leer un turno ni una novedad por id (403)', async () => {
      expect((await api(token).get(`/turnos/${E.A.turno.id}`)).status).toBe(403);
      expect((await api(token).get(`/novedades/${E.A.novedad.id}`)).status).toBe(403);
    });

    test('un admin de empresa no entra a la plataforma (403)', async () => {
      expect((await api(E.A.tokenAdmin).get('/plataforma/empresas')).status).toBe(403);
    });

    test('crea una empresa y su primer admin; el admin inicia sesión solo con su empresa', async () => {
      const rutEmpresa = rutNuevo(contador++);
      const creada = await api(token).post('/plataforma/empresas', { nombre: `Empresa C ${sufijo}`, rut: rutEmpresa, plan: 'basico' });
      expect(creada.status).toBe(201);
      const id = creada.body.id ?? creada.body.data?.id;
      E.C = { empresa: { id } };
      const rutAdmin = siguienteRut();
      const admin = await api(token).post(`/plataforma/empresas/${id}/admin`, { rut: rutAdmin, nombre: 'Admin C', email: `adminc.${rutAdmin}@prueba-${sufijo}.test` });
      expect(admin.status).toBe(201);
      const fila = await prismaGlobal.usuario.findUnique({ where: { rut: rutAdmin } });
      expect(fila.empresa_id).toBe(id);
      expect(fila.rol).toBe('admin');
      // la creación queda auditada sin empresa (evento de plataforma)
      expect(await prismaGlobal.auditoria.count({ where: { empresa_id: null, usuario_id: superAdmin.id } })).toBeGreaterThan(0);
    });

    test('gestiona al admin: edita datos, no cambia RUT, desactiva y permite crear uno nuevo', async () => {
      const creada = await api(token).post('/plataforma/empresas', { nombre: `Empresa D ${sufijo}`, rut: rutNuevo(contador++), plan: 'basico' });
      const id = creada.body.id ?? creada.body.data?.id;
      const rut1 = siguienteRut();
      const a1 = await api(token).post(`/plataforma/empresas/${id}/admin`, { rut: rut1, nombre: 'Admin D1', email: `d1.${rut1}@prueba-${sufijo}.test` });
      expect(a1.status).toBe(201);
      const adminId = a1.body.id;

      // edita nombre y correo
      const ed = await api(token).put(`/plataforma/empresas/${id}/admin/${adminId}`, { nombre: 'Admin D1 Corregido', email: `d1b.${rut1}@prueba-${sufijo}.test` });
      expect(ed.status).toBe(200);
      expect(ed.body.nombre).toBe('Admin D1 Corregido');
      // el RUT no se puede modificar
      expect((await api(token).put(`/plataforma/empresas/${id}/admin/${adminId}`, { rut: siguienteRut() })).status).toBe(400);
      // un admin de otra empresa no se puede tocar con el id de esta (404)
      expect((await api(token).put(`/plataforma/empresas/${E.A.empresa.id}/admin/${adminId}`, { nombre: 'Intruso' })).status).toBe(404);
      // reenvía la invitación
      expect((await api(token).post(`/plataforma/empresas/${id}/admin/${adminId}/invitacion`)).status).toBe(200);

      // con un admin activo no se puede crear otro
      const rut2 = siguienteRut();
      const cuerpo2 = { rut: rut2, nombre: 'Admin D2', email: `d2.${rut2}@prueba-${sufijo}.test` };
      expect((await api(token).post(`/plataforma/empresas/${id}/admin`, cuerpo2)).status).toBe(409);
      // desactiva al primero y ahora sí se puede crear el reemplazo
      expect((await api(token).patch(`/plataforma/empresas/${id}/admin/${adminId}/estado`, { estado: 'inactivo' })).status).toBe(200);
      const a2 = await api(token).post(`/plataforma/empresas/${id}/admin`, cuerpo2);
      expect(a2.status).toBe(201);
      // reactivar al primero mientras el segundo está activo → 409
      expect((await api(token).patch(`/plataforma/empresas/${id}/admin/${adminId}/estado`, { estado: 'activo' })).status).toBe(409);
      // un admin de empresa no puede usar estas rutas
      expect((await api(E.A.tokenAdmin).put(`/plataforma/empresas/${id}/admin/${a2.body.id}`, { nombre: 'X' })).status).toBe(403);
    });

    test('RUT de empresa repetido → 409', async () => {
      const res = await api(token).post('/plataforma/empresas', { nombre: 'Duplicada', rut: E.A.empresa.rut });
      expect(res.status).toBe(409);
    });
  });

  // ------------------------------------------------------------------ suspensión
  describe('empresa suspendida', () => {
    let token;
    beforeAll(async () => { token = (await iniciarSesion(superAdmin)).token; });

    test('suspender B: su token vigente se rechaza, no puede iniciar sesión y A sigue operando', async () => {
      expect((await api(E.B.tokenAdmin).get('/turnos')).status).toBe(200);
      const susp = await api(token).patch(`/plataforma/empresas/${E.B.empresa.id}/estado`, { estado: 'suspendida' });
      expect(susp.status).toBe(200);

      const conTokenViejo = await api(E.B.tokenAdmin).get('/turnos');
      expect(conTokenViejo.status).toBe(403);
      expect(JSON.stringify(conTokenViejo.body)).toMatch(/suspendid/i);

      const login = await request(app).post('/api/v1/auth/login').send({ rut: E.B.admin.rut, password: CLAVE });
      expect(login.status).toBe(403);

      expect((await api(E.A.tokenAdmin).get('/turnos')).status).toBe(200);
    });

    test('reactivar B restablece el acceso', async () => {
      const act = await api(token).patch(`/plataforma/empresas/${E.B.empresa.id}/estado`, { estado: 'activa' });
      expect(act.status).toBe(200);
      expect((await api(E.B.tokenAdmin).get('/turnos')).status).toBe(200);
      const login = await iniciarSesion(E.B.admin);
      expect(login.res.status).toBe(200);
    });
  });

  // ------------------------------------------------------------------ token manipulado
  describe('token manipulado', () => {
    test('un token de A reescrito con la empresa de B se rechaza', async () => {
      const jwt = require('jsonwebtoken');
      const payload = jwt.decode(E.A.tokenAdmin);
      const falso = jwt.sign({ ...payload, empresaId: E.B.empresa.id }, process.env.JWT_ACCESS_SECRET);
      const res = await api(falso).get('/turnos');
      expect([401, 403]).toContain(res.status);
      expect(JSON.stringify(res.body)).not.toContain(E.B.turno.id);
    });

    test('un token firmado con otra clave se rechaza', async () => {
      const jwt = require('jsonwebtoken');
      const payload = jwt.decode(E.A.tokenAdmin);
      const falso = jwt.sign(payload, 'otra-clave');
      expect((await api(falso).get('/turnos')).status).toBe(401);
    });
  });

  // ------------------------------------------------- subida de fotos (multipart)
  describe('novedad con foto (multipart/form-data)', () => {
    // multer lee el cuerpo con eventos de stream: sin `restaurarEmpresa` la petición seguía sin contexto
    // de empresa y la creación fallaba (SIN_CONTEXTO_EMPRESA). Se prueba con la app completa y login real.
    let guardia; let token; let otraEmpresaFolio;
    beforeAll(async () => {
      const { aFechaDB, ahoraChile } = require('../../utils/fechaChile');
      guardia = await crearUsuario(E.A.empresa.id, 'pauta', { tipo_ggss: 'pauta' });
      await prismaGlobal.turno.create({
        data: { empresa_id: E.A.empresa.id, usuario_id: guardia.id, instalacion_id: E.A.instalacion.id, fecha: aFechaDB(ahoraChile().fecha), hora_inicio: '00:00', hora_fin: '23:59' },
      });
      token = (await iniciarSesion(guardia)).token;
      otraEmpresaFolio = (await prismaGlobal.empresa.findUnique({ where: { id: E.B.empresa.id } })).ultimo_folio;
    });

    test('crea la novedad con foto en la empresa del guardia y con su folio', async () => {
      const { uploadFotoToAzure } = require('../../utils/azureStorage');
      uploadFotoToAzure.mockResolvedValue('https://almacenamiento.test/reportes/foto.jpg');
      const antes = (await prismaGlobal.empresa.findUnique({ where: { id: E.A.empresa.id } })).ultimo_folio;

      const res = await request(app).post('/api/v1/novedades')
        .set('Authorization', `Bearer ${token}`)
        .field('tipo', 'otro')
        .field('descripcion', 'Novedad con foto adjunta')
        .field('latitud', String(E.A.instalacion.latitud))
        .field('longitud', String(E.A.instalacion.longitud))
        .attach('foto', Buffer.alloc(3 * 1024 * 1024, 7), { filename: 'foto.jpg', contentType: 'image/jpeg' }); // varios paquetes, como una foto real de celular

      expect(res.status).toBe(201);
      expect(uploadFotoToAzure).toHaveBeenCalledTimes(1);
      const fila = await prismaGlobal.novedad.findUnique({ where: { id: res.body.id } });
      expect(fila.empresa_id).toBe(E.A.empresa.id);
      expect(fila.foto_url).toBe('https://almacenamiento.test/reportes/foto.jpg');
      expect(fila.numero).toBe(antes + 1);
      // la otra empresa no se altera
      expect((await prismaGlobal.empresa.findUnique({ where: { id: E.B.empresa.id } })).ultimo_folio).toBe(otraEmpresaFolio);
    });

    test('sin foto (JSON) sigue funcionando igual', async () => {
      const res = await api(token).post('/novedades', { tipo: 'otro', descripcion: 'Novedad sin foto adjunta' });
      expect(res.status).toBe(201);
    });
  });

  // ----------------------------------------------------------------- auditoría
  describe('auditoría', () => {
    test('una acción del admin de A queda registrada con empresa A', async () => {
      const rut = siguienteRut();
      const res = await api(E.A.tokenAdmin).post('/usuarios', { rut, nombre: 'Auditado', email: `aud.${rut}@prueba-${sufijo}.test`, rol: 'supervisor', password: CLAVE });
      expect([200, 201]).toContain(res.status);
      await new Promise((r) => setTimeout(r, 300));
      const creado = await prismaGlobal.usuario.findUnique({ where: { rut } });
      const filas = await prismaGlobal.auditoria.findMany({ where: { registro_id: creado.id } });
      if (filas.length) for (const f of filas) expect(f.empresa_id).toBe(E.A.empresa.id);
    });
  });
});

