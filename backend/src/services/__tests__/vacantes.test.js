jest.mock('../../config/database', () => ({ prisma: {
  usuario: { findUnique: jest.fn() }, turno: { findMany: jest.fn(), findUnique: jest.fn() },
  solicitud: { findFirst: jest.fn(), create: jest.fn() }, $transaction: jest.fn(),
} }));
jest.mock('../turnos.service', () => ({ verificarConflictos: jest.fn() }));
const { prisma } = require('../../config/database');
const { verificarConflictos } = require('../turnos.service');
const { esVacante, listarCompatibles, solicitar } = require('../vacantes.service');
const { instanteChile, aFechaDB } = require('../../utils/fechaChile');
const { ROLES } = require('../../constants/roles');
const { ESTADO_TURNO, ESTADO_USUARIO, ESTADO_SOLICITUD } = require('../../constants/estados');
const { TIPO_SOLICITUD } = require('../../constants/solicitudes');
const user = { id: 'g1', rol: ROLES.GGSS_LIBRE };
const turno = { id: 't1', usuario_id: null, fecha: aFechaDB('2026-10-30'), hora_inicio: '08:00', hora_fin: '20:00',
  estado: ESTADO_TURNO.PROGRAMADO, instalacion: { id: 'i1', nombre: 'Instalación' }, asistencias: [],
};
beforeEach(() => {
  jest.resetAllMocks(); jest.useFakeTimers().setSystemTime(instanteChile('2026-10-30', '08:20'));
  prisma.usuario.findUnique.mockResolvedValue({ ...user, estado: ESTADO_USUARIO.ACTIVO });
  prisma.turno.findMany.mockResolvedValue([turno]); prisma.turno.findUnique.mockResolvedValue(turno);
  verificarConflictos.mockResolvedValue([]); prisma.solicitud.findFirst.mockResolvedValue(null);
  prisma.$transaction.mockImplementation(fn => fn(prisma));
});
afterEach(() => jest.useRealTimers());
test('detecta turno sin asignar incluso antes de empezar', () => {
  expect(esVacante(turno, instanteChile('2026-10-30', '07:00'))).toBe(true);
});
test('guardia sin asistencia es vacante al vencer tolerancia, no antes', () => {
  const asignado = { ...turno, usuario_id: 'otro' };
  expect(esVacante(asignado, instanteChile('2026-10-30', '08:14'))).toBe(false);
  expect(esVacante(asignado, instanteChile('2026-10-30', '08:15'))).toBe(true);
});
test('no incluye cancelados, finalizados ni turnos con asistencia', () => {
  expect(esVacante({ ...turno, estado: ESTADO_TURNO.CANCELADO })).toBe(false);
  expect(esVacante(turno, instanteChile('2026-10-30', '20:00'))).toBe(false);
  expect(esVacante({ ...turno, asistencias: [{ id: 'a1' }] })).toBe(false);
});
test('lista solo vacantes sin solapamiento y no expone datos del guardia ausente', async () => {
  await expect(listarCompatibles(user)).resolves.toEqual([expect.objectContaining({ id: 't1', motivo_vacante: 'sin_asignar' })]);
  expect(verificarConflictos).toHaveBeenCalledWith(expect.objectContaining({ usuario_id: user.id, hora_inicio: '08:00' }));
  verificarConflictos.mockResolvedValue([turno]);
  await expect(listarCompatibles(user)).resolves.toEqual([]);
});
test.each([ROLES.SUPERVISOR, ROLES.GGSS_EN_PAUTA])('rechaza rol %s', async rol => {
  await expect(listarCompatibles({ id: 'g1', rol })).rejects.toMatchObject({ statusCode: 403 });
});
test('registra cobertura vinculada a la vacante y al solicitante', async () => {
  prisma.solicitud.create.mockResolvedValue({ id: 's1' });
  await solicitar('t1', user, ' Disponible ');
  expect(prisma.solicitud.create).toHaveBeenCalledWith({ data: { usuario_id: 'g1', tipo: TIPO_SOLICITUD.COBERTURA,
    vacante_turno_id: 't1', fecha_desde: turno.fecha, fecha_hasta: turno.fecha, motivo: 'Disponible', estado: ESTADO_SOLICITUD.PENDIENTE } });
});
test('rechaza vacante inexistente o ya cubierta', async () => {
  prisma.turno.findUnique.mockResolvedValueOnce(null).mockResolvedValueOnce({ ...turno, asistencias: [{ id: 'a1' }] });
  await expect(solicitar('t1', user)).rejects.toMatchObject({ statusCode: 404 });
  await expect(solicitar('t1', user)).rejects.toMatchObject({ statusCode: 409 });
});
test('rechaza solape y solicitudes duplicadas', async () => {
  verificarConflictos.mockResolvedValueOnce([turno]);
  await expect(solicitar('t1', user)).rejects.toMatchObject({ statusCode: 409 });
  prisma.solicitud.findFirst.mockResolvedValue({ id: 's1' });
  await expect(solicitar('t1', user)).rejects.toMatchObject({ statusCode: 409 });
  expect(prisma.solicitud.create).not.toHaveBeenCalled();
});
