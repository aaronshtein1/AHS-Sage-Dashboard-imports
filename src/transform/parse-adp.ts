/**
 * ADP Payroll Export CSV Parser
 *
 * Parses CSV files exported from ADP payroll system and converts them
 * to structured PayrollEntry objects for further processing.
 *
 * Features:
 * - Handles quoted fields and commas within values
 * - Validates required columns exist
 * - Converts dates to standard format
 * - Handles debit/credit amounts properly
 * - Returns detailed parse errors for troubleshooting
 */

import * as fs from 'fs';
import * as path from 'path';
import {
  ADPPayrollRow,
  PayrollEntry,
  ParseResult,
  ValidationIssue,
  TransformConfig,
  ADPColumnMapping,
} from './types';

// Default column mapping if not specified in config
const DEFAULT_COLUMN_MAPPING: ADPColumnMapping = {
  accountCode: 'Account',
  departmentCode: 'Department',
  locationCode: 'Location',
  debitAmount: 'Debit',
  creditAmount: 'Credit',
  description: 'Description',
  date: 'Date',
  employeeId: 'Employee ID',
  employeeName: 'Employee Name',
  payType: 'Pay Type',
};

/**
 * Parse a CSV line handling quoted fields with commas
 * @param line - Raw CSV line
 * @param delimiter - Field delimiter (default comma)
 * @returns Array of field values
 */
function parseCSVLine(line: string, delimiter: string = ','): string[] {
  const fields: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const nextChar = line[i + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        // Escaped quote
        current += '"';
        i++;
      } else {
        // Toggle quote mode
        inQuotes = !inQuotes;
      }
    } else if (char === delimiter && !inQuotes) {
      // Field boundary
      fields.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }

  // Add last field
  fields.push(current.trim());

  return fields;
}

/**
 * Parse a date string in various formats
 * @param dateStr - Date string from ADP file
 * @param inputFormat - Expected format (e.g., "MM/DD/YYYY")
 * @returns Date object or null if invalid
 */
function parseDate(dateStr: string, inputFormat: string = 'MM/DD/YYYY'): Date | null {
  if (!dateStr || dateStr.trim() === '') {
    return null;
  }

  const trimmed = dateStr.trim();

  // Try common formats
  let parts: string[];
  let year: number;
  let month: number;
  let day: number;

  if (inputFormat === 'MM/DD/YYYY' || trimmed.includes('/')) {
    parts = trimmed.split('/');
    if (parts.length === 3) {
      month = parseInt(parts[0], 10);
      day = parseInt(parts[1], 10);
      year = parseInt(parts[2], 10);
      // Handle 2-digit years
      if (year < 100) {
        year += year < 50 ? 2000 : 1900;
      }
    } else {
      return null;
    }
  } else if (inputFormat === 'YYYY-MM-DD' || trimmed.includes('-')) {
    parts = trimmed.split('-');
    if (parts.length === 3) {
      year = parseInt(parts[0], 10);
      month = parseInt(parts[1], 10);
      day = parseInt(parts[2], 10);
    } else {
      return null;
    }
  } else {
    // Try ISO format as fallback
    const parsed = new Date(trimmed);
    if (!isNaN(parsed.getTime())) {
      return parsed;
    }
    return null;
  }

  // Validate ranges
  if (
    isNaN(year) ||
    isNaN(month) ||
    isNaN(day) ||
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > 31 ||
    year < 1900 ||
    year > 2100
  ) {
    return null;
  }

  return new Date(year, month - 1, day);
}

/**
 * Parse an amount string handling various formats
 * @param amountStr - Amount string (may include $, commas, parentheses for negative)
 * @returns Parsed number or null if invalid
 */
