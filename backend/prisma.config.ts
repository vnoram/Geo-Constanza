import { defineConfig } from '@prisma/config'
import 'dotenv/config'

export default defineConfig({
  // @ts-ignore
  earlyAccess: true,
  migrations: {
    seed: 'node ./prisma/seed.js',
  },
  datasource: {
    url: process.env.DATABASE_URL,
  },
})