import { defineConfig } from '@prisma/config'
import 'dotenv/config'

export default defineConfig({
  // @ts-ignore
  earlyAccess: true,
  datasource: {
    url: process.env.DATABASE_URL,
  },
})