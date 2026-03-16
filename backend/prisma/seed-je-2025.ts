/**
 * Seed script for 2025 Journal Entries
 * Run with: npx ts-node prisma/seed-je-2025.ts
 */

import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
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

interface AccountMap {
  [key: string]: string;
}

async function main() {
  console.log('Starting 2025 Journal Entry seed...');

  // Get the first org (assuming one exists)
  const org = await prisma.org.findFirst();
  if (!org) {
    console.error('No organization found. Please create an org first.');
    process.exit(1);
  }
  console.log(`Using org: ${org.name} (${org.id})`);

  // Get or create journal types
  const journalTypes = await ensureJournalTypes(org.id);
  console.log('Journal types ready:', Object.keys(journalTypes));

  // Get or create accounts
  const accounts = await ensureAccounts(org.id);
  console.log('Accounts ready:', Object.keys(accounts).length, 'accounts');

  // Get or create periods for 2025
  const periods = await ensurePeriods(org.id);
  console.log('Periods ready:', Object.keys(periods).length, 'periods');

  // Generate journal entries
  await generateJournalEntries(org.id, journalTypes, accounts, periods);

  console.log('Seed completed successfully!');
}

async function ensureJournalTypes(orgId: string) {
  const types = [
    { code: 'GJ', name: 'General Journal', description: 'General journal entries' },
    { code: 'PR', name: 'Payroll', description: 'Payroll journal entries' },
    { code: 'REV', name: 'Revenue', description: 'Revenue recognition entries' },
    { code: 'ADJ', name: 'Adjusting Entry', description: 'Period-end adjustments' },
    { code: 'CD', name: 'Cash Disbursements', description: 'Cash payment entries' },
    { code: 'CR', name: 'Cash Receipts', description: 'Cash receipt entries' },
  ];

  const result: { [key: string]: string } = {};

  for (const type of types) {
    const existing = await prisma.journalType.findUnique({
      where: { orgId_code: { orgId, code: type.code } },
    });

    if (existing) {
      result[type.code] = existing.id;
    } else {
      const created = await prisma.journalType.create({
        data: { orgId, ...type },
      });
      result[type.code] = created.id;
    }
  }

  return result;
}

