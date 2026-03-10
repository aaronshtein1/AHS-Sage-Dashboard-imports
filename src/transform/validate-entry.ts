/**
 * Entry Validation Module
 *
 * Validates transformed Intacct journal entries before import.
 * Performs comprehensive checks including:
 * - Balance verification (debits = credits)
 * - Required field validation
 * - Account code existence in mapping
 * - Date format validation
 * - Amount numeric validation
 *
 * Returns detailed ValidationResult with errors and warnings.
 */

import * as fs from 'fs';
import * as path from 'path';
import {
  IntacctJournalEntry,
  IntacctJournalLine,
  ValidationResult,
  ValidationIssue,
  EntryValidationResult,
  AccountMapping,
  DepartmentMapping,
} from './types';
import { loadAccountMapping, loadDepartmentMapping } from './map-to-intacct';

// Default configuration paths
const DEFAULT_CONFIG_PATH = path.join(process.cwd(), 'config');
const DEFAULT_ACCOUNT_MAPPING_PATH = path.join(DEFAULT_CONFIG_PATH, 'account-mapping.json');
const DEFAULT_DEPARTMENT_MAPPING_PATH = path.join(DEFAULT_CONFIG_PATH, 'department-mapping.json');

/**
 * Validation options
 */
export interface ValidationOptions {
  /** Path to account mapping file for validation */
  accountMappingPath?: string;
  /** Path to department mapping file for validation */
  departmentMappingPath?: string;
  /** Tolerance for balance checking (default 0.01) */
  balanceTolerance?: number;
  /** Decimal precision for amount comparisons */
  decimalPrecision?: number;
  /** Minimum date allowed */
  minDate?: Date;
  /** Maximum date allowed */
  maxDate?: Date;
  /** Whether to validate account codes exist */
  validateAccountCodes?: boolean;
  /** Whether to validate department codes exist */
  validateDepartmentCodes?: boolean;
  /** Check for suspicious large amounts */
  maxAmountWarning?: number;
  /** Check for duplicate reference numbers */
  checkDuplicateReferences?: boolean;
}

// Default validation options
const DEFAULT_OPTIONS: Required<ValidationOptions> = {
  accountMappingPath: DEFAULT_ACCOUNT_MAPPING_PATH,
  departmentMappingPath: DEFAULT_DEPARTMENT_MAPPING_PATH,
  balanceTolerance: 0.01,
  decimalPrecision: 2,
  minDate: new Date('2000-01-01'),
  maxDate: new Date('2100-12-31'),
  validateAccountCodes: true,
  validateDepartmentCodes: true,
  maxAmountWarning: 1000000, // Warn on amounts over $1M
  checkDuplicateReferences: true,
};

/**
 * Round a number to specified decimal places
 */
function roundToDecimal(value: number, decimals: number): number {
  const factor = Math.pow(10, decimals);
  return Math.round(value * factor) / factor;
}

/**
 * Validate a single journal line
 * @param line - Journal line to validate
 * @param lineIndex - Line index for error reporting
 * @param entryId - Parent entry ID
 * @param options - Validation options
 * @returns Array of validation issues
 */
function validateLine(
  line: IntacctJournalLine,
  lineIndex: number,
  entryId: string,
  options: Required<ValidationOptions>
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  // Check GL account number is present
  if (!line.glAccountNo || line.glAccountNo.trim() === '') {
    issues.push({
      code: 'MISSING_GL_ACCOUNT',
      severity: 'error',
      message: 'GL account number is required',
      field: 'glAccountNo',
      entryId,
      lineNumber: lineIndex,
    });
  }

  // Check either debit or credit is present (but not both)
  if (line.debit === 0 && line.credit === 0) {
    issues.push({
      code: 'ZERO_LINE_AMOUNT',
      severity: 'warning',
      message: 'Line has zero debit and credit amounts',
      entryId,
      lineNumber: lineIndex,
    });
  }

  if (line.debit > 0 && line.credit > 0) {
    issues.push({
      code: 'BOTH_DEBIT_CREDIT',
      severity: 'error',
      message: 'Line cannot have both debit and credit amounts',
      field: 'debit/credit',
      entryId,
      lineNumber: lineIndex,
      suggestion: 'Split into separate lines or net the amounts',
    });
  }

  // Check amounts are positive
  if (line.debit < 0) {
    issues.push({
      code: 'NEGATIVE_DEBIT',
      severity: 'error',
      message: 'Debit amount cannot be negative',
      field: 'debit',
      value: line.debit,
      entryId,
      lineNumber: lineIndex,
    });
  }

  if (line.credit < 0) {
    issues.push({
      code: 'NEGATIVE_CREDIT',
      severity: 'error',
      message: 'Credit amount cannot be negative',
      field: 'credit',
      value: line.credit,
      entryId,
      lineNumber: lineIndex,
    });
  }

  // Check for unusually large amounts
  const lineAmount = line.debit || line.credit;
  if (lineAmount > options.maxAmountWarning) {
    issues.push({
      code: 'LARGE_AMOUNT_WARNING',
      severity: 'warning',
      message: `Line amount ${lineAmount.toLocaleString()} exceeds warning threshold`,
      field: 'amount',
      value: lineAmount,
      entryId,
      lineNumber: lineIndex,
      suggestion: 'Please verify this amount is correct',
    });
  }

  // Check amounts are valid numbers
  if (isNaN(line.debit) || !isFinite(line.debit)) {
    issues.push({
      code: 'INVALID_DEBIT',
      severity: 'error',
      message: 'Debit amount is not a valid number',
      field: 'debit',
      value: String(line.debit),
      entryId,
      lineNumber: lineIndex,
    });
  }

  if (isNaN(line.credit) || !isFinite(line.credit)) {
    issues.push({
      code: 'INVALID_CREDIT',
      severity: 'error',
      message: 'Credit amount is not a valid number',
      field: 'credit',
      value: String(line.credit),
      entryId,
      lineNumber: lineIndex,
    });
  }

  return issues;
}

