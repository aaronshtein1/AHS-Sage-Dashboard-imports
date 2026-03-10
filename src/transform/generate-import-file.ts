/**
 * Intacct Import File Generator
 *
 * Generates CSV files in the exact format required by Sage Intacct
 * for journal entry imports.
 *
 * Features:
 * - Creates CSV in exact Intacct import format
 * - Includes proper header row per Intacct requirements
 * - Handles date formatting
 * - Supports both single-entry and batch generation
 * - Generates file checksum for verification
 */

import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import {
  IntacctJournalEntry,
  IntacctJournalLine,
  GenerationResult,
  ValidationIssue,
} from './types';
import { formatDateForIntacct } from './map-to-intacct';

// Default export directory
const DEFAULT_EXPORT_PATH = path.join(process.cwd(), 'exports', 'intacct-ready');

/**
 * Intacct CSV column headers
 * These are the exact column names required by Intacct journal entry import
 */
const INTACCT_HEADERS = [
  'JOURNAL',           // Journal symbol (e.g., GJ for General Journal)
  'BATCH_DATE',        // Batch posting date (MM/DD/YYYY)
  'BATCH_TITLE',       // Batch description
  'ENTRY_DATE',        // Individual entry date (MM/DD/YYYY)
  'ENTRY_DESCRIPTION', // Entry description/memo
  'ACCOUNTNO',         // GL Account number
  'DEBIT',             // Debit amount
  'CREDIT',            // Credit amount
  'DEPT_ID',           // Department ID
  'LOCATION_ID',       // Location ID
  'CLASS_ID',          // Class ID (optional)
  'PROJECT_ID',        // Project ID (optional)
  'CUSTOMER_ID',       // Customer ID (optional)
  'VENDOR_ID',         // Vendor ID (optional)
  'EMPLOYEE_ID',       // Employee ID (optional)
  'LINE_MEMO',         // Line-level memo
  'ENTRY_NUMBER',      // Reference number
];

/**
 * Simplified header for basic journal entry import
 */
const SIMPLE_HEADERS = [
  'JOURNAL',
  'ENTRY_DATE',
  'DESCRIPTION',
  'ACCOUNTNO',
  'DEBIT',
  'CREDIT',
  'DEPT_ID',
  'LOCATION_ID',
  'LINE_MEMO',
  'ENTRY_NUMBER',
];

/**
 * Generation options
 */
export interface GenerationOptions {
  /** Output directory (default: /exports/intacct-ready/) */
  outputDir?: string;
  /** Filename (without extension) - if not provided, will be auto-generated */
  filename?: string;
  /** Entry type for filename (e.g., "payroll", "adjusting") */
  entryType?: string;
  /** Date format for output (default: MM/DD/YYYY) */
  dateFormat?: string;
  /** Whether to use full headers vs simplified */
  useFullHeaders?: boolean;
  /** Include batch information columns */
  includeBatchInfo?: boolean;
  /** Generate checksum */
  generateChecksum?: boolean;
  /** CSV delimiter */
  delimiter?: string;
  /** Line ending */
  lineEnding?: '\n' | '\r\n';
  /** Whether to quote all fields */
  quoteAllFields?: boolean;
}

// Default options
const DEFAULT_OPTIONS: Required<GenerationOptions> = {
  outputDir: DEFAULT_EXPORT_PATH,
  filename: '',
  entryType: 'journal',
  dateFormat: 'MM/DD/YYYY',
  useFullHeaders: false,
  includeBatchInfo: false,
  generateChecksum: true,
  delimiter: ',',
  lineEnding: '\n',
  quoteAllFields: false,
};

/**
 * Escape a field value for CSV
 * @param value - Value to escape
 * @param forceQuote - Always quote the value
 * @param delimiter - CSV delimiter
 * @returns Escaped value
 */