async function ensureAccounts(orgId: string) {
  const accountDefs = [
    // Assets
    { accountCode: '1000', title: 'Cash - Operating', accountType: 'ASSET', normalBalance: 'DEBIT', closingType: 'NON_CLOSING', category: 'Current Assets' },
    { accountCode: '1010', title: 'Cash - Payroll', accountType: 'ASSET', normalBalance: 'DEBIT', closingType: 'NON_CLOSING', category: 'Current Assets' },
    { accountCode: '1100', title: 'Accounts Receivable', accountType: 'ASSET', normalBalance: 'DEBIT', closingType: 'NON_CLOSING', category: 'Current Assets' },
    { accountCode: '1200', title: 'Prepaid Expenses', accountType: 'ASSET', normalBalance: 'DEBIT', closingType: 'NON_CLOSING', category: 'Current Assets' },
    { accountCode: '1500', title: 'Equipment', accountType: 'ASSET', normalBalance: 'DEBIT', closingType: 'NON_CLOSING', category: 'Fixed Assets' },
    { accountCode: '1510', title: 'Accumulated Depreciation', accountType: 'ASSET', normalBalance: 'CREDIT', closingType: 'NON_CLOSING', category: 'Fixed Assets' },

    // Liabilities
    { accountCode: '2000', title: 'Accounts Payable', accountType: 'LIABILITY', normalBalance: 'CREDIT', closingType: 'NON_CLOSING', category: 'Current Liabilities' },
    { accountCode: '2100', title: 'Accrued Payroll', accountType: 'LIABILITY', normalBalance: 'CREDIT', closingType: 'NON_CLOSING', category: 'Current Liabilities' },
    { accountCode: '2110', title: 'Payroll Taxes Payable', accountType: 'LIABILITY', normalBalance: 'CREDIT', closingType: 'NON_CLOSING', category: 'Current Liabilities' },
    { accountCode: '2120', title: 'Federal Withholding Payable', accountType: 'LIABILITY', normalBalance: 'CREDIT', closingType: 'NON_CLOSING', category: 'Current Liabilities' },
    { accountCode: '2130', title: 'State Withholding Payable', accountType: 'LIABILITY', normalBalance: 'CREDIT', closingType: 'NON_CLOSING', category: 'Current Liabilities' },
    { accountCode: '2140', title: '401k Payable', accountType: 'LIABILITY', normalBalance: 'CREDIT', closingType: 'NON_CLOSING', category: 'Current Liabilities' },
    { accountCode: '2150', title: 'Health Insurance Payable', accountType: 'LIABILITY', normalBalance: 'CREDIT', closingType: 'NON_CLOSING', category: 'Current Liabilities' },
    { accountCode: '2200', title: 'Accrued Expenses', accountType: 'LIABILITY', normalBalance: 'CREDIT', closingType: 'NON_CLOSING', category: 'Current Liabilities' },
    { accountCode: '2500', title: 'Deferred Revenue', accountType: 'LIABILITY', normalBalance: 'CREDIT', closingType: 'NON_CLOSING', category: 'Current Liabilities' },

    // Equity
    { accountCode: '3000', title: 'Retained Earnings', accountType: 'EQUITY', normalBalance: 'CREDIT', closingType: 'NON_CLOSING', category: 'Equity' },
    { accountCode: '3100', title: 'Common Stock', accountType: 'EQUITY', normalBalance: 'CREDIT', closingType: 'NON_CLOSING', category: 'Equity' },

    // Revenue
    { accountCode: '4000', title: 'Service Revenue - Home Health', accountType: 'REVENUE', normalBalance: 'CREDIT', closingType: 'CLOSING', category: 'Operating Revenue' },
    { accountCode: '4010', title: 'Service Revenue - Staffing', accountType: 'REVENUE', normalBalance: 'CREDIT', closingType: 'CLOSING', category: 'Operating Revenue' },
    { accountCode: '4020', title: 'Service Revenue - Consulting', accountType: 'REVENUE', normalBalance: 'CREDIT', closingType: 'CLOSING', category: 'Operating Revenue' },
    { accountCode: '4100', title: 'Medicare Revenue', accountType: 'REVENUE', normalBalance: 'CREDIT', closingType: 'CLOSING', category: 'Operating Revenue' },
    { accountCode: '4110', title: 'Medicaid Revenue', accountType: 'REVENUE', normalBalance: 'CREDIT', closingType: 'CLOSING', category: 'Operating Revenue' },
    { accountCode: '4120', title: 'Private Pay Revenue', accountType: 'REVENUE', normalBalance: 'CREDIT', closingType: 'CLOSING', category: 'Operating Revenue' },
    { accountCode: '4500', title: 'Interest Income', accountType: 'REVENUE', normalBalance: 'CREDIT', closingType: 'CLOSING', category: 'Other Income' },

    // Expenses - Payroll
    { accountCode: '5000', title: 'Salaries & Wages - Clinical', accountType: 'EXPENSE', normalBalance: 'DEBIT', closingType: 'CLOSING', category: 'Payroll Expenses' },
    { accountCode: '5010', title: 'Salaries & Wages - Admin', accountType: 'EXPENSE', normalBalance: 'DEBIT', closingType: 'CLOSING', category: 'Payroll Expenses' },
    { accountCode: '5020', title: 'Salaries & Wages - Management', accountType: 'EXPENSE', normalBalance: 'DEBIT', closingType: 'CLOSING', category: 'Payroll Expenses' },
    { accountCode: '5100', title: 'Payroll Taxes', accountType: 'EXPENSE', normalBalance: 'DEBIT', closingType: 'CLOSING', category: 'Payroll Expenses' },
    { accountCode: '5110', title: 'Health Insurance Expense', accountType: 'EXPENSE', normalBalance: 'DEBIT', closingType: 'CLOSING', category: 'Payroll Expenses' },
    { accountCode: '5120', title: '401k Match Expense', accountType: 'EXPENSE', normalBalance: 'DEBIT', closingType: 'CLOSING', category: 'Payroll Expenses' },
    { accountCode: '5130', title: 'Workers Comp Expense', accountType: 'EXPENSE', normalBalance: 'DEBIT', closingType: 'CLOSING', category: 'Payroll Expenses' },

    // Expenses - Operating
    { accountCode: '6000', title: 'Rent Expense', accountType: 'EXPENSE', normalBalance: 'DEBIT', closingType: 'CLOSING', category: 'Operating Expenses' },
    { accountCode: '6010', title: 'Utilities', accountType: 'EXPENSE', normalBalance: 'DEBIT', closingType: 'CLOSING', category: 'Operating Expenses' },
    { accountCode: '6020', title: 'Office Supplies', accountType: 'EXPENSE', normalBalance: 'DEBIT', closingType: 'CLOSING', category: 'Operating Expenses' },
    { accountCode: '6030', title: 'Medical Supplies', accountType: 'EXPENSE', normalBalance: 'DEBIT', closingType: 'CLOSING', category: 'Operating Expenses' },
    { accountCode: '6040', title: 'Insurance - General', accountType: 'EXPENSE', normalBalance: 'DEBIT', closingType: 'CLOSING', category: 'Operating Expenses' },
    { accountCode: '6050', title: 'Insurance - Professional Liability', accountType: 'EXPENSE', normalBalance: 'DEBIT', closingType: 'CLOSING', category: 'Operating Expenses' },
    { accountCode: '6060', title: 'Telephone & Internet', accountType: 'EXPENSE', normalBalance: 'DEBIT', closingType: 'CLOSING', category: 'Operating Expenses' },
    { accountCode: '6070', title: 'Software & Subscriptions', accountType: 'EXPENSE', normalBalance: 'DEBIT', closingType: 'CLOSING', category: 'Operating Expenses' },
    { accountCode: '6080', title: 'Marketing & Advertising', accountType: 'EXPENSE', normalBalance: 'DEBIT', closingType: 'CLOSING', category: 'Operating Expenses' },
    { accountCode: '6090', title: 'Professional Fees', accountType: 'EXPENSE', normalBalance: 'DEBIT', closingType: 'CLOSING', category: 'Operating Expenses' },
    { accountCode: '6100', title: 'Travel & Mileage', accountType: 'EXPENSE', normalBalance: 'DEBIT', closingType: 'CLOSING', category: 'Operating Expenses' },
    { accountCode: '6110', title: 'Training & Education', accountType: 'EXPENSE', normalBalance: 'DEBIT', closingType: 'CLOSING', category: 'Operating Expenses' },
    { accountCode: '6200', title: 'Depreciation Expense', accountType: 'EXPENSE', normalBalance: 'DEBIT', closingType: 'CLOSING', category: 'Operating Expenses' },
    { accountCode: '6300', title: 'Bank Fees', accountType: 'EXPENSE', normalBalance: 'DEBIT', closingType: 'CLOSING', category: 'Other Expenses' },
    { accountCode: '6900', title: 'Miscellaneous Expense', accountType: 'EXPENSE', normalBalance: 'DEBIT', closingType: 'CLOSING', category: 'Other Expenses' },
  ];

  const result: AccountMap = {};

  for (const acc of accountDefs) {
    const existing = await prisma.account.findUnique({
      where: { orgId_accountCode: { orgId, accountCode: acc.accountCode } },
    });

    if (existing) {
      result[acc.accountCode] = existing.id;
    } else {
      const created = await prisma.account.create({
        data: {
          orgId,
          ...acc,
          accountType: acc.accountType as any,
          normalBalance: acc.normalBalance as any,
          closingType: acc.closingType as any,
        },
      });
      result[acc.accountCode] = created.id;
    }
  }

  return result;
}

