/**
 * TypeScript interfaces for ADP to Sage Intacct transformation module
 *
 * This file defines all types used throughout the transformation pipeline:
 * - ADP payroll export parsing
 * - Mapping to Intacct format
 * - Validation
 * - Import file generation
 */

// ==================== ADP PAYROLL TYPES ====================

/**
 * Raw row structure from ADP payroll export CSV
 * Maps directly to expected ADP export columns
 */
export interface ADPPayrollRow {
  /** ADP account code (e.g., "5100", "6200-SALARY") */
  accountCode: string;

  /** ADP department code (e.g., "ADMIN", "CLINICAL", "100") */
  departmentCode: string;

  /** Optional location/branch code from ADP */
  locationCode?: string;

  /** Debit amount (positive number or empty) */
  debitAmount: number | null;

  /** Credit amount (positive number or empty) */
  creditAmount: number | null;

  /** Description/memo from ADP */
  description: string;

  /** Pay period end date or posting date (YYYY-MM-DD or MM/DD/YYYY) */
  date: string;

  /** Employee ID if applicable */
  employeeId?: string;

  /** Employee name if applicable */
  employeeName?: string;

  /** Pay type (e.g., "Regular", "Overtime", "Bonus") */
  payType?: string;

  /** Raw line number from source file (for error reporting) */
  sourceLineNumber: number;
}

/**
 * Parsed and validated payroll entry ready for mapping
 */
export interface PayrollEntry {
  /** Unique identifier for this entry */
  id: string;

  /** ADP account code */
  accountCode: string;

  /** ADP department code */
  departmentCode: string;

  /** Optional location code */
  locationCode?: string;

  /** Net amount (positive = debit, negative = credit) */
  amount: number;

  /** Whether this is a debit (true) or credit (false) */
  isDebit: boolean;

  /** Description/memo */
  description: string;

  /** Posting date as Date object */
  postingDate: Date;

  /** Original date string from file */
  originalDateString: string;

  /** Employee ID if applicable */
  employeeId?: string;

  /** Employee name if applicable */
  employeeName?: string;

  /** Pay type */
  payType?: string;

  /** Source line number for traceability */
  sourceLineNumber: number;

  /** Source filename */
  sourceFile: string;
}

// ==================== INTACCT JOURNAL ENTRY TYPES ====================

/**
 * Single line item in an Intacct journal entry
 */
export interface IntacctJournalLine {
  /** Intacct GL account number */
  glAccountNo: string;

  /** Debit amount (use 0 if credit) */
  debit: number;

  /** Credit amount (use 0 if debit) */
  credit: number;

  /** Department ID in Intacct */
  departmentId?: string;

  /** Location ID in Intacct */
  locationId?: string;

  /** Class ID in Intacct (if using class tracking) */
  classId?: string;

  /** Project ID in Intacct (if using project tracking) */
  projectId?: string;

  /** Customer ID (if applicable) */
  customerId?: string;

  /** Vendor ID (if applicable) */
  vendorId?: string;

  /** Employee ID (if applicable) */
  employeeId?: string;

  /** Line memo/description */
  memo: string;

  /** Allocation ID for statistical journals */
  allocationId?: string;
}

/**
 * Complete Intacct journal entry ready for import
 */
export interface IntacctJournalEntry {
  /** Journal entry batch reference */
  batchKey?: string;

  /** Journal symbol (e.g., "GJ" for General Journal) */
  journalSymbol: string;

  /** Reference number for the entry */
  referenceNumber: string;

  /** Journal entry date */
  entryDate: Date;

  /** Reversal date if this is a reversing entry */
  reversalDate?: Date;

  /** Entry description/memo */
  description: string;

  /** History comment */
  historyComment?: string;

  /** Attachment reference if any */
  attachmentRef?: string;

  /** Journal entry lines */
  lines: IntacctJournalLine[];

  /** Source document type */
  sourceDocumentType: 'ADP_PAYROLL' | 'MANUAL' | 'OTHER';

  /** Original source file */
  sourceFile: string;

  /** Created timestamp */
  createdAt: Date;

  /** Total debits (for validation) */
  totalDebits: number;

  /** Total credits (for validation) */
  totalCredits: number;
}

// ==================== MAPPING CONFIGURATION TYPES ====================

/**
 * Single account mapping entry
 */
export interface AccountMappingEntry {
  /** ADP account code (source) */
  adpAccountCode: string;

  /** Intacct GL account number (target) */
  intacctAccountNo: string;

  /** Optional: specific Intacct account title for validation */
  intacctAccountTitle?: string;

  /** Whether this mapping is active */
  isActive: boolean;

  /** Description of what this account is for */
  description?: string;

  /** Account category for grouping */
  category?: string;

  /** Default memo template if none provided */
  defaultMemo?: string;
}

/**
 * Complete account mapping configuration
 */
export interface AccountMapping {
  /** Version of the mapping file */
  version: string;

  /** Last updated date */
  lastUpdated: string;

  /** Mapping entries indexed by ADP account code */
  mappings: Record<string, AccountMappingEntry>;

