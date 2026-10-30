jest.mock('../../config/database', () => ({ prisma: {
  solicitud: { findUniqueOrThrow: jest.fn(), update: jest.fn() },
  turno: { findUnique: jest.fn(), findMany: jest.fn(), update: jest.fn() },
  usuario: { findUnique: jest.fn() }, $transaction: jest.fn(),
} }));
jest.mock('../turnos.service', () => ({ verificarConflictos: jest.fn() }));
jest.mock('../supervisor.helper', () => ({ resolverInstalacionesSupervisor: jest.fn() }));
jest.mock('../../constants/cobertura', () => ({ ...jest.requireActual('../../constants/cobertura'), MAX_HORAS_SEMANALES: 24 }));
const { prisma } = require('../../config/database');
const politica = require('../../constants/cobertura');
const { verificarConflictos } = require('../turnos.service');
const { resolverInstalacionesSupervisor } = require('../supervisor.helper');
const { aprobarCobertura, validarHoras } = require('../cobertura.service');
const { aFechaDB, instanteChile } = require('../../utils/fechaChile');
const { ROLES } = require('../../constants/roles');
const { ESTADO_SOLICITUD, ESTADO_TURNO, ESTADO_USUARIO } = require('../../constants/estados');
const turno = { id: 't1', usuario_id: null, instalacion_id: 'i1', fecha: aFechaDB('2026-10-30'), hora_inicio: '08:00', hora_fin: '20:00',
  estado: ESTADO_TURNO.PROGRAMADO, asistencias: [], solicitudes_cobertura: [], instalacion: {},
};
beforeEach(() => {
  jest.resetAllMocks(); jest.useFakeTimers().setSystemTime(instanteChile('2026-10-30', '08:20'));
  politica.MAX_HORAS_SEMANALES = 24;
  prisma.$transaction.mockImplementation(fn => fn(prisma));
  prisma.solicitud.findUniqueOrThrow.mockResolvedValue({ id: 'sol1', usuario_id: 'g1', vacante_turno_id: 't1', estado: ESTADO_SOLICITUD.PENDIENTE });
  prisma.solicitud.update.mockResolvedValue({ id: 'sol1', estado: ESTADO_SOLICITUD.APROBADA });
  prisma.turno.findUnique.mockResolvedValue(turno); prisma.turno.findMany.mockResolvedValue([]);
  prisma.usuario.findUnique.mockImplementation(({ where }) => Promise.resolve({ id: where.id, estado: ESTADO_USUARIO.ACTIVO,
    rol: where.id === 's1' ? ROLES.SUPERVISOR : ROLES.GGSS_LIBRE }));
  verificarConflictos.mockResolvedValue([]); resolverInstalacionesSupervisor.mockResolvedValue(['i1']);
});
afterEach(() => jest.useRealTimers());
test('rechaza superposición sin asignar ni aprobar', async () => {
  verificarConflictos.mockResolvedValue([turno]);
  await expect(aprobarCobertura('sol1', 's1')).rejects.toMatchObject({ statusCode: 409 });
  expect(prisma.turno.update).not.toHaveBeenCalled(); expect(prisma.solicitud.update).not.toHaveBeenCalled();
});
test('rechaza exceso de horas planificadas semanales', async () => {
  prisma.turno.findMany.mockResolvedValue([ { ...turno, id: 'otro1', fecha: aFechaDB('2026-10-27') },
    { ...turno, id: 'otro2', fecha: aFechaDB('2026-10-28') } ]);
  await expect(aprobarCobertura('sol1', 's1')).rejects.toMatchObject({ statusCode: 409 });
  expect(prisma.solicitud.update).not.toHaveBeenCalled();
});
test('sin tope configurado no se aprueba cobertura', async () => {
  politica.MAX_HORAS_SEMANALES = null;
  await expect(aprobarCobertura('sol1', 's1')).rejects.toMatchObject({ statusCode: 503 });
});
test('permite el máximo exacto y guarda turno/solicitud en la misma transacción', async () => {
  politica.MAX_HORAS_SEMANALES = 12;
  await expect(aprobarCobertura('sol1', 's1', 'Confirmada')).resolves.toHaveProperty('estado', ESTADO_SOLICITUD.APROBADA);
  expect(prisma.$transaction).toHaveBeenCalledWith(expect.any(Function), { isolationLevel: 'Serializable' });
  expect(prisma.turno.update).toHaveBeenCalledWith({ where: { id: 't1', usuario_id: null, estado: ESTADO_TURNO.PROGRAMADO }, data: { usuario_id: 'g1' } });
});
test('no reasigna una vacante con cobertura aprobada aunque aún no haya marcaje', async () => {
  prisma.turno.findUnique.mockResolvedValue({ ...turno, solicitudes_cobertura: [{ id: 'otra' }] });
  await expect(aprobarCobertura('sol1', 's1')).rejects.toMatchObject({ statusCode: 409 });
});
test('supervisor de otra instalación recibe 403', async () => {
  resolverInstalacionesSupervisor.mockResolvedValue(['otra']);
  await expect(aprobarCobertura('sol1', 's1')).rejects.toMatchObject({ statusCode: 403 });
});
test('serialización concurrente fallida responde 409', async () => {
  prisma.$transaction.mockRejectedValue({ code: 'P2034' });
  await expect(aprobarCobertura('sol1', 's1')).rejects.toMatchObject({ statusCode: 409 });
});
test('horas se calculan con cambio horario chileno y se reparten entre semanas', async () => {
  politica.MAX_HORAS_SEMANALES = 11;
  await expect(validarHoras({ ...turno, fecha: aFechaDB('2026-09-05'), hora_inicio: '20:00', hora_fin: '08:00' }, 'g1', prisma)).resolves.toBeUndefined();
  politica.MAX_HORAS_SEMANALES = 8;
  await expect(validarHoras({ ...turno, fecha: aFechaDB('2026-10-25'), hora_inicio: '20:00', hora_fin: '08:00' }, 'g1', prisma)).resolves.toBeUndefined();
});