function parseAmount(amountStr: string | null | undefined): number | null {
  if (amountStr === null || amountStr === undefined || amountStr.trim() === '') {
    return null;
  }

  let cleaned = amountStr.trim();

  // Handle parentheses for negative (accounting format)
  const isNegative = cleaned.startsWith('(') && cleaned.endsWith(')');
  if (isNegative) {
    cleaned = cleaned.slice(1, -1);
  }

  // Remove currency symbols and commas
  cleaned = cleaned.replace(/[$,]/g, '');

  // Handle negative sign
  const hasNegativeSign = cleaned.startsWith('-');
  if (hasNegativeSign) {
    cleaned = cleaned.slice(1);
  }

  const value = parseFloat(cleaned);

  if (isNaN(value)) {
    return null;
  }

  return isNegative || hasNegativeSign ? -value : value;
}

/**
 * Generate a unique ID for an entry
 * @param index - Row index
 * @param filename - Source filename
 * @returns Unique entry ID
 */
function generateEntryId(index: number, filename: string): string {
  const baseName = path.basename(filename, path.extname(filename));
  const timestamp = Date.now().toString(36);
  return `${baseName}_${index}_${timestamp}`;
}

/**
 * Build column index map from header row
 * @param headers - Array of column headers
 * @param columnMapping - Column mapping configuration
 * @returns Map of field name to column index
 */
function buildColumnIndexMap(
  headers: string[],
  columnMapping: ADPColumnMapping
): Map<string, number> {
  const indexMap = new Map<string, number>();
  const normalizedHeaders = headers.map((h) => h.toLowerCase().trim());

  // Map each field to its column index
  for (const [field, colRef] of Object.entries(columnMapping)) {
    if (colRef === undefined) continue;

    if (typeof colRef === 'number') {
      // Direct index reference
      indexMap.set(field, colRef);
    } else {
      // Header name reference - find index
      const searchName = colRef.toLowerCase().trim();
      const index = normalizedHeaders.findIndex(
        (h) => h === searchName || h.includes(searchName)
      );
      if (index >= 0) {
        indexMap.set(field, index);
      }
    }
  }

  return indexMap;
}

/**
 * Parse a single row into an ADPPayrollRow
 * @param fields - Array of field values
 * @param columnMap - Map of field name to column index
 * @param lineNumber - Source line number
 * @returns Parsed row or null if critical fields missing
 */
function parseRow(
  fields: string[],
  columnMap: Map<string, number>,
  lineNumber: number
): { row: ADPPayrollRow | null; errors: ValidationIssue[] } {
  const errors: ValidationIssue[] = [];

  const getField = (name: string): string => {
    const index = columnMap.get(name);
    if (index === undefined || index >= fields.length) {
      return '';
    }
    return fields[index];
  };

  const accountCode = getField('accountCode');
  const departmentCode = getField('departmentCode');
  const dateStr = getField('date');
  const debitStr = getField('debitAmount');
  const creditStr = getField('creditAmount');
  const description = getField('description');

  // Validate required fields
  if (!accountCode) {
    errors.push({
      code: 'MISSING_ACCOUNT',
      severity: 'error',
      message: 'Account code is required',
      field: 'accountCode',
      lineNumber,
    });
  }

  if (!dateStr) {
    errors.push({
      code: 'MISSING_DATE',
      severity: 'error',
      message: 'Date is required',
      field: 'date',
      lineNumber,
    });
  }

  // If critical fields missing, return null
  if (errors.some((e) => e.severity === 'error')) {
    return { row: null, errors };
  }

  const debitAmount = parseAmount(debitStr);
  const creditAmount = parseAmount(creditStr);

  // At least one amount must be present
  if (debitAmount === null && creditAmount === null) {
    errors.push({
      code: 'MISSING_AMOUNTS',
      severity: 'error',
      message: 'At least one of debit or credit amount is required',
      field: 'debitAmount',
      lineNumber,
    });
    return { row: null, errors };
  }

  const row: ADPPayrollRow = {
    accountCode: accountCode.trim(),
    departmentCode: departmentCode.trim(),
    locationCode: getField('locationCode').trim() || undefined,
    debitAmount,
    creditAmount,
    description: description.trim(),
    date: dateStr.trim(),
    employeeId: getField('employeeId').trim() || undefined,
    employeeName: getField('employeeName').trim() || undefined,
    payType: getField('payType').trim() || undefined,
    sourceLineNumber: lineNumber,
  };

  return { row, errors };
}