/**
 * Validate a single journal entry
 * @param entry - Journal entry to validate
 * @param options - Validation options
 * @param accountMapping - Optional account mapping for code validation
 * @param departmentMapping - Optional department mapping for code validation
 * @returns EntryValidationResult
 */
export function validateEntry(
  entry: IntacctJournalEntry,
  options: ValidationOptions = {},
  accountMapping?: AccountMapping,
  departmentMapping?: DepartmentMapping
): EntryValidationResult {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const issues: ValidationIssue[] = [];
  const entryId = entry.referenceNumber;

  // Validate required header fields
  if (!entry.journalSymbol || entry.journalSymbol.trim() === '') {
    issues.push({
      code: 'MISSING_JOURNAL_SYMBOL',
      severity: 'error',
      message: 'Journal symbol is required',
      field: 'journalSymbol',
      entryId,
    });
  }

  if (!entry.referenceNumber || entry.referenceNumber.trim() === '') {
    issues.push({
      code: 'MISSING_REFERENCE_NUMBER',
      severity: 'error',
      message: 'Reference number is required',
      field: 'referenceNumber',
      entryId,
    });
  }

  // Validate entry date
  if (!entry.entryDate) {
    issues.push({
      code: 'MISSING_ENTRY_DATE',
      severity: 'error',
      message: 'Entry date is required',
      field: 'entryDate',
      entryId,
    });
  } else {
    // Check date is valid
    if (!(entry.entryDate instanceof Date) || isNaN(entry.entryDate.getTime())) {
      issues.push({
        code: 'INVALID_ENTRY_DATE',
        severity: 'error',
        message: 'Entry date is not a valid date',
        field: 'entryDate',
        value: String(entry.entryDate),
        entryId,
      });
    } else {
      // Check date is within allowed range
      if (entry.entryDate < opts.minDate) {
        issues.push({
          code: 'DATE_TOO_OLD',
          severity: 'warning',
          message: `Entry date ${entry.entryDate.toISOString().split('T')[0]} is before minimum allowed date`,
          field: 'entryDate',
          entryId,
        });
      }

      if (entry.entryDate > opts.maxDate) {
        issues.push({
          code: 'DATE_TOO_FUTURE',
          severity: 'error',
          message: `Entry date ${entry.entryDate.toISOString().split('T')[0]} is after maximum allowed date`,
          field: 'entryDate',
          entryId,
        });
      }
    }
  }

  // Validate reversal date if present
  if (entry.reversalDate) {
    if (!(entry.reversalDate instanceof Date) || isNaN(entry.reversalDate.getTime())) {
      issues.push({
        code: 'INVALID_REVERSAL_DATE',
        severity: 'error',
        message: 'Reversal date is not a valid date',
        field: 'reversalDate',
        value: String(entry.reversalDate),
        entryId,
      });
    } else if (entry.entryDate && entry.reversalDate < entry.entryDate) {
      issues.push({
        code: 'REVERSAL_BEFORE_ENTRY',
        severity: 'error',
        message: 'Reversal date cannot be before entry date',
        field: 'reversalDate',
        entryId,
      });
    }
  }

  // Validate lines exist
  if (!entry.lines || entry.lines.length === 0) {
    issues.push({
      code: 'NO_LINES',
      severity: 'error',
      message: 'Journal entry must have at least one line',
      field: 'lines',
      entryId,
    });
  } else {
    // Validate each line
    entry.lines.forEach((line, index) => {
      const lineIssues = validateLine(line, index, entryId, opts);
      issues.push(...lineIssues);

      // Validate account code exists in mapping
      if (opts.validateAccountCodes && accountMapping) {
        const accountExists =
          accountMapping.mappings[line.glAccountNo] ||
          Object.values(accountMapping.mappings).some(
            (m) => m.intacctAccountNo === line.glAccountNo
          );

        if (!accountExists) {
          issues.push({
            code: 'UNKNOWN_GL_ACCOUNT',
            severity: 'warning',
            message: `GL account ${line.glAccountNo} not found in account mapping`,
            field: 'glAccountNo',
            value: line.glAccountNo,
            entryId,
            lineNumber: index,
          });
        }
      }

      // Validate department code exists in mapping
      if (opts.validateDepartmentCodes && departmentMapping && line.departmentId) {
        const deptExists =
          departmentMapping.mappings[line.departmentId] ||
          Object.values(departmentMapping.mappings).some(
            (m) => m.intacctDepartmentId === line.departmentId
          );

        if (!deptExists) {
          issues.push({
            code: 'UNKNOWN_DEPARTMENT',
            severity: 'warning',
            message: `Department ${line.departmentId} not found in department mapping`,
            field: 'departmentId',
            value: line.departmentId,
            entryId,
            lineNumber: index,
          });
        }
      }
    });

    // Check entry is balanced (debits = credits)
    const totalDebits = roundToDecimal(
      entry.lines.reduce((sum, l) => sum + l.debit, 0),
      opts.decimalPrecision
    );
    const totalCredits = roundToDecimal(
      entry.lines.reduce((sum, l) => sum + l.credit, 0),
      opts.decimalPrecision
    );
    const difference = Math.abs(totalDebits - totalCredits);

    if (difference > opts.balanceTolerance) {
      issues.push({
        code: 'UNBALANCED_ENTRY',
        severity: 'error',
        message: `Entry is not balanced: Debits ${totalDebits.toFixed(2)}, Credits ${totalCredits.toFixed(2)}, Difference ${difference.toFixed(2)}`,
        field: 'balance',
        value: difference,
        entryId,
        suggestion: 'Ensure total debits equal total credits',
      });
    }

    // Verify stored totals match calculated totals
    if (entry.totalDebits !== undefined) {
      const storedDebits = roundToDecimal(entry.totalDebits, opts.decimalPrecision);
      if (Math.abs(storedDebits - totalDebits) > opts.balanceTolerance) {
        issues.push({
          code: 'TOTAL_DEBITS_MISMATCH',
          severity: 'warning',
          message: `Stored total debits (${storedDebits}) does not match calculated (${totalDebits})`,
          field: 'totalDebits',
          entryId,
        });
      }
    }

    if (entry.totalCredits !== undefined) {
      const storedCredits = roundToDecimal(entry.totalCredits, opts.decimalPrecision);
      if (Math.abs(storedCredits - totalCredits) > opts.balanceTolerance) {
        issues.push({
          code: 'TOTAL_CREDITS_MISMATCH',
          severity: 'warning',
          message: `Stored total credits (${storedCredits}) does not match calculated (${totalCredits})`,
          field: 'totalCredits',
          entryId,
        });
      }
    }
  }

  const hasErrors = issues.some((i) => i.severity === 'error');

  return {
    entryId,
    isValid: !hasErrors,
    issues,
    entry,
  };
}

