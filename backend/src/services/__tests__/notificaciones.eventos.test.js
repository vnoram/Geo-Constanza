jest.mock('../../config/database', () => ({ prisma: { solicitud: { findUniqueOrThrow: jest.fn(), update: jest.fn() } } }));
jest.mock('../notificacion.service', () => ({ enviarNotificacion: jest.fn() }));
const { prisma } = require('../../config/database');
const { enviarNotificacion } = require('../notificacion.service');
const { aprobar, rechazar } = require('../solicitudes.service');
const { ESTADO_SOLICITUD } = require('../../constants/estados');
const { TIPO_SOLICITUD } = require('../../constants/solicitudes');
beforeEach(() => {
  jest.clearAllMocks();
  prisma.solicitud.findUniqueOrThrow.mockResolvedValue({ id: 's1', usuario_id: 'g1', tipo: TIPO_SOLICITUD.TURNO, estado: ESTADO_SOLICITUD.PENDIENTE });
  prisma.solicitud.update.mockResolvedValue({ id: 's1' });
});
test.each([
  ['aprobar', () => aprobar('s1', 'sup', 'Aceptada')],
  ['rechazar', () => rechazar('s1', 'Sin cupo', 'sup')],
])('%s cobertura notifica al solicitante solo tras guardar', async (_accion, ejecutar) => {
  await ejecutar();
  expect(enviarNotificacion).toHaveBeenCalledTimes(1);
  expect(enviarNotificacion.mock.calls[0][0]).toBe('g1');
  expect(prisma.solicitud.update.mock.invocationCallOrder[0]).toBeLessThan(enviarNotificacion.mock.invocationCallOrder[0]);
});
test('no notifica una revisión rechazada', async () => {
  prisma.solicitud.update.mockRejectedValue(new Error('Fallo de persistencia'));
  await expect(aprobar('s1', 'sup')).rejects.toThrow();
  expect(enviarNotificacion).not.toHaveBeenCalled();
});
