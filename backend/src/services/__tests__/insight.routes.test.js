// Ruta GET /dashboard/insight: validación del parámetro y permisos por rol.

const mockUser = { current: { id: 'u1', rol: 'supervisor' } };

jest.mock('../../middlewares/auth', () => ({
  authenticate: (req, _res, next) => { req.user = mockUser.current; next(); },
}));
jest.mock('../insight.service', () => ({ getInsight: jest.fn().mockResolvedValue({ ok: true }) }));
jest.mock('../../config/database', () => ({ prisma: {} }));
jest.mock('../dashboard.service', () => ({ getDashboardHoy: jest.fn(), getEstadoSupervisores: jest.fn() }));

const express = require('express');
const request = require('supertest');
const { getInsight } = require('../insight.service');
const router = require('../../routes/dashboard.routes');

const app = express();
app.use('/api/v1/dashboard', router);
app.use((err, _req, res, _next) => res.status(err.statusCode || 500).json({ error: err.message }));

describe('GET /dashboard/insight', () => {
  beforeEach(() => { getInsight.mockClear(); mockUser.current = { id: 'u1', rol: 'supervisor' }; });

  test('usa 30 días por defecto', async () => {
    const res = await request(app).get('/api/v1/dashboard/insight');
    expect(res.status).toBe(200);
    expect(getInsight).toHaveBeenCalledWith(expect.objectContaining({ rol: 'supervisor' }), { dias: 30 });
  });

  test.each(['3', '91', 'abc', '10.5'])('rechaza dias=%s', async (dias) => {
    const res = await request(app).get(`/api/v1/dashboard/insight?dias=${dias}`);
    expect(res.status).toBe(400);
    expect(getInsight).not.toHaveBeenCalled();
  });

  test.each(['central', 'admin'])('permite el rol %s', async (rol) => {
    mockUser.current = { id: 'u2', rol };
    const res = await request(app).get('/api/v1/dashboard/insight?dias=7');
    expect(res.status).toBe(200);
  });

  test.each(['pauta', 'libre'])('niega el rol %s', async (rol) => {
    mockUser.current = { id: 'u3', rol };
    const res = await request(app).get('/api/v1/dashboard/insight');
    expect(res.status).toBe(403);
    expect(getInsight).not.toHaveBeenCalled();
  });
});
