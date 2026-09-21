import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import dotenv from 'dotenv';
import path from 'path';

// Load .env from project root
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

/**
 * Database seed script.
 *
 * Seeds the initial roles required by the platform.
 * Uses "upsert" — if the role already exists, it updates it;
 * if not, it creates it. This makes it safe to run multiple times.
 *
 * Usage:
 *   npx prisma db seed
 */

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const roles = [
  {
    name: 'ADMIN',
    description: 'Full system access, user management, audit log access',
  },
  {
    name: 'INVESTIGATOR',
    description: 'Create/manage cases, upload evidence, request AI analysis',
  },
  {
    name: 'ANALYST',
    description: 'Analyze evidence, add findings, view assigned cases',
  },
  {
    name: 'VIEWER',
    description: 'Read-only access to authorized cases and evidence',
  },
];

async function main() {
  console.log('🌱 Seeding database...\n');

  for (const role of roles) {
    const upsertedRole = await prisma.role.upsert({
      where: { name: role.name },
      update: { description: role.description },
      create: { name: role.name, description: role.description },
    });

    console.log(`  ✅ Role: ${upsertedRole.name} (${upsertedRole.id})`);
  }

  console.log('\n🌱 Seeding complete!');
}

main()
  .catch((e) => {
    console.error('❌ Seed error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
