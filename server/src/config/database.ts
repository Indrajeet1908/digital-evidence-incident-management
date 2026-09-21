import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import config from './environment';

/**
 * Shared Prisma client instance.
 *
 * WHY A SINGLE INSTANCE?
 * Every PrismaClient opens a pool of database connections.
 * Creating multiple instances wastes connections and can crash the database.
 * By exporting one instance, all parts of the app share the same connection pool.
 *
 * DEVELOPMENT NOTE:
 * During development with hot-reload (tsx watch), the module can be re-imported
 * many times. We store the client on `globalThis` to reuse it across reloads,
 * preventing "too many connections" errors.
 *
 * PRISMA v7 NOTE:
 * Prisma v7 uses "driver adapters" instead of its own query engine.
 * We create a standard pg Pool and wrap it with PrismaPg adapter.
 */

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createPrismaClient(): PrismaClient {
  const pool = new Pool({ connectionString: config.databaseUrl });
  const adapter = new PrismaPg(pool);

  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  });
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

export default prisma;