  /** Default account for unmapped codes (optional) */
  defaultAccount?: string;

  /** Whether to fail on unmapped accounts */
  failOnUnmapped: boolean;
}

/**
 * Single department mapping entry
 */
export interface DepartmentMappingEntry {
  /** ADP department code (source) */
  adpDepartmentCode: string;

  /** Intacct department ID (target) */
  intacctDepartmentId: string;

  /** Intacct department name for validation */
  intacctDepartmentName?: string;

  /** Whether this mapping is active */
  isActive: boolean;

  /** Description */
  description?: string;
}

/**
 * Complete department mapping configuration
 */
export interface DepartmentMapping {
  /** Version of the mapping file */
  version: string;

  /** Last updated date */
  lastUpdated: string;

  /** Mapping entries indexed by ADP department code */
  mappings: Record<string, DepartmentMappingEntry>;

  /** Default department for unmapped codes */
  defaultDepartment?: string;

  /** Whether to fail on unmapped departments */
  failOnUnmapped: boolean;
}

/**
 * Location mapping entry
 */
export interface LocationMappingEntry {
  /** ADP location code (source) */
  adpLocationCode: string;

  /** Intacct location ID (target) */
  intacctLocationId: string;

  /** Intacct location name for validation */
  intacctLocationName?: string;

  /** Whether this mapping is active */
  isActive: boolean;
}

/**
 * Class mapping entry (for Intacct class tracking)
 */
export interface ClassMappingEntry {
  /** Source code */
  sourceCode: string;

  /** Intacct class ID */
  intacctClassId: string;

  /** Intacct class name */
  intacctClassName?: string;

  /** Whether this mapping is active */
  isActive: boolean;
}

// ==================== TRANSFORMATION CONFIG ====================

/**
 * Column mapping for ADP CSV files
 */
export interface ADPColumnMapping {
  /** Column index or header name for account code */
  accountCode: string | number;

  /** Column index or header name for department code */
  departmentCode: string | number;

  /** Column index or header name for location code */
  locationCode?: string | number;

  /** Column index or header name for debit amount */
  debitAmount: string | number;

  /** Column index or header name for credit amount */
  creditAmount: string | number;

  /** Column index or header name for description */
  description: string | number;

  /** Column index or header name for date */
  date: string | number;

  /** Column index or header name for employee ID */
  employeeId?: string | number;

  /** Column index or header name for employee name */
  employeeName?: string | number;

  /** Column index or header name for pay type */
  payType?: string | number;
}

/**
 * Date format configuration
 */
export interface DateFormatConfig {
  /** Input date format from ADP (e.g., "MM/DD/YYYY", "YYYY-MM-DD") */
  inputFormat: string;

  /** Output date format for Intacct (usually "MM/DD/YYYY") */
  outputFormat: string;

  /** Timezone to use for date parsing */
  timezone?: string;
}

/**
 * Complete transformation configuration
 */
export interface TransformConfig {
  /** Configuration version */
  version: string;

  /** Last updated */
  lastUpdated: string;

  /** ADP file column mapping */
  adpColumnMapping: ADPColumnMapping;

  /** Date format configuration */
  dateFormat: DateFormatConfig;

  /** Default journal symbol for Intacct */
  defaultJournalSymbol: string;

  /** Prefix for reference numbers */
  referenceNumberPrefix: string;

  /** Maximum memo length for Intacct */
  maxMemoLength: number;

  /** Whether to include employee details in memo */
  includeEmployeeInMemo: boolean;

  /** Whether to aggregate entries by account/department */
  aggregateEntries: boolean;

  /** Decimal precision for amounts */
  decimalPrecision: number;

  /** Rounding mode: "round" | "floor" | "ceil" */
  roundingMode: 'round' | 'floor' | 'ceil';

  /** Tolerance for balance checking (usually 0.01) */
  balanceTolerance: number;

  /** File encoding for ADP files */
  fileEncoding: BufferEncoding;

  /** CSV delimiter */
  csvDelimiter: string;

  /** Whether first row is header */
  hasHeaderRow: boolean;

  /** Rows to skip at start of file */
  skipRows: number;

  /** Output file naming pattern */
  outputFilePattern: string;
}

// ==================== VALIDATION TYPES ====================

/**
 * Single validation error or warning
 */
export interface ValidationIssue {
  /** Unique issue code */
  code: string;

  /** Severity level */
  severity: 'error' | 'warning' | 'info';

  /** Human-readable message */
  message: string;

  /** Field that caused the issue */
  field?: string;

  /** Value that caused the issue */
  value?: string | number;

  /** Source line number if applicable */
  lineNumber?: number;

  /** Entry ID if applicable */
  entryId?: string;

  /** Suggestion for fixing */
  suggestion?: string;
}

/**
 * Result of validating a single entry
 */
export interface EntryValidationResult {
  /** Entry ID that was validated */
  entryId: string;

  /** Whether entry is valid (no errors) */
  isValid: boolean;

  /** List of issues found */
  issues: ValidationIssue[];

  /** Original entry for reference */
  entry?: IntacctJournalEntry;
}

