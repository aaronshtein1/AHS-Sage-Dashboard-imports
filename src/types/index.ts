// ==================== FINANCIAL TYPES ====================

export interface Period {
  value: string; // YYYY-MM
  label: string;
  year: number;
  month: number;
}

export interface AccountBalance {
  accountId: string;
  accountNo: string;
  accountTitle: string;
  accountType: "incomestatement" | "balancesheet";
  category: string;
  subcategory?: string;
  period: string;
  locationId?: string;
  departmentId?: string;
  openingBalance: number;
  debitAmount: number;
  creditAmount: number;
  netChange: number;
  endingBalance: number;
}

export interface FinancialStatement {
  title: string;
  period: string;
  comparisonPeriod?: string;
  sections: StatementSection[];
  totals: {
    current: number;
    comparison?: number;
    variance?: number;
    variancePercent?: number;
  };
}

export interface StatementSection {
  title: string;
  accounts: StatementLineItem[];
  subtotal: {
    current: number;
    comparison?: number;
    variance?: number;
    variancePercent?: number;
  };
}

export interface StatementLineItem {
  accountId: string;
  accountNo: string;
  title: string;
  indent: number;
  isBold: boolean;
  current: number;
  comparison?: number;
  variance?: number;
  variancePercent?: number;
  budget?: number;
  budgetVariance?: number;
  budgetVariancePercent?: number;
}

// ==================== HEALTHCARE TYPES ====================

export interface LocationMetrics {
  locationId: string;
  locationName: string;
  period: string;
  grossRevenue: number;
  netRevenue: number;
  directCosts: number;
  grossProfit: number;
  grossMargin: number;
  operatingExpenses: number;
  netIncome: number;
  netMargin: number;
  patientVolume?: number;
  revenuePerVisit?: number;
}

export interface PayerMixData {
  payerName: string;
  contractName?: string;
  revenue: number;
  revenuePercent: number;
  collections: number;
  collectionRate: number;
  patientCount?: number;
  avgReimbursement?: number;
  margin?: number;
}

export interface ContractAnalysis {
  payerName: string;
  contractName: string;
  effectiveDate: string;
  medicarePercent?: number;
  totalCharges: number;
  totalPayments: number;
  avgPaymentPercent: number;
  volume: number;
}

// ==================== WORKFORCE TYPES ====================

export interface PositionBudget {
  positionId: string;
  title: string;
  department: string;
  category: string;
  locationId?: string;
  locationName?: string;
  period: string;
  budgetedFTE: number;
  actualFTE?: number;
  varianceFTE?: number;
  avgSalary: number;
  baseSalaryCost: number;
  benefitsCost: number;
  payrollTaxCost: number;
  totalCost: number;
}

export interface HeadcountSummary {
  period: string;
  locationId?: string;
  department?: string;
  totalBudgetedFTE: number;
  totalActualFTE: number;
  varianceFTE: number;
  totalBudgetedCost: number;
  totalActualCost: number;
  varianceCost: number;
  positions: PositionBudget[];
}

export interface LaborCostBreakdown {
  category: string;
  budgetedFTE: number;
  actualFTE: number;
  budgetedCost: number;
  actualCost: number;
  variance: number;
  variancePercent: number;
}

// ==================== PLANNING TYPES ====================

export interface BudgetSummary {
  id: string;
  name: string;
  fiscalYear: number;
  version: number;
  status: string;
  totalRevenue: number;
  totalExpenses: number;
  netIncome: number;
  totalHeadcount: number;
  totalLaborCost: number;
}

export interface BudgetVsActual {
  accountId: string;
  accountNo: string;
  accountTitle: string;
  category: string;
  period: string;
  budget: number;
  actual: number;
  variance: number;
  variancePercent: number;
  isOverBudget: boolean;
}

export interface ForecastData {
  period: string;
  actual?: number;
  forecast: number;
  budget?: number;
  method: string;
  confidence?: number;
}

export interface ScenarioComparison {
  accountId: string;
  accountTitle: string;
  category: string;
  baseline: number;
  scenario: number;
  difference: number;
  differencePercent: number;
}

export interface DriverInput {
  driverType: string;
  name: string;
  value: number;
  unit: string;
  impactedAccounts: string[];
}

// ==================== DASHBOARD TYPES ====================