/**
 * Convert an ADPPayrollRow to a PayrollEntry
 * @param row - Parsed ADP row
 * @param sourceFile - Source filename
 * @param dateFormat - Date format configuration
 * @returns PayrollEntry
 */
function convertToPayrollEntry(
  row: ADPPayrollRow,
  sourceFile: string,
  dateFormat: string = 'MM/DD/YYYY'
): { entry: PayrollEntry | null; errors: ValidationIssue[] } {
  const errors: ValidationIssue[] = [];

  // Parse the date
  const postingDate = parseDate(row.date, dateFormat);
  if (!postingDate) {
    errors.push({
      code: 'INVALID_DATE',
      severity: 'error',
      message: `Invalid date format: "${row.date}"`,
      field: 'date',
      value: row.date,
      lineNumber: row.sourceLineNumber,
      suggestion: `Expected format: ${dateFormat}`,
    });
    return { entry: null, errors };
  }

  // Determine amount and debit/credit
  let amount: number;
  let isDebit: boolean;

  if (row.debitAmount !== null && row.debitAmount !== 0) {
    amount = Math.abs(row.debitAmount);
    isDebit = true;
  } else if (row.creditAmount !== null && row.creditAmount !== 0) {
    amount = Math.abs(row.creditAmount);
    isDebit = false;
  } else {
    // Both are zero or null - skip this entry with warning
    errors.push({
      code: 'ZERO_AMOUNT',
      severity: 'warning',
      message: 'Entry has zero amount',
      lineNumber: row.sourceLineNumber,
    });
    return { entry: null, errors };
  }

  const entry: PayrollEntry = {
    id: generateEntryId(row.sourceLineNumber, sourceFile),
    accountCode: row.accountCode,
    departmentCode: row.departmentCode,
    locationCode: row.locationCode,
    amount,
    isDebit,
    description: row.description,
    postingDate,
    originalDateString: row.date,
    employeeId: row.employeeId,
    employeeName: row.employeeName,
    payType: row.payType,
    sourceLineNumber: row.sourceLineNumber,
    sourceFile,
  };

  return { entry, errors };
}

/**
 * Validate that a file exists and has expected columns
 * @param filePath - Path to CSV file
 * @param columnMapping - Expected column mapping
 * @returns Validation errors
 */
export function validateFile(
  filePath: string,
  columnMapping: ADPColumnMapping = DEFAULT_COLUMN_MAPPING
): ValidationIssue[] {
  const errors: ValidationIssue[] = [];

  // Check file exists
  if (!fs.existsSync(filePath)) {
    errors.push({
      code: 'FILE_NOT_FOUND',
      severity: 'error',
      message: `File not found: ${filePath}`,
    });
    return errors;
  }

  // Check file is readable
  try {
    fs.accessSync(filePath, fs.constants.R_OK);
  } catch {
    errors.push({
      code: 'FILE_NOT_READABLE',
      severity: 'error',
      message: `Cannot read file: ${filePath}`,
    });
    return errors;
  }

  // Read first line to check headers
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split(/\r?\n/).filter((line) => line.trim() !== '');

  if (lines.length === 0) {
    errors.push({
      code: 'EMPTY_FILE',
      severity: 'error',
      message: 'File is empty',
    });
    return errors;
  }

  // Parse header row
  const headers = parseCSVLine(lines[0]);
  const columnMap = buildColumnIndexMap(headers, columnMapping);

  // Check required columns exist
  const requiredFields = ['accountCode', 'date'];
  for (const field of requiredFields) {
    if (!columnMap.has(field)) {
      const expectedHeader =
        typeof columnMapping[field as keyof ADPColumnMapping] === 'string'
          ? columnMapping[field as keyof ADPColumnMapping]
          : field;
      errors.push({
        code: 'MISSING_COLUMN',
        severity: 'error',
        message: `Required column not found: ${expectedHeader}`,
        field,
        suggestion: `Available columns: ${headers.join(', ')}`,
      });
    }
  }

  // Check at least debit or credit column exists
  if (!columnMap.has('debitAmount') && !columnMap.has('creditAmount')) {
    errors.push({
      code: 'MISSING_AMOUNT_COLUMNS',
      severity: 'error',
      message: 'Neither debit nor credit amount column found',
      suggestion: `Available columns: ${headers.join(', ')}`,
    });
  }

  if (lines.length < 2) {
    errors.push({
      code: 'NO_DATA_ROWS',
      severity: 'warning',
      message: 'File contains only header row, no data',
    });
  }

  return errors;
}

