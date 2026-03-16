/**
 * Script to create missing ledger postings for all POSTED journal entries
 * This fixes the issue where journal entries were marked as POSTED but
 * ledger postings were never created.
 */

import { PrismaClient, Prisma } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import * as dotenv from 'dotenv';

dotenv.config();

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error('DATABASE_URL environment variable is not set');
  process.exit(1);
}

const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const Decimal = Prisma.Decimal;

async function main() {
  console.log('Creating missing ledger postings for POSTED journal entries...\n');

  // Get the org
  const org = await prisma.org.findFirst({
    where: { name: { contains: 'At Home Solutions' } },
  });

  if (!org) {
    console.error('At Home Solutions LLC not found!');
    process.exit(1);
  }

  console.log(`Found org: ${org.name} (${org.id})\n`);

  // Get all POSTED journal entries
  const postedEntries = await prisma.journalEntry.findMany({
    where: {
      orgId: org.id,
      status: 'POSTED',
    },
    include: {
      lines: true,
    },
    orderBy: { entryDate: 'asc' },
  });

  console.log(`Found ${postedEntries.length} POSTED journal entries\n`);

  // Check existing ledger postings
  const existingPostings = await prisma.ledgerPosting.findMany({
    where: { orgId: org.id },
    select: { journalEntryId: true },
  });

  const entriesWithPostings = new Set(existingPostings.map(p => p.journalEntryId));
  console.log(`${entriesWithPostings.size} entries already have ledger postings\n`);

  // Find entries missing ledger postings
  const entriesMissingPostings = postedEntries.filter(e => !entriesWithPostings.has(e.id));
  console.log(`${entriesMissingPostings.length} entries are missing ledger postings\n`);

  if (entriesMissingPostings.length === 0) {
    console.log('No missing ledger postings to create!');
    return;
  }

  // Create ledger postings in batches
  let created = 0;
  const batchSize = 100;

  for (let i = 0; i < entriesMissingPostings.length; i += batchSize) {
    const batch = entriesMissingPostings.slice(i, i + batchSize);

    const postingsToCreate: Prisma.LedgerPostingCreateManyInput[] = [];

    for (const entry of batch) {
      for (const line of entry.lines) {
        postingsToCreate.push({
          orgId: org.id,
          journalEntryId: entry.id,
          accountId: line.accountId,
          postingDate: entry.entryDate,
          debitAmount: line.debitAmount || new Decimal(0),
          creditAmount: line.creditAmount || new Decimal(0),
        });
      }
    }

    await prisma.ledgerPosting.createMany({ data: postingsToCreate });
    created += batch.length;
    console.log(`Progress: ${created}/${entriesMissingPostings.length} entries processed (${postingsToCreate.length} posting records created in this batch)`);
  }

  console.log('\n✓ Ledger postings created successfully!');

  // Verify
  const finalCount = await prisma.ledgerPosting.count({ where: { orgId: org.id } });
  console.log(`\nTotal ledger postings for ${org.name}: ${finalCount}`);
}

main()
  .catch((e) => {
    console.error('Script failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
