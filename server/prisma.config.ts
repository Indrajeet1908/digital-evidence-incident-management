import path from 'path';
import dotenv from 'dotenv';
import { defineConfig } from 'prisma/config';

// Load .env from the project root (one level above server/)
dotenv.config({ path: path.resolve(__dirname, '.env') });
dotenv.config({ path: path.resolve(__dirname, '../.env') });

/**
 * Prisma configuration file (Prisma v7+).
 *
 * This file tells the Prisma CLI (migrate, generate, studio)
 * where to find the schema and how to connect to the database.
 *
 * The database URL is read from the .env file — never hardcoded.
 */
export default defineConfig({
  schema: path.resolve(__dirname, 'prisma/schema.prisma'),
  migrate: {
    schema: path.resolve(__dirname, 'prisma/schema.prisma'),
  },
  migrations: {
    seed: 'npx tsx prisma/seed.ts',
  },
  datasource: {
    url: process.env.DATABASE_URL!,
  },
});