async function ensurePeriods(orgId: string) {
  const result: { [key: string]: string } = {};
  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  for (let i = 0; i < 12; i++) {
    const name = `${months[i]} 2025`;
    const startDate = new Date(2025, i, 1);
    const endDate = new Date(2025, i + 1, 0);

    const existing = await prisma.period.findUnique({
      where: { orgId_name: { orgId, name } },
    });

    if (existing) {
      result[months[i]] = existing.id;
    } else {
      const created = await prisma.period.create({
        data: { orgId, name, startDate, endDate, status: 'OPEN' },
      });
      result[months[i]] = created.id;
    }
  }

  return result;
}

async function generateJournalEntries(
  orgId: string,
  journalTypes: { [key: string]: string },
  accounts: AccountMap,
  periods: { [key: string]: string }
) {
  let entryCounter = 1;
  const months = ['January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'];

  for (let month = 0; month < 12; month++) {
    const periodId = periods[months[month]];
    const monthStr = (month + 1).toString().padStart(2, '0');

    console.log(`Generating entries for ${months[month]} 2025...`);

    // ========== REVENUE ENTRIES (Weekly) ==========
    for (let week = 1; week <= 4; week++) {
      const day = Math.min(week * 7, 28);
      const entryDate = new Date(2025, month, day);

      // Medicare Revenue
      const medicareAmount = 45000 + Math.random() * 15000;
      await createJournalEntry(orgId, {
        journalTypeId: journalTypes['REV'],
        periodId,
        entryNumber: `REV-2025-${entryCounter++}`,
        entryDate,
        description: `Medicare Revenue - Week ${week}`,
        status: 'POSTED',
        lines: [
          { accountId: accounts['1100'], debitAmount: medicareAmount, creditAmount: 0, description: 'AR - Medicare' },
          { accountId: accounts['4100'], debitAmount: 0, creditAmount: medicareAmount, description: 'Medicare billing' },
        ],
      });

      // Medicaid Revenue
      const medicaidAmount = 25000 + Math.random() * 10000;
      await createJournalEntry(orgId, {
        journalTypeId: journalTypes['REV'],
        periodId,
        entryNumber: `REV-2025-${entryCounter++}`,
        entryDate,
        description: `Medicaid Revenue - Week ${week}`,
        status: 'POSTED',
        lines: [
          { accountId: accounts['1100'], debitAmount: medicaidAmount, creditAmount: 0, description: 'AR - Medicaid' },
          { accountId: accounts['4110'], debitAmount: 0, creditAmount: medicaidAmount, description: 'Medicaid billing' },
        ],
      });

      // Private Pay Revenue
      const privatePayAmount = 15000 + Math.random() * 8000;
      await createJournalEntry(orgId, {
        journalTypeId: journalTypes['REV'],
        periodId,
        entryNumber: `REV-2025-${entryCounter++}`,
        entryDate,
        description: `Private Pay Revenue - Week ${week}`,
        status: 'POSTED',
        lines: [
          { accountId: accounts['1100'], debitAmount: privatePayAmount, creditAmount: 0, description: 'AR - Private Pay' },
          { accountId: accounts['4120'], debitAmount: 0, creditAmount: privatePayAmount, description: 'Private pay billing' },
        ],
      });

      // Cash Receipts
      const cashReceived = (medicareAmount + medicaidAmount + privatePayAmount) * 0.85;
      await createJournalEntry(orgId, {
        journalTypeId: journalTypes['CR'],
        periodId,
        entryNumber: `CR-2025-${entryCounter++}`,
        entryDate: new Date(2025, month, Math.min(day + 3, 28)),
        description: `Cash Receipts - Week ${week}`,
        status: 'POSTED',
        lines: [
          { accountId: accounts['1000'], debitAmount: cashReceived, creditAmount: 0, description: 'Cash received' },
          { accountId: accounts['1100'], debitAmount: 0, creditAmount: cashReceived, description: 'AR collection' },
        ],
      });
    }

    // ========== PAYROLL ENTRIES (Bi-weekly) ==========
    for (let pay = 1; pay <= 2; pay++) {
      const payDay = pay === 1 ? 15 : 28;
      const entryDate = new Date(2025, month, payDay);

      // Clinical Staff Payroll
      const clinicalGross = 85000 + Math.random() * 10000;
      const clinicalFedTax = clinicalGross * 0.18;
      const clinicalStateTax = clinicalGross * 0.05;
      const clinical401k = clinicalGross * 0.04;
      const clinicalHealth = 4500;
      const clinicalNet = clinicalGross - clinicalFedTax - clinicalStateTax - clinical401k - clinicalHealth;

      await createJournalEntry(orgId, {
        journalTypeId: journalTypes['PR'],
        periodId,
        entryNumber: `PR-2025-${entryCounter++}`,
        entryDate,
        description: `Payroll - Clinical Staff - Pay Period ${pay}`,
        status: 'POSTED',
        lines: [
          { accountId: accounts['5000'], debitAmount: clinicalGross, creditAmount: 0, description: 'Clinical salaries' },
          { accountId: accounts['2120'], debitAmount: 0, creditAmount: clinicalFedTax, description: 'Federal withholding' },
          { accountId: accounts['2130'], debitAmount: 0, creditAmount: clinicalStateTax, description: 'State withholding' },
          { accountId: accounts['2140'], debitAmount: 0, creditAmount: clinical401k, description: '401k withholding' },
          { accountId: accounts['2150'], debitAmount: 0, creditAmount: clinicalHealth, description: 'Health ins withholding' },
          { accountId: accounts['1010'], debitAmount: 0, creditAmount: clinicalNet, description: 'Net pay - clinical' },
        ],
      });

      // Admin Staff Payroll
      const adminGross = 35000 + Math.random() * 5000;
      const adminFedTax = adminGross * 0.18;
      const adminStateTax = adminGross * 0.05;
      const admin401k = adminGross * 0.04;
      const adminHealth = 2000;
      const adminNet = adminGross - adminFedTax - adminStateTax - admin401k - adminHealth;

      await createJournalEntry(orgId, {
        journalTypeId: journalTypes['PR'],
        periodId,
        entryNumber: `PR-2025-${entryCounter++}`,
        entryDate,
        description: `Payroll - Admin Staff - Pay Period ${pay}`,
        status: 'POSTED',
        lines: [
          { accountId: accounts['5010'], debitAmount: adminGross, creditAmount: 0, description: 'Admin salaries' },
          { accountId: accounts['2120'], debitAmount: 0, creditAmount: adminFedTax, description: 'Federal withholding' },
          { accountId: accounts['2130'], debitAmount: 0, creditAmount: adminStateTax, description: 'State withholding' },
          { accountId: accounts['2140'], debitAmount: 0, creditAmount: admin401k, description: '401k withholding' },
          { accountId: accounts['2150'], debitAmount: 0, creditAmount: adminHealth, description: 'Health ins withholding' },
          { accountId: accounts['1010'], debitAmount: 0, creditAmount: adminNet, description: 'Net pay - admin' },
        ],
      });

      // Management Payroll
      const mgmtGross = 25000 + Math.random() * 3000;
      const mgmtFedTax = mgmtGross * 0.22;
      const mgmtStateTax = mgmtGross * 0.05;
      const mgmt401k = mgmtGross * 0.06;
      const mgmtHealth = 1500;
      const mgmtNet = mgmtGross - mgmtFedTax - mgmtStateTax - mgmt401k - mgmtHealth;

      await createJournalEntry(orgId, {
        journalTypeId: journalTypes['PR'],
        periodId,
        entryNumber: `PR-2025-${entryCounter++}`,
        entryDate,
        description: `Payroll - Management - Pay Period ${pay}`,
        status: 'POSTED',
        lines: [
          { accountId: accounts['5020'], debitAmount: mgmtGross, creditAmount: 0, description: 'Management salaries' },
          { accountId: accounts['2120'], debitAmount: 0, creditAmount: mgmtFedTax, description: 'Federal withholding' },
          { accountId: accounts['2130'], debitAmount: 0, creditAmount: mgmtStateTax, description: 'State withholding' },
          { accountId: accounts['2140'], debitAmount: 0, creditAmount: mgmt401k, description: '401k withholding' },
          { accountId: accounts['2150'], debitAmount: 0, creditAmount: mgmtHealth, description: 'Health ins withholding' },
          { accountId: accounts['1010'], debitAmount: 0, creditAmount: mgmtNet, description: 'Net pay - management' },
        ],
      });

      // Employer Payroll Taxes
      const totalGross = clinicalGross + adminGross + mgmtGross;
      const employerTaxes = totalGross * 0.0765; // FICA

      await createJournalEntry(orgId, {
        journalTypeId: journalTypes['PR'],
        periodId,
        entryNumber: `PR-2025-${entryCounter++}`,
        entryDate,
        description: `Employer Payroll Taxes - Pay Period ${pay}`,
        status: 'POSTED',
        lines: [
          { accountId: accounts['5100'], debitAmount: employerTaxes, creditAmount: 0, description: 'Employer FICA' },
          { accountId: accounts['2110'], debitAmount: 0, creditAmount: employerTaxes, description: 'FICA payable' },
        ],
      });

      // 401k Match
      const total401kMatch = (clinical401k + admin401k + mgmt401k) * 0.5;
      await createJournalEntry(orgId, {
        journalTypeId: journalTypes['PR'],
        periodId,
        entryNumber: `PR-2025-${entryCounter++}`,
        entryDate,
        description: `401k Employer Match - Pay Period ${pay}`,
        status: 'POSTED',
        lines: [
          { accountId: accounts['5120'], debitAmount: total401kMatch, creditAmount: 0, description: '401k match expense' },
          { accountId: accounts['2140'], debitAmount: 0, creditAmount: total401kMatch, description: '401k match payable' },
        ],
      });

      // Health Insurance Employer Contribution
      const healthContribution = (clinicalHealth + adminHealth + mgmtHealth) * 0.7;
      await createJournalEntry(orgId, {
        journalTypeId: journalTypes['PR'],
        periodId,
        entryNumber: `PR-2025-${entryCounter++}`,
        entryDate,
        description: `Health Insurance Employer Contribution - Pay Period ${pay}`,
        status: 'POSTED',
        lines: [
          { accountId: accounts['5110'], debitAmount: healthContribution, creditAmount: 0, description: 'Health ins expense' },
          { accountId: accounts['2150'], debitAmount: 0, creditAmount: healthContribution, description: 'Health ins payable' },
        ],
      });
    }

    // ========== OPERATING EXPENSES (Monthly) ==========
    const firstOfMonth = new Date(2025, month, 1);

    // Rent
    await createJournalEntry(orgId, {
      journalTypeId: journalTypes['CD'],
      periodId,
      entryNumber: `CD-2025-${entryCounter++}`,
      entryDate: firstOfMonth,
      description: 'Monthly rent payment',
      status: 'POSTED',
      lines: [
        { accountId: accounts['6000'], debitAmount: 8500, creditAmount: 0, description: 'Office rent' },
        { accountId: accounts['1000'], debitAmount: 0, creditAmount: 8500, description: 'Rent payment' },
      ],
    });

    // Utilities
    const utilitiesAmount = 800 + Math.random() * 400;
    await createJournalEntry(orgId, {
      journalTypeId: journalTypes['CD'],
      periodId,
      entryNumber: `CD-2025-${entryCounter++}`,
      entryDate: new Date(2025, month, 10),
      description: 'Monthly utilities payment',
      status: 'POSTED',
      lines: [
        { accountId: accounts['6010'], debitAmount: utilitiesAmount, creditAmount: 0, description: 'Utilities' },
        { accountId: accounts['1000'], debitAmount: 0, creditAmount: utilitiesAmount, description: 'Utilities payment' },
      ],
    });

    // Telephone & Internet
    await createJournalEntry(orgId, {
      journalTypeId: journalTypes['CD'],
      periodId,
      entryNumber: `CD-2025-${entryCounter++}`,
      entryDate: new Date(2025, month, 5),
      description: 'Telephone & Internet service',
      status: 'POSTED',
      lines: [
        { accountId: accounts['6060'], debitAmount: 650, creditAmount: 0, description: 'Phone/Internet' },
        { accountId: accounts['1000'], debitAmount: 0, creditAmount: 650, description: 'Phone/Internet payment' },
      ],
    });

    // Software Subscriptions
    await createJournalEntry(orgId, {
      journalTypeId: journalTypes['CD'],
      periodId,
      entryNumber: `CD-2025-${entryCounter++}`,
      entryDate: new Date(2025, month, 1),
      description: 'Software subscriptions - EMR, scheduling, billing',
      status: 'POSTED',
      lines: [
        { accountId: accounts['6070'], debitAmount: 2800, creditAmount: 0, description: 'Software subs' },
        { accountId: accounts['1000'], debitAmount: 0, creditAmount: 2800, description: 'Software payment' },
      ],
    });

    // Medical Supplies
    const suppliesAmount = 3500 + Math.random() * 1500;
    await createJournalEntry(orgId, {
      journalTypeId: journalTypes['CD'],
      periodId,
      entryNumber: `CD-2025-${entryCounter++}`,
      entryDate: new Date(2025, month, 12),
      description: 'Medical supplies purchase',
      status: 'POSTED',
      lines: [
        { accountId: accounts['6030'], debitAmount: suppliesAmount, creditAmount: 0, description: 'Medical supplies' },
        { accountId: accounts['1000'], debitAmount: 0, creditAmount: suppliesAmount, description: 'Supplies payment' },
      ],
    });

    // Office Supplies
    const officeSuppliesAmount = 400 + Math.random() * 200;
    await createJournalEntry(orgId, {
      journalTypeId: journalTypes['CD'],
      periodId,
      entryNumber: `CD-2025-${entryCounter++}`,
      entryDate: new Date(2025, month, 8),
      description: 'Office supplies purchase',
      status: 'POSTED',
      lines: [
        { accountId: accounts['6020'], debitAmount: officeSuppliesAmount, creditAmount: 0, description: 'Office supplies' },
        { accountId: accounts['1000'], debitAmount: 0, creditAmount: officeSuppliesAmount, description: 'Supplies payment' },
      ],
    });

    // Travel & Mileage Reimbursement
    const mileageAmount = 2000 + Math.random() * 1000;
    await createJournalEntry(orgId, {
      journalTypeId: journalTypes['CD'],
      periodId,
      entryNumber: `CD-2025-${entryCounter++}`,
      entryDate: new Date(2025, month, 20),
      description: 'Staff mileage reimbursement',
      status: 'POSTED',
      lines: [
        { accountId: accounts['6100'], debitAmount: mileageAmount, creditAmount: 0, description: 'Mileage reimbursement' },
        { accountId: accounts['1000'], debitAmount: 0, creditAmount: mileageAmount, description: 'Mileage payment' },
      ],
    });

    // Bank Fees
    await createJournalEntry(orgId, {
      journalTypeId: journalTypes['GJ'],
      periodId,
      entryNumber: `GJ-2025-${entryCounter++}`,
      entryDate: new Date(2025, month, 28),
      description: 'Monthly bank service charges',
      status: 'POSTED',
      lines: [
        { accountId: accounts['6300'], debitAmount: 75, creditAmount: 0, description: 'Bank fees' },
        { accountId: accounts['1000'], debitAmount: 0, creditAmount: 75, description: 'Bank fee charge' },
      ],
    });

    // ========== QUARTERLY ENTRIES ==========
    if (month === 2 || month === 5 || month === 8 || month === 11) {
      // Insurance Payment (Quarterly)
      await createJournalEntry(orgId, {
        journalTypeId: journalTypes['CD'],
        periodId,
        entryNumber: `CD-2025-${entryCounter++}`,
        entryDate: new Date(2025, month, 15),
        description: 'Quarterly insurance premium - General Liability',
        status: 'POSTED',
        lines: [
          { accountId: accounts['6040'], debitAmount: 4500, creditAmount: 0, description: 'General liability ins' },
          { accountId: accounts['1000'], debitAmount: 0, creditAmount: 4500, description: 'Insurance payment' },
        ],
      });

      // Professional Liability Insurance
      await createJournalEntry(orgId, {
        journalTypeId: journalTypes['CD'],
        periodId,
        entryNumber: `CD-2025-${entryCounter++}`,
        entryDate: new Date(2025, month, 15),
        description: 'Quarterly insurance premium - Professional Liability',
        status: 'POSTED',
        lines: [
          { accountId: accounts['6050'], debitAmount: 6500, creditAmount: 0, description: 'Prof liability ins' },
          { accountId: accounts['1000'], debitAmount: 0, creditAmount: 6500, description: 'Insurance payment' },
        ],
      });

      // Workers Comp
      await createJournalEntry(orgId, {
        journalTypeId: journalTypes['CD'],
        periodId,
        entryNumber: `CD-2025-${entryCounter++}`,
        entryDate: new Date(2025, month, 15),
        description: 'Quarterly workers compensation premium',
        status: 'POSTED',
        lines: [
          { accountId: accounts['5130'], debitAmount: 8500, creditAmount: 0, description: 'Workers comp' },
          { accountId: accounts['1000'], debitAmount: 0, creditAmount: 8500, description: 'WC payment' },
        ],
      });

      // Professional Fees (CPA/Legal)
      await createJournalEntry(orgId, {
        journalTypeId: journalTypes['CD'],
        periodId,
        entryNumber: `CD-2025-${entryCounter++}`,
        entryDate: new Date(2025, month, 25),
        description: 'Quarterly professional services - Accounting & Legal',
        status: 'POSTED',
        lines: [
          { accountId: accounts['6090'], debitAmount: 3500, creditAmount: 0, description: 'Professional fees' },
          { accountId: accounts['1000'], debitAmount: 0, creditAmount: 3500, description: 'Prof fees payment' },
        ],
      });
    }

    // ========== MONTH-END ADJUSTMENTS ==========
    const lastDayOfMonth = new Date(2025, month + 1, 0);

    // Depreciation
    await createJournalEntry(orgId, {
      journalTypeId: journalTypes['ADJ'],
      periodId,
      entryNumber: `ADJ-2025-${entryCounter++}`,
      entryDate: lastDayOfMonth,
      description: 'Monthly depreciation expense',
      status: 'POSTED',
      lines: [
        { accountId: accounts['6200'], debitAmount: 1250, creditAmount: 0, description: 'Depreciation expense' },
        { accountId: accounts['1510'], debitAmount: 0, creditAmount: 1250, description: 'Accum depreciation' },
      ],
    });

    // Prepaid Insurance Amortization
    await createJournalEntry(orgId, {
      journalTypeId: journalTypes['ADJ'],
      periodId,
      entryNumber: `ADJ-2025-${entryCounter++}`,
      entryDate: lastDayOfMonth,
      description: 'Prepaid insurance amortization',
      status: 'POSTED',
      lines: [
        { accountId: accounts['6040'], debitAmount: 500, creditAmount: 0, description: 'Prepaid ins amortization' },
        { accountId: accounts['1200'], debitAmount: 0, creditAmount: 500, description: 'Prepaid expense reduction' },
      ],
    });

    // Interest Income (if any)
    const interestIncome = 50 + Math.random() * 100;
    await createJournalEntry(orgId, {
      journalTypeId: journalTypes['GJ'],
      periodId,
      entryNumber: `GJ-2025-${entryCounter++}`,
      entryDate: lastDayOfMonth,
      description: 'Monthly interest income',
      status: 'POSTED',
      lines: [
        { accountId: accounts['1000'], debitAmount: interestIncome, creditAmount: 0, description: 'Interest earned' },
        { accountId: accounts['4500'], debitAmount: 0, creditAmount: interestIncome, description: 'Interest income' },
      ],
    });

    // Create a few DRAFT entries for testing edit/delete
    if (month === 11) { // December only
      await createJournalEntry(orgId, {
        journalTypeId: journalTypes['GJ'],
        periodId,
        entryNumber: `GJ-2025-${entryCounter++}`,
        entryDate: new Date(2025, month, 28),
        description: 'DRAFT - Pending review - Misc adjustment',
        status: 'DRAFT',
        lines: [
          { accountId: accounts['6900'], debitAmount: 1500, creditAmount: 0, description: 'Misc expense' },
          { accountId: accounts['2200'], debitAmount: 0, creditAmount: 1500, description: 'Accrued expense' },
        ],
      });

      await createJournalEntry(orgId, {
        journalTypeId: journalTypes['ADJ'],
        periodId,
        entryNumber: `ADJ-2025-${entryCounter++}`,
        entryDate: new Date(2025, month, 31),
        description: 'DRAFT - Year-end accrual adjustment',
        status: 'DRAFT',
        lines: [
          { accountId: accounts['5000'], debitAmount: 12000, creditAmount: 0, description: 'Accrued wages' },
          { accountId: accounts['2100'], debitAmount: 0, creditAmount: 12000, description: 'Accrued payroll' },
        ],
      });

      await createJournalEntry(orgId, {
        journalTypeId: journalTypes['REV'],
        periodId,
        entryNumber: `REV-2025-${entryCounter++}`,
        entryDate: new Date(2025, month, 31),
        description: 'DRAFT - Deferred revenue recognition',
        status: 'DRAFT',
        lines: [
          { accountId: accounts['2500'], debitAmount: 8000, creditAmount: 0, description: 'Deferred rev reduction' },
          { accountId: accounts['4000'], debitAmount: 0, creditAmount: 8000, description: 'Service revenue' },
        ],
      });
    }
  }

  console.log(`Created ${entryCounter - 1} journal entries for 2025`);
}

async function createJournalEntry(orgId: string, data: {
  journalTypeId: string;
  periodId: string;
  entryNumber: string;
  entryDate: Date;
  description: string;
  status: string;
  lines: Array<{ accountId: string; debitAmount: number; creditAmount: number; description: string }>;
}) {
  // Check if entry already exists
  const existing = await prisma.journalEntry.findUnique({
    where: { orgId_entryNumber: { orgId, entryNumber: data.entryNumber } },
  });

  if (existing) {
    return existing;
  }

  return prisma.journalEntry.create({
    data: {
      orgId,
      journalTypeId: data.journalTypeId,
      periodId: data.periodId,
      entryNumber: data.entryNumber,
      entryDate: data.entryDate,
      description: data.description,
      status: data.status,
      postedAt: data.status === 'POSTED' ? new Date() : null,
      postedBy: data.status === 'POSTED' ? 'system' : null,
      lines: {
        create: data.lines.map((line, index) => ({
          lineNumber: index + 1,
          accountId: line.accountId,
          description: line.description,
          debitAmount: line.debitAmount,
          creditAmount: line.creditAmount,
        })),
      },
    },
  });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
