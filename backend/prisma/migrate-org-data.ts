/**
 * Migration script to:
 * 1. Move journal entry data from Test Healthcare Org to Demo Organization
 * 2. Delete Test Healthcare Org
 * 3. Rename Demo Organization to "At Home Solutions LLC"
 */

import { PrismaClient } from '@prisma/client';
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

async function main() {
  console.log('Starting organization data migration...\n');

  // Find both orgs
  const testOrg = await prisma.org.findFirst({
    where: { name: { contains: 'Test Healthcare' } },
  });

  const demoOrg = await prisma.org.findFirst({
    where: { name: { contains: 'Demo' } },
  });

  if (!testOrg) {
    console.log('Test Healthcare Org not found - may have already been migrated');
  } else {
    console.log(`Found Test Healthcare Org: ${testOrg.id}`);
  }

  if (!demoOrg) {
    console.error('Demo Organization not found!');
    process.exit(1);
  }
  console.log(`Found Demo Organization: ${demoOrg.id}\n`);

  // Step 1: Copy accounts from Test to Demo (if they don't exist)
  if (testOrg) {
    console.log('Step 1: Copying accounts...');
    const testAccounts = await prisma.account.findMany({
      where: { orgId: testOrg.id },
    });

    for (const account of testAccounts) {
      const existing = await prisma.account.findUnique({
        where: { orgId_accountCode: { orgId: demoOrg.id, accountCode: account.accountCode } },
      });

      if (!existing) {
        await prisma.account.create({
          data: {
            orgId: demoOrg.id,
            accountCode: account.accountCode,
            title: account.title,
            accountType: account.accountType,
            normalBalance: account.normalBalance,
            closingType: account.closingType,
            category: account.category,
            requireDepartment: account.requireDepartment,
            requireLocation: account.requireLocation,
            isBankAccount: account.isBankAccount,
            status: account.status,
          },
        });
        console.log(`  Created account: ${account.accountCode} - ${account.title}`);
      }
    }

    // Step 2: Copy journal types
    console.log('\nStep 2: Copying journal types...');
    const testJournalTypes = await prisma.journalType.findMany({
      where: { orgId: testOrg.id },
    });

    const journalTypeMap: Record<string, string> = {};

    for (const jt of testJournalTypes) {
      let existing = await prisma.journalType.findUnique({
        where: { orgId_code: { orgId: demoOrg.id, code: jt.code } },
      });

      if (!existing) {
        existing = await prisma.journalType.create({
          data: {
            orgId: demoOrg.id,
            code: jt.code,
            name: jt.name,
            description: jt.description,
          },
        });
        console.log(`  Created journal type: ${jt.code} - ${jt.name}`);
      }
      journalTypeMap[jt.id] = existing.id;
    }

    // Step 3: Copy periods
    console.log('\nStep 3: Copying periods...');
    const testPeriods = await prisma.period.findMany({
      where: { orgId: testOrg.id },
    });

    const periodMap: Record<string, string> = {};

    for (const period of testPeriods) {
      let existing = await prisma.period.findUnique({
        where: { orgId_name: { orgId: demoOrg.id, name: period.name } },
      });

      if (!existing) {
        existing = await prisma.period.create({
          data: {
            orgId: demoOrg.id,
            name: period.name,
            startDate: period.startDate,
            endDate: period.endDate,
            status: period.status,
          },
        });
        console.log(`  Created period: ${period.name}`);
      }
      periodMap[period.id] = existing.id;
    }

    // Step 4: Copy journal entries with lines
    console.log('\nStep 4: Copying journal entries...');
    const testEntries = await prisma.journalEntry.findMany({
      where: { orgId: testOrg.id },
      include: { lines: true },
    });

    // Get account mapping for Demo org
    const demoAccounts = await prisma.account.findMany({
      where: { orgId: demoOrg.id },
    });
    const accountCodeToId: Record<string, string> = {};
    for (const acc of demoAccounts) {
      accountCodeToId[acc.accountCode] = acc.id;
    }

    // Get test org accounts for code lookup
    const testAccountsMap: Record<string, string> = {};
    for (const acc of testAccounts) {
      testAccountsMap[acc.id] = acc.accountCode;
    }

    let copiedCount = 0;
    for (const entry of testEntries) {
      // Check if entry already exists in demo org
      const existing = await prisma.journalEntry.findUnique({
        where: { orgId_entryNumber: { orgId: demoOrg.id, entryNumber: entry.entryNumber } },
      });

      if (!existing) {
        const newJournalTypeId = journalTypeMap[entry.journalTypeId];
        const newPeriodId = periodMap[entry.periodId];

        if (!newJournalTypeId || !newPeriodId) {
          console.log(`  Skipping entry ${entry.entryNumber} - missing journal type or period mapping`);
          continue;
        }

        await prisma.journalEntry.create({
          data: {
            orgId: demoOrg.id,
            journalTypeId: newJournalTypeId,
            periodId: newPeriodId,
            entryNumber: entry.entryNumber,
            entryDate: entry.entryDate,
            description: entry.description,
            reference: entry.reference,
            status: entry.status,
            postedAt: entry.postedAt,
            postedBy: entry.postedBy,
            isAdjusting: entry.isAdjusting,
            lines: {
              create: entry.lines.map((line) => {
                const accountCode = testAccountsMap[line.accountId];
                const newAccountId = accountCodeToId[accountCode];
                return {
                  lineNumber: line.lineNumber,
                  accountId: newAccountId,
                  description: line.description,
                  debitAmount: line.debitAmount,
                  creditAmount: line.creditAmount,
                };
              }),
            },
          },
        });
        copiedCount++;
      }
    }
    console.log(`  Copied ${copiedCount} journal entries`);

    // Step 5: Delete Test Healthcare Org data
    console.log('\nStep 5: Deleting Test Healthcare Org data...');

    // Delete in order respecting foreign keys
    await prisma.journalLineDimension.deleteMany({
      where: { journalLine: { journalEntry: { orgId: testOrg.id } } },
    });
    await prisma.journalLine.deleteMany({
      where: { journalEntry: { orgId: testOrg.id } },
    });
    await prisma.ledgerPosting.deleteMany({ where: { orgId: testOrg.id } });
    await prisma.journalEntry.deleteMany({ where: { orgId: testOrg.id } });
    await prisma.journalBatch.deleteMany({ where: { orgId: testOrg.id } });
    await prisma.journalType.deleteMany({ where: { orgId: testOrg.id } });
    await prisma.period.deleteMany({ where: { orgId: testOrg.id } });
    await prisma.accountRequiredDimension.deleteMany({
      where: { account: { orgId: testOrg.id } },
    });
    await prisma.dimensionValue.deleteMany({ where: { orgId: testOrg.id } });
    await prisma.dimensionType.deleteMany({ where: { orgId: testOrg.id } });
    await prisma.account.deleteMany({ where: { orgId: testOrg.id } });
    await prisma.userRole.deleteMany({ where: { orgId: testOrg.id } });
    await prisma.org.delete({ where: { id: testOrg.id } });

    console.log('  Deleted Test Healthcare Org and all its data');
  }

  // Step 6: Rename Demo Organization
  console.log('\nStep 6: Renaming Demo Organization to "At Home Solutions LLC"...');
  await prisma.org.update({
    where: { id: demoOrg.id },
    data: { name: 'At Home Solutions LLC' },
  });
  console.log('  Done!');

  console.log('\n✓ Migration completed successfully!');
  console.log('  - Data moved to At Home Solutions LLC');
  console.log('  - Test Healthcare Org deleted');
}

main()
  .catch((e) => {
    console.error('Migration failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
