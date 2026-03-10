/**
 * ADP to Intacct Mapping Module
 *
 * Transforms parsed ADP payroll entries into Intacct journal entry format
 * using configuration-driven account, department, and location mappings.
 *
 * Features:
 * - Config-driven account code mapping
 * - Department and location code mapping
 * - Memo/description formatting per Intacct requirements
 * - Proper debit/credit handling
 * - Entry aggregation option
 * - Reference number generation
 */

import * as fs from 'fs';
import * as path from 'path';
import {
  PayrollEntry,
  IntacctJournalEntry,
  IntacctJournalLine,
  AccountMapping,
  AccountMappingEntry,
  DepartmentMapping,
  DepartmentMappingEntry,
  TransformConfig,
  ValidationIssue,
} from './types';

// Default paths for configuration files
const DEFAULT_CONFIG_PATH = path.join(process.cwd(), 'config');
const DEFAULT_ACCOUNT_MAPPING_PATH = path.join(DEFAULT_CONFIG_PATH, 'account-mapping.json');
const DEFAULT_DEPARTMENT_MAPPING_PATH = path.join(DEFAULT_CONFIG_PATH, 'department-mapping.json');
const DEFAULT_TRANSFORM_CONFIG_PATH = path.join(DEFAULT_CONFIG_PATH, 'transform-config.json');

/**
 * Result of the mapping process
 */
export interface MappingResult {
  /** Whether mapping was successful */
  success: boolean;
  /** Mapped journal entries */
  entries: IntacctJournalEntry[];
  /** Mapping errors */
  errors: ValidationIssue[];
  /** Mapping warnings */
  warnings: ValidationIssue[];
  /** Statistics */
  stats: {
    totalInputEntries: number;
    mappedEntries: number;
    unmappedAccounts: string[];
    unmappedDepartments: string[];
  };
}

/**
 * Load account mapping configuration from file
 * @param filePath - Path to account-mapping.json
 * @returns AccountMapping configuration
 */
export function loadAccountMapping(filePath: string = DEFAULT_ACCOUNT_MAPPING_PATH): AccountMapping {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Account mapping file not found: ${filePath}`);
  }

  const content = fs.readFileSync(filePath, 'utf-8');
  const mapping = JSON.parse(content) as AccountMapping;

  // Validate required fields
  if (!mapping.version) {
    throw new Error('Account mapping file missing version field');
  }

  if (!mapping.mappings || typeof mapping.mappings !== 'object') {
    throw new Error('Account mapping file missing or invalid mappings field');
  }

  return mapping;
}

/**
 * Load department mapping configuration from file
 * @param filePath - Path to department-mapping.json
 * @returns DepartmentMapping configuration
 */
export function loadDepartmentMapping(
  filePath: string = DEFAULT_DEPARTMENT_MAPPING_PATH
): DepartmentMapping {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Department mapping file not found: ${filePath}`);
  }

  const content = fs.readFileSync(filePath, 'utf-8');
  const mapping = JSON.parse(content) as DepartmentMapping;

  // Validate required fields
  if (!mapping.version) {
    throw new Error('Department mapping file missing version field');
  }

  if (!mapping.mappings || typeof mapping.mappings !== 'object') {
    throw new Error('Department mapping file missing or invalid mappings field');
  }

  return mapping;
}

/**
 * Load transform configuration from file
 * @param filePath - Path to transform-config.json
 * @returns TransformConfig configuration
 */