/**
 * Parse an ADP payroll export CSV file
 * @param filePath - Path to the CSV file
 * @param config - Optional transform configuration
 * @returns ParseResult with entries and any errors/warnings
 */
export function parseADPFile(
  filePath: string,
  config?: Partial<TransformConfig>
): ParseResult {
  const startTime = Date.now();
  const errors: ValidationIssue[] = [];
  const warnings: ValidationIssue[] = [];
  const entries: PayrollEntry[] = [];

  // Get configuration values
  const columnMapping = config?.adpColumnMapping || DEFAULT_COLUMN_MAPPING;
  const dateFormat = config?.dateFormat?.inputFormat || 'MM/DD/YYYY';
  const hasHeaderRow = config?.hasHeaderRow ?? true;
  const skipRows = config?.skipRows ?? 0;
  const delimiter = config?.csvDelimiter || ',';
  const encoding = config?.fileEncoding || 'utf-8';

  // Validate file first
  const fileErrors = validateFile(filePath, columnMapping);
  if (fileErrors.some((e) => e.severity === 'error')) {
    return {
      success: false,
      entries: [],
      errors: fileErrors,
      warnings: [],
      sourceFile: filePath,
      totalRows: 0,
      parsedRows: 0,
      skippedRows: 0,
      errorRows: 0,
      parsedAt: new Date(),
    };
  }

  // Read file content
  let content: string;
  try {
    content = fs.readFileSync(filePath, encoding);
  } catch (err) {
    errors.push({
      code: 'READ_ERROR',
      severity: 'error',
      message: `Error reading file: ${err instanceof Error ? err.message : 'Unknown error'}`,
    });
    return {
      success: false,
      entries: [],
      errors,
      warnings: [],
      sourceFile: filePath,
      totalRows: 0,
      parsedRows: 0,
      skippedRows: 0,
      errorRows: 0,
      parsedAt: new Date(),
    };
  }

  // Split into lines
  const lines = content.split(/\r?\n/);
  const totalRows = lines.length;
  let skippedRows = skipRows;
  let errorRows = 0;
  let dataStartRow = skipRows;

  // Parse header row
  let columnMap: Map<string, number>;
  if (hasHeaderRow) {
    const headerLine = lines[skipRows];
    if (!headerLine || headerLine.trim() === '') {
      errors.push({
        code: 'MISSING_HEADER',
        severity: 'error',
        message: 'Header row is empty or missing',
      });
      return {
        success: false,
        entries: [],
        errors,
        warnings: [],
        sourceFile: filePath,
        totalRows,
        parsedRows: 0,
        skippedRows,
        errorRows: 0,
        parsedAt: new Date(),
      };
    }

    const headers = parseCSVLine(headerLine, delimiter);
    columnMap = buildColumnIndexMap(headers, columnMapping);
    dataStartRow = skipRows + 1;
    skippedRows++;
  } else {
    // Use numeric indices from column mapping
    columnMap = new Map();
    for (const [field, colRef] of Object.entries(columnMapping)) {
      if (typeof colRef === 'number') {
        columnMap.set(field, colRef);
      }
    }
  }

  // Parse data rows
  for (let i = dataStartRow; i < lines.length; i++) {
    const line = lines[i];

    // Skip empty lines
    if (!line || line.trim() === '') {
      skippedRows++;
      continue;
    }

    const lineNumber = i + 1; // 1-based line numbers
    const fields = parseCSVLine(line, delimiter);

    // Parse row
    const { row, errors: rowErrors } = parseRow(fields, columnMap, lineNumber);

    if (rowErrors.length > 0) {
      for (const err of rowErrors) {
        if (err.severity === 'error') {
          errors.push(err);
        } else {
          warnings.push(err);
        }
      }
    }

    if (!row) {
      errorRows++;
      continue;
    }

    // Convert to PayrollEntry
    const { entry, errors: conversionErrors } = convertToPayrollEntry(
      row,
      filePath,
      dateFormat
    );

    if (conversionErrors.length > 0) {
      for (const err of conversionErrors) {
        if (err.severity === 'error') {
          errors.push(err);
        } else {
          warnings.push(err);
        }
      }
    }

    if (entry) {
      entries.push(entry);
    } else if (conversionErrors.some((e) => e.severity === 'error')) {
      errorRows++;
    }
  }

  const success = errors.length === 0;
  const parsedRows = entries.length;

  return {
    success,
    entries,
    errors,
    warnings,
    sourceFile: filePath,
    totalRows,
    parsedRows,
    skippedRows,
    errorRows,
    encodingDetected: encoding,
    parsedAt: new Date(),
  };
}

