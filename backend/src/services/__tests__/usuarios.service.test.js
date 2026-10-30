jest.mock('../../config/database', () => ({ prisma: {
  usuario: { findUniqueOrThrow: jest.fn(), findMany: jest.fn(), count: jest.fn(), create: jest.fn(), update: jest.fn() },
  supervisor_Instalacion: { createMany: jest.fn(), deleteMany: jest.fn() }, $transaction: jest.fn(),
} }));
jest.mock('bcryptjs', () => ({ hash: jest.fn() }));
const { prisma } = require('../../config/database');
const bcrypt = require('bcryptjs');
const service = require('../usuarios.service');
const { ROLES } = require('../../constants/roles');
const { ESTADO_USUARIO } = require('../../constants/estados');
const datos = { nombre: 'Prueba', rut: 'rut-prueba', email: 'prueba@example.invalid', rol: ROLES.GGSS_LIBRE, password: 'entrada-simulada' };
beforeEach(() => {
  jest.resetAllMocks(); prisma.$transaction.mockImplementation(fn => fn(prisma));
  bcrypt.hash.mockResolvedValue('hash-simulado');
  prisma.usuario.create.mockResolvedValue({ id: 'u1', rol: ROLES.GGSS_LIBRE });
  prisma.usuario.update.mockResolvedValue({ id: 'u1', rol: ROLES.SUPERVISOR });
  prisma.usuario.findMany.mockResolvedValue([{ id: 'u1' }]); prisma.usuario.count.mockResolvedValue(1);
});
test('perfil propio selecciona datos públicos sin hash, token FCM ni secreto 2FA', async () => {
  await service.miInformacion('u1');
  const consulta = prisma.usuario.findUniqueOrThrow.mock.calls[0][0];
  expect(consulta.where).toEqual({ id: 'u1' });
  expect(consulta.select.password_hash).toBeUndefined(); expect(consulta.select.fcm_token).toBeUndefined(); expect(consulta.select.two_factor_secret).toBeUndefined();
});
test('listado paginado usa filtros de rol/estado y no selecciona credenciales', async () => {
  await expect(service.listar({ rol: ROLES.GGSS_LIBRE, estado: ESTADO_USUARIO.ACTIVO, page: 2, limit: 10 })).resolves.toMatchObject({ total: 1, page: 2 });
  expect(prisma.usuario.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { rol: ROLES.GGSS_LIBRE, estado: ESTADO_USUARIO.ACTIVO }, skip: 10, take: 10 }));
  await service.listar({ page: 1, limit: 20 });
  expect(prisma.usuario.findMany.mock.calls[1][0].where).toEqual({});
});
test.each(Object.values(ROLES))('crea rol válido %s usando bcrypt sin persistir password plano', async rol => {
  await service.crear({ ...datos, rol });
  expect(bcrypt.hash).toHaveBeenCalledWith('entrada-simulada', 12);
  const consulta = prisma.usuario.create.mock.calls[0][0];
  expect(consulta.data.password).toBeUndefined(); expect(consulta.data.password_hash).toBe('hash-simulado');
});
test('crear supervisor guarda comunas válidas y asignaciones sin duplicados', async () => {
  await service.crear({ ...datos, rol: ROLES.SUPERVISOR, comunas: ['Santiago', '', 3], instalacionIds: ['i1'] });
  expect(prisma.usuario.create.mock.calls[0][0].data.comunas_cobertura).toEqual(['Santiago']);
  expect(prisma.supervisor_Instalacion.createMany).toHaveBeenCalledWith({ data: [{ supervisor_id: 'u1', instalacion_id: 'i1' }], skipDuplicates: true });
});
test.each(['desconocido', null, undefined])('crear rechaza rol inválido %p', async rol => {
  await expect(service.crear({ ...datos, rol })).rejects.toMatchObject({ statusCode: 400 });
  expect(prisma.usuario.create).not.toHaveBeenCalled();
});
test('edita contraseña y sincroniza asignaciones del supervisor', async () => {
  await service.editar('u1', { password: 'otra-entrada-simulada', comunas: ['Santiago', ''], instalacionIds: ['i2'] });
  expect(prisma.usuario.update.mock.calls[0][0].data).toEqual({ password_hash: 'hash-simulado', comunas_cobertura: ['Santiago'] });
  expect(prisma.supervisor_Instalacion.deleteMany).toHaveBeenCalledWith({ where: { supervisor_id: 'u1' } });
  expect(prisma.supervisor_Instalacion.createMany).toHaveBeenCalledWith({ data: [{ supervisor_id: 'u1', instalacion_id: 'i2' }], skipDuplicates: true });
});
test('edita campos públicos sin contraseña y permite limpiar asignaciones', async () => {
  await service.editar('u1', { nombre: 'Otro', instalacionIds: [] });
  expect(bcrypt.hash).not.toHaveBeenCalled(); expect(prisma.supervisor_Instalacion.createMany).not.toHaveBeenCalled();
  expect(prisma.usuario.update.mock.calls[0][0].data).toEqual({ nombre: 'Otro' });
});
test('editar otro rol no crea asignaciones y rechaza roles inválidos', async () => {
  await service.editar('u1', { rol: ROLES.GGSS_LIBRE, instalacionIds: ['i1'] });
  expect(prisma.supervisor_Instalacion.deleteMany).not.toHaveBeenCalled();
  await expect(service.editar('u1', { rol: 'desconocido' })).rejects.toMatchObject({ statusCode: 400 });
});
test('desactivación es lógica y su respuesta no expone credenciales', async () => {
  await service.desactivar('u1');
  expect(prisma.usuario.update).toHaveBeenCalledWith({ where: { id: 'u1' }, data: { estado: ESTADO_USUARIO.INACTIVO },
    select: { id: true, nombre: true, email: true, rol: true, estado: true } });
});
