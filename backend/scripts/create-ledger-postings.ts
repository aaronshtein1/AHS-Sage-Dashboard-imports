import { PrismaClient, Prisma } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import * as dotenv from 'dotenv';

dotenv.config();

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error('DATABASE_URL environment variable is required');
}

const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('Creating ledger postings from posted journal entries...\n');

  // Get org
  const org = await prisma.org.findFirst();
  if (!org) {
    console.error('No org found');
    return;
  }
  console.log(`Using org: ${org.name} (${org.id})`);

  // Check current ledger posting count
  const existingPostings = await prisma.ledgerPosting.count();
  console.log(`Existing ledger postings: ${existingPostings}`);

  // Get all POSTED journal entries that might need ledger postings
  const postedEntries = await prisma.journalEntry.findMany({
    where: {
      orgId: org.id,
      status: 'POSTED',
    },
    include: {
      lines: {
        include: {
          account: true,
        },
      },
    },
  });

  console.log(`Found ${postedEntries.length} posted journal entries`);

  // Check which entries already have ledger postings
  const entriesWithPostings = await prisma.ledgerPosting.groupBy({
    by: ['journalEntryId'],
    where: { orgId: org.id },
  });
  const entriesWithPostingsSet = new Set(entriesWithPostings.map(e => e.journalEntryId));

  const entriesNeedingPostings = postedEntries.filter(e => !entriesWithPostingsSet.has(e.id));
  console.log(`Entries needing ledger postings: ${entriesNeedingPostings.length}`);

  if (entriesNeedingPostings.length === 0) {
    console.log('\nNo entries need ledger postings. Exiting.');
    return;
  }

  // Create ledger postings for each entry
  let created = 0;
  let errors = 0;

  for (const entry of entriesNeedingPostings) {
    try {
      // Create ledger postings for each line (backend schema doesn't have postingHash)
      const postingsData = entry.lines.map((line) => ({
        orgId: org.id,
        journalEntryId: entry.id,
        accountId: line.accountId,
        postingDate: entry.entryDate,
        debitAmount: line.debitAmount || new Prisma.Decimal(0),
        creditAmount: line.creditAmount || new Prisma.Decimal(0),
        runningBalance: new Prisma.Decimal(0), // Will be calculated if needed
      }));

      await prisma.ledgerPosting.createMany({
        data: postingsData,
      });

      created++;
      if (created % 500 === 0) {
        console.log(`Created ledger postings for ${created} entries...`);
      }
    } catch (error) {
      console.error(`Error creating postings for entry ${entry.entryNumber}:`, error);
      errors++;
    }
  }

  console.log(`\n=== Complete ===`);
  console.log(`Created ledger postings for: ${created} entries`);
  console.log(`Errors: ${errors}`);

  // Verify
  const totalPostings = await prisma.ledgerPosting.count();
  console.log(`\nTotal ledger postings in database: ${totalPostings}`);

  // Show sample postings
  const samplePostings = await prisma.ledgerPosting.findMany({
    take: 5,
    include: {
      account: true,
      journalEntry: true,
    },
    orderBy: { createdAt: 'desc' },
  });

  console.log('\n=== Sample Ledger Postings ===');
  for (const posting of samplePostings) {
    console.log(`${posting.journalEntry.entryNumber} | ${posting.account.accountCode} | Dr: ${posting.debitAmount} | Cr: ${posting.creditAmount}`);
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
