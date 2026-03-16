import { Injectable } from '@nestjs/common';
import { PostingService } from '../posting/posting.service';
import { PrismaService } from '../../common/prisma.service';
import { Prisma, AccountType, ClosingType, NormalBalance } from '@prisma/client';

type Decimal = Prisma.Decimal;
const Decimal = Prisma.Decimal;

// Report types for flexible report generation
export type ReportType =
  | 'trial-balance'
  | 'income-statement'
  | 'balance-sheet'
  | 'cash-flow'
  | 'general-ledger'
  | 'account-activity'
  | 'custom';

export type ComparisonType = 'none' | 'prior-period' | 'prior-year' | 'budget';

export type GroupByOption = 'none' | 'account-type' | 'category' | 'department' | 'location';

export interface ReportFilters {
  startDate?: string;
  endDate?: string;
  asOfDate?: string;
  accountTypes?: string[];
  accountIds?: string[];
  accountCodeStart?: string;
  accountCodeEnd?: string;
  departmentIds?: string[];
  locationIds?: string[];
  includeZeroBalances?: boolean;
  includeInactiveAccounts?: boolean;
}

export interface ReportDefinition {
  id?: string;
  name: string;
  description?: string;
  reportType: ReportType;
  filters: ReportFilters;
  comparison?: ComparisonType;
  groupBy?: GroupByOption;
  showSubtotals?: boolean;
  showGrandTotal?: boolean;
}

export interface ReportRow {
  id: string;
  accountCode?: string;
  accountTitle?: string;
  accountType?: string;
  category?: string;
  department?: string;
  location?: string;
  date?: string;
  description?: string;
  reference?: string;
  debit: string;
  credit: string;
  balance: string;
  openingBalance?: string;
  closingBalance?: string;
  netChange?: string;
  comparison?: string;
  variance?: string;
  variancePercent?: string;
  budget?: string;
  budgetVariance?: string;
  isSubtotal?: boolean;
  isGrandTotal?: boolean;
  indent?: number;
}

export interface ReportSection {
  title: string;
  accountType?: string;
  rows: ReportRow[];
  subtotal?: ReportRow;
}

export interface GeneratedReport {
  definition: ReportDefinition;
  generatedAt: string;
  orgName: string;
  periodLabel: string;
  sections: ReportSection[];
  grandTotal?: ReportRow;
  metadata?: {
    totalAccounts: number;
    totalTransactions?: number;
    dateRange?: { start: string; end: string };
  };
}

export interface TrialBalanceRow {
  accountId: string;
  accountCode: string;
  accountTitle: string;
  accountType: string;
  normalBalance: string;
  debitBalance: string;
  creditBalance: string;
}

export interface BalanceSheetSection {
  title: string;
  accounts: {
    accountCode: string;
    accountTitle: string;
    balance: string;
  }[];
  total: string;
}

export interface BalanceSheetReport {
  asOfDate: string;
  generatedAt: string;
  assets: {
    currentAssets: BalanceSheetSection;
    fixedAssets: BalanceSheetSection;
    totalAssets: string;
  };
  liabilities: {
    currentLiabilities: BalanceSheetSection;
    longTermLiabilities: BalanceSheetSection;
    totalLiabilities: string;
  };
  equity: {
    section: BalanceSheetSection;
    totalEquity: string;
  };
  totalLiabilitiesAndEquity: string;
}

export interface ProfitLossSection {
  title: string;
  accounts: {
    accountCode: string;
    accountTitle: string;
    amount: string;
  }[];
  total: string;
}

export interface ProfitLossReport {
  startDate: string;
  endDate: string;
  generatedAt: string;
  revenue: ProfitLossSection;
  expenses: ProfitLossSection;
  netIncome: string;
}

@Injectable()
export class ReportsService {
  constructor(
    private postingService: PostingService,
    private prisma: PrismaService,
  ) {}

  /**
   * Generate Trial Balance report
   */
  async getTrialBalance(
    orgId: string,
    asOfDate: Date,
  ): Promise<{
    asOfDate: string;
    generatedAt: string;
    rows: TrialBalanceRow[];
    totals: {
      totalDebits: string;
      totalCredits: string;
      difference: string;
    };
  }> {
    const result = await this.postingService.calculateTrialBalance(orgId, asOfDate);

    const rows: TrialBalanceRow[] = result.rows.map((row) => ({
      accountId: row.accountId,
      accountCode: row.accountCode,
      accountTitle: row.accountTitle,
      accountType: row.accountType,
      normalBalance: row.normalBalance,
      debitBalance: row.debitBalance.toString(),
      creditBalance: row.creditBalance.toString(),
    }));

    return {
      asOfDate: asOfDate.toISOString().split('T')[0],
      generatedAt: new Date().toISOString(),
      rows,
      totals: {
        totalDebits: result.totals.totalDebits.toString(),
        totalCredits: result.totals.totalCredits.toString(),
        difference: result.totals.totalDebits
          .minus(result.totals.totalCredits)
          .toString(),
      },
    };
  }