export function loadTransformConfig(
  filePath: string = DEFAULT_TRANSFORM_CONFIG_PATH
): TransformConfig {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Transform config file not found: ${filePath}`);
  }

  const content = fs.readFileSync(filePath, 'utf-8');
  return JSON.parse(content) as TransformConfig;
}

/**
 * Map an ADP account code to Intacct GL account number
 * @param adpAccountCode - ADP account code
 * @param mapping - Account mapping configuration
 * @returns Mapped Intacct account number or null if not found
 */
export function mapAccountCode(
  adpAccountCode: string,
  mapping: AccountMapping
): AccountMappingEntry | null {
  // Normalize the code for lookup
  const normalizedCode = adpAccountCode.trim().toUpperCase();

  // Try exact match first
  let entry = mapping.mappings[adpAccountCode];
  if (entry && entry.isActive) {
    return entry;
  }

  // Try normalized match
  entry = mapping.mappings[normalizedCode];
  if (entry && entry.isActive) {
    return entry;
  }

  // Try case-insensitive search
  for (const [key, value] of Object.entries(mapping.mappings)) {
    if (key.toUpperCase() === normalizedCode && value.isActive) {
      return value;
    }
  }

  return null;
}

/**
 * Map an ADP department code to Intacct department ID
 * @param adpDepartmentCode - ADP department code
 * @param mapping - Department mapping configuration
 * @returns Mapped Intacct department ID or null if not found
 */
export function mapDepartmentCode(
  adpDepartmentCode: string,
  mapping: DepartmentMapping
): DepartmentMappingEntry | null {
  if (!adpDepartmentCode || adpDepartmentCode.trim() === '') {
    return null;
  }

  const normalizedCode = adpDepartmentCode.trim().toUpperCase();

  // Try exact match first
  let entry = mapping.mappings[adpDepartmentCode];
  if (entry && entry.isActive) {
    return entry;
  }

  // Try normalized match
  entry = mapping.mappings[normalizedCode];
  if (entry && entry.isActive) {
    return entry;
  }

  // Try case-insensitive search
  for (const [key, value] of Object.entries(mapping.mappings)) {
    if (key.toUpperCase() === normalizedCode && value.isActive) {
      return value;
    }
  }

  return null;
}

/**
 * Format a memo/description per Intacct requirements
 * @param entry - PayrollEntry
 * @param maxLength - Maximum memo length
 * @param includeEmployee - Whether to include employee info
 * @returns Formatted memo string
 */
export function formatMemo(
  entry: PayrollEntry,
  maxLength: number = 1000,
  includeEmployee: boolean = true
): string {
  const parts: string[] = [];

  // Add description
  if (entry.description) {
    parts.push(entry.description);
  }

  // Add pay type if available
  if (entry.payType) {
    parts.push(`Pay Type: ${entry.payType}`);
  }

  // Add employee info if requested and available
  if (includeEmployee) {
    if (entry.employeeId && entry.employeeName) {
      parts.push(`Employee: ${entry.employeeName} (${entry.employeeId})`);
    } else if (entry.employeeName) {
      parts.push(`Employee: ${entry.employeeName}`);
    } else if (entry.employeeId) {
      parts.push(`Employee ID: ${entry.employeeId}`);
    }
  }

  // Join and truncate if needed
  let memo = parts.join(' | ');
  if (memo.length > maxLength) {
    memo = memo.substring(0, maxLength - 3) + '...';
  }

  return memo;
}

/**
 * Generate a reference number for a journal entry
 * @param prefix - Reference number prefix
 * @param date - Entry date
 * @param sequence - Sequence number
 * @returns Reference number string
 */
export function generateReferenceNumber(
  prefix: string,
  date: Date,
  sequence: number
): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const seq = String(sequence).padStart(4, '0');

  return `${prefix}${year}${month}${day}-${seq}`;
}

/**
 * Format date for Intacct output
 * @param date - Date object
 * @param format - Output format (default MM/DD/YYYY)
 * @returns Formatted date string
 */
export function formatDateForIntacct(date: Date, format: string = 'MM/DD/YYYY'): string {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const year = date.getFullYear();

  switch (format) {
    case 'YYYY-MM-DD':
      return `${year}-${month}-${day}`;
    case 'MM/DD/YYYY':
    default:
      return `${month}/${day}/${year}`;
  }
}

/**
 * Round an amount to specified precision
 * @param amount - Amount to round
 * @param precision - Decimal places
 * @param mode - Rounding mode
 * @returns Rounded amount
 */
function roundAmount(
  amount: number,
  precision: number = 2,
  mode: 'round' | 'floor' | 'ceil' = 'round'
): number {
  const factor = Math.pow(10, precision);

  switch (mode) {
    case 'floor':
      return Math.floor(amount * factor) / factor;
    case 'ceil':
      return Math.ceil(amount * factor) / factor;
    case 'round':
    default:
      return Math.round(amount * factor) / factor;
  }
}

/**
 * Map a single PayrollEntry to an IntacctJournalLine
 * @param entry - PayrollEntry to map
 * @param accountMapping - Account mapping configuration
 * @param departmentMapping - Department mapping configuration
 * @param config - Transform configuration
 * @returns Mapped journal line and any issues
 */
export function mapEntryToLine(
  entry: PayrollEntry,
  accountMapping: AccountMapping,
  departmentMapping: DepartmentMapping,
  config: Partial<TransformConfig> = {}
): { line: IntacctJournalLine | null; errors: ValidationIssue[]; warnings: ValidationIssue[] } {
  const errors: ValidationIssue[] = [];
  const warnings: ValidationIssue[] = [];

  // Map account code
  const accountEntry = mapAccountCode(entry.accountCode, accountMapping);
  if (!accountEntry) {
    if (accountMapping.failOnUnmapped) {
      errors.push({
        code: 'UNMAPPED_ACCOUNT',
        severity: 'error',
        message: `No mapping found for account code: ${entry.accountCode}`,
        field: 'accountCode',
        value: entry.accountCode,
        entryId: entry.id,
        lineNumber: entry.sourceLineNumber,
        suggestion: 'Add mapping to account-mapping.json or set failOnUnmapped to false',
      });
      return { line: null, errors, warnings };
    } else if (accountMapping.defaultAccount) {
      warnings.push({
        code: 'USING_DEFAULT_ACCOUNT',
        severity: 'warning',
        message: `Using default account for unmapped code: ${entry.accountCode}`,
        field: 'accountCode',
        value: entry.accountCode,
        entryId: entry.id,
      });
    } else {
      errors.push({
        code: 'UNMAPPED_ACCOUNT_NO_DEFAULT',
        severity: 'error',
        message: `No mapping or default for account code: ${entry.accountCode}`,
        field: 'accountCode',
        value: entry.accountCode,
        entryId: entry.id,
      });
      return { line: null, errors, warnings };
    }
  }

  // Map department code
  let intacctDepartmentId: string | undefined;
  if (entry.departmentCode) {
    const deptEntry = mapDepartmentCode(entry.departmentCode, departmentMapping);
    if (deptEntry) {
      intacctDepartmentId = deptEntry.intacctDepartmentId;
    } else if (departmentMapping.failOnUnmapped) {
      errors.push({
        code: 'UNMAPPED_DEPARTMENT',
        severity: 'error',
        message: `No mapping found for department code: ${entry.departmentCode}`,
        field: 'departmentCode',
        value: entry.departmentCode,
        entryId: entry.id,
      });
      return { line: null, errors, warnings };
    } else if (departmentMapping.defaultDepartment) {
      intacctDepartmentId = departmentMapping.defaultDepartment;
      warnings.push({
        code: 'USING_DEFAULT_DEPARTMENT',
        severity: 'warning',
        message: `Using default department for unmapped code: ${entry.departmentCode}`,
        field: 'departmentCode',
        value: entry.departmentCode,
        entryId: entry.id,
      });
    }
  }

  // Get GL account number
  const glAccountNo = accountEntry?.intacctAccountNo || accountMapping.defaultAccount || '';

  // Round amount
  const precision = config.decimalPrecision ?? 2;
  const roundingMode = config.roundingMode ?? 'round';
  const roundedAmount = roundAmount(entry.amount, precision, roundingMode);

  // Create journal line
  const line: IntacctJournalLine = {
    glAccountNo,
    debit: entry.isDebit ? roundedAmount : 0,
    credit: entry.isDebit ? 0 : roundedAmount,
    departmentId: intacctDepartmentId,
    locationId: entry.locationCode,
    memo: formatMemo(
      entry,
      config.maxMemoLength ?? 1000,
      config.includeEmployeeInMemo ?? true
    ),
  };

  // Add employee ID if present
  if (entry.employeeId) {
    line.employeeId = entry.employeeId;
  }

  return { line, errors, warnings };
}

/**
 * Group payroll entries by date for journal entry creation
 * @param entries - Array of PayrollEntry
 * @returns Map of date string to entries
 */
function groupEntriesByDate(entries: PayrollEntry[]): Map<string, PayrollEntry[]> {
  const groups = new Map<string, PayrollEntry[]>();

  for (const entry of entries) {
    const dateKey = entry.postingDate.toISOString().split('T')[0];
    const existing = groups.get(dateKey) || [];
    existing.push(entry);
    groups.set(dateKey, existing);
  }

  return groups;
}

/**
 * Aggregate entries by account and department
 * @param entries - Array of PayrollEntry
 * @returns Aggregated entries
 */
function aggregateEntries(entries: PayrollEntry[]): PayrollEntry[] {
  const aggregated = new Map<string, PayrollEntry>();

  for (const entry of entries) {
    const key = `${entry.accountCode}|${entry.departmentCode || ''}|${entry.isDebit ? 'D' : 'C'}`;
    const existing = aggregated.get(key);

    if (existing) {
      // Aggregate amounts
      existing.amount += entry.amount;
      // Combine descriptions if different
      if (entry.description && !existing.description.includes(entry.description)) {
        existing.description = `${existing.description}; ${entry.description}`.substring(0, 500);
      }
    } else {
      // Clone entry
      aggregated.set(key, {
        ...entry,
        description: entry.description,
      });
    }
  }

  return Array.from(aggregated.values());
}

/**
 * Map PayrollEntry array to IntacctJournalEntry array
 * @param entries - Array of PayrollEntry from parsing
 * @param options - Mapping options
 * @returns MappingResult with journal entries
 */
export function mapToIntacct(
  entries: PayrollEntry[],
  options: {
    accountMappingPath?: string;
    departmentMappingPath?: string;
    transformConfigPath?: string;
    journalSymbol?: string;
    referencePrefix?: string;
    entryDateOverride?: Date;
    aggregate?: boolean;
  } = {}
): MappingResult {
  const errors: ValidationIssue[] = [];
  const warnings: ValidationIssue[] = [];
  const journalEntries: IntacctJournalEntry[] = [];
  const unmappedAccounts = new Set<string>();
  const unmappedDepartments = new Set<string>();

  // Load configurations
  let accountMapping: AccountMapping;
  let departmentMapping: DepartmentMapping;
  let transformConfig: Partial<TransformConfig> = {};

  try {
    accountMapping = loadAccountMapping(options.accountMappingPath);
  } catch (err) {
    errors.push({
      code: 'CONFIG_LOAD_ERROR',
      severity: 'error',
      message: `Failed to load account mapping: ${err instanceof Error ? err.message : 'Unknown error'}`,
    });
    return {
      success: false,
      entries: [],
      errors,
      warnings,
      stats: {
        totalInputEntries: entries.length,
        mappedEntries: 0,
        unmappedAccounts: [],
        unmappedDepartments: [],
      },
    };
  }

  try {
    departmentMapping = loadDepartmentMapping(options.departmentMappingPath);
  } catch (err) {
    errors.push({
      code: 'CONFIG_LOAD_ERROR',
      severity: 'error',
      message: `Failed to load department mapping: ${err instanceof Error ? err.message : 'Unknown error'}`,
    });
    return {
      success: false,
      entries: [],
      errors,
      warnings,
      stats: {
        totalInputEntries: entries.length,
        mappedEntries: 0,
        unmappedAccounts: [],
        unmappedDepartments: [],
      },
    };
  }

  try {
    if (options.transformConfigPath || fs.existsSync(DEFAULT_TRANSFORM_CONFIG_PATH)) {
      transformConfig = loadTransformConfig(options.transformConfigPath);
    }
  } catch {
    // Transform config is optional, use defaults
    warnings.push({
      code: 'CONFIG_LOAD_WARNING',
      severity: 'warning',
      message: 'Transform config not found, using defaults',
    });
  }

  // Get config values
  const journalSymbol = options.journalSymbol || transformConfig.defaultJournalSymbol || 'GJ';
  const referencePrefix = options.referencePrefix || transformConfig.referenceNumberPrefix || 'ADP';
  const shouldAggregate = options.aggregate ?? transformConfig.aggregateEntries ?? false;

  // Process entries by date
  const entriesByDate = groupEntriesByDate(entries);
  let sequenceNumber = 1;

  for (const [dateKey, dateEntries] of entriesByDate) {
    // Optionally aggregate entries
    const processEntries = shouldAggregate ? aggregateEntries(dateEntries) : dateEntries;

    // Map each entry to a journal line
    const lines: IntacctJournalLine[] = [];
    let hasErrors = false;

    for (const entry of processEntries) {
      const { line, errors: lineErrors, warnings: lineWarnings } = mapEntryToLine(
        entry,
        accountMapping,
        departmentMapping,
        transformConfig
      );

      errors.push(...lineErrors);
      warnings.push(...lineWarnings);

      if (line) {
        lines.push(line);
      } else {
        hasErrors = true;
        // Track unmapped codes
        if (lineErrors.some((e) => e.code === 'UNMAPPED_ACCOUNT')) {
          unmappedAccounts.add(entry.accountCode);
        }
        if (lineErrors.some((e) => e.code === 'UNMAPPED_DEPARTMENT')) {
          unmappedDepartments.add(entry.departmentCode);
        }
      }
    }

    // Skip creating journal entry if there are errors
    if (hasErrors && lines.length === 0) {
      continue;
    }

    // Calculate totals
    const totalDebits = lines.reduce((sum, l) => sum + l.debit, 0);
    const totalCredits = lines.reduce((sum, l) => sum + l.credit, 0);

    // Determine entry date
    const entryDate = options.entryDateOverride || new Date(dateKey);

    // Get source file from first entry
    const sourceFile = processEntries[0]?.sourceFile || 'unknown';

    // Create journal entry
    const journalEntry: IntacctJournalEntry = {
      journalSymbol,
      referenceNumber: generateReferenceNumber(referencePrefix, entryDate, sequenceNumber),
      entryDate,
      description: `ADP Payroll Import - ${dateKey}`,
      lines,
      sourceDocumentType: 'ADP_PAYROLL',
      sourceFile,
      createdAt: new Date(),
      totalDebits: roundAmount(totalDebits, transformConfig.decimalPrecision ?? 2),
      totalCredits: roundAmount(totalCredits, transformConfig.decimalPrecision ?? 2),
    };

    journalEntries.push(journalEntry);
    sequenceNumber++;
  }

  return {
    success: errors.filter((e) => e.severity === 'error').length === 0,
    entries: journalEntries,
    errors,
    warnings,
    stats: {
      totalInputEntries: entries.length,
      mappedEntries: journalEntries.reduce((sum, e) => sum + e.lines.length, 0),
      unmappedAccounts: Array.from(unmappedAccounts),
      unmappedDepartments: Array.from(unmappedDepartments),
    },
  };
}

/**
 * Quick map function with default configurations
 * @param entries - PayrollEntry array
 * @returns MappingResult
 */
export function quickMap(entries: PayrollEntry[]): MappingResult {
  return mapToIntacct(entries);
}

/**
 * Re-export types for convenience
 */
export type { AccountMapping, DepartmentMapping, TransformConfig };
