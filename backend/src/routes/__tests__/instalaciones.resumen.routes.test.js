jest.mock('../../middlewares/auth', () => ({
  authenticate: (req, _res, next) => { req.user = JSON.parse(req.get('x-test-user')); next(); },
}));
jest.mock('../../services/instalaciones.service', () => ({ resumen: jest.fn().mockResolvedValue({ instalacion: { id: 'i1' } }), estadoMapa: jest.fn().mockResolvedValue({ i1: { novedades: { total: 1, rojo: 1, amarillo: 0, verde: 0 }, sin_marcar: 0 } }) }));
jest.mock('../../middlewares/auditLog', () => ({ registrarAuditoria: jest.fn() }));
jest.mock('../../config/database', () => ({ prismaGlobal: {}, prisma: {} }));

const express = require('express');
const request = require('supertest');
const { ROLES } = require('../../constants/roles');
const { errorHandler } = require('../../middlewares/errorHandler');
const { resumen } = require('../../services/instalaciones.service');

const app = express();
app.use('/instalaciones', require('../instalaciones.routes'));
app.use(errorHandler);
const como = (user) => ({ 'x-test-user': JSON.stringify(user) });

test.each([ROLES.OPERADOR_CENTRAL, ROLES.SUPERVISOR, ROLES.ADMINISTRADOR])('%s puede ver la ficha', async (rol) => {
  const res = await request(app).get('/instalaciones/i1/resumen').set(como({ id: 'u', rol, empresaId: 'e1' }));
  expect(res.status).toBe(200);
  expect(res.body.data).toEqual({ instalacion: { id: 'i1' } });
  expect(resumen).toHaveBeenLastCalledWith('i1', expect.objectContaining({ rol, empresaId: 'e1' }));
});

test('un guardia no puede', async () => {
  const res = await request(app).get('/instalaciones/i1/resumen').set(como({ id: 'g', rol: ROLES.GGSS, empresaId: 'e1' }));
  expect(res.status).toBe(403);
});

test('estado-mapa responde a central y no se confunde con :id', async () => {
  const res = await request(app).get('/instalaciones/estado-mapa').set(como({ id: 'c', rol: ROLES.OPERADOR_CENTRAL, empresaId: 'e1' }));
  expect(res.status).toBe(200);
  expect(res.body.data.i1.novedades.rojo).toBe(1);
});

test('un guardia no puede ver estado-mapa', async () => {
  const res = await request(app).get('/instalaciones/estado-mapa').set(como({ id: 'g', rol: ROLES.GGSS, empresaId: 'e1' }));
  expect(res.status).toBe(403);
});
