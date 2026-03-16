import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import * as dotenv from 'dotenv';

dotenv.config();

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error('DATABASE_URL not set');
  process.exit(1);
}

const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('Checking database...\n');

  // Count journal entries by org
  const orgs = await prisma.org.findMany();
  console.log('Organizations:');
  for (const org of orgs) {
    const count = await prisma.journalEntry.count({ where: { orgId: org.id } });
    const draftCount = await prisma.journalEntry.count({ where: { orgId: org.id, status: 'DRAFT' } });
    console.log(`  - ${org.name} (${org.id}): ${count} total, ${draftCount} drafts`);
  }

  // Show journal types
  console.log('\nJournal Types:');
  const types = await prisma.journalType.findMany({ include: { _count: { select: { journalEntries: true } } } });
  for (const t of types) {
    console.log(`  - ${t.code}: ${t.name} (${t._count.journalEntries} entries) - orgId: ${t.orgId}`);
  }

  // Show recent entries
  const recentEntries = await prisma.journalEntry.findMany({
    take: 5,
    orderBy: { createdAt: 'desc' },
    include: { journalType: true }
  });
  console.log('\nRecent 5 entries:');
  for (const e of recentEntries) {
    console.log(`  - ${e.entryNumber} | ${e.entryDate.toISOString().split('T')[0]} | ${e.journalType.code} | ${e.status} | ${(e.description || '').substring(0, 30)}`);
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