/**
 * Validate a batch of journal entries
 * @param entries - Array of journal entries to validate
 * @param options - Validation options
 * @returns ValidationResult
 */
export function validateBatch(
  entries: IntacctJournalEntry[],
  options: ValidationOptions = {}
): ValidationResult {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const allIssues: ValidationIssue[] = [];
  const entryResults: EntryValidationResult[] = [];
  const issueSummary: Record<string, number> = {};
  let validEntries = 0;
  let errorEntries = 0;
  let warningEntries = 0;

  // Load mappings for validation
  let accountMapping: AccountMapping | undefined;
  let departmentMapping: DepartmentMapping | undefined;

  if (opts.validateAccountCodes) {
    try {
      accountMapping = loadAccountMapping(opts.accountMappingPath);
    } catch {
      allIssues.push({
        code: 'ACCOUNT_MAPPING_LOAD_FAILED',
        severity: 'warning',
        message: 'Could not load account mapping for validation',
      });
    }
  }

  if (opts.validateDepartmentCodes) {
    try {
      departmentMapping = loadDepartmentMapping(opts.departmentMappingPath);
    } catch {
      allIssues.push({
        code: 'DEPARTMENT_MAPPING_LOAD_FAILED',
        severity: 'warning',
        message: 'Could not load department mapping for validation',
      });
    }
  }

  // Check for duplicate reference numbers
  if (opts.checkDuplicateReferences) {
    const refNumbers = new Map<string, number>();
    entries.forEach((entry, index) => {
      if (entry.referenceNumber) {
        const existing = refNumbers.get(entry.referenceNumber);
        if (existing !== undefined) {
          allIssues.push({
            code: 'DUPLICATE_REFERENCE_NUMBER',
            severity: 'error',
            message: `Duplicate reference number: ${entry.referenceNumber} (entries ${existing + 1} and ${index + 1})`,
            field: 'referenceNumber',
            value: entry.referenceNumber,
          });
        }
        refNumbers.set(entry.referenceNumber, index);
      }
    });
  }

  // Validate each entry
  for (const entry of entries) {
    const result = validateEntry(entry, options, accountMapping, departmentMapping);
    entryResults.push(result);
    allIssues.push(...result.issues);

    // Count entry types
    if (result.isValid) {
      if (result.issues.length > 0) {
        warningEntries++;
      } else {
        validEntries++;
      }
    } else {
      errorEntries++;
    }

    // Update issue summary
    for (const issue of result.issues) {
      issueSummary[issue.code] = (issueSummary[issue.code] || 0) + 1;
    }
  }

  // Calculate totals across all entries
  const totalDebits = roundToDecimal(
    entries.reduce((sum, e) => sum + (e.totalDebits || 0), 0),
    opts.decimalPrecision
  );
  const totalCredits = roundToDecimal(
    entries.reduce((sum, e) => sum + (e.totalCredits || 0), 0),
    opts.decimalPrecision
  );
  const netDifference = Math.abs(totalDebits - totalCredits);

  // Check overall balance
  if (netDifference > opts.balanceTolerance) {
    allIssues.push({
      code: 'BATCH_UNBALANCED',
      severity: 'warning',
      message: `Batch total is unbalanced: Debits ${totalDebits.toFixed(2)}, Credits ${totalCredits.toFixed(2)}`,
      field: 'batch_balance',
      value: netDifference,
    });
  }

  const hasErrors = allIssues.some((i) => i.severity === 'error');
  const hasOnlyWarnings = !hasErrors && allIssues.some((i) => i.severity === 'warning');

  return {
    isValid: !hasErrors,
    canProceed: !hasErrors,
    totalEntries: entries.length,
    validEntries,
    errorEntries,
    warningEntries,
    issues: allIssues,
    issueSummary,
    totalDebits,
    totalCredits,
    netDifference,
    entryResults,
    validatedAt: new Date(),
  };
}

