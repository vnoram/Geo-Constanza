import { defineConfig } from '@prisma/config'
import { PrismaPg } from '@prisma/adapter-pg'
import pg from 'pg'
import 'dotenv/config'

export default defineConfig({
  earlyAccess: true,
  migrate: {
    async adapter(env) {
      const pool = new pg.Pool({
        connectionString: env.DATABASE_URL,
        ssl: env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
      })
      return new PrismaPg(pool)
    },
    seed: 'node ./prisma/seed.js',
  },
})