  /**
   * Generate Balance Sheet report
   */
  async getBalanceSheet(
    orgId: string,
    asOfDate: Date,
  ): Promise<BalanceSheetReport> {
    const tb = await this.postingService.calculateTrialBalance(orgId, asOfDate);

    // Categorize accounts
    const assets = tb.rows.filter((r) => r.accountType === AccountType.ASSET);
    const liabilities = tb.rows.filter((r) => r.accountType === AccountType.LIABILITY);
    const equity = tb.rows.filter((r) => r.accountType === AccountType.EQUITY);

    // Calculate balances (for balance sheet, show net balance)
    const calculateBalance = (row: typeof tb.rows[0]): Decimal => {
      if (row.normalBalance === 'DEBIT') {
        return row.debitBalance.minus(row.creditBalance);
      } else {
        return row.creditBalance.minus(row.debitBalance);
      }
    };

    const formatSection = (
      accounts: typeof tb.rows,
      title: string,
    ): BalanceSheetSection => {
      const formatted = accounts.map((a) => ({
        accountCode: a.accountCode,
        accountTitle: a.accountTitle,
        balance: calculateBalance(a).toString(),
      }));

      const total = accounts.reduce(
        (sum, a) => sum.plus(calculateBalance(a)),
        new Decimal(0),
      );

      return { title, accounts: formatted, total: total.toString() };
    };

    // Simple categorization (in real app, would use account.category)
    const currentAssets = formatSection(
      assets.filter((a) => a.accountCode < '1500'),
      'Current Assets',
    );
    const fixedAssets = formatSection(
      assets.filter((a) => a.accountCode >= '1500'),
      'Fixed Assets',
    );
    const totalAssets = new Decimal(currentAssets.total)
      .plus(fixedAssets.total)
      .toString();

    const currentLiabilities = formatSection(
      liabilities.filter((a) => a.accountCode < '2500'),
      'Current Liabilities',
    );
    const longTermLiabilities = formatSection(
      liabilities.filter((a) => a.accountCode >= '2500'),
      'Long-Term Liabilities',
    );
    const totalLiabilities = new Decimal(currentLiabilities.total)
      .plus(longTermLiabilities.total)
      .toString();

    const equitySection = formatSection(equity, 'Equity');
    const totalEquity = equitySection.total;

    return {
      asOfDate: asOfDate.toISOString().split('T')[0],
      generatedAt: new Date().toISOString(),
      assets: {
        currentAssets,
        fixedAssets,
        totalAssets,
      },
      liabilities: {
        currentLiabilities,
        longTermLiabilities,
        totalLiabilities,
      },
      equity: {
        section: equitySection,
        totalEquity,
      },
      totalLiabilitiesAndEquity: new Decimal(totalLiabilities)
        .plus(totalEquity)
        .toString(),
    };
  }