/**
 * Result of validating a complete batch
 */
export interface ValidationResult {
  /** Overall validation passed (no errors) */
  isValid: boolean;

  /** Can proceed with upload (warnings allowed) */
  canProceed: boolean;

  /** Total entries validated */
  totalEntries: number;

  /** Entries that passed validation */
  validEntries: number;

  /** Entries with errors */
  errorEntries: number;

  /** Entries with only warnings */
  warningEntries: number;

  /** All validation issues */
  issues: ValidationIssue[];

  /** Summary by issue code */
  issueSummary: Record<string, number>;

  /** Total debits across all entries */
  totalDebits: number;

  /** Total credits across all entries */
  totalCredits: number;

  /** Net difference (should be 0 or within tolerance) */
  netDifference: number;

  /** Individual entry results */
  entryResults: EntryValidationResult[];

  /** Validation timestamp */
  validatedAt: Date;
}

// ==================== REPORT TYPES ====================

/**
 * Summary statistics for the pre-upload report
 */
export interface ReportSummary {
  /** Source file(s) processed */
  sourceFiles: string[];

  /** Total rows in source */
  totalSourceRows: number;

  /** Total entries after transformation */
  totalEntries: number;

  /** Total journal entry lines */
  totalLines: number;

  /** Total debits */
  totalDebits: number;

  /** Total credits */
  totalCredits: number;

  /** Whether balanced */
  isBalanced: boolean;

  /** Earliest transaction date */
  earliestDate: Date;

  /** Latest transaction date */
  latestDate: Date;

  /** Accounts used */
  accountsUsed: string[];

  /** Departments used */
  departmentsUsed: string[];

  /** Locations used */
  locationsUsed: string[];
}

/**
 * Pre-upload validation report
 */
export interface PreUploadReport {
  /** Report generated timestamp */
  generatedAt: Date;

  /** Report title */
  title: string;

  /** Overall status */
  status: 'ready' | 'warnings' | 'blocked';

  /** Status message */
  statusMessage: string;

  /** Summary statistics */
  summary: ReportSummary;

  /** Validation result */
  validation: ValidationResult;

  /** Critical issues that block upload */
  criticalIssues: ValidationIssue[];

  /** Warnings that don't block upload */
  warnings: ValidationIssue[];

  /** Informational notes */
  notes: string[];

  /** Recommended actions before upload */
  recommendations: string[];

  /** Output file path if generated */
  outputFilePath?: string;

  /** Row count in output file */
  outputRowCount?: number;
}

// ==================== PARSE RESULT TYPES ====================

/**
 * Result of parsing an ADP file
 */
export interface ParseResult {
  /** Whether parsing succeeded */
  success: boolean;

  /** Parsed entries */
  entries: PayrollEntry[];

  /** Parse errors */
  errors: ValidationIssue[];

  /** Parse warnings */
  warnings: ValidationIssue[];

  /** Source file path */
  sourceFile: string;

  /** Total rows in file */
  totalRows: number;

  /** Successfully parsed rows */
  parsedRows: number;

  /** Skipped rows (headers, empty, etc.) */
  skippedRows: number;

  /** Error rows */
  errorRows: number;

  /** File encoding detected */
  encodingDetected?: string;

  /** Parse timestamp */
  parsedAt: Date;
}

// ==================== GENERATION RESULT TYPES ====================

/**
 * Result of generating an import file
 */
export interface GenerationResult {
  /** Whether generation succeeded */
  success: boolean;

  /** Output file path */
  filePath: string;

  /** Number of data rows (excluding header) */
  rowCount: number;

  /** Total journal entries */
  entryCount: number;

  /** File size in bytes */
  fileSizeBytes: number;

  /** Generation timestamp */
  generatedAt: Date;

  /** Any warnings during generation */
  warnings: ValidationIssue[];

  /** Checksum for verification */
  checksum?: string;
}

// ==================== UTILITY TYPES ====================

/**
 * Processing status for tracking progress
 */
export interface ProcessingStatus {
  /** Current phase */
  phase: 'parsing' | 'mapping' | 'validating' | 'generating' | 'complete' | 'error';

  /** Progress percentage (0-100) */
  progress: number;

  /** Current item being processed */
  currentItem?: string;

  /** Total items to process */
  totalItems?: number;

  /** Processed items */
  processedItems?: number;

  /** Status message */
  message: string;

  /** Start time */
  startedAt: Date;

  /** End time if complete */
  completedAt?: Date;

  /** Error if failed */
  error?: string;
}

/**
 * Options for the transformation pipeline
 */
export interface TransformOptions {
  /** Path to account mapping config */
  accountMappingPath?: string;

  /** Path to department mapping config */
  departmentMappingPath?: string;

  /** Path to transform config */
  transformConfigPath?: string;

  /** Override journal symbol */
  journalSymbol?: string;

  /** Override reference number prefix */
  referencePrefix?: string;

  /** Entry date override (for all entries) */
  entryDateOverride?: Date;

  /** Dry run mode (don't write files) */
  dryRun?: boolean;

  /** Verbose logging */
  verbose?: boolean;
}
