// Alcance por instalación: un supervisor no opera ni lee fuera de lo suyo.
jest.mock('../../config/database', () => ({ prisma: {
  turno: { findUniqueOrThrow: jest.fn(), findUnique: jest.fn(), findMany: jest.fn(), count: jest.fn(), groupBy: jest.fn(), update: jest.fn() },
  solicitud: { findUniqueOrThrow: jest.fn(), update: jest.fn() },
  usuario: { findUnique: jest.fn(), findMany: jest.fn() },
  supervisor_Instalacion: { findMany: jest.fn() },
  instalacion: { findMany: jest.fn() },
  novedad: { findMany: jest.fn(), groupBy: jest.fn() },
  asistencia: { findMany: jest.fn(), groupBy: jest.fn() },
} }));
jest.mock('../../socket/socketManager', () => ({ getSocketIO: jest.fn() }));
jest.mock('../notificacion.service', () => ({ enviarNotificacion: jest.fn() }));

const { prisma } = require('../../config/database');
const turnos = require('../turnos.service');
const solicitudes = require('../solicitudes.service');
const reportes = require('../reportes.service');
const { ROLES } = require('../../constants/roles');

const sup = { id: 'sup', rol: ROLES.SUPERVISOR };
const admin = { id: 'adm', rol: ROLES.ADMINISTRADOR };
const guardia = { id: 'g1', rol: ROLES.GGSS_EN_PAUTA };

beforeEach(() => {
  jest.resetAllMocks();
  prisma.usuario.findUnique.mockResolvedValue({ comunas_cobertura: null, instalacion_asignada_id: null });
  prisma.supervisor_Instalacion.findMany.mockResolvedValue([{ instalacion_id: 'mia' }]);
  prisma.turno.findUniqueOrThrow.mockResolvedValue({ id: 't', estado: 'programado', usuario_id: 'g2', instalacion_id: 'ajena' });
});

describe('turnos', () => {
  test('supervisor no puede leer, editar, cancelar ni crear turnos de otra instalación', async () => {
    await expect(turnos.obtenerPorId('t', sup)).rejects.toMatchObject({ statusCode: 403 });
    await expect(turnos.editar('t', { hora_inicio: '08:00' }, sup)).rejects.toMatchObject({ statusCode: 403 });
    await expect(turnos.cancelar('t', 'motivo', sup)).rejects.toMatchObject({ statusCode: 403 });
    await expect(turnos.crear({ instalacion_id: 'ajena' }, 'sup', sup)).rejects.toMatchObject({ statusCode: 403 });
    expect(prisma.turno.update).not.toHaveBeenCalled();
  });

  test('supervisor sí opera en su instalación y admin en cualquiera', async () => {
    prisma.turno.findUniqueOrThrow.mockResolvedValue({ id: 't', estado: 'programado', usuario_id: 'g2', instalacion_id: 'mia' });
    prisma.turno.update.mockResolvedValue({ id: 't' });
    await expect(turnos.obtenerPorId('t', sup)).resolves.toMatchObject({ id: 't' });
    await expect(turnos.cancelar('t', 'motivo', sup)).resolves.toBeDefined();
    prisma.turno.findUniqueOrThrow.mockResolvedValue({ id: 't', usuario_id: 'g2', instalacion_id: 'ajena' });
    await expect(turnos.obtenerPorId('t', admin)).resolves.toBeDefined();
  });

  test('un guardia solo lee sus propios turnos', async () => {
    await expect(turnos.obtenerPorId('t', guardia)).rejects.toMatchObject({ statusCode: 403 });
    prisma.turno.findUniqueOrThrow.mockResolvedValue({ id: 't', usuario_id: 'g1', instalacion_id: 'mia' });
    await expect(turnos.obtenerPorId('t', guardia)).resolves.toBeDefined();
  });
});

describe('solicitudes', () => {
  const pendiente = { id: 's', estado: 'pendiente', usuario_id: 'g2', vacante_turno_id: null, tipo: 'vacaciones' };

  test('supervisor no revisa solicitudes de guardias de otra instalación', async () => {
    prisma.solicitud.findUniqueOrThrow.mockResolvedValue(pendiente);
    prisma.usuario.findUnique.mockResolvedValue({ instalacion_asignada_id: 'ajena', comunas_cobertura: null });
    await expect(solicitudes.aprobar('s', 'sup', 'ok', sup)).rejects.toMatchObject({ statusCode: 403 });
    await expect(solicitudes.rechazar('s', 'no', 'sup', sup)).rejects.toMatchObject({ statusCode: 403 });
    expect(prisma.solicitud.update).not.toHaveBeenCalled();
  });

  test('con vacante, manda la instalación del turno y no la del solicitante', async () => {
    prisma.solicitud.findUniqueOrThrow.mockResolvedValue({ ...pendiente, vacante_turno_id: 'tv' });
    prisma.turno.findUnique.mockResolvedValue({ instalacion_id: 'ajena' });
    await expect(solicitudes.aprobar('s', 'sup', 'ok', sup)).rejects.toMatchObject({ statusCode: 403 });
  });

  test('supervisor en su alcance y administrador sí pueden revisar', async () => {
    prisma.solicitud.findUniqueOrThrow.mockResolvedValue(pendiente);
    prisma.solicitud.update.mockResolvedValue({ id: 's', estado: 'rechazada' });
    prisma.usuario.findUnique.mockResolvedValue({ instalacion_asignada_id: 'mia', comunas_cobertura: null });
    await expect(solicitudes.rechazar('s', 'no', 'sup', sup)).resolves.toMatchObject({ estado: 'rechazada' });
    prisma.usuario.findUnique.mockResolvedValue({ instalacion_asignada_id: 'ajena', comunas_cobertura: null });
    await expect(solicitudes.rechazar('s', 'no', 'adm', admin)).resolves.toBeDefined();
  });
});

describe('reportes agregados', () => {
  beforeEach(() => {
    prisma.novedad.findMany.mockResolvedValue([]);
    prisma.turno.count.mockResolvedValue(0);
    prisma.asistencia.findMany.mockResolvedValue([]);
    prisma.turno.groupBy.mockResolvedValue([]);
    prisma.asistencia.groupBy.mockResolvedValue([]);
    prisma.novedad.groupBy.mockResolvedValue([]);
    prisma.instalacion.findMany.mockResolvedValue([]);
  });
  const filtros = (mock) => mock.mock.calls.map((c) => c[0].where.instalacion_id);

  test('supervisor: semana, estado y mensual filtran por sus instalaciones', async () => {
    await reportes.novedadesPorSemana(sup);
    await reportes.estadoGuardias(sup);
    await reportes.resumenMensual(10, 2026, sup);
    for (const m of [prisma.novedad.findMany, prisma.turno.count, prisma.asistencia.findMany, prisma.turno.groupBy, prisma.asistencia.groupBy, prisma.novedad.groupBy]) {
      expect(filtros(m).every((f) => f && f.in.join() === 'mia')).toBe(true);
    }
  });

  test('administrador ve todo sin filtro de instalación', async () => {
    await reportes.novedadesPorSemana(admin);
    await reportes.estadoGuardias(admin);
    expect(filtros(prisma.novedad.findMany)).toEqual([undefined]);
    expect(filtros(prisma.turno.count)).toEqual([undefined]);
  });
});
