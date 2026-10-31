jest.mock('../../config/database', () => ({ prisma: { usuario: { update: jest.fn(), findUnique: jest.fn() } } }));
jest.mock('../../config/firebase', () => ({ initFirebase: jest.fn() }));
jest.mock('../../config/logger', () => ({ logger: { warn: jest.fn() } }));
const { prisma } = require('../../config/database');
const { initFirebase } = require('../../config/firebase');
const { registrarToken, enviarNotificacion } = require('../notificacion.service');
const { registrarDispositivo } = require('../../controllers/notificacion.controller');
const { ESTADO_USUARIO } = require('../../constants/estados');
const send = jest.fn();
beforeEach(() => {
  jest.resetAllMocks();
  initFirebase.mockReturnValue({ messaging: () => ({ send }) });
  prisma.usuario.findUnique.mockResolvedValue({ fcm_token: 'dispositivo-simulado', estado: ESTADO_USUARIO.ACTIVO });
});
test('registra solo el token del usuario autenticado', async () => {
  const res = { json: jest.fn() }, next = jest.fn();
  await registrarDispositivo({ user: { id: 'u1' }, body: { usuario_id: 'otro', token: ' dispositivo-simulado ' } }, res, next);
  expect(next).not.toHaveBeenCalled();
  expect(prisma.usuario.update).toHaveBeenCalledWith({ where: { id: 'u1' }, data: { fcm_token: 'dispositivo-simulado' } });
  expect(res.json).toHaveBeenCalledWith({ registrado: true });
});
test.each([null, 123, '', ' ', 'a'.repeat(4097)])('rechaza token inválido', async token => {
  await expect(registrarToken('u1', token)).rejects.toMatchObject({ statusCode: 400 });
});
test('envía notificación y datos FCM', async () => {
  await expect(enviarNotificacion('u1', 'Título', 'Mensaje', { numero: 42 })).resolves.toBe(true);
  expect(send).toHaveBeenCalledWith({ token: 'dispositivo-simulado', notification: { title: 'Título', body: 'Mensaje' }, data: { numero: '42' } });
});
test('sin credenciales degrada sin consultar la base ni enviar', async () => {
  initFirebase.mockReturnValue(null);
  await expect(enviarNotificacion('u1', 'Título', 'Mensaje')).resolves.toBe(false);
  expect(prisma.usuario.findUnique).not.toHaveBeenCalled(); expect(send).not.toHaveBeenCalled();
});
test('fallo de Firebase no rompe la operación', async () => {
  send.mockRejectedValue(new Error('Fallo simulado'));
  await expect(enviarNotificacion('u1', 'Título', 'Mensaje')).resolves.toBe(false);
});
test('no envía a usuarios sin token o inactivos', async () => {
  prisma.usuario.findUnique.mockResolvedValueOnce(null).mockResolvedValueOnce({ fcm_token: 'simulado', estado: ESTADO_USUARIO.INACTIVO });
  await enviarNotificacion('u1', 'Título', 'Mensaje'); await enviarNotificacion('u2', 'Título', 'Mensaje');
  expect(send).not.toHaveBeenCalled();
});
