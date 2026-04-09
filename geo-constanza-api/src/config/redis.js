const Redis = require('ioredis');
const { logger } = require('./logger');

let redis;

const connectRedis = () => {
  const redisUrl = new URL(process.env.REDIS_URL || 'redis://localhost:6379');
  const useTLS = redisUrl.protocol === 'rediss:';

  redis = new Redis({
    host: redisUrl.hostname,
    port: Number(redisUrl.port) || 6379,
    username: redisUrl.username || 'default',
    password: decodeURIComponent(redisUrl.password),
    ...(useTLS && {
      tls: { rejectUnauthorized: false, servername: redisUrl.hostname },
    }),
    maxRetriesPerRequest: 3,
    enableReadyCheck: true,
    lazyConnect: false,
  });

  redis.on('connect', () => logger.info('Redis conectado'));
  redis.on('ready',   () => logger.info(`Redis listo (TLS: ${useTLS})`));
  redis.on('error',   (err) => logger.error(`Error Redis: ${err.message}`));

  return redis;
};

const getRedis = () => redis;

module.exports = { connectRedis, getRedis };
