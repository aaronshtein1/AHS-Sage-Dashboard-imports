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
  console.log('Checking ledger postings...\n');

  // Total count
  const totalCount = await prisma.ledgerPosting.count();
  console.log('Total ledger postings:', totalCount);

  // Check by account type
  const accountTypes = ['ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE'];

  for (const accountType of accountTypes) {
    const result = await prisma.ledgerPosting.aggregate({
      where: {
        account: {
          accountType: accountType as any,
        },
      },
      _sum: { debitAmount: true, creditAmount: true },
      _count: true,
    });

    console.log(`\n${accountType}:`);
    console.log(`  Count: ${result._count}`);
    console.log(`  Total Debits: ${result._sum.debitAmount?.toString() || '0'}`);
    console.log(`  Total Credits: ${result._sum.creditAmount?.toString() || '0'}`);
  }

  // Sample revenue accounts
  console.log('\n=== Revenue Accounts with Postings ===');
  const revenueAccounts = await prisma.account.findMany({
    where: { accountType: 'REVENUE' },
    include: {
      ledgerPostings: {
        take: 1,
      },
    },
  });

  for (const acc of revenueAccounts) {
    if (acc.ledgerPostings.length > 0) {
      const totals = await prisma.ledgerPosting.aggregate({
        where: { accountId: acc.id },
        _sum: { debitAmount: true, creditAmount: true },
        _count: true,
      });
      console.log(`${acc.accountCode} - ${acc.title}`);
      console.log(`  Postings: ${totals._count}, Dr: ${totals._sum.debitAmount?.toString()}, Cr: ${totals._sum.creditAmount?.toString()}`);
    }
  }

  // Sample expense accounts
  console.log('\n=== Expense Accounts with Postings ===');
  const expenseAccounts = await prisma.account.findMany({
    where: { accountType: 'EXPENSE' },
    include: {
      ledgerPostings: {
        take: 1,
      },
    },
  });

  for (const acc of expenseAccounts) {
    if (acc.ledgerPostings.length > 0) {
      const totals = await prisma.ledgerPosting.aggregate({
        where: { accountId: acc.id },
        _sum: { debitAmount: true, creditAmount: true },
        _count: true,
      });
      console.log(`${acc.accountCode} - ${acc.title}`);
      console.log(`  Postings: ${totals._count}, Dr: ${totals._sum.debitAmount?.toString()}, Cr: ${totals._sum.creditAmount?.toString()}`);
    }
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
