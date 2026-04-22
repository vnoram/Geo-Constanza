import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';
import 'dotenv/config';

// 1. Configuramos el pool de conexión
const connectionString = process.env.DATABASE_URL;

const pool = new pg.Pool({ 
  connectionString,
  // Configuración de SSL necesaria para Railway/Render en producción
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// 2. Creamos el adaptador de PostgreSQL
const adapter = new PrismaPg(pool);

// 3. Inicializamos el cliente usando el adaptador
const prisma = new PrismaClient({ adapter });

export default prisma;