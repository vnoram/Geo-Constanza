require('dotenv').config();

// Validar variables críticas antes de cargar cualquier módulo
const REQUIRED_ENV = ['JWT_ACCESS_SECRET', 'JWT_REFRESH_SECRET', 'DATABASE_URL', 'FRONTEND_URL'];
for (const key of REQUIRED_ENV) {
  if (!process.env[key]) {
    console.error(`=== STARTUP ERROR: La variable de entorno "${key}" no está definida. El servidor no puede iniciar. ===`);
    process.exit(1);
  }
}

process.on('uncaughtException', (err) => {
  console.error('=== UNCAUGHT EXCEPTION ===');
  console.error(err.message);
  console.error(err.stack);
  process.exit(1);
});
process.on('unhandledRejection', (reason) => {
  console.error('=== UNHANDLED REJECTION ===');
  console.error(reason);
  process.exit(1);
});

const app = require('./app');
const { createServer } = require('http');
const { initSocket } = require('./socket/socketManager');
const { logger } = require('./config/logger');
const { connectRedis } = require('./config/redis');

const PORT = process.env.PORT || 3005;

const httpServer = createServer(app);

initSocket(httpServer);
try { connectRedis(); } catch (err) { logger.warn(`Redis no disponible al iniciar: ${err.message}`); }

httpServer.listen(PORT, '0.0.0.0', () => {
  logger.info(`Servidor Geo Constanza corriendo en puerto ${PORT}`);
  logger.info(`Entorno: ${process.env.NODE_ENV || 'development'}`);
});

httpServer.on('error', (err) => {
  console.error('>>> Error al iniciar servidor:', err.message);
  if (err.code === 'EADDRINUSE') {
    logger.error(`Puerto ${PORT} ocupado.`);
    process.exit(1);
  } else {
    throw err;
  }
});

module.exports = httpServer;
