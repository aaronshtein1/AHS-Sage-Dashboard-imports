/**
 * Script to import Sage Intacct Journal Report CSV
 *
 * Usage: npx ts-node scripts/import-sage-journals.ts "C:\Users\aaron\Downloads\Journal report (2).csv"
 */

import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import * as fs from 'fs';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error('DATABASE_URL environment variable is not set');
  process.exit(1);
}

const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

interface ParsedLine {
  lineNo: number;
  memo: string;
  accountNo: string;
  locationId: string;
  debit: number;
  credit: number;
}

interface ParsedJournalEntry {
  journal: string;
  documentNo: string;
  date: string;
  description: string;
  lines: ParsedLine[];
  totalDebit: number;
  totalCredit: number;
  isBalanced: boolean;
}

// Parse CSV line handling quoted values
function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}

// Convert MM/DD/YYYY to Date
function parseDate(dateStr: string): Date {
  const parts = dateStr.split('/');
  if (parts.length === 3) {
    const [month, day, year] = parts;
    return new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
  }
  return new Date(dateStr);
}

function parseCSV(content: string): ParsedJournalEntry[] {
  const lines = content.split('\n').map(line => line.trim()).filter(line => line);

  // Find the header row
  let headerIndex = -1;
  for (let i = 0; i < Math.min(10, lines.length); i++) {
    if (lines[i].toLowerCase().includes('date') && lines[i].toLowerCase().includes('account')) {
      headerIndex = i;
      break;
    }
  }

  if (headerIndex === -1) {
    throw new Error('Could not find header row');
  }

  // Parse header
  const headerLine = lines[headerIndex];
  const headers = parseCSVLine(headerLine).map(h => h.trim().toLowerCase());

  // Find column indices
  const colIndex = {
    date: headers.findIndex(h => h === 'date'),
    document: headers.findIndex(h => h === 'document'),
    memo: headers.findIndex(h => h === 'memo'),
    accountNo: headers.findIndex(h => h.includes('account') && h.includes('no')),
    locationId: headers.findIndex(h => h.includes('location')),
    debit: headers.findIndex(h => h.includes('dr') || h.includes('increase')),
    credit: headers.findIndex(h => h.includes('cr') || h.includes('decrease')),
  };

  // Get journal type from lines before header
  let journalName = 'GJ';
  for (let i = 0; i < headerIndex; i++) {
    const line = lines[i].trim();
    if (line && !line.includes(',') && line.toLowerCase().includes('journal')) {
      journalName = line.replace(/journal/i, '').trim() || 'GJ';
      break;
    }
  }

  // Parse data rows
  const entries: ParsedJournalEntry[] = [];
  let currentEntry: ParsedJournalEntry | null = null;
  let lineNo = 0;

  for (let i = headerIndex + 1; i < lines.length; i++) {
    const line = lines[i];

    // Skip total rows
    if (line.toLowerCase().includes('total for transaction')) {
      if (currentEntry && currentEntry.lines.length > 0) {
        currentEntry.totalDebit = currentEntry.lines.reduce((sum, l) => sum + l.debit, 0);
        currentEntry.totalCredit = currentEntry.lines.reduce((sum, l) => sum + l.credit, 0);
        currentEntry.isBalanced = Math.abs(currentEntry.totalDebit - currentEntry.totalCredit) < 0.01;
        entries.push(currentEntry);
        currentEntry = null;
        lineNo = 0;
      }
      continue;
    }

    const values = parseCSVLine(line);
    const date = colIndex.date >= 0 ? values[colIndex.date] : '';
    const documentNo = colIndex.document >= 0 ? values[colIndex.document] : '';
    const memo = colIndex.memo >= 0 ? values[colIndex.memo] : '';
    const accountNo = colIndex.accountNo >= 0 ? values[colIndex.accountNo] : '';

    // Parse amounts
    const debitStr = colIndex.debit >= 0 ? values[colIndex.debit]?.replace(/[,$]/g, '') : '';
    const creditStr = colIndex.credit >= 0 ? values[colIndex.credit]?.replace(/[,$]/g, '') : '';
    const debit = parseFloat(debitStr) || 0;
    const credit = parseFloat(creditStr) || 0;

    // Skip rows without account or amounts
    if (!accountNo || (debit === 0 && credit === 0)) {
      // Check if starting new transaction
      if (date && documentNo) {
        if (currentEntry && currentEntry.lines.length > 0) {
          currentEntry.totalDebit = currentEntry.lines.reduce((sum, l) => sum + l.debit, 0);
          currentEntry.totalCredit = currentEntry.lines.reduce((sum, l) => sum + l.credit, 0);
          currentEntry.isBalanced = Math.abs(currentEntry.totalDebit - currentEntry.totalCredit) < 0.01;
          entries.push(currentEntry);
        }
        currentEntry = {
          journal: journalName,
          documentNo,
          date,
          description: memo,
          lines: [],
          totalDebit: 0,
          totalCredit: 0,
          isBalanced: false,
        };
        lineNo = 0;
      }
      continue;
    }

    // New transaction if document number changes
    if (date && documentNo && (!currentEntry || currentEntry.documentNo !== documentNo)) {
      if (currentEntry && currentEntry.lines.length > 0) {
        currentEntry.totalDebit = currentEntry.lines.reduce((sum, l) => sum + l.debit, 0);
        currentEntry.totalCredit = currentEntry.lines.reduce((sum, l) => sum + l.credit, 0);
        currentEntry.isBalanced = Math.abs(currentEntry.totalDebit - currentEntry.totalCredit) < 0.01;
        entries.push(currentEntry);
      }
      currentEntry = {
        journal: journalName,
        documentNo,
        date,
        description: memo,
        lines: [],
        totalDebit: 0,
        totalCredit: 0,
        isBalanced: false,
      };
      lineNo = 0;
    }

    if (!currentEntry) {
      currentEntry = {
        journal: journalName,
        documentNo: documentNo || 'N/A',
        date: date || new Date().toLocaleDateString(),
        description: memo,
        lines: [],
        totalDebit: 0,
        totalCredit: 0,
        isBalanced: false,
      };
    }

    lineNo++;
    currentEntry.lines.push({
      lineNo,
      memo: memo || '',
      accountNo,
      locationId: colIndex.locationId >= 0 ? values[colIndex.locationId] || '' : '',
      debit,
      credit,
    });
  }

  // Push last entry
  if (currentEntry && currentEntry.lines.length > 0) {
    currentEntry.totalDebit = currentEntry.lines.reduce((sum, l) => sum + l.debit, 0);
    currentEntry.totalCredit = currentEntry.lines.reduce((sum, l) => sum + l.credit, 0);
    currentEntry.isBalanced = Math.abs(currentEntry.totalDebit - currentEntry.totalCredit) < 0.01;
    entries.push(currentEntry);
  }

  return entries;
}

