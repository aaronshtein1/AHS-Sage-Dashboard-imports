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
  console.log('Verifying journal entries...\n');

  // Count entries
  const entryCount = await prisma.journalEntry.count();
  console.log('Total journal entries:', entryCount);

  // Count lines
  const lineCount = await prisma.journalLine.count();
  console.log('Total journal lines:', lineCount);
  console.log('Average lines per entry:', (lineCount / entryCount).toFixed(2));

  // Check for any lines that have both debit and credit > 0
  const badLines = await prisma.journalLine.count({
    where: {
      AND: [
        { debitAmount: { gt: 0 } },
        { creditAmount: { gt: 0 } }
      ]
    }
  });
  console.log('\nLines with both debit AND credit > 0:', badLines);

  // Get some sample entries with lines
  const samples = await prisma.journalEntry.findMany({
    take: 3,
    include: {
      lines: {
        include: { account: true }
      }
    }
  });

  console.log('\n=== Sample Entries ===');
  for (const entry of samples) {
    console.log(`\nEntry: ${entry.entryNumber}`);
    console.log(`Description: ${entry.description}`);
    console.log(`Date: ${entry.entryDate}`);
    console.log('Lines:');
    for (const line of entry.lines) {
      const dr = Number(line.debitAmount);
      const cr = Number(line.creditAmount);
      console.log(`  ${line.lineNumber}. ${line.account.accountCode} - ${line.account.title}`);
      console.log(`     Debit: ${dr.toFixed(2)}   Credit: ${cr.toFixed(2)}`);
    }
    const totalDr = entry.lines.reduce((sum, l) => sum + Number(l.debitAmount), 0);
    const totalCr = entry.lines.reduce((sum, l) => sum + Number(l.creditAmount), 0);
    console.log(`  TOTALS: Debit: ${totalDr.toFixed(2)}   Credit: ${totalCr.toFixed(2)}`);
  }

  // Count by journal type
  const byType = await prisma.journalEntry.groupBy({
    by: ['journalTypeId'],
    _count: true,
  });

  console.log('\n=== Entries by Journal Type ===');
  for (const t of byType) {
    const jt = await prisma.journalType.findUnique({ where: { id: t.journalTypeId } });
    console.log(`${jt?.name}: ${t._count}`);
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