export interface KPIMetric {
  id: string;
  title: string;
  value: number;
  formattedValue: string;
  change?: number;
  changePercent?: number;
  changeLabel?: string;
  trend?: "up" | "down" | "flat";
  trendDirection?: "positive" | "negative" | "neutral";
  sparklineData?: number[];
}

export interface DashboardFilters {
  period: string;
  comparisonPeriod?: string;
  comparisonType?: "prior-period" | "prior-year" | "budget";
  locationId?: string;
  departmentId?: string;
}

export interface AlertItem {
  id: string;
  type: "warning" | "error" | "info";
  title: string;
  description: string;
  metric?: string;
  threshold?: number;
  actual?: number;
  link?: string;
}

// ==================== INTACCT TYPES ====================

export interface IntacctSession {
  sessionId: string;
  endpoint: string;
  expiresAt: Date;
}

export interface IntacctCredentials {
  companyId: string;
  userId: string;
  userPassword: string;
  senderId: string;
  senderPassword: string;
}

export interface IntacctGLAccount {
  RECORDNO: string;
  ACCOUNTNO: string;
  TITLE: string;
  ACCOUNTTYPE: string;
  NORMALBALANCE: string;
  CLOSINGTYPE: string;
  STATUS: string;
  CATEGORY?: string;
}

export interface IntacctGLBalance {
  RECORDNO: string;
  ACCOUNTNO: string;
  ACCOUNTTITLE: string;
  LOCATIONID?: string;
  DEPARTMENTID?: string;
  REPORTINGPERIOD: string;
  OPENBALANCE: number;
  DEBITAMOUNT: number;
  CREDITAMOUNT: number;
  ADJDEBITAMOUNT: number;
  ADJCREDITAMOUNT: number;
  ENDBALANCE: number;
}

export interface IntacctLocation {
  LOCATIONID: string;
  NAME: string;
  PARENTID?: string;
  STATUS: string;
}

export interface IntacctDepartment {
  DEPARTMENTID: string;
  TITLE: string;
  PARENTID?: string;
  STATUS: string;
}

// ==================== API TYPES ====================

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

export interface SyncStatus {
  lastSync?: Date;
  inProgress: boolean;
  progress?: number;
  error?: string;
}

// ==================== OPENLEDGER AUTH TYPES ====================

export interface User {
  id: string;
  email: string;
  name: string;
  orgs: UserOrg[];
  currentOrgId?: string;
}

export interface UserOrg {
  id: string;
  name: string;
  role: 'admin' | 'accountant' | 'viewer';
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  accessToken: string;
  user: User;
}

export interface OrgContext {
  orgId: string;
  userId: string;
  role: 'admin' | 'accountant' | 'viewer';
}

// ==================== OPENLEDGER ACCOUNT TYPES ====================

export interface Account {
  id: string;
  accountCode: string;
  accountNo?: string; // Alias for accountCode for compatibility
  title: string;
  accountType: 'ASSET' | 'LIABILITY' | 'EQUITY' | 'REVENUE' | 'EXPENSE';
  normalBalance: 'DEBIT' | 'CREDIT';
  status: 'ACTIVE' | 'INACTIVE';
  closingType: 'CLOSING' | 'NON_CLOSING' | 'CLOSED_TO';
  category?: string;
  isBankAccount?: boolean;
  requireDepartment?: boolean;
  requireLocation?: boolean;
  requiredDimensions?: {
    dimensionType: {
      id: string;
      code: string;
      name: string;
    };
  }[];
  createdAt: string;
  updatedAt: string;
}

export interface CreateAccountRequest {
  accountCode: string;
  title: string;
  accountType: 'ASSET' | 'LIABILITY' | 'EQUITY' | 'REVENUE' | 'EXPENSE';
  normalBalance: 'DEBIT' | 'CREDIT';
  closingType: 'CLOSING' | 'NON_CLOSING' | 'CLOSED_TO';
  category?: string;
  requiredDimensionTypeIds?: string[];
}

// ==================== OPENLEDGER DIMENSION TYPES ====================

export interface DimensionType {
  id: string;
  code: string;
  name: string;
  status: 'active' | 'inactive';
}

