const { Router } = require('express');
const { prisma } = require('../config/database');

const router = Router();
const ESPERA_BD_MS = 2000;

// Liveness: el proceso responde. No toca la base, para que un corte de la base
// no haga reiniciar el contenedor (lo usa el HEALTHCHECK del Dockerfile).
router.get('/', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Readiness: además comprueba que la base responda. Para alertas y monitoreo.
router.get('/ready', async (req, res) => {
  let timer;
  try {
    await Promise.race([
      prisma.$queryRaw`SELECT 1`,
      new Promise((_, rechazar) => { timer = setTimeout(() => rechazar(new Error('timeout')), ESPERA_BD_MS); }),
    ]);
    res.json({ status: 'ok', db: 'ok', timestamp: new Date().toISOString() });
  } catch (_) {
    res.status(503).json({ status: 'degradado', db: 'error', timestamp: new Date().toISOString() });
  } finally {
    clearTimeout(timer);
  }
});

module.exports = router;
