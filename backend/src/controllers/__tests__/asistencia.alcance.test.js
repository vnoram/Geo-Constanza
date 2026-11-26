// Alcance del supervisor en las consultas de asistencia (hoy por instalación e historial por usuario).
jest.mock('../../config/database', () => ({ prisma: {
  instalacion: { findUnique: jest.fn() },
  usuario: { findUnique: jest.fn() },
} }));
jest.mock('../../services/asistencia.service', () => ({ obtenerHoy: jest.fn(), obtenerHistorial: jest.fn() }));
jest.mock('../../services/supervisor.helper', () => ({
  exigirAlcanceInstalacion: jest.fn(),
  resolverInstalacionesSupervisor: jest.fn(),
}));
jest.mock('../../services/dispositivos.service', () => ({ habilitada: () => false }));

const { prisma } = require('../../config/database');
const asistenciaService = require('../../services/asistencia.service');
const { exigirAlcanceInstalacion, resolverInstalacionesSupervisor } = require('../../services/supervisor.helper');
const ctrl = require('../asistencia.controller');

const supervisor = { id: 'sup', rol: 'supervisor' };
const central = { id: 'cen', rol: 'central' };
const res = () => ({ json: jest.fn(), status: jest.fn().mockReturnThis() });

beforeEach(() => {
  jest.resetAllMocks();
  prisma.instalacion.findUnique.mockResolvedValue({ id: 'B' });
  prisma.usuario.findUnique.mockResolvedValue({ id: 'g' });
  asistenciaService.obtenerHoy.mockResolvedValue([]);
  asistenciaService.obtenerHistorial.mockResolvedValue({ data: [] });
});

test('hoy: supervisor sin cobertura de la instalación recibe 403 y no se consulta la asistencia', async () => {
  exigirAlcanceInstalacion.mockRejectedValue(Object.assign(new Error('No tienes acceso a esta instalación'), { statusCode: 403 }));
  const next = jest.fn();
  await ctrl.obtenerHoy({ params: { instalacionId: 'B' }, user: supervisor }, res(), next);
  expect(exigirAlcanceInstalacion).toHaveBeenCalledWith(supervisor, 'B');
  expect(next.mock.calls[0][0]).toMatchObject({ statusCode: 403 });
  expect(asistenciaService.obtenerHoy).not.toHaveBeenCalled();
});

test('hoy: supervisor con cobertura ve la asistencia', async () => {
  exigirAlcanceInstalacion.mockResolvedValue();
  const r = res();
  await ctrl.obtenerHoy({ params: { instalacionId: 'A' }, user: supervisor }, r, jest.fn());
  expect(asistenciaService.obtenerHoy).toHaveBeenCalledWith('A');
  expect(r.json).toHaveBeenCalled();
});

test('hoy: central no pasa por el alcance de supervisor, pero una instalación inexistente sigue siendo 404', async () => {
  prisma.instalacion.findUnique.mockResolvedValue(null);
  const next = jest.fn();
  await ctrl.obtenerHoy({ params: { instalacionId: 'X' }, user: central }, res(), next);
  expect(exigirAlcanceInstalacion).not.toHaveBeenCalled();
  expect(next.mock.calls[0][0]).toMatchObject({ statusCode: 404 });
});

test('historial: al supervisor se le filtra por sus instalaciones', async () => {
  resolverInstalacionesSupervisor.mockResolvedValue(['A']);
  await ctrl.obtenerHistorial({ params: { usuarioId: 'g' }, query: {}, user: supervisor }, res(), jest.fn());
  expect(asistenciaService.obtenerHistorial).toHaveBeenCalledWith('g', {}, { instalacionIds: ['A'] });
});

test('historial: central consulta sin filtro de instalaciones', async () => {
  await ctrl.obtenerHistorial({ params: { usuarioId: 'g' }, query: {}, user: central }, res(), jest.fn());
  expect(resolverInstalacionesSupervisor).not.toHaveBeenCalled();
  expect(asistenciaService.obtenerHistorial).toHaveBeenCalledWith('g', {}, {});
});