export interface DimensionValue {
  id: string;
  dimensionTypeId: string;
  dimensionTypeCode: string;
  code: string;
  name: string;
  parentId?: string;
  status: 'active' | 'inactive';
}

// ==================== OPENLEDGER JOURNAL TYPES ====================

export interface JournalType {
  id: string;
  code: string;
  name: string;
  description?: string;
}

export interface JournalEntry {
  id: string;
  entryDate: string;
  postingDate: string | null;
  referenceNumber: string;
  description: string;
  status: 'draft' | 'posted';
  journalType: JournalType;
  lines: JournalLine[];
  createdAt: string;
  postedAt: string | null;
  postedBy: string | null;
  createdBy: string;
}

export interface JournalLine {
  id: string;
  accountId: string;
  accountNo: string;
  accountTitle: string;
  debit: number;
  credit: number;
  description?: string;
  dimensions: JournalLineDimension[];
}

export interface JournalLineDimension {
  dimensionTypeCode: string;
  dimensionValueCode: string;
  dimensionValueName: string;
}

export interface CreateJournalRequest {
  entryDate: string;
  referenceNumber: string;
  description: string;
  journalTypeId: string;
  lines: CreateJournalLineRequest[];
}

export interface CreateJournalLineRequest {
  accountId: string;
  debit: number;
  credit: number;
  description?: string;
  dimensions?: { dimensionTypeCode: string; dimensionValueCode: string }[];
}

// ==================== OPENLEDGER REPORT TYPES ====================

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

export interface ReportColumn {
  id: string;
  label: string;
  field: string;
  type: 'text' | 'number' | 'currency' | 'percent' | 'date';
  width?: number;
  align?: 'left' | 'center' | 'right';
  visible?: boolean;
}

export interface ReportDefinition {
  id?: string;
  name: string;
  description?: string;
  reportType: ReportType;
  filters: ReportFilters;
  comparison?: ComparisonType;
  groupBy?: GroupByOption;
  columns?: ReportColumn[];
  showSubtotals?: boolean;
  showGrandTotal?: boolean;
  isSystemReport?: boolean;
  createdAt?: string;
  updatedAt?: string;
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
  children?: ReportRow[];
}