function escapeCSVField(
  value: string | number | undefined | null,
  forceQuote: boolean = false,
  delimiter: string = ','
): string {
  if (value === undefined || value === null) {
    return '';
  }

  const str = String(value);

  // Check if quoting is needed
  const needsQuotes =
    forceQuote ||
    str.includes(delimiter) ||
    str.includes('"') ||
    str.includes('\n') ||
    str.includes('\r');

  if (needsQuotes) {
    // Escape internal quotes by doubling them
    const escaped = str.replace(/"/g, '""');
    return `"${escaped}"`;
  }

  return str;
}

/**
 * Format an amount for CSV output
 * @param amount - Amount to format
 * @returns Formatted amount string
 */
function formatAmount(amount: number): string {
  if (amount === 0) {
    return '';
  }
  // Format with 2 decimal places, no thousands separator
  return amount.toFixed(2);
}

/**
 * Generate filename for the export
 * @param entryType - Type of entry (e.g., "payroll")
 * @param date - Date for filename
 * @returns Generated filename
 */
function generateFilename(entryType: string, date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');

  return `${year}${month}${day}_${hours}${minutes}_${entryType}_intacct`;
}

/**
 * Convert a journal line to CSV row values
 * @param entry - Parent journal entry
 * @param line - Journal line
 * @param options - Generation options
 * @returns Array of field values
 */
function lineToRow(
  entry: IntacctJournalEntry,
  line: IntacctJournalLine,
  options: Required<GenerationOptions>
): string[] {
  const entryDate = formatDateForIntacct(entry.entryDate, options.dateFormat);

  if (options.useFullHeaders) {
    // Full format with all columns
    const batchDate = entry.batchKey
      ? formatDateForIntacct(entry.entryDate, options.dateFormat)
      : entryDate;

    return [
      entry.journalSymbol,
      batchDate,
      entry.description || '',
      entryDate,
      entry.description || '',
      line.glAccountNo,
      formatAmount(line.debit),
      formatAmount(line.credit),
      line.departmentId || '',
      line.locationId || '',
      line.classId || '',
      line.projectId || '',
      line.customerId || '',
      line.vendorId || '',
      line.employeeId || '',
      line.memo || '',
      entry.referenceNumber,
    ];
  } else {
    // Simplified format
    return [
      entry.journalSymbol,
      entryDate,
      entry.description || '',
      line.glAccountNo,
      formatAmount(line.debit),
      formatAmount(line.credit),
      line.departmentId || '',
      line.locationId || '',
      line.memo || '',
      entry.referenceNumber,
    ];
  }
}

/**
 * Generate CSV content from journal entries
 * @param entries - Array of journal entries
 * @param options - Generation options
 * @returns CSV content as string and row count
 */
function generateCSVContent(
  entries: IntacctJournalEntry[],
  options: Required<GenerationOptions>
): { content: string; rowCount: number } {
  const lines: string[] = [];
  const headers = options.useFullHeaders ? INTACCT_HEADERS : SIMPLE_HEADERS;
  const { delimiter, lineEnding, quoteAllFields } = options;

  // Add header row
  const headerRow = headers
    .map((h) => escapeCSVField(h, quoteAllFields, delimiter))
    .join(delimiter);
  lines.push(headerRow);

  let rowCount = 0;

  // Add data rows
  for (const entry of entries) {
    for (const line of entry.lines) {
      const rowValues = lineToRow(entry, line, options);
      const row = rowValues
        .map((v) => escapeCSVField(v, quoteAllFields, delimiter))
        .join(delimiter);
      lines.push(row);
      rowCount++;
    }
  }

  return {
    content: lines.join(lineEnding) + lineEnding,
    rowCount,
  };
}

/**
 * Calculate MD5 checksum of content
 * @param content - String content
 * @returns MD5 hash string
 */
function calculateChecksum(content: string): string {
  return crypto.createHash('md5').update(content, 'utf8').digest('hex');
}

/**
 * Ensure the output directory exists
 * @param dirPath - Directory path
 */
function ensureDirectoryExists(dirPath: string): void {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

/**
 * Generate an Intacct-ready import CSV file
 * @param entries - Array of IntacctJournalEntry
 * @param options - Generation options
 * @returns GenerationResult
 */
export function generateImportFile(
  entries: IntacctJournalEntry[],
  options: GenerationOptions = {}
): GenerationResult {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const warnings: ValidationIssue[] = [];
  const generatedAt = new Date();

  // Validate inputs
  if (!entries || entries.length === 0) {
    return {
      success: false,
      filePath: '',
      rowCount: 0,
      entryCount: 0,
      fileSizeBytes: 0,
      generatedAt,
      warnings: [
        {
          code: 'NO_ENTRIES',
          severity: 'error',
          message: 'No entries provided for file generation',
        },
      ],
    };
  }

  // Generate filename if not provided
  const filename =
    opts.filename || generateFilename(opts.entryType, entries[0]?.entryDate || new Date());

  // Ensure output directory exists
  ensureDirectoryExists(opts.outputDir);

  // Full file path
  const filePath = path.join(opts.outputDir, `${filename}.csv`);

  // Check for existing file
  if (fs.existsSync(filePath)) {
    warnings.push({
      code: 'FILE_EXISTS',
      severity: 'warning',
      message: `File already exists and will be overwritten: ${filePath}`,
    });
  }

  // Generate CSV content
  const { content, rowCount } = generateCSVContent(entries, opts);

  // Calculate checksum if requested
  const checksum = opts.generateChecksum ? calculateChecksum(content) : undefined;

  // Write file
  try {
    fs.writeFileSync(filePath, content, 'utf-8');
  } catch (err) {
    return {
      success: false,
      filePath,
      rowCount: 0,
      entryCount: entries.length,
      fileSizeBytes: 0,
      generatedAt,
      warnings: [
        {
          code: 'WRITE_ERROR',
          severity: 'error',
          message: `Failed to write file: ${err instanceof Error ? err.message : 'Unknown error'}`,
        },
      ],
    };
  }

  // Get file size
  const stats = fs.statSync(filePath);

  return {
    success: true,
    filePath,
    rowCount,
    entryCount: entries.length,
    fileSizeBytes: stats.size,
    generatedAt,
    warnings,
    checksum,
  };
}

/**
 * Generate import file with automatic naming based on date and type
 * @param entries - Journal entries
 * @param entryType - Type for filename (e.g., "payroll", "adjusting")
 * @returns GenerationResult
 */
export function generateAutoNamedFile(
  entries: IntacctJournalEntry[],
  entryType: string = 'payroll'
): GenerationResult {
  return generateImportFile(entries, { entryType });
}

/**
 * Generate a preview of what the CSV will look like
 * @param entries - Journal entries
 * @param maxRows - Maximum rows to preview
 * @param options - Generation options
 * @returns Preview string
 */
export function previewCSV(
  entries: IntacctJournalEntry[],
  maxRows: number = 10,
  options: GenerationOptions = {}
): string {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const headers = opts.useFullHeaders ? INTACCT_HEADERS : SIMPLE_HEADERS;

  const lines: string[] = [];
  lines.push(headers.join(opts.delimiter));

  let rowCount = 0;
  outer: for (const entry of entries) {
    for (const line of entry.lines) {
      if (rowCount >= maxRows) {
        lines.push(`... (${entries.reduce((sum, e) => sum + e.lines.length, 0) - maxRows} more rows)`);
        break outer;
      }
      const rowValues = lineToRow(entry, line, opts);
      lines.push(rowValues.join(opts.delimiter));
      rowCount++;
    }
  }

  return lines.join('\n');
}

/**
 * Get summary statistics for entries
 * @param entries - Journal entries
 * @returns Summary object
 */
export function getEntrySummary(entries: IntacctJournalEntry[]): {
  entryCount: number;
  lineCount: number;
  totalDebits: number;
  totalCredits: number;
  dateRange: { earliest: Date | null; latest: Date | null };
  journalSymbols: string[];
} {
  let lineCount = 0;
  let totalDebits = 0;
  let totalCredits = 0;
  let earliest: Date | null = null;
  let latest: Date | null = null;
  const journalSymbols = new Set<string>();

  for (const entry of entries) {
    lineCount += entry.lines.length;
    totalDebits += entry.totalDebits || 0;
    totalCredits += entry.totalCredits || 0;
    journalSymbols.add(entry.journalSymbol);

    if (!earliest || entry.entryDate < earliest) {
      earliest = entry.entryDate;
    }
    if (!latest || entry.entryDate > latest) {
      latest = entry.entryDate;
    }
  }

  return {
    entryCount: entries.length,
    lineCount,
    totalDebits,
    totalCredits,
    dateRange: { earliest, latest },
    journalSymbols: Array.from(journalSymbols),
  };
}

/**
 * Write a checksum file alongside the CSV
 * @param csvPath - Path to the CSV file
 * @param checksum - Checksum string
 */
export function writeChecksumFile(csvPath: string, checksum: string): void {
  const checksumPath = csvPath.replace('.csv', '.md5');
  const filename = path.basename(csvPath);
  const content = `${checksum}  ${filename}\n`;
  fs.writeFileSync(checksumPath, content, 'utf-8');
}

/**
 * Verify a file against its checksum
 * @param csvPath - Path to CSV file
 * @returns True if checksum matches
 */
export function verifyChecksum(csvPath: string): boolean {
  const checksumPath = csvPath.replace('.csv', '.md5');

  if (!fs.existsSync(checksumPath)) {
    return false;
  }

  const content = fs.readFileSync(csvPath, 'utf-8');
  const actualChecksum = calculateChecksum(content);

  const storedContent = fs.readFileSync(checksumPath, 'utf-8');
  const storedChecksum = storedContent.split(/\s+/)[0];

  return actualChecksum === storedChecksum;
}

// Export constants
export { INTACCT_HEADERS, SIMPLE_HEADERS, DEFAULT_EXPORT_PATH };