  /**
   * Generate Profit & Loss report
   */
  async getProfitLoss(
    orgId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<ProfitLossReport> {
    // Get all postings in the date range
    const postings = await this.prisma.ledgerPosting.findMany({
      where: {
        orgId,
        postingDate: { gte: startDate, lte: endDate },
      },
      include: {
        account: true,
      },
    });

    // Aggregate by account
    const accountBalances = new Map<
      string,
      { account: typeof postings[0]['account']; debits: Decimal; credits: Decimal }
    >();

    for (const posting of postings) {
      const existing = accountBalances.get(posting.accountId) || {
        account: posting.account,
        debits: new Decimal(0),
        credits: new Decimal(0),
      };
      accountBalances.set(posting.accountId, {
        account: posting.account,
        debits: existing.debits.plus(posting.debitAmount),
        credits: existing.credits.plus(posting.creditAmount),
      });
    }

    // Separate revenue and expenses (only CLOSING accounts for P&L)
    const revenues: { account: typeof postings[0]['account']; amount: Decimal }[] = [];
    const expenses: { account: typeof postings[0]['account']; amount: Decimal }[] = [];

    for (const [, data] of accountBalances) {
      if (data.account.closingType !== ClosingType.CLOSING) continue;

      const netAmount = data.debits.minus(data.credits);

      if (data.account.accountType === AccountType.REVENUE) {
        // Revenue has credit normal balance, so negate
        revenues.push({ account: data.account, amount: netAmount.negated() });
      } else if (data.account.accountType === AccountType.EXPENSE) {
        // Expense has debit normal balance
        expenses.push({ account: data.account, amount: netAmount });
      }
    }

    // Sort by account code
    revenues.sort((a, b) => a.account.accountCode.localeCompare(b.account.accountCode));
    expenses.sort((a, b) => a.account.accountCode.localeCompare(b.account.accountCode));

    const totalRevenue = revenues.reduce((sum, r) => sum.plus(r.amount), new Decimal(0));
    const totalExpenses = expenses.reduce((sum, e) => sum.plus(e.amount), new Decimal(0));

    return {
      startDate: startDate.toISOString().split('T')[0],
      endDate: endDate.toISOString().split('T')[0],
      generatedAt: new Date().toISOString(),
      revenue: {
        title: 'Revenue',
        accounts: revenues.map((r) => ({
          accountCode: r.account.accountCode,
          accountTitle: r.account.title,
          amount: r.amount.toString(),
        })),
        total: totalRevenue.toString(),
      },
      expenses: {
        title: 'Expenses',
        accounts: expenses.map((e) => ({
          accountCode: e.account.accountCode,
          accountTitle: e.account.title,
          amount: e.amount.toString(),
        })),
        total: totalExpenses.toString(),
      },
      netIncome: totalRevenue.minus(totalExpenses).toString(),
    };
  }

  /**
   * Generate Journal Listing report
   */
  async getJournalListing(
    orgId: string,
    startDate: Date,
    endDate: Date,
    journalTypeId?: string,
  ) {
    const where: any = {
      orgId,
      entryDate: { gte: startDate, lte: endDate },
      status: 'POSTED',
    };

    if (journalTypeId) {
      where.journalTypeId = journalTypeId;
    }

    const entries = await this.prisma.journalEntry.findMany({
      where,
      include: {
        journalType: true,
        lines: {
          include: { account: true },
          orderBy: { lineNumber: 'asc' },
        },
      },
      orderBy: [{ entryDate: 'asc' }, { entryNumber: 'asc' }],
    });

    return {
      startDate: startDate.toISOString().split('T')[0],
      endDate: endDate.toISOString().split('T')[0],
      generatedAt: new Date().toISOString(),
      entries: entries.map((entry) => {
        let totalDebits = new Decimal(0);
        let totalCredits = new Decimal(0);

        for (const line of entry.lines) {
          if (line.debitAmount) totalDebits = totalDebits.plus(line.debitAmount);
          if (line.creditAmount) totalCredits = totalCredits.plus(line.creditAmount);
        }

        return {
          entryNumber: entry.entryNumber,
          entryDate: entry.entryDate.toISOString().split('T')[0],
          postedAt: entry.postedAt?.toISOString().split('T')[0],
          journalType: entry.journalType.code,
          description: entry.description,
          reference: entry.reference,
          postedBy: entry.postedBy,
          totalDebits: totalDebits.toString(),
          totalCredits: totalCredits.toString(),
          lines: entry.lines.map((line) => ({
            accountCode: line.account.accountCode,
            accountTitle: line.account.title,
            debitAmount: line.debitAmount?.toString() || null,
            creditAmount: line.creditAmount?.toString() || null,
            description: line.description,
          })),
        };
      }),
      summary: {
        totalEntries: entries.length,
      },
    };
  }

  /**
   * Generate a flexible report based on a report definition
   */
  async generateReport(
    orgId: string,
    definition: ReportDefinition,
  ): Promise<GeneratedReport> {
    const org = await this.prisma.org.findUnique({ where: { id: orgId } });

    switch (definition.reportType) {
      case 'trial-balance':
        return this.generateTrialBalanceReport(orgId, org?.name || '', definition);
      case 'income-statement':
        return this.generateIncomeStatementReport(orgId, org?.name || '', definition);
      case 'balance-sheet':
        return this.generateBalanceSheetReport(orgId, org?.name || '', definition);
      case 'cash-flow':
        return this.generateCashFlowReport(orgId, org?.name || '', definition);
      case 'general-ledger':
        return this.generateGeneralLedgerReport(orgId, org?.name || '', definition);
      case 'account-activity':
        return this.generateAccountActivityReport(orgId, org?.name || '', definition);
      default:
        return this.generateCustomReport(orgId, org?.name || '', definition);
    }
  }

  private async generateTrialBalanceReport(
    orgId: string,
    orgName: string,
    definition: ReportDefinition,
  ): Promise<GeneratedReport> {
    const asOfDate = definition.filters.asOfDate
      ? new Date(definition.filters.asOfDate)
      : new Date();

    const result = await this.postingService.calculateTrialBalance(orgId, asOfDate);

    // Apply filters
    let filteredRows = result.rows;

    if (definition.filters.accountTypes?.length) {
      filteredRows = filteredRows.filter((r) =>
        definition.filters.accountTypes!.includes(r.accountType),
      );
    }

    if (definition.filters.accountCodeStart) {
      filteredRows = filteredRows.filter(
        (r) => r.accountCode >= definition.filters.accountCodeStart!,
      );
    }

    if (definition.filters.accountCodeEnd) {
      filteredRows = filteredRows.filter(
        (r) => r.accountCode <= definition.filters.accountCodeEnd!,
      );
    }

    if (!definition.filters.includeZeroBalances) {
      filteredRows = filteredRows.filter(
        (r) => !r.debitBalance.equals(0) || !r.creditBalance.equals(0),
      );
    }

    // Group by account type if requested
    const sections: ReportSection[] = [];
    let totalDebits = new Decimal(0);
    let totalCredits = new Decimal(0);

    if (definition.groupBy === 'account-type') {
      const accountTypeOrder = ['ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE'];
      const accountTypeLabels: Record<string, string> = {
        ASSET: 'Assets',
        LIABILITY: 'Liabilities',
        EQUITY: 'Equity',
        REVENUE: 'Revenue',
        EXPENSE: 'Expenses',
      };

      for (const accountType of accountTypeOrder) {
        const typeRows = filteredRows.filter((r) => r.accountType === accountType);
        if (typeRows.length === 0) continue;

        let sectionDebits = new Decimal(0);
        let sectionCredits = new Decimal(0);

        const rows: ReportRow[] = typeRows.map((r) => {
          sectionDebits = sectionDebits.plus(r.debitBalance);
          sectionCredits = sectionCredits.plus(r.creditBalance);
          return {
            id: r.accountId,
            accountCode: r.accountCode,
            accountTitle: r.accountTitle,
            accountType: r.accountType,
            debit: r.debitBalance.toString(),
            credit: r.creditBalance.toString(),
            balance: r.debitBalance.minus(r.creditBalance).toString(),
          };
        });

        totalDebits = totalDebits.plus(sectionDebits);
        totalCredits = totalCredits.plus(sectionCredits);

        sections.push({
          title: accountTypeLabels[accountType] || accountType,
          accountType,
          rows,
          subtotal: definition.showSubtotals
            ? {
                id: `subtotal-${accountType}`,
                accountTitle: `Total ${accountTypeLabels[accountType] || accountType}`,
                debit: sectionDebits.toString(),
                credit: sectionCredits.toString(),
                balance: sectionDebits.minus(sectionCredits).toString(),
                isSubtotal: true,
              }
            : undefined,
        });
      }
    } else {
      // No grouping - single section
      const rows: ReportRow[] = filteredRows.map((r) => {
        totalDebits = totalDebits.plus(r.debitBalance);
        totalCredits = totalCredits.plus(r.creditBalance);
        return {
          id: r.accountId,
          accountCode: r.accountCode,
          accountTitle: r.accountTitle,
          accountType: r.accountType,
          debit: r.debitBalance.toString(),
          credit: r.creditBalance.toString(),
          balance: r.debitBalance.minus(r.creditBalance).toString(),
        };
      });

      sections.push({
        title: 'All Accounts',
        rows,
      });
    }

    return {
      definition,
      generatedAt: new Date().toISOString(),
      orgName,
      periodLabel: `As of ${asOfDate.toISOString().split('T')[0]}`,
      sections,
      grandTotal: definition.showGrandTotal
        ? {
            id: 'grand-total',
            accountTitle: 'Grand Total',
            debit: totalDebits.toString(),
            credit: totalCredits.toString(),
            balance: totalDebits.minus(totalCredits).toString(),
            isGrandTotal: true,
          }
        : undefined,
      metadata: {
        totalAccounts: filteredRows.length,
      },
    };
  }

  private async generateIncomeStatementReport(
    orgId: string,
    orgName: string,
    definition: ReportDefinition,
  ): Promise<GeneratedReport> {
    const startDate = definition.filters.startDate
      ? new Date(definition.filters.startDate)
      : new Date(new Date().getFullYear(), 0, 1); // Start of year
    const endDate = definition.filters.endDate
      ? new Date(definition.filters.endDate)
      : new Date();

    const plReport = await this.getProfitLoss(orgId, startDate, endDate);

    const sections: ReportSection[] = [];

    // Revenue section
    const revenueRows: ReportRow[] = plReport.revenue.accounts.map((a, i) => ({
      id: `rev-${i}`,
      accountCode: a.accountCode,
      accountTitle: a.accountTitle,
      debit: '0',
      credit: a.amount,
      balance: a.amount,
    }));

    sections.push({
      title: 'Revenue',
      accountType: 'REVENUE',
      rows: revenueRows,
      subtotal: {
        id: 'subtotal-revenue',
        accountTitle: 'Total Revenue',
        debit: '0',
        credit: plReport.revenue.total,
        balance: plReport.revenue.total,
        isSubtotal: true,
      },
    });

    // Expenses section
    const expenseRows: ReportRow[] = plReport.expenses.accounts.map((a, i) => ({
      id: `exp-${i}`,
      accountCode: a.accountCode,
      accountTitle: a.accountTitle,
      debit: a.amount,
      credit: '0',
      balance: a.amount,
    }));

    sections.push({
      title: 'Expenses',
      accountType: 'EXPENSE',
      rows: expenseRows,
      subtotal: {
        id: 'subtotal-expenses',
        accountTitle: 'Total Expenses',
        debit: plReport.expenses.total,
        credit: '0',
        balance: plReport.expenses.total,
        isSubtotal: true,
      },
    });

    return {
      definition,
      generatedAt: new Date().toISOString(),
      orgName,
      periodLabel: `${startDate.toISOString().split('T')[0]} to ${endDate.toISOString().split('T')[0]}`,
      sections,
      grandTotal: {
        id: 'net-income',
        accountTitle: 'Net Income',
        debit: '0',
        credit: '0',
        balance: plReport.netIncome,
        isGrandTotal: true,
      },
      metadata: {
        totalAccounts: revenueRows.length + expenseRows.length,
        dateRange: {
          start: startDate.toISOString().split('T')[0],
          end: endDate.toISOString().split('T')[0],
        },
      },
    };
  }

  private async generateBalanceSheetReport(
    orgId: string,
    orgName: string,
    definition: ReportDefinition,
  ): Promise<GeneratedReport> {
    const asOfDate = definition.filters.asOfDate
      ? new Date(definition.filters.asOfDate)
      : new Date();

    const bsReport = await this.getBalanceSheet(orgId, asOfDate);

    const sections: ReportSection[] = [];

    // Assets
    const assetRows: ReportRow[] = [
      ...bsReport.assets.currentAssets.accounts.map((a, i) => ({
        id: `ca-${i}`,
        accountCode: a.accountCode,
        accountTitle: a.accountTitle,
        category: 'Current Assets',
        debit: a.balance,
        credit: '0',
        balance: a.balance,
        indent: 1,
      })),
      ...bsReport.assets.fixedAssets.accounts.map((a, i) => ({
        id: `fa-${i}`,
        accountCode: a.accountCode,
        accountTitle: a.accountTitle,
        category: 'Fixed Assets',
        debit: a.balance,
        credit: '0',
        balance: a.balance,
        indent: 1,
      })),
    ];

    sections.push({
      title: 'Assets',
      accountType: 'ASSET',
      rows: assetRows,
      subtotal: {
        id: 'subtotal-assets',
        accountTitle: 'Total Assets',
        debit: bsReport.assets.totalAssets,
        credit: '0',
        balance: bsReport.assets.totalAssets,
        isSubtotal: true,
      },
    });

    // Liabilities
    const liabilityRows: ReportRow[] = [
      ...bsReport.liabilities.currentLiabilities.accounts.map((a, i) => ({
        id: `cl-${i}`,
        accountCode: a.accountCode,
        accountTitle: a.accountTitle,
        category: 'Current Liabilities',
        debit: '0',
        credit: a.balance,
        balance: a.balance,
        indent: 1,
      })),
      ...bsReport.liabilities.longTermLiabilities.accounts.map((a, i) => ({
        id: `ltl-${i}`,
        accountCode: a.accountCode,
        accountTitle: a.accountTitle,
        category: 'Long-Term Liabilities',
        debit: '0',
        credit: a.balance,
        balance: a.balance,
        indent: 1,
      })),
    ];

    sections.push({
      title: 'Liabilities',
      accountType: 'LIABILITY',
      rows: liabilityRows,
      subtotal: {
        id: 'subtotal-liabilities',
        accountTitle: 'Total Liabilities',
        debit: '0',
        credit: bsReport.liabilities.totalLiabilities,
        balance: bsReport.liabilities.totalLiabilities,
        isSubtotal: true,
      },
    });

    // Equity
    const equityRows: ReportRow[] = bsReport.equity.section.accounts.map((a, i) => ({
      id: `eq-${i}`,
      accountCode: a.accountCode,
      accountTitle: a.accountTitle,
      debit: '0',
      credit: a.balance,
      balance: a.balance,
      indent: 1,
    }));

    sections.push({
      title: 'Equity',
      accountType: 'EQUITY',
      rows: equityRows,
      subtotal: {
        id: 'subtotal-equity',
        accountTitle: 'Total Equity',
        debit: '0',
        credit: bsReport.equity.totalEquity,
        balance: bsReport.equity.totalEquity,
        isSubtotal: true,
      },
    });

    return {
      definition,
      generatedAt: new Date().toISOString(),
      orgName,
      periodLabel: `As of ${asOfDate.toISOString().split('T')[0]}`,
      sections,
      grandTotal: {
        id: 'total-l-and-e',
        accountTitle: 'Total Liabilities & Equity',
        debit: '0',
        credit: bsReport.totalLiabilitiesAndEquity,
        balance: bsReport.totalLiabilitiesAndEquity,
        isGrandTotal: true,
      },
      metadata: {
        totalAccounts: assetRows.length + liabilityRows.length + equityRows.length,
      },
    };
  }

  private async generateGeneralLedgerReport(
    orgId: string,
    orgName: string,
    definition: ReportDefinition,
  ): Promise<GeneratedReport> {
    const startDate = definition.filters.startDate
      ? new Date(definition.filters.startDate)
      : new Date(new Date().getFullYear(), 0, 1);
    const endDate = definition.filters.endDate
      ? new Date(definition.filters.endDate)
      : new Date();

    // Get all accounts with their transactions
    const whereAccount: any = { orgId };

    if (definition.filters.accountTypes?.length) {
      whereAccount.accountType = { in: definition.filters.accountTypes };
    }

    if (definition.filters.accountCodeStart) {
      whereAccount.accountCode = { gte: definition.filters.accountCodeStart };
    }

    if (definition.filters.accountCodeEnd) {
      whereAccount.accountCode = {
        ...whereAccount.accountCode,
        lte: definition.filters.accountCodeEnd,
      };
    }

    if (definition.filters.accountIds?.length) {
      whereAccount.id = { in: definition.filters.accountIds };
    }

    const accounts = await this.prisma.account.findMany({
      where: whereAccount,
      orderBy: { accountCode: 'asc' },
    });

    const sections: ReportSection[] = [];
    let totalTransactions = 0;

    for (const account of accounts) {
      // Get opening balance (all postings before start date)
      const openingPostings = await this.prisma.ledgerPosting.aggregate({
        where: {
          orgId,
          accountId: account.id,
          postingDate: { lt: startDate },
        },
        _sum: {
          debitAmount: true,
          creditAmount: true,
        },
      });

      const openingDebits = new Decimal(openingPostings._sum.debitAmount || 0);
      const openingCredits = new Decimal(openingPostings._sum.creditAmount || 0);
      const openingBalance =
        account.normalBalance === NormalBalance.DEBIT
          ? openingDebits.minus(openingCredits)
          : openingCredits.minus(openingDebits);

      // Get transactions in date range
      const postings = await this.prisma.ledgerPosting.findMany({
        where: {
          orgId,
          accountId: account.id,
          postingDate: { gte: startDate, lte: endDate },
        },
        include: {
          journalEntry: true,
        },
        orderBy: { postingDate: 'asc' },
      });

      if (postings.length === 0 && !definition.filters.includeZeroBalances) {
        continue;
      }

      totalTransactions += postings.length;
      let runningBalance = openingBalance;

      const rows: ReportRow[] = [
        {
          id: `${account.id}-opening`,
          date: startDate.toISOString().split('T')[0],
          description: 'Opening Balance',
          debit: '0',
          credit: '0',
          balance: openingBalance.toString(),
          openingBalance: openingBalance.toString(),
        },
      ];

      for (const posting of postings) {
        const debitAmt = new Decimal(posting.debitAmount);
        const creditAmt = new Decimal(posting.creditAmount);

        if (account.normalBalance === NormalBalance.DEBIT) {
          runningBalance = runningBalance.plus(debitAmt).minus(creditAmt);
        } else {
          runningBalance = runningBalance.plus(creditAmt).minus(debitAmt);
        }

        rows.push({
          id: posting.id,
          date: posting.postingDate.toISOString().split('T')[0],
          description: posting.journalEntry.description || undefined,
          reference: posting.journalEntry.reference || undefined,
          debit: debitAmt.toString(),
          credit: creditAmt.toString(),
          balance: runningBalance.toString(),
        });
      }

      sections.push({
        title: `${account.accountCode} - ${account.title}`,
        accountType: account.accountType,
        rows,
        subtotal: {
          id: `${account.id}-closing`,
          accountTitle: 'Closing Balance',
          debit: postings
            .reduce((sum, p) => sum.plus(p.debitAmount), new Decimal(0))
            .toString(),
          credit: postings
            .reduce((sum, p) => sum.plus(p.creditAmount), new Decimal(0))
            .toString(),
          balance: runningBalance.toString(),
          closingBalance: runningBalance.toString(),
          isSubtotal: true,
        },
      });
    }

    return {
      definition,
      generatedAt: new Date().toISOString(),
      orgName,
      periodLabel: `${startDate.toISOString().split('T')[0]} to ${endDate.toISOString().split('T')[0]}`,
      sections,
      metadata: {
        totalAccounts: sections.length,
        totalTransactions,
        dateRange: {
          start: startDate.toISOString().split('T')[0],
          end: endDate.toISOString().split('T')[0],
        },
      },
    };
  }

  private async generateAccountActivityReport(
    orgId: string,
    orgName: string,
    definition: ReportDefinition,
  ): Promise<GeneratedReport> {
    const startDate = definition.filters.startDate
      ? new Date(definition.filters.startDate)
      : new Date(new Date().getFullYear(), 0, 1);
    const endDate = definition.filters.endDate
      ? new Date(definition.filters.endDate)
      : new Date();

    // Get account activity summary
    const whereAccount: any = { orgId };

    if (definition.filters.accountTypes?.length) {
      whereAccount.accountType = { in: definition.filters.accountTypes };
    }

    if (definition.filters.accountCodeStart) {
      whereAccount.accountCode = { gte: definition.filters.accountCodeStart };
    }

    if (definition.filters.accountCodeEnd) {
      whereAccount.accountCode = {
        ...whereAccount.accountCode,
        lte: definition.filters.accountCodeEnd,
      };
    }

    const accounts = await this.prisma.account.findMany({
      where: whereAccount,
      orderBy: { accountCode: 'asc' },
    });

    const rows: ReportRow[] = [];
    let totalDebits = new Decimal(0);
    let totalCredits = new Decimal(0);

    for (const account of accounts) {
      // Get opening balance
      const openingPostings = await this.prisma.ledgerPosting.aggregate({
        where: {
          orgId,
          accountId: account.id,
          postingDate: { lt: startDate },
        },
        _sum: {
          debitAmount: true,
          creditAmount: true,
        },
      });

      // Get period activity
      const periodPostings = await this.prisma.ledgerPosting.aggregate({
        where: {
          orgId,
          accountId: account.id,
          postingDate: { gte: startDate, lte: endDate },
        },
        _sum: {
          debitAmount: true,
          creditAmount: true,
        },
      });

      const openingDebits = new Decimal(openingPostings._sum.debitAmount || 0);
      const openingCredits = new Decimal(openingPostings._sum.creditAmount || 0);
      const periodDebits = new Decimal(periodPostings._sum.debitAmount || 0);
      const periodCredits = new Decimal(periodPostings._sum.creditAmount || 0);

      const openingBalance =
        account.normalBalance === NormalBalance.DEBIT
          ? openingDebits.minus(openingCredits)
          : openingCredits.minus(openingDebits);

      const netChange =
        account.normalBalance === NormalBalance.DEBIT
          ? periodDebits.minus(periodCredits)
          : periodCredits.minus(periodDebits);

      const closingBalance = openingBalance.plus(netChange);

      if (
        !definition.filters.includeZeroBalances &&
        periodDebits.equals(0) &&
        periodCredits.equals(0) &&
        openingBalance.equals(0)
      ) {
        continue;
      }

      totalDebits = totalDebits.plus(periodDebits);
      totalCredits = totalCredits.plus(periodCredits);

      rows.push({
        id: account.id,
        accountCode: account.accountCode,
        accountTitle: account.title,
        accountType: account.accountType,
        openingBalance: openingBalance.toString(),
        debit: periodDebits.toString(),
        credit: periodCredits.toString(),
        netChange: netChange.toString(),
        closingBalance: closingBalance.toString(),
        balance: closingBalance.toString(),
      });
    }

    return {
      definition,
      generatedAt: new Date().toISOString(),
      orgName,
      periodLabel: `${startDate.toISOString().split('T')[0]} to ${endDate.toISOString().split('T')[0]}`,
      sections: [
        {
          title: 'Account Activity Summary',
          rows,
        },
      ],
      grandTotal: {
        id: 'grand-total',
        accountTitle: 'Grand Total',
        debit: totalDebits.toString(),
        credit: totalCredits.toString(),
        balance: '0',
        isGrandTotal: true,
      },
      metadata: {
        totalAccounts: rows.length,
        dateRange: {
          start: startDate.toISOString().split('T')[0],
          end: endDate.toISOString().split('T')[0],
        },
      },
    };
  }

  /**
   * Generate Cash Flow Statement using indirect method
   */
  private async generateCashFlowReport(
    orgId: string,
    orgName: string,
    definition: ReportDefinition,
  ): Promise<GeneratedReport> {
    const startDate = definition.filters.startDate
      ? new Date(definition.filters.startDate)
      : new Date(new Date().getFullYear(), 0, 1);
    const endDate = definition.filters.endDate
      ? new Date(definition.filters.endDate)
      : new Date();

    // Get P&L for net income
    const plReport = await this.getProfitLoss(orgId, startDate, endDate);
    const netIncome = new Decimal(plReport.netIncome);

    // Get all postings in the period grouped by account
    const postings = await this.prisma.ledgerPosting.findMany({
      where: {
        orgId,
        postingDate: { gte: startDate, lte: endDate },
      },
      include: { account: true },
    });

    // Aggregate changes by account
    const accountChanges = new Map<string, { account: NonNullable<typeof postings[0]['account']>; change: Decimal }>();
    for (const posting of postings) {
      // Skip orphaned postings without a valid account
      if (!posting.account) continue;

      const existing = accountChanges.get(posting.accountId);
      const change = new Decimal(posting.debitAmount).minus(posting.creditAmount);
      if (existing) {
        existing.change = existing.change.plus(change);
      } else {
        accountChanges.set(posting.accountId, { account: posting.account, change });
      }
    }

    const sections: ReportSection[] = [];

    // Operating Activities
    const operatingRows: ReportRow[] = [];
    let operatingTotal = netIncome;

    // Start with Net Income
    operatingRows.push({
      id: 'net-income',
      accountTitle: 'Net Income',
      debit: '0',
      credit: '0',
      balance: netIncome.toString(),
    });

    // Adjustments for non-cash items and working capital changes
    for (const [, data] of accountChanges) {
      const code = data.account.accountCode || '';
      const title = data.account.title || '';
      const type = data.account.accountType;

      // Depreciation/Amortization (add back - non-cash expense)
      if (title.toLowerCase().includes('depreciation') || title.toLowerCase().includes('amortization')) {
        const amount = data.change.abs();
        operatingRows.push({
          id: `op-${data.account.id}`,
          accountCode: code,
          accountTitle: `Add: ${title}`,
          debit: '0',
          credit: '0',
          balance: amount.toString(),
        });
        operatingTotal = operatingTotal.plus(amount);
      }
      // Changes in Accounts Receivable (decrease = source, increase = use)
      else if (type === AccountType.ASSET && (code.startsWith('11') || code.startsWith('12') || title.toLowerCase().includes('receivable'))) {
        const change = data.change.negated(); // Increase in AR = decrease in cash
        if (!change.isZero()) {
          operatingRows.push({
            id: `op-${data.account.id}`,
            accountCode: code,
            accountTitle: `${change.greaterThan(0) ? 'Decrease' : 'Increase'} in ${title}`,
            debit: '0',
            credit: '0',
            balance: change.toString(),
          });
          operatingTotal = operatingTotal.plus(change);
        }
      }
      // Changes in Accounts Payable (increase = source, decrease = use)
      else if (type === AccountType.LIABILITY && (code.startsWith('20') || title.toLowerCase().includes('payable'))) {
        const change = data.change.negated(); // Increase in AP = increase in cash
        if (!change.isZero()) {
          operatingRows.push({
            id: `op-${data.account.id}`,
            accountCode: code,
            accountTitle: `${change.greaterThan(0) ? 'Increase' : 'Decrease'} in ${title}`,
            debit: '0',
            credit: '0',
            balance: change.toString(),
          });
          operatingTotal = operatingTotal.plus(change);
        }
      }
      // Prepaid expenses and other current assets
      else if (type === AccountType.ASSET && (code.startsWith('13') || code.startsWith('14') || title.toLowerCase().includes('prepaid'))) {
        const change = data.change.negated();
        if (!change.isZero()) {
          operatingRows.push({
            id: `op-${data.account.id}`,
            accountCode: code,
            accountTitle: `${change.greaterThan(0) ? 'Decrease' : 'Increase'} in ${title}`,
            debit: '0',
            credit: '0',
            balance: change.toString(),
          });
          operatingTotal = operatingTotal.plus(change);
        }
      }
    }

    sections.push({
      title: 'Cash Flows from Operating Activities',
      rows: operatingRows,
      subtotal: {
        id: 'subtotal-operating',
        accountTitle: 'Net Cash from Operating Activities',
        debit: '0',
        credit: '0',
        balance: operatingTotal.toString(),
        isSubtotal: true,
      },
    });

    // Investing Activities
    const investingRows: ReportRow[] = [];
    let investingTotal = new Decimal(0);

    for (const [, data] of accountChanges) {
      const code = data.account.accountCode || '';
      const title = data.account.title || '';
      const type = data.account.accountType;

      // Fixed Assets (Property, Equipment) - exclude accumulated depreciation
      if (type === AccountType.ASSET && code >= '1500' && code < '2000' &&
          !title.toLowerCase().includes('accumulated') && !title.toLowerCase().includes('depreciation')) {
        const change = data.change.negated(); // Purchase = cash outflow
        if (!change.isZero()) {
          investingRows.push({
            id: `inv-${data.account.id}`,
            accountCode: code,
            accountTitle: `${change.lessThan(0) ? 'Purchase of' : 'Sale of'} ${title}`,
            debit: '0',
            credit: '0',
            balance: change.toString(),
          });
          investingTotal = investingTotal.plus(change);
        }
      }
      // Investments
      else if (type === AccountType.ASSET && (title.toLowerCase().includes('investment') || title.toLowerCase().includes('securities'))) {
        const change = data.change.negated();
        if (!change.isZero()) {
          investingRows.push({
            id: `inv-${data.account.id}`,
            accountCode: code,
            accountTitle: `${change.lessThan(0) ? 'Purchase of' : 'Proceeds from'} ${title}`,
            debit: '0',
            credit: '0',
            balance: change.toString(),
          });
          investingTotal = investingTotal.plus(change);
        }
      }
    }

    if (investingRows.length === 0) {
      investingRows.push({
        id: 'inv-none',
        accountTitle: 'No investing activities',
        debit: '0',
        credit: '0',
        balance: '0',
      });
    }

    sections.push({
      title: 'Cash Flows from Investing Activities',
      rows: investingRows,
      subtotal: {
        id: 'subtotal-investing',
        accountTitle: 'Net Cash from Investing Activities',
        debit: '0',
        credit: '0',
        balance: investingTotal.toString(),
        isSubtotal: true,
      },
    });

    // Financing Activities
    const financingRows: ReportRow[] = [];
    let financingTotal = new Decimal(0);

    for (const [, data] of accountChanges) {
      const code = data.account.accountCode || '';
      const title = data.account.title || '';
      const type = data.account.accountType;

      // Long-term debt
      if (type === AccountType.LIABILITY && code >= '2500') {
        const change = data.change.negated();
        if (!change.isZero()) {
          financingRows.push({
            id: `fin-${data.account.id}`,
            accountCode: code,
            accountTitle: `${change.greaterThan(0) ? 'Proceeds from' : 'Repayment of'} ${title}`,
            debit: '0',
            credit: '0',
            balance: change.toString(),
          });
          financingTotal = financingTotal.plus(change);
        }
      }
      // Equity changes (except retained earnings which is from net income)
      else if (type === AccountType.EQUITY && !title.toLowerCase().includes('retained')) {
        const change = data.change.negated();
        if (!change.isZero()) {
          financingRows.push({
            id: `fin-${data.account.id}`,
            accountCode: code,
            accountTitle: `${change.greaterThan(0) ? 'Capital contribution' : 'Distribution'}: ${title}`,
            debit: '0',
            credit: '0',
            balance: change.toString(),
          });
          financingTotal = financingTotal.plus(change);
        }
      }
    }

    if (financingRows.length === 0) {
      financingRows.push({
        id: 'fin-none',
        accountTitle: 'No financing activities',
        debit: '0',
        credit: '0',
        balance: '0',
      });
    }

    sections.push({
      title: 'Cash Flows from Financing Activities',
      rows: financingRows,
      subtotal: {
        id: 'subtotal-financing',
        accountTitle: 'Net Cash from Financing Activities',
        debit: '0',
        credit: '0',
        balance: financingTotal.toString(),
        isSubtotal: true,
      },
    });

    // Calculate net change in cash
    const netCashChange = operatingTotal.plus(investingTotal).plus(financingTotal);

    // Get beginning and ending cash balances
    const cashAccounts = await this.prisma.account.findMany({
      where: {
        orgId,
        accountType: AccountType.ASSET,
        accountCode: { startsWith: '10' },
      },
    });

    let beginningCash = new Decimal(0);
    let endingCash = new Decimal(0);

    for (const account of cashAccounts) {
      // Beginning balance
      const beginningPostings = await this.prisma.ledgerPosting.aggregate({
        where: {
          orgId,
          accountId: account.id,
          postingDate: { lt: startDate },
        },
        _sum: { debitAmount: true, creditAmount: true },
      });
      beginningCash = beginningCash.plus(
        new Decimal(beginningPostings._sum.debitAmount || 0).minus(beginningPostings._sum.creditAmount || 0)
      );

      // Ending balance
      const endingPostings = await this.prisma.ledgerPosting.aggregate({
        where: {
          orgId,
          accountId: account.id,
          postingDate: { lte: endDate },
        },
        _sum: { debitAmount: true, creditAmount: true },
      });
      endingCash = endingCash.plus(
        new Decimal(endingPostings._sum.debitAmount || 0).minus(endingPostings._sum.creditAmount || 0)
      );
    }

    // Summary section
    sections.push({
      title: 'Summary',
      rows: [
        {
          id: 'summary-net-change',
          accountTitle: 'Net Change in Cash',
          debit: '0',
          credit: '0',
          balance: netCashChange.toString(),
        },
        {
          id: 'summary-beginning',
          accountTitle: 'Cash at Beginning of Period',
          debit: '0',
          credit: '0',
          balance: beginningCash.toString(),
        },
        {
          id: 'summary-ending',
          accountTitle: 'Cash at End of Period',
          debit: '0',
          credit: '0',
          balance: endingCash.toString(),
        },
      ],
    });

    return {
      definition,
      generatedAt: new Date().toISOString(),
      orgName,
      periodLabel: `${startDate.toISOString().split('T')[0]} to ${endDate.toISOString().split('T')[0]}`,
      sections,
      grandTotal: {
        id: 'net-cash-change',
        accountTitle: 'Net Change in Cash',
        debit: '0',
        credit: '0',
        balance: netCashChange.toString(),
        isGrandTotal: true,
      },
      metadata: {
        totalAccounts: cashAccounts.length,
        dateRange: {
          start: startDate.toISOString().split('T')[0],
          end: endDate.toISOString().split('T')[0],
        },
      },
    };
  }

  private async generateCustomReport(
    orgId: string,
    orgName: string,
    definition: ReportDefinition,
  ): Promise<GeneratedReport> {
    // For custom reports, default to trial balance behavior
    return this.generateTrialBalanceReport(orgId, orgName, definition);
  }

  /**
   * Get account balances from ledger postings for the Financial Report Writer
   */
  async getAccountBalances(
    orgId: string,
    startDate: Date,
    endDate: Date,
    options?: {
      includeMonthly?: boolean;
      dimensionTypeIds?: string[];
    },
  ): Promise<{
    accounts: {
      accountId: string;
      accountCode: string;
      accountTitle: string;
      accountType: string;
      normalBalance: string;
      debits: string;
      credits: string;
      monthlyBalances?: { month: number; year: number; debits: string; credits: string }[];
      dimensionBalances?: { dimensionValueId: string; debits: string; credits: string }[];
    }[];
  }> {
    // Get all accounts
    const accounts = await this.prisma.account.findMany({
      where: { orgId, status: 'ACTIVE' },
      orderBy: { accountCode: 'asc' },
    });

    // Get all ledger postings in the date range
    const postings = await this.prisma.ledgerPosting.findMany({
      where: {
        orgId,
        postingDate: { gte: startDate, lte: endDate },
      },
    });

    // Aggregate by account
    const balancesByAccount = new Map<
      string,
      {
        debits: Decimal;
        credits: Decimal;
        monthlyBalances: Map<string, { debits: Decimal; credits: Decimal }>;
      }
    >();

    for (const posting of postings) {
      const existing = balancesByAccount.get(posting.accountId) || {
        debits: new Decimal(0),
        credits: new Decimal(0),
        monthlyBalances: new Map<string, { debits: Decimal; credits: Decimal }>(),
      };

      existing.debits = existing.debits.plus(posting.debitAmount);
      existing.credits = existing.credits.plus(posting.creditAmount);

      // Track monthly balances if requested
      if (options?.includeMonthly) {
        const date = posting.postingDate;
        const monthKey = `${date.getFullYear()}-${date.getMonth()}`;
        const monthBal = existing.monthlyBalances.get(monthKey) || {
          debits: new Decimal(0),
          credits: new Decimal(0),
        };
        monthBal.debits = monthBal.debits.plus(posting.debitAmount);
        monthBal.credits = monthBal.credits.plus(posting.creditAmount);
        existing.monthlyBalances.set(monthKey, monthBal);
      }

      balancesByAccount.set(posting.accountId, existing);
    }

    // Build response
    const result = accounts.map((account) => {
      const balances = balancesByAccount.get(account.id);
      const debits = balances?.debits || new Decimal(0);
      const credits = balances?.credits || new Decimal(0);

      const accountResult: {
        accountId: string;
        accountCode: string;
        accountTitle: string;
        accountType: string;
        normalBalance: string;
        debits: string;
        credits: string;
        monthlyBalances?: { month: number; year: number; debits: string; credits: string }[];
        dimensionBalances?: { dimensionValueId: string; debits: string; credits: string }[];
      } = {
        accountId: account.id,
        accountCode: account.accountCode,
        accountTitle: account.title,
        accountType: account.accountType,
        normalBalance: account.normalBalance,
        debits: debits.toString(),
        credits: credits.toString(),
      };

      // Add monthly breakdowns if requested
      if (options?.includeMonthly && balances) {
        accountResult.monthlyBalances = [];
        balances.monthlyBalances.forEach((bal, key) => {
          const [year, month] = key.split('-').map(Number);
          accountResult.monthlyBalances!.push({
            month,
            year,
            debits: bal.debits.toString(),
            credits: bal.credits.toString(),
          });
        });
        // Sort by year and month
        accountResult.monthlyBalances.sort((a, b) =>
          a.year !== b.year ? a.year - b.year : a.month - b.month,
        );
      }

      return accountResult;
    });

    return { accounts: result };
  }

  /**
   * Get saved report definitions
   */
  async getSavedReports(orgId: string): Promise<ReportDefinition[]> {
    // Return built-in report definitions
    const builtInReports: ReportDefinition[] = [
      {
        id: 'income-statement',
        name: 'Income Statement (P&L)',
        description: 'Revenue, expenses, and net income for a period',
        reportType: 'income-statement',
        filters: {},
        showSubtotals: true,
        showGrandTotal: true,
      },
      {
        id: 'balance-sheet',
        name: 'Balance Sheet',
        description: 'Assets, liabilities, and equity at a point in time',
        reportType: 'balance-sheet',
        filters: {},
        showSubtotals: true,
        showGrandTotal: true,
      },
      {
        id: 'cash-flow',
        name: 'Cash Flow Statement',
        description: 'Operating, investing, and financing cash flows',
        reportType: 'cash-flow',
        filters: {},
        showSubtotals: true,
        showGrandTotal: true,
      },
      {
        id: 'trial-balance',
        name: 'Trial Balance',
        description: 'All accounts with debit and credit balances',
        reportType: 'trial-balance',
        filters: { includeZeroBalances: false },
        groupBy: 'account-type',
        showSubtotals: true,
        showGrandTotal: true,
      },
      {
        id: 'general-ledger',
        name: 'General Ledger',
        description: 'Detailed transaction listing by account',
        reportType: 'general-ledger',
        filters: { includeZeroBalances: false },
        showSubtotals: true,
      },
      {
        id: 'account-activity',
        name: 'Account Activity Summary',
        description: 'Opening/closing balances and activity by account',
        reportType: 'account-activity',
        filters: { includeZeroBalances: false },
        showGrandTotal: true,
      },
    ];

    return builtInReports;
  }
}