export interface ReportSection {
  title: string;
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

export interface TrialBalanceReport {
  asOfDate: string;
  orgId: string;
  orgName: string;
  rows: TrialBalanceRow[];
  totals: {
    totalDebit: number;
    totalCredit: number;
  };
}

export interface BalanceSheetReport {
  asOfDate: string;
  orgId: string;
  orgName: string;
  assets: StatementSection[];
  liabilities: StatementSection[];
  equity: StatementSection[];
  totals: {
    totalAssets: number;
    totalLiabilities: number;
    totalEquity: number;
  };
}

export interface ProfitLossReport {
  startDate: string;
  endDate: string;
  orgId: string;
  orgName: string;
  revenue: StatementSection[];
  expenses: StatementSection[];
  totals: {
    totalRevenue: number;
    totalExpenses: number;
    netIncome: number;
  };
}

// ==================== OPENLEDGER PERIOD TYPES ====================

export interface AccountingPeriod {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  status: 'open' | 'closed';
  fiscalYear: number;
}

// ==================== PLAID/BANK FEED TYPES ====================

export interface PlaidLinkToken {
  linkToken: string;
  expiration: string;
}

export interface PlaidItem {
  id: string;
  plaidItemId: string;
  plaidInstitutionId: string;
  plaidInstitutionName: string;
  status: string;
  lastSyncedAt?: string;
  accounts: PlaidAccount[];
}

export interface PlaidAccount {
  id: string;
  plaidAccountId: string;
  name: string;
  officialName?: string;
  type: string;
  subtype?: string;
  mask?: string;
  currentBalance?: number;
  availableBalance?: number;
  isoCurrencyCode?: string;
  linkedAccountId?: string;
}

export interface BankTransaction {
  id: string;
  plaidTransactionId: string;
  amount: number;
  date: string;
  name: string;
  merchantName?: string;
  pending: boolean;
  category?: string;
  paymentChannel?: string;
  accountId?: string;
  journalEntryId?: string;
  plaidAccount?: {
    id: string;
    name: string;
    plaidItem: {
      plaidInstitutionName: string;
    };
  };
}

export interface PlaidSyncResult {
  results: {
    plaidItemId: string;
    institutionName: string;
    added: number;
    modified: number;
    removed: number;
    hasMore: boolean;
  }[];
  syncedAt: string;
}

// ==================== BANK RECONCILIATION ====================

export type ReconStatus = 'INITIATED' | 'IN_PROGRESS' | 'FINALIZED';
export type ReconType = 'BANK_FEED' | 'MANUAL';

export interface ReconciliationSession {
  id: string;
  orgId: string;
  accountId: string;
  statementEndDate: string;
  statementBeginningBalance: string;
  statementEndingBalance: string;
  reconType: ReconType;
  status: ReconStatus;
  clearedBalance?: string;
  difference?: string;
  createdById: string;
  createdAt: string;
  finalizedAt?: string;
  finalizedById?: string;
  updatedAt: string;
  account?: {
    id: string;
    accountCode: string;
    title: string;
    isBankAccount: boolean;
  };
  matches?: ReconMatch[];
  depositsInTransit?: BankTransaction[];
  outstandingChecks?: OutstandingCheck[];
  summary?: ReconciliationSummary;
}

export interface ReconMatch {
  id: string;
  reconSessionId: string;
  journalLineId?: string;
  sourceTransactionId?: string;
  matchType: string;
  matchGroupId?: string;
  createdAt: string;
  sourceTransaction?: BankTransaction;
  journalLine?: {
    id: string;
    lineNumber: number;
    debitAmount?: string;
    creditAmount?: string;
    memo?: string;
    journalEntry: {
      id: string;
      transactionNumber?: string;
      entryDate: string;
      description: string;
    };
  };
}

export interface OutstandingCheck {
  id: string;
  lineNumber: number;
  accountId: string;
  debitAmount?: string;
  creditAmount?: string;
  memo?: string;
  journalEntry: {
    id: string;
    transactionNumber?: string;
    entryDate: string;
    description: string;
  };
}

export interface ReconciliationSummary {
  bankStatementBalance: string;
  depositsInTransitTotal: string;
  depositsInTransitCount: number;
  outstandingChecksTotal: string;
  outstandingChecksCount: number;
  adjustedBankBalance: string;
  bookBalance: string;
  difference: string;
  isBalanced: boolean;
}

export interface CreateReconciliationSessionRequest {
  accountId: string;
  statementEndingBalance: string;
  statementEndDate: string;
  statementBeginningBalance?: string;
}

export interface CreateReconMatchRequest {
  matchType: 'source_to_journal' | 'journal_to_journal' | 'source_to_source';
  sourceTransactionIds?: string[];
  journalLineIds?: string[];
}

// ==================== AI RULE SUGGESTIONS ====================

export interface RuleSuggestion {
  transactionId: string;
  merchantName: string | null;
  transactionName: string;
  amount: number;
  suggestedCategory: string;
  suggestedAccountId: string | null;
  suggestedAccountCode: string | null;
  suggestedAccountName: string | null;
  confidence: 'HIGH' | 'MEDIUM' | 'LOW';
  matchedPattern: string;
  suggestedRule: {
    name: string;
    matchType: string;
    pattern: string;
    autoPost: boolean;
  } | null;
  existingRule: {
    id: string;
    name: string;
  } | null;
}

// ==================== CUSTOM REPORT BUILDER TYPES ====================

/** Period type for custom reports */
export type PeriodType = 'single' | 'range' | 'ytd' | 'mtd' | 'qtd' | 'rolling-12';

/** Period configuration for custom reports */
export interface PeriodConfig {
  type: PeriodType;
  /** For single period or start of range (YYYY-MM format) */
  startPeriod?: string;
  /** For range end (YYYY-MM format) */
  endPeriod?: string;
  /** As-of date for balance sheet reports (YYYY-MM-DD format) */
  asOfDate?: string;
  /** Fiscal year start month (1-12), defaults to 1 (January) */
  fiscalYearStartMonth?: number;
}

/** Comparison configuration */
export interface ReportComparisonConfig {
  enabled: boolean;
  type: 'prior-period' | 'prior-year' | 'budget';
  showVariance: boolean;
  showVariancePercent: boolean;
}

/** Available column types for custom reports */
export type CustomColumnType =
  | 'account-code'
  | 'account-title'
  | 'account-type'
  | 'category'
  | 'opening-balance'
  | 'debit'
  | 'credit'
  | 'net-change'
  | 'ending-balance'
  | 'period-amount'
  | 'ytd-amount'
  | 'mtd-amount'
  | 'qtd-amount'
  | 'budget'
  | 'budget-variance'
  | 'budget-variance-pct'
  | 'prior-period'
  | 'prior-period-variance'
  | 'prior-period-variance-pct'
  | 'prior-year'
  | 'prior-year-variance'
  | 'prior-year-variance-pct';

/** Custom column definition */
export interface CustomColumn {
  id: string;
  type: CustomColumnType;
  label: string;
  dataType: 'text' | 'number' | 'currency' | 'percent';
  align: 'left' | 'center' | 'right';
  visible: boolean;
  order: number;
  width?: number;
}

/** Account filter configuration */
export interface CustomReportAccountFilters {
  accountTypes?: ('ASSET' | 'LIABILITY' | 'EQUITY' | 'REVENUE' | 'EXPENSE')[];
  accountCodeStart?: string;
  accountCodeEnd?: string;
  accountIds?: string[];
  categories?: string[];
  includeZeroBalances: boolean;
  includeInactiveAccounts: boolean;
}

/** Grouping configuration */
export interface CustomReportGrouping {
  groupBy: 'none' | 'account-type' | 'category';
  showSubtotals: boolean;
  showGrandTotal: boolean;
  collapseByDefault?: boolean;
}

/** Complete custom report definition */
export interface CustomReportDefinition {
  id: string;
  name: string;
  description?: string;
  columns: CustomColumn[];
  period: PeriodConfig;
  comparison?: ReportComparisonConfig;
  accountFilters: CustomReportAccountFilters;
  grouping: CustomReportGrouping;
  isSystemReport: boolean;
  createdAt: string;
  updatedAt: string;
}

/** Custom report row with dynamic values */
export interface CustomReportRow {
  id: string;
  rowType: 'data' | 'subtotal' | 'total';
  indent: number;
  accountId?: string;
  accountCode?: string;
  accountTitle?: string;
  accountType?: string;
  category?: string;
  isExpandable?: boolean;
  isExpanded?: boolean;
  /** Dynamic values keyed by column ID */
  values: Record<string, string | number | null>;
  children?: CustomReportRow[];
  /** For drill-through */
  drillThroughParams?: {
    accountId: string;
    startDate: string;
    endDate: string;
  };
}

/** Generated custom report */
export interface GeneratedCustomReport {
  definition: CustomReportDefinition;
  generatedAt: string;
  orgName: string;
  periodLabel: string;
  rows: CustomReportRow[];
  grandTotal?: CustomReportRow;
  metadata?: {
    totalAccounts: number;
    dateRange?: { start: string; end: string };
  };
}

/** Drill-through transaction detail */
export interface DrillThroughTransaction {
  id: string;
  date: string;
  journalNumber: string;
  description: string;
  reference?: string;
  debit: number;
  credit: number;
  runningBalance?: number;
  journalEntryId: string;
}

// ==================== FINANCIAL REPORT WRITER (Sage Intacct Style) ====================

/** Account group for row structure (like Sage Intacct's hierarchical rows) */
export interface FRWAccountGroup {
  id: string;
  name: string;
  type: 'section' | 'group' | 'account' | 'computed';
  accountType?: 'ASSET' | 'LIABILITY' | 'EQUITY' | 'REVENUE' | 'EXPENSE';
  accountCodes?: string[]; // Specific account codes to include
  accountCodeRange?: { start: string; end: string };
  children?: FRWAccountGroup[];
  detailLevel: 'summary' | 'detail'; // Summary = hide accounts, Detail = show accounts
  basisForAmounts: 'period' | 'cumulative' | 'percent';
  alwaysDisplay: boolean;
  printTotal: boolean;
  expanded?: boolean;
}

/** Column type options (mirrors Sage Intacct column types) */
export type FRWColumnType =
  | 'account-name'
  | 'account-number'
  | 'account-number-name'
  | 'account-attribute'
  | 'actual'
  | 'budget'
  | 'computation-actual'
  | 'computation-budget'
  | 'summary-columns'
  | 'period-variance'
  | 'period-variance-normalized'
  | 'period-difference'
  | 'period-difference-normalized'
  | 'actual-minus-budget'
  | 'actual-minus-budget-normalized'
  | 'budget-minus-actual'
  | 'budget-minus-actual-normalized'
  | 'budget-variance'
  | 'budget-variance-normalized'
  | 'budget-ratio'
  | 'remaining-budget'
  | 'forecast-prorated'
  | 'forecast-full-period'
  | 'percent-actual'
  | 'percent-budget'
  | 'spacer';

/** Column definition for Financial Report Writer */
export interface FRWColumn {
  id: string;
  type: FRWColumnType;
  label: string;
  header1?: string; // Column heading 1 (e.g., "Period name")
  header2?: string; // Column heading 2 (e.g., "Period date")
  customTitle?: string;

  // Period configuration
  reportingPeriod: 'current-year' | 'prior-year' | 'current-month' | 'prior-month' | 'ytd' | 'custom';
  customPeriodStart?: string;
  customPeriodEnd?: string;

  // Dimension expansion
  expandBy?: 'none' | 'months' | 'quarters' | 'departments' | 'locations' | 'projects';

  // For computation columns
  computationId?: string;

  // For comparison columns
  compareToColumnId?: string;

  // Display options
  showAs: 'number' | 'currency' | 'percent';
  precision?: number;
  visualIndicators?: FRWVisualIndicator[];
  hidden: boolean;
  order: number;
  width?: number;
}

/** Visual indicator for conditional formatting */
export interface FRWVisualIndicator {
  condition: 'greater-than' | 'less-than' | 'equals' | 'between';
  value: number;
  value2?: number; // For 'between' condition
  color: string;
  bold?: boolean;
  icon?: string;
}

/** Computation definition */
export interface FRWComputation {
  id: string;
  name: string;
  formula: string; // e.g., "C1 - C2" or "(C1 / C2) * 100"
  description?: string;
}

/** Filter configuration */
export interface FRWFilters {
  departments?: string[];
  locations?: string[];
  projects?: string[];
  customers?: string[];
  vendors?: string[];
  employees?: string[];
  classes?: string[];
  items?: string[];
  excludeZeroBalances: boolean;
  excludeInactiveAccounts: boolean;
}

/** Format/display options */
export interface FRWFormat {
  reportTitle?: string;
  subtitle?: string;
  headerLogo?: string;
  showAccountNumbers: boolean;
  showHierarchy: boolean;
  indentAmount: number;
  negativeFormat: 'minus' | 'parentheses' | 'red';
  thousandsSeparator: boolean;
  decimalPlaces: number;
  pageOrientation: 'portrait' | 'landscape';
  paperSize: 'letter' | 'legal' | 'a4';
}

/** Complete Financial Report Writer definition */
export interface FRWReportDefinition {
  id: string;
  name: string;
  description?: string;
  reportType: 'balance-sheet' | 'income-statement' | 'cash-flow' | 'custom';

  // Rows tab
  rowStructure: FRWAccountGroup[];
  defaultDetailLevel: 'summary' | 'detail';

  // Columns tab
  columns: FRWColumn[];

  // Computations tab
  computations: FRWComputation[];

  // Filters tab
  filters: FRWFilters;

  // Format tab
  format: FRWFormat;

  // Metadata
  isSystemReport: boolean;
  createdBy?: string;
  createdAt: string;
  updatedAt: string;
}

/** Generated FRW report row */
export interface FRWReportRow {
  id: string;
  rowType: 'section-header' | 'group-header' | 'account' | 'subtotal' | 'total' | 'computed' | 'spacer';
  level: number;
  indent: number;
  label: string;
  accountCode?: string;
  accountId?: string;
  values: Record<string, number | string | null>;
  children?: FRWReportRow[];
  isExpandable?: boolean;
  isExpanded?: boolean;
  isBold?: boolean;
  cssClass?: string;
}

/** Generated FRW report */
export interface FRWGeneratedReport {
  definition: FRWReportDefinition;
  generatedAt: string;
  orgName: string;
  periodLabel: string;
  columnHeaders: { id: string; label: string; header1?: string; header2?: string }[];
  rows: FRWReportRow[];
  metadata: {
    totalRows: number;
    executionTimeMs: number;
  };
}
