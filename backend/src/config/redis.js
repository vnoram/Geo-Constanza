const Redis = require('ioredis');
const { logger } = require('./logger');

let redis;
let _errorLogged = false;

const connectRedis = () => {
  const redisUrl = new URL(process.env.REDIS_URL || 'redis://localhost:6379');
  const useTLS = redisUrl.protocol === 'rediss:';

  redis = new Redis({
    host: redisUrl.hostname,
    port: Number(redisUrl.port) || 6379,
    ...(redisUrl.password && { password: decodeURIComponent(redisUrl.password) }),
    ...(redisUrl.username && redisUrl.password && { username: redisUrl.username }),
    ...(useTLS && {
      tls: { rejectUnauthorized: false, servername: redisUrl.hostname },
    }),
    maxRetriesPerRequest: null,
    enableReadyCheck: true,
    lazyConnect: false,
    retryStrategy: (times) => {
      if (times >= 3) {
        logger.warn('Redis no disponible. El sistema continúa sin caché de tokens ni blacklist.');
        return null; // detiene reintentos permanentemente
      }
      return 500; // espera 500ms entre intentos
    },
  });

  redis.on('connect', () => { _errorLogged = false; logger.info('Redis conectado'); });
  redis.on('ready',   () => logger.info(`Redis listo (TLS: ${useTLS})`));
  redis.on('error',   (err) => {
    if (!_errorLogged) {
      logger.error(`Error Redis: ${err.message}`);
      _errorLogged = true;
    }
  });

  return redis;
};

const getRedis = () => (redis && redis.status === 'ready' ? redis : null);

module.exports = { connectRedis, getRedis };
