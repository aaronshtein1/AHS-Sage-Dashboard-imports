import { PrismaClient, Prisma } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

dotenv.config();

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error('DATABASE_URL environment variable is required');
}

const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

interface ParsedJournalEntry {
  journalTypeName: string;
  date: string;
  document: string;
  memo: string;
  lines: {
    accountCode: string;
    accountDesc: string;
    departmentId: string;
    locationId: string;
    debit: number;
    credit: number;
  }[];
}

async function main() {
  const csvPath = 'C:\\Users\\aaron\\Downloads\\Journal report (2).csv';
  const csvContent = fs.readFileSync(csvPath, 'utf-8');
  const lines = csvContent.split('\n');

  // Get org
  const org = await prisma.org.findFirst();
  if (!org) {
    console.error('No org found');
    return;
  }
  console.log(`Using org: ${org.name} (${org.id})`);

  // Get or create journal types
  const journalTypeMap = new Map<string, string>();
  const journalTypes = [
    { code: 'BREX', name: 'Brex Journal' },
    { code: 'GJ', name: 'General Journal' },
    { code: 'IE', name: 'Inter-entity Journal' },
  ];

  for (const jt of journalTypes) {
    let type = await prisma.journalType.findFirst({
      where: { orgId: org.id, name: jt.name },
    });
    if (!type) {
      type = await prisma.journalType.create({
        data: {
          orgId: org.id,
          code: jt.code,
          name: jt.name,
        },
      });
      console.log(`Created journal type: ${jt.name}`);
    }
    journalTypeMap.set(jt.name, type.id);
  }

  // Get accounts by code
  const accounts = await prisma.account.findMany({
    where: { orgId: org.id },
  });
  const accountMap = new Map<string, string>();
  accounts.forEach(a => accountMap.set(a.accountCode, a.id));
  console.log(`Loaded ${accounts.length} accounts`);

  // Get or create periods
  const periodMap = new Map<string, string>();
  const periods = await prisma.period.findMany({
    where: { orgId: org.id },
  });
  periods.forEach(p => {
    // Extract year-month from period name or startDate
    const startDate = new Date(p.startDate);
    const key = `${startDate.getFullYear()}-${String(startDate.getMonth() + 1).padStart(2, '0')}`;
    periodMap.set(key, p.id);
  });
  console.log(`Loaded ${periods.length} periods`);

  // Get location and department dimension values
  const dimensionValues = await prisma.dimensionValue.findMany({
    include: { dimensionType: true },
  });
  const locationMap = new Map<string, string>();
  const departmentMap = new Map<string, string>();
  dimensionValues.forEach(dv => {
    if (dv.dimensionType.code === 'LOCATION') {
      locationMap.set(dv.code, dv.id);
    } else if (dv.dimensionType.code === 'DEPARTMENT') {
      departmentMap.set(dv.code, dv.id);
    }
  });
  console.log(`Loaded ${locationMap.size} locations, ${departmentMap.size} departments`);

  // Get dimension type IDs
  const dimensionTypes = await prisma.dimensionType.findMany({
    where: { orgId: org.id },
  });
  const locationTypeId = dimensionTypes.find(dt => dt.code === 'LOCATION')?.id;
  const departmentTypeId = dimensionTypes.find(dt => dt.code === 'DEPARTMENT')?.id;

  // Parse CSV
  let currentJournalType = '';
  let currentEntry: ParsedJournalEntry | null = null;
  const entries: ParsedJournalEntry[] = [];
  let entryNumberCounter = 1;
  const missingAccounts = new Set<string>();

  for (let i = 3; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    // Parse CSV line (handle commas in quoted fields)
    const parts = line.split(',');

    // Check for journal type header
    if (line.endsWith('Journal,,,,,,,,')) {
      currentJournalType = line.replace(',,,,,,,,', '');
      console.log(`Found journal type: ${currentJournalType}`);
      continue;
    }

    // Check for "Total for transaction" line
    if (parts[0].startsWith('Total for transaction')) {
      if (currentEntry && currentEntry.lines.length > 0) {
        entries.push(currentEntry);
      }
      currentEntry = null;
      continue;
    }

    // Check for entry header (has a date and document number)
    const dateMatch = parts[0].match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (dateMatch && parts[1]) {
      // This is a new entry header
      if (currentEntry && currentEntry.lines.length > 0) {
        entries.push(currentEntry);
      }
      currentEntry = {
        journalTypeName: currentJournalType,
        date: `${dateMatch[3]}-${dateMatch[1]}-${dateMatch[2]}`, // YYYY-MM-DD
        document: parts[1],
        memo: parts[2] || '',
        lines: [],
      };

      // Check if this header also has account data on the same line
      if (parts[3]) {
        const debit = parseFloat(parts[7]) || 0;
        const credit = parseFloat(parts[8]) || 0;
        if (parts[3] && (debit > 0 || credit > 0)) {
          currentEntry.lines.push({
            accountCode: parts[3],
            accountDesc: parts[4] || '',
            departmentId: parts[5] || '',
            locationId: parts[6] || '',
            debit,
            credit,
          });
        }
      }
      continue;
    }

    // This is a detail line (starts with commas)
    if (parts[0] === '' && parts[3] && currentEntry) {
      const debit = parseFloat(parts[7]) || 0;
      const credit = parseFloat(parts[8]) || 0;
      if (debit > 0 || credit > 0) {
        currentEntry.lines.push({
          accountCode: parts[3],
          accountDesc: parts[4] || '',
          departmentId: parts[5] || '',
          locationId: parts[6] || '',
          debit,
          credit,
        });
      }
    }
  }

  // Add last entry if exists
  if (currentEntry && currentEntry.lines.length > 0) {
    entries.push(currentEntry);
  }

  console.log(`\nParsed ${entries.length} journal entries`);

  // Check for missing accounts
  for (const entry of entries) {
    for (const line of entry.lines) {
      if (!accountMap.has(line.accountCode)) {
        missingAccounts.add(`${line.accountCode} - ${line.accountDesc}`);
      }
    }
  }

  if (missingAccounts.size > 0) {
    console.log(`\nMissing accounts (${missingAccounts.size}):`);
    Array.from(missingAccounts).sort().forEach(a => console.log(`  ${a}`));
  }

  // Import entries
  let importedCount = 0;
  let skippedCount = 0;
  let errorCount = 0;

  for (const entry of entries) {
    try {
      const journalTypeId = journalTypeMap.get(entry.journalTypeName);
      if (!journalTypeId) {
        console.error(`Unknown journal type: ${entry.journalTypeName}`);
        errorCount++;
        continue;
      }

      // Get period
      const entryDate = new Date(entry.date);
      const periodKey = `${entryDate.getFullYear()}-${String(entryDate.getMonth() + 1).padStart(2, '0')}`;
      let periodId = periodMap.get(periodKey);

      if (!periodId) {
        // Create period
        const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
          'July', 'August', 'September', 'October', 'November', 'December'];
        const periodName = `${monthNames[entryDate.getMonth()]} ${entryDate.getFullYear()}`;
        const period = await prisma.period.create({
          data: {
            orgId: org.id,
            name: periodName,
            startDate: new Date(entryDate.getFullYear(), entryDate.getMonth(), 1),
            endDate: new Date(entryDate.getFullYear(), entryDate.getMonth() + 1, 0),
            status: 'OPEN',
          },
        });
        periodId = period.id;
        periodMap.set(periodKey, periodId);
        console.log(`Created period: ${periodKey} (${periodName})`);
      }

      // Filter lines to only those with valid accounts
      const validLines = entry.lines.filter(line => accountMap.has(line.accountCode));
      if (validLines.length === 0) {
        skippedCount++;
        continue;
      }

      // Verify entry balances
      const totalDebit = validLines.reduce((sum, l) => sum + l.debit, 0);
      const totalCredit = validLines.reduce((sum, l) => sum + l.credit, 0);
      if (Math.abs(totalDebit - totalCredit) > 0.01) {
        console.warn(`Entry ${entry.document} is unbalanced: Dr=${totalDebit.toFixed(2)}, Cr=${totalCredit.toFixed(2)}`);
      }

      // Generate unique entry number
      const entryNumber = `IMP-${String(entryNumberCounter++).padStart(6, '0')}`;

      // Create journal entry with lines
      await prisma.journalEntry.create({
        data: {
          orgId: org.id,
          journalTypeId,
          periodId,
          entryNumber,
          entryDate: new Date(entry.date),
          description: entry.memo,
          reference: entry.document,
          status: 'POSTED',
          postedAt: new Date(),
          lines: {
            create: validLines.map((line, idx) => {
              const lineData: any = {
                lineNumber: idx + 1,
                accountId: accountMap.get(line.accountCode)!,
                description: line.accountDesc,
                debitAmount: new Prisma.Decimal(line.debit),
                creditAmount: new Prisma.Decimal(line.credit),
              };
              return lineData;
            }),
          },
        },
      });

      // Now add dimensions to the lines if needed
      const createdEntry = await prisma.journalEntry.findFirst({
        where: { entryNumber },
        include: { lines: true },
      });

      if (createdEntry && locationTypeId) {
        for (let i = 0; i < validLines.length; i++) {
          const line = validLines[i];
          const journalLine = createdEntry.lines[i];

          if (line.locationId && locationMap.has(line.locationId)) {
            await prisma.journalLineDimension.create({
              data: {
                journalLineId: journalLine.id,
                dimensionTypeId: locationTypeId,
                dimensionValueId: locationMap.get(line.locationId)!,
              },
            }).catch(() => {}); // Ignore if already exists
          }

          if (line.departmentId && departmentTypeId && departmentMap.has(line.departmentId)) {
            await prisma.journalLineDimension.create({
              data: {
                journalLineId: journalLine.id,
                dimensionTypeId: departmentTypeId,
                dimensionValueId: departmentMap.get(line.departmentId)!,
              },
            }).catch(() => {}); // Ignore if already exists
          }
        }
      }

      importedCount++;
      if (importedCount % 100 === 0) {
        console.log(`Imported ${importedCount} entries...`);
      }
    } catch (error) {
      console.error(`Error importing entry ${entry.document}:`, error);
      errorCount++;
    }
  }

  console.log(`\n=== Import Complete ===`);
  console.log(`Imported: ${importedCount}`);
  console.log(`Skipped (no valid accounts): ${skippedCount}`);
  console.log(`Errors: ${errorCount}`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
