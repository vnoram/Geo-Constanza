jest.mock('../../config/database', () => ({ prisma: { $queryRaw: jest.fn() } }));
const express = require('express');
const request = require('supertest');
const { prisma } = require('../../config/database');

const app = express();
app.use('/health', require('../../routes/health.routes'));

beforeEach(() => jest.resetAllMocks());

test('liveness responde ok sin consultar la base', async () => {
  const res = await request(app).get('/health');
  expect(res.status).toBe(200);
  expect(res.body.status).toBe('ok');
  expect(prisma.$queryRaw).not.toHaveBeenCalled();
});
test('readiness responde ok cuando la base contesta', async () => {
  prisma.$queryRaw.mockResolvedValue([{ '?column?': 1 }]);
  const res = await request(app).get('/health/ready');
  expect(res.status).toBe(200);
  expect(res.body).toMatchObject({ status: 'ok', db: 'ok' });
});
test('readiness responde 503 cuando la base falla', async () => {
  prisma.$queryRaw.mockRejectedValue(new Error('conexión rechazada'));
  const res = await request(app).get('/health/ready');
  expect(res.status).toBe(503);
  expect(res.body).toMatchObject({ status: 'degradado', db: 'error' });
});
