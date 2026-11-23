jest.mock('../../middlewares/auth', () => ({
  authenticate: (req, _res, next) => { req.user = JSON.parse(req.get('x-test-user')); next(); },
}));
jest.mock('../../services/alertasGuardia.service', () => ({ listarMias: jest.fn().mockResolvedValue([{ id: 'x' }]) }));
jest.mock('../../config/database', () => ({ prismaGlobal: {}, prisma: {} }));

const express = require('express');
const request = require('supertest');
const { ROLES } = require('../../constants/roles');
const { errorHandler } = require('../../middlewares/errorHandler');
const { listarMias } = require('../../services/alertasGuardia.service');

const app = express();
app.use('/alertas', require('../alertas.routes'));
app.use(errorHandler);
const como = (user) => ({ 'x-test-user': JSON.stringify(user) });

test('un guardia obtiene sus alertas', async () => {
  const res = await request(app).get('/alertas/mias').set(como({ id: 'g1', rol: ROLES.GGSS, empresaId: 'e1' }));
  expect(res.status).toBe(200);
  expect(res.body.data).toEqual([{ id: 'x' }]);
  expect(listarMias).toHaveBeenCalledWith(expect.objectContaining({ id: 'g1', empresaId: 'e1' }));
});

test.each([ROLES.SUPERVISOR, ROLES.ADMINISTRADOR, ROLES.OPERADOR_CENTRAL])('%s no puede usar la ruta del guardia', async (rol) => {
  const res = await request(app).get('/alertas/mias').set(como({ id: 'u', rol, empresaId: 'e1' }));
  expect(res.status).toBe(403);
});

test('el super admin (sin empresa) no entra', async () => {
  const res = await request(app).get('/alertas/mias').set(como({ id: 'sa', rol: ROLES.SUPER_ADMIN, empresaId: null }));
  expect([401, 403]).toContain(res.status);
});
