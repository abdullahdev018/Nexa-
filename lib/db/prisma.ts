import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '@/lib/generated/prisma/client'

/**
 * One PrismaClient for the process. Next's dev server re-evaluates modules on
 * every change, so without the global cache each edit would open another pool
 * until Postgres refused new connections.
 */
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient }

function createClient(): PrismaClient {
  const connectionString = process.env.DATABASE_URL
  if (!connectionString) {
    throw new Error('DATABASE_URL is not set. Copy .env.example to .env and fill it in.')
  }

  return new PrismaClient({
    // Prisma 7 talks to Postgres through a driver adapter rather than its own
    // binary engine, so the pool is node-postgres'.
    adapter: new PrismaPg({ connectionString }),
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  })
}

export const prisma = globalForPrisma.prisma ?? createClient()

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma
