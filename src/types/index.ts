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
