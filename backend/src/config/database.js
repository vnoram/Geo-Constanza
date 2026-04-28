const { Pool } = require('pg');
const { PrismaPg } = require('@prisma/adapter-pg');
const { PrismaClient } = require('@prisma/client');

const isProd = process.env.NODE_ENV === 'production';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: isProd ? 15 : 5,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
  keepAlive: true,
  keepAliveInitialDelayMillis: 10000,
  ssl: isProd ? { rejectUnauthorized: false } : false,
});

// Reconectar automáticamente si la conexión se cae
pool.on('error', (err) => {
  console.error('[DB] Error inesperado en cliente del pool:', err.message);
});

const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

module.exports = { prisma };
