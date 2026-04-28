import { defineConfig } from '@prisma/config'
import { PrismaPg } from '@prisma/adapter-pg'
import pg from 'pg'
import 'dotenv/config'

export default defineConfig({
  // Indica la ruta del esquema
  schema: './prisma/schema.prisma',

  // Configuración de la base de datos para la CLI
  datasource: {
    url: process.env.DATABASE_URL,
  },

  // Cambia 'migrate' por 'migrations' (en plural)
  migrations: {
    async adapter(env) {
      const pool = new pg.Pool({
        connectionString: env.DATABASE_URL,
        ssl: env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
      })
      return new PrismaPg(pool)
    },
    // El comando para ejecutar tu archivo JS de semillas
    seed: 'node ./prisma/seed.js',
  },
})