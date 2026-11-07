const { Pool } = require('pg');
const { PrismaPg } = require('@prisma/adapter-pg');
const { PrismaClient } = require('@prisma/client');
const { empresaActual } = require('./tenant');
const { aplicarAlcance, MODELOS_CON_EMPRESA } = require('./tenantScope');

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

// Cliente SIN alcance por empresa. Úsalo solo de forma explícita y justificada:
//   - plataforma (super admin), migraciones, seed y scripts
//   - lo que ocurre ANTES de conocer la empresa: login, renovar sesión, authenticate,
//     restablecer contraseña y el arranque de un socket
// Todo lo demás debe usar `prisma` (más abajo).
const prismaGlobal = new PrismaClient({ adapter });

// Cliente con aislamiento por empresa: agrega empresa_id a cada consulta de los modelos que
// tienen empresa, con la empresa del contexto de la petición (que sale del TOKEN).
// FALLA CERRADO: sin empresa en el contexto no devuelve datos, lanza un error.
// Ver config/tenantScope.js y docs/MULTIEMPRESA.md.
const prisma = prismaGlobal.$extends({
  name: 'alcance-por-empresa',
  query: {
    $allModels: {
      async $allOperations({ model, operation, args, query }) {
        if (!MODELOS_CON_EMPRESA.has(model)) return query(args);
        const empresaId = empresaActual();
        if (!empresaId) {
          throw Object.assign(
            new Error(`Consulta a ${model}.${operation} sin empresa en el contexto (¿falta authenticate, o debe usar prismaGlobal?)`),
            { code: 'SIN_CONTEXTO_EMPRESA' },
          );
        }
        return query(aplicarAlcance(model, operation, args, empresaId));
      },
    },
  },
});

module.exports = { prisma, prismaGlobal };