/**
 * Quick validation with default options
 * @param entries - Array of journal entries
 * @returns ValidationResult
 */
export function quickValidate(entries: IntacctJournalEntry[]): ValidationResult {
  return validateBatch(entries);
}

/**
 * Check if a single entry is balanced
 * @param entry - Journal entry to check
 * @param tolerance - Balance tolerance
 * @returns True if balanced
 */
export function isEntryBalanced(
  entry: IntacctJournalEntry,
  tolerance: number = 0.01
): boolean {
  if (!entry.lines || entry.lines.length === 0) {
    return false;
  }

  const totalDebits = entry.lines.reduce((sum, l) => sum + l.debit, 0);
  const totalCredits = entry.lines.reduce((sum, l) => sum + l.credit, 0);

  return Math.abs(totalDebits - totalCredits) <= tolerance;
}

/**
 * Get validation error summary as string
 * @param result - ValidationResult
 * @returns Human-readable summary
 */
export function getValidationSummary(result: ValidationResult): string {
  const lines: string[] = [];

  lines.push('=== Validation Summary ===');
  lines.push(`Total Entries: ${result.totalEntries}`);
  lines.push(`Valid: ${result.validEntries}`);
  lines.push(`With Warnings: ${result.warningEntries}`);
  lines.push(`With Errors: ${result.errorEntries}`);
  lines.push('');
  lines.push(`Total Debits: $${result.totalDebits.toLocaleString('en-US', { minimumFractionDigits: 2 })}`);
  lines.push(`Total Credits: $${result.totalCredits.toLocaleString('en-US', { minimumFractionDigits: 2 })}`);
  lines.push(`Net Difference: $${result.netDifference.toFixed(2)}`);
  lines.push('');

  if (Object.keys(result.issueSummary).length > 0) {
    lines.push('Issue Summary:');
    for (const [code, count] of Object.entries(result.issueSummary)) {
      lines.push(`  ${code}: ${count}`);
    }
  }

  lines.push('');
  lines.push(`Status: ${result.canProceed ? 'READY FOR UPLOAD' : 'BLOCKED - FIX ERRORS'}`);

  return lines.join('\n');
}

// ValidationOptions is already exported via the interface declaration above
