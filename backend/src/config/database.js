const { Pool } = require('pg');
const { PrismaPg } = require('@prisma/adapter-pg');
const { PrismaClient } = require('@prisma/client');

const isProd = process.env.NODE_ENV === 'production';

// DATABASE_SSL: 'disable' | 'require' | 'verify'.
//   require (por defecto en producción): cifra la conexión sin validar el certificado.
//   verify: valida el certificado del servidor; usa DATABASE_SSL_CA (PEM) si el proveedor
//           usa una CA que Node no trae (p. ej. Azure Database for PostgreSQL).
const sslConfig = () => {
  const modo = (process.env.DATABASE_SSL || (isProd ? 'require' : 'disable')).toLowerCase();
  if (modo === 'disable') return false;
  if (modo === 'verify') {
    return { rejectUnauthorized: true, ...(process.env.DATABASE_SSL_CA && { ca: process.env.DATABASE_SSL_CA.replace(/\\n/g, '\n') }) };
  }
  return { rejectUnauthorized: false };
};

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: isProd ? 15 : 5,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
  keepAlive: true,
  keepAliveInitialDelayMillis: 10000,
  ssl: sslConfig(),
});

// Reconectar automáticamente si la conexión se cae
pool.on('error', (err) => {
  console.error('[DB] Error inesperado en cliente del pool:', err.message);
});

const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

module.exports = { prisma };
