const { Pool } = require('pg');
const { PrismaPg } = require('@prisma/adapter-pg');
const { PrismaClient } = require('@prisma/client');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 5,                  // máximo de conexiones simultáneas
  idleTimeoutMillis: 30000, // cierra conexiones idle tras 30s
  connectionTimeoutMillis: 10000, // timeout al conectar
  keepAlive: true,          // mantiene la conexión viva
  keepAliveInitialDelayMillis: 10000,
});

// Reconectar automáticamente si la conexión se cae
pool.on('error', (err) => {
  console.error('[DB] Error inesperado en cliente del pool:', err.message);
});

const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

module.exports = { prisma };
