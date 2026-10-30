jest.mock('../../config/database', () => ({ prisma: {
  novedad: { findUnique: jest.fn(), update: jest.fn() },
  usuario: { findUnique: jest.fn(), findMany: jest.fn() },
  novedadHistorial: { create: jest.fn() }, $transaction: jest.fn(),
} }));
jest.mock('../supervisor.helper', () => ({ resolverInstalacionesSupervisor: jest.fn() }));
jest.mock('../../utils/azureStorage', () => ({ generarUrlLectura: jest.fn() }));
jest.mock('../../socket/socketManager', () => ({ getSocketIO: jest.fn() }));
jest.mock('../notificacion.service', () => ({ enviarNotificacion: jest.fn() }));
const { enviarNotificacion } = require('../notificacion.service');
const { prisma } = require('../../config/database');
const { ROLES } = require('../../constants/roles');
const { ESTADO_NOVEDAD, ESTADO_USUARIO } = require('../../constants/estados');
const { asignar, escalar, responsables } = require('../novedades.service');
const { resolverInstalacionesSupervisor } = require('../supervisor.helper');
const { getSocketIO } = require('../../socket/socketManager');
const actor = { id: 's1', rol: ROLES.SUPERVISOR };
const emit = jest.fn();
const to = jest.fn(() => ({ emit }));
beforeEach(() => {
  jest.clearAllMocks();
  prisma.$transaction.mockImplementation(fn => fn(prisma));
  prisma.novedad.findUnique.mockResolvedValue({ id: 'n1', instalacion_id: 'i1', estado: ESTADO_NOVEDAD.ABIERTA });
  resolverInstalacionesSupervisor.mockResolvedValue(['i1']);
  prisma.usuario.findUnique.mockResolvedValue({ id: 'r1', rol: ROLES.SUPERVISOR, estado: ESTADO_USUARIO.ACTIVO });
  prisma.novedad.update.mockResolvedValue({ id: 'n1', instalacion_id: 'i1', estado: ESTADO_NOVEDAD.EN_ATENCION });
  getSocketIO.mockReturnValue({ to });
});
test.each([ROLES.SUPERVISOR, ROLES.OPERADOR_CENTRAL, ROLES.ADMINISTRADOR])('asignar permite actor %s y emite solo a instalación', async (rol) => {
  await asignar('n1', 'r1', { id: 's1', rol });
  expect(prisma.novedad.update).toHaveBeenCalledWith(expect.objectContaining({
    where: { id: 'n1', estado: ESTADO_NOVEDAD.ABIERTA },
    data: { asignada_a: 'r1', estado: ESTADO_NOVEDAD.EN_ATENCION },
  }));
  expect(to).toHaveBeenCalledWith('instalacion:i1');
  expect(emit).toHaveBeenCalledTimes(1);
  expect(enviarNotificacion).toHaveBeenCalledWith('r1', expect.any(String), expect.any(String), { novedad_id: 'n1' });
});
test('supervisor ajeno recibe 403', async () => {
  resolverInstalacionesSupervisor.mockResolvedValue(['otra']);
  await expect(asignar('n1', 'r1', actor)).rejects.toMatchObject({ statusCode: 403 });
  expect(prisma.novedad.update).not.toHaveBeenCalled();
});
test.each([null, { rol: ROLES.GGSS_LIBRE, estado: ESTADO_USUARIO.ACTIVO },
  { rol: ROLES.SUPERVISOR, estado: ESTADO_USUARIO.INACTIVO }])('responsable inválido %p devuelve 400', async (perfil) => {
  prisma.usuario.findUnique.mockResolvedValue(perfil);
  await expect(asignar('n1', 'r1', actor)).rejects.toMatchObject({ statusCode: 400 });
  expect(prisma.novedad.update).not.toHaveBeenCalled();
});
test('admite central activo como responsable', async () => {
  prisma.usuario.findUnique.mockResolvedValue({ id: 'r1', rol: ROLES.OPERADOR_CENTRAL, estado: ESTADO_USUARIO.ACTIVO });
  await expect(asignar('n1', 'r1', actor)).resolves.toHaveProperty('id', 'n1');
});
test('asignar en estado distinto de abierta devuelve 409', async () => {
  prisma.novedad.update.mockRejectedValueOnce({ code: 'P2025' });
  await expect(asignar('n1', 'r1', actor)).rejects.toMatchObject({ statusCode: 409 });
  expect(emit).not.toHaveBeenCalled();
});
test('escalar admite en atención', async () => {
  prisma.novedad.findUnique.mockResolvedValue({ id: 'n1', instalacion_id: 'i1', estado: ESTADO_NOVEDAD.EN_ATENCION });
  await escalar('n1', actor);
  expect(prisma.novedad.update.mock.calls[0][0].where.estado).toBe(ESTADO_NOVEDAD.EN_ATENCION);
});
test('candidatos expone solo id/nombre de supervisores y centrales activos', async () => {
  prisma.usuario.findMany.mockResolvedValue([]);
  await responsables('n1', actor);
  expect(prisma.usuario.findMany).toHaveBeenCalledWith(expect.objectContaining({
    select: { id: true, nombre: true },
    where: { rol: { in: [ROLES.SUPERVISOR, ROLES.OPERADOR_CENTRAL] }, estado: ESTADO_USUARIO.ACTIVO },
  }));
});