/**
 * Parse multiple ADP files from a directory
 * @param directoryPath - Path to directory containing CSV files
 * @param config - Optional transform configuration
 * @returns Combined ParseResult
 */
export function parseADPDirectory(
  directoryPath: string,
  config?: Partial<TransformConfig>
): ParseResult {
  const allEntries: PayrollEntry[] = [];
  const allErrors: ValidationIssue[] = [];
  const allWarnings: ValidationIssue[] = [];
  let totalRows = 0;
  let parsedRows = 0;
  let skippedRows = 0;
  let errorRows = 0;
  const sourceFiles: string[] = [];

  // Check directory exists
  if (!fs.existsSync(directoryPath)) {
    return {
      success: false,
      entries: [],
      errors: [
        {
          code: 'DIRECTORY_NOT_FOUND',
          severity: 'error',
          message: `Directory not found: ${directoryPath}`,
        },
      ],
      warnings: [],
      sourceFile: directoryPath,
      totalRows: 0,
      parsedRows: 0,
      skippedRows: 0,
      errorRows: 0,
      parsedAt: new Date(),
    };
  }

  // Find CSV files
  const files = fs.readdirSync(directoryPath).filter((f) => {
    const ext = path.extname(f).toLowerCase();
    return ext === '.csv';
  });

  if (files.length === 0) {
    return {
      success: false,
      entries: [],
      errors: [
        {
          code: 'NO_CSV_FILES',
          severity: 'error',
          message: `No CSV files found in: ${directoryPath}`,
        },
      ],
      warnings: [],
      sourceFile: directoryPath,
      totalRows: 0,
      parsedRows: 0,
      skippedRows: 0,
      errorRows: 0,
      parsedAt: new Date(),
    };
  }

  // Parse each file
  for (const file of files) {
    const filePath = path.join(directoryPath, file);
    const result = parseADPFile(filePath, config);

    sourceFiles.push(filePath);
    allEntries.push(...result.entries);
    allErrors.push(...result.errors);
    allWarnings.push(...result.warnings);
    totalRows += result.totalRows;
    parsedRows += result.parsedRows;
    skippedRows += result.skippedRows;
    errorRows += result.errorRows;
  }

  return {
    success: allErrors.length === 0,
    entries: allEntries,
    errors: allErrors,
    warnings: allWarnings,
    sourceFile: sourceFiles.join(', '),
    totalRows,
    parsedRows,
    skippedRows,
    errorRows,
    parsedAt: new Date(),
  };
}

/**
 * Default export directory path
 */
export const DEFAULT_PAYROLL_GL_PATH = '/downloads/payroll-gl/';

/**
 * Parse ADP files from the default payroll-gl directory
 * @param config - Optional transform configuration
 * @returns ParseResult
 */
export function parsePayrollGLFiles(config?: Partial<TransformConfig>): ParseResult {
  return parseADPDirectory(DEFAULT_PAYROLL_GL_PATH, config);
}
