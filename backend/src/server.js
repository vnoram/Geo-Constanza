require('dotenv').config();

const app = require('./app');
const { createServer } = require('http');
const { initSocket } = require('./socket/socketManager');
const { logger } = require('./config/logger');
const { connectRedis } = require('./config/redis');

const PORT = process.env.PORT || 3005;

const httpServer = createServer(app);

// Inicializar Socket.IO
initSocket(httpServer);

// Conectar Redis
connectRedis();

httpServer.listen(PORT, () => {
  logger.info(`Servidor Geo Constanza corriendo en puerto ${PORT}`);
  logger.info(`Entorno: ${process.env.NODE_ENV || 'development'}`);
});

httpServer.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    logger.error(`Puerto ${PORT} ocupado. Cambia PORT en .env o libera el puerto.`);
    process.exit(1);
  } else {
    throw err;
  }
});

module.exports = httpServer;