async function main() {
  const csvPath = process.argv[2] || 'C:\\Users\\aaron\\Downloads\\Journal report (2).csv';

  console.log('='.repeat(60));
  console.log('Sage Intacct Journal Import Script');
  console.log('='.repeat(60));
  console.log(`\nReading CSV from: ${csvPath}`);

  // Read CSV file
  if (!fs.existsSync(csvPath)) {
    console.error(`File not found: ${csvPath}`);
    process.exit(1);
  }

  const content = fs.readFileSync(csvPath, 'utf-8');
  const entries = parseCSV(content);

  console.log(`\nParsed ${entries.length} journal entries`);

  // Get the org (assuming single tenant for now)
  const org = await prisma.org.findFirst();
  if (!org) {
    console.error('No organization found in database. Please set up the org first.');
    process.exit(1);
  }
  console.log(`\nOrganization: ${org.name} (${org.id})`);

  // Get all accounts for mapping
  const accounts = await prisma.account.findMany({
    where: { orgId: org.id },
  });
  const accountMap = new Map(accounts.map(a => [a.accountCode, a]));
  console.log(`\nLoaded ${accounts.length} accounts`);

  // Delete existing draft journal entries
  console.log('\n--- Deleting existing draft journal entries ---');
  const deleteResult = await prisma.journalEntry.deleteMany({
    where: {
      orgId: org.id,
      status: 'DRAFT',
    },
  });
  console.log(`Deleted ${deleteResult.count} draft entries`);

  // Get or create journal type
  const journalCode = entries[0]?.journal?.toUpperCase() || 'BREX';
  let journalType = await prisma.journalType.findFirst({
    where: { orgId: org.id, code: journalCode },
  });

  if (!journalType) {
    journalType = await prisma.journalType.create({
      data: {
        orgId: org.id,
        code: journalCode,
        name: `${journalCode} Journal`,
        description: `Imported journal type for ${journalCode}`,
      },
    });
    console.log(`Created journal type: ${journalCode}`);
  } else {
    console.log(`Using existing journal type: ${journalCode}`);
  }

  // Import entries
  console.log('\n--- Importing journal entries ---');
  let successCount = 0;
  let failCount = 0;
  let skippedCount = 0;
  let entryCounter = 1;

  // Get the last entry number
  const lastEntry = await prisma.journalEntry.findFirst({
    where: { orgId: org.id },
    orderBy: { entryNumber: 'desc' },
  });
  if (lastEntry) {
    const match = lastEntry.entryNumber.match(/(\d+)/);
    if (match) {
      entryCounter = parseInt(match[1]) + 1;
    }
  }

  for (const entry of entries) {
    // Skip unbalanced entries
    if (!entry.isBalanced) {
      console.log(`  SKIP: Doc #${entry.documentNo} - not balanced (off by $${Math.abs(entry.totalDebit - entry.totalCredit).toFixed(2)})`);
      skippedCount++;
      continue;
    }

    // Map account numbers to IDs
    const missingAccounts: string[] = [];
    const linesData = entry.lines.map((line, idx) => {
      const account = accountMap.get(line.accountNo);
      if (!account) {
        missingAccounts.push(line.accountNo);
      }
      return {
        lineNumber: idx + 1,
        accountId: account?.id || '',
        debitAmount: line.debit,
        creditAmount: line.credit,
        description: line.memo || undefined,
      };
    }).filter(l => l.accountId);

    if (missingAccounts.length > 0) {
      console.log(`  SKIP: Doc #${entry.documentNo} - missing accounts: ${missingAccounts.join(', ')}`);
      skippedCount++;
      continue;
    }

    try {
      // Find or create period
      const entryDate = parseDate(entry.date);
      let period = await prisma.period.findFirst({
        where: {
          orgId: org.id,
          startDate: { lte: entryDate },
          endDate: { gte: entryDate },
        },
      });

      if (!period) {
        const startOfMonth = new Date(entryDate.getFullYear(), entryDate.getMonth(), 1);
        const endOfMonth = new Date(entryDate.getFullYear(), entryDate.getMonth() + 1, 0);
        const monthName = entryDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

        period = await prisma.period.create({
          data: {
            orgId: org.id,
            name: monthName,
            startDate: startOfMonth,
            endDate: endOfMonth,
            status: 'OPEN',
          },
        });
      }

      // Generate entry number
      const entryNumber = `JE-${String(entryCounter++).padStart(6, '0')}`;

      // Create journal entry with lines (using backend schema field names)
      await prisma.journalEntry.create({
        data: {
          orgId: org.id,
          journalTypeId: journalType.id,
          periodId: period.id,
          entryNumber,
          entryDate,
          description: entry.description || `Document ${entry.documentNo}`,
          reference: `${journalCode}-${entry.documentNo}`,
          status: 'DRAFT',
          lines: {
            create: linesData,
          },
        },
      });

      successCount++;
      if (successCount % 50 === 0) {
        console.log(`  Imported ${successCount} entries...`);
      }
    } catch (error) {
      console.log(`  FAIL: Doc #${entry.documentNo} - ${error instanceof Error ? error.message : 'Unknown error'}`);
      failCount++;
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log('IMPORT COMPLETE');
  console.log('='.repeat(60));
  console.log(`  Success: ${successCount}`);
  console.log(`  Failed:  ${failCount}`);
  console.log(`  Skipped: ${skippedCount}`);
  console.log(`  Total:   ${entries.length}`);
}

main()
  .catch((e) => {
    console.error('Fatal error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
