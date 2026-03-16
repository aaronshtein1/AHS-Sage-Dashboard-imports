import { PrismaClient } from '@prisma/client';
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
  console.log('Cleaning all journal data...\n');

  // Delete in order to handle foreign keys
  console.log('Deleting source transaction links...');
  await prisma.sourceToJournalLine.deleteMany();

  console.log('Deleting recon matches...');
  await prisma.reconMatch.deleteMany();

  console.log('Deleting journal line dimensions...');
  await prisma.journalLineDimension.deleteMany();

  console.log('Deleting ledger postings...');
  await prisma.ledgerPosting.deleteMany();

  console.log('Deleting journal lines...');
  await prisma.journalLine.deleteMany();

  console.log('Deleting journal entries...');
  await prisma.journalEntry.deleteMany();

  console.log('\nDone! Verifying...');
  const entryCount = await prisma.journalEntry.count();
  const lineCount = await prisma.journalLine.count();
  console.log('Remaining entries:', entryCount);
  console.log('Remaining lines:', lineCount);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
