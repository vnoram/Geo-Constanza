jest.mock('../../config/database', () => ({ prisma: {
  asistencia: { findUniqueOrThrow: jest.fn(), updateMany: jest.fn() },
} }));
jest.mock('../../middlewares/auditLog', () => ({ registrarAuditoria: jest.fn() }));
jest.mock('../notificacion.service', () => ({ enviarNotificacion: jest.fn() }));
jest.mock('../supervisor.helper', () => ({ exigirAlcanceInstalacion: jest.fn() }));
jest.mock('../dispositivos.service', () => ({ habilitada: jest.fn() }));
jest.mock('../../socket/socketManager', () => ({ getSocketIO: jest.fn() }));
const { prisma } = require('../../config/database');
const { registrarAuditoria } = require('../../middlewares/auditLog');
const { habilitada } = require('../dispositivos.service');
const { getSocketIO } = require('../../socket/socketManager');
const { solicitarNuevaRevision } = require('../revisionMarcajes.service');

const rechazada = { id: 'a1', usuario_id: 'g1', instalacion_id: 'i1', hora_salida: null, revision_estado: 'rechazado', comentario_revision: 'tardanza', verificacion_gps: 'por_revisar' };
const guardia = { id: 'g1' };
const emit = jest.fn();

beforeEach(() => {
  jest.resetAllMocks();
  habilitada.mockReturnValue(true);
  getSocketIO.mockReturnValue({ to: () => ({ emit }) });
  prisma.asistencia.findUniqueOrThrow.mockResolvedValue(rechazada);
  prisma.asistencia.updateMany.mockResolvedValue({ count: 1 });
});

test('el guardia reenvía su marcaje rechazado con una explicación: vuelve a quedar pendiente y se audita', async () => {
  await solicitarNuevaRevision('a1', { comentario: '  Estoy en la instalación, el PC no tiene GPS  ' }, guardia, {});
  const { where, data } = prisma.asistencia.updateMany.mock.calls[0][0];
  expect(where).toMatchObject({ id: 'a1', revision_estado: 'rechazado', hora_salida: null });
  expect(data).toEqual({ revision_estado: null, comentario_revision: null, comentario_guardia: 'Estoy en la instalación, el PC no tiene GPS' });
  expect(registrarAuditoria.mock.calls[0][0]).toMatchObject({ accion: 'reenviar_marcaje', valoresAntes: { revision_estado: 'rechazado', comentario_revision: 'tardanza' } });
  expect(emit).toHaveBeenCalledWith('guardia:marcaje_por_revisar', expect.objectContaining({ instalacion: 'i1' }));
});

test('exige una explicación', async () => {
  await expect(solicitarNuevaRevision('a1', { comentario: '   ' }, guardia, {})).rejects.toMatchObject({ statusCode: 400 });
  expect(prisma.asistencia.updateMany).not.toHaveBeenCalled();
});

test('solo el dueño, solo marcajes rechazados y solo con el turno abierto', async () => {
  await expect(solicitarNuevaRevision('a1', { comentario: 'explicación' }, { id: 'otro' }, {})).rejects.toMatchObject({ statusCode: 403 });
  prisma.asistencia.findUniqueOrThrow.mockResolvedValue({ ...rechazada, revision_estado: null });
  await expect(solicitarNuevaRevision('a1', { comentario: 'explicación' }, guardia, {})).rejects.toMatchObject({ statusCode: 400 });
  prisma.asistencia.findUniqueOrThrow.mockResolvedValue({ ...rechazada, hora_salida: new Date() });
  await expect(solicitarNuevaRevision('a1', { comentario: 'explicación' }, guardia, {})).rejects.toMatchObject({ statusCode: 400 });
});

test('si el marcaje cambió mientras tanto responde 409', async () => {
  prisma.asistencia.updateMany.mockResolvedValue({ count: 0 });
  await expect(solicitarNuevaRevision('a1', { comentario: 'explicación' }, guardia, {})).rejects.toMatchObject({ statusCode: 409 });
});

test('responde 404 si la revisión de marcajes está apagada', async () => {
  habilitada.mockReturnValue(false);
  await expect(solicitarNuevaRevision('a1', { comentario: 'explicación' }, guardia, {})).rejects.toMatchObject({ statusCode: 404 });
});
