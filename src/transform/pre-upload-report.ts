/**
 * Pre-Upload Validation Report Generator
 *
 * Generates comprehensive validation reports before uploading
 * journal entries to Sage Intacct. Provides human-readable summaries,
 * flags issues, and blocks upload if critical errors exist.
 *
 * Features:
 * - Summary statistics for all entries
 * - Issue categorization (critical/warning/info)
 * - Human-readable formatting
 * - Upload blocking on critical errors
 * - Recommendations for fixes
 */

import * as fs from 'fs';
import * as path from 'path';
import {
  IntacctJournalEntry,
  ValidationResult,
  ValidationIssue,
  PreUploadReport,
  ReportSummary,
} from './types';
import { validateBatch, ValidationOptions } from './validate-entry';
import { getEntrySummary } from './generate-import-file';

/**
 * Report generation options
 */
export interface ReportOptions {
  /** Title for the report */
  title?: string;
  /** Include detailed line-by-line breakdown */
  includeDetails?: boolean;
  /** Output directory for report file */
  outputDir?: string;
  /** Generate text file report */
  generateTextFile?: boolean;
  /** Generate JSON report */
  generateJsonFile?: boolean;
  /** Validation options to pass through */
  validationOptions?: ValidationOptions;
}

// Default options
const DEFAULT_OPTIONS: Required<ReportOptions> = {
  title: 'Pre-Upload Validation Report',
  includeDetails: true,
  outputDir: path.join(process.cwd(), 'logs'),
  generateTextFile: true,
  generateJsonFile: false,
  validationOptions: {},
};

/**
 * Format a date for display
 */
function formatDate(date: Date): string {
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

/**
 * Format currency for display
 */
function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

/**
 * Generate summary statistics from entries
 */
function generateSummary(
  entries: IntacctJournalEntry[],
  sourceFiles: string[]
): ReportSummary {
  const summary = getEntrySummary(entries);

  // Collect unique accounts, departments, locations
  const accountsUsed = new Set<string>();
  const departmentsUsed = new Set<string>();
  const locationsUsed = new Set<string>();

  for (const entry of entries) {
    for (const line of entry.lines) {
      accountsUsed.add(line.glAccountNo);
      if (line.departmentId) departmentsUsed.add(line.departmentId);
      if (line.locationId) locationsUsed.add(line.locationId);
    }
  }

  const isBalanced = Math.abs(summary.totalDebits - summary.totalCredits) < 0.01;

  return {
    sourceFiles,
    totalSourceRows: summary.lineCount,
    totalEntries: entries.length,
    totalLines: summary.lineCount,
    totalDebits: summary.totalDebits,
    totalCredits: summary.totalCredits,
    isBalanced,
    earliestDate: summary.dateRange.earliest || new Date(),
    latestDate: summary.dateRange.latest || new Date(),
    accountsUsed: Array.from(accountsUsed).sort(),
    departmentsUsed: Array.from(departmentsUsed).sort(),
    locationsUsed: Array.from(locationsUsed).sort(),
  };
}

/**
 * Categorize issues by severity
 */
function categorizeIssues(issues: ValidationIssue[]): {
  critical: ValidationIssue[];
  warnings: ValidationIssue[];
  info: ValidationIssue[];
} {
  const critical: ValidationIssue[] = [];
  const warnings: ValidationIssue[] = [];
  const info: ValidationIssue[] = [];

  for (const issue of issues) {
    switch (issue.severity) {
      case 'error':
        critical.push(issue);
        break;
      case 'warning':
        warnings.push(issue);
        break;
      case 'info':
        info.push(issue);
        break;
    }
  }

  return { critical, warnings, info };
}

/**
 * Generate recommendations based on issues found
 */
function generateRecommendations(issues: ValidationIssue[]): string[] {
  const recommendations: string[] = [];
  const issueCodes = new Set(issues.map((i) => i.code));

  if (issueCodes.has('UNBALANCED_ENTRY')) {
    recommendations.push(
      'Review unbalanced entries and ensure total debits equal total credits for each journal entry.'
    );
  }

  if (issueCodes.has('UNMAPPED_ACCOUNT')) {
    recommendations.push(
      'Add missing account mappings to config/account-mapping.json or review account codes in source file.'
    );
  }

  if (issueCodes.has('UNMAPPED_DEPARTMENT')) {
    recommendations.push(
      'Add missing department mappings to config/department-mapping.json.'
    );
  }

  if (issueCodes.has('INVALID_DATE') || issueCodes.has('MISSING_DATE')) {
    recommendations.push(
      'Review date formats in source file. Expected format: MM/DD/YYYY.'
    );
  }

  if (issueCodes.has('LARGE_AMOUNT_WARNING')) {
    recommendations.push(
      'Verify large amounts are correct before uploading.'
    );
  }

  if (issueCodes.has('DUPLICATE_REFERENCE_NUMBER')) {
    recommendations.push(
      'Resolve duplicate reference numbers before uploading.'
    );
  }

  if (issueCodes.has('MISSING_GL_ACCOUNT')) {
    recommendations.push(
      'Ensure all lines have valid GL account numbers.'
    );
  }

  if (recommendations.length === 0 && issues.length > 0) {
    recommendations.push(
      'Review all warnings above before proceeding with upload.'
    );
  }

  return recommendations;
}

/**
 * Determine report status based on validation result
 */
function determineStatus(
  validation: ValidationResult
): { status: 'ready' | 'warnings' | 'blocked'; message: string } {
  const hasErrors = validation.issues.some((i) => i.severity === 'error');
  const hasWarnings = validation.issues.some((i) => i.severity === 'warning');

  if (hasErrors) {
    return {
      status: 'blocked',
      message: `BLOCKED: ${validation.errorEntries} entries have errors that must be fixed before upload.`,
    };
  }

  if (hasWarnings) {
    return {
      status: 'warnings',
      message: `READY WITH WARNINGS: ${validation.warningEntries} entries have warnings. Review before proceeding.`,
    };
  }

  return {
    status: 'ready',
    message: 'READY: All entries validated successfully. Safe to proceed with upload.',
  };
}

/**
 * Generate the pre-upload validation report
 */
export function generatePreUploadReport(
  entries: IntacctJournalEntry[],
  options: ReportOptions = {}
): PreUploadReport {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const generatedAt = new Date();

  // Validate entries
  const validation = validateBatch(entries, opts.validationOptions);

  // Generate summary
  const sourceFiles = [...new Set(entries.map((e) => e.sourceFile))];
  const summary = generateSummary(entries, sourceFiles);

  // Categorize issues
  const { critical, warnings, info } = categorizeIssues(validation.issues);

  // Determine status
  const { status, message } = determineStatus(validation);

  // Generate recommendations
  const recommendations = generateRecommendations(validation.issues);

  // Generate notes
  const notes: string[] = [];
  if (summary.accountsUsed.length > 0) {
    notes.push(`${summary.accountsUsed.length} unique GL accounts will be affected.`);
  }
  if (summary.departmentsUsed.length > 0) {
    notes.push(`${summary.departmentsUsed.length} departments are referenced.`);
  }
  if (summary.earliestDate.getTime() !== summary.latestDate.getTime()) {
    notes.push(
      `Entries span from ${summary.earliestDate.toISOString().split('T')[0]} to ${summary.latestDate.toISOString().split('T')[0]}.`
    );
  }

  const report: PreUploadReport = {
    generatedAt,
    title: opts.title,
    status,
    statusMessage: message,
    summary,
    validation,
    criticalIssues: critical,
    warnings,
    notes,
    recommendations,
  };

  return report;
}

/**
 * Format the report as human-readable text
 */
export function formatReportAsText(report: PreUploadReport): string {
  const lines: string[] = [];
  const divider = '═'.repeat(70);
  const thinDivider = '─'.repeat(70);

  // Header
  lines.push(divider);
  lines.push(`  ${report.title.toUpperCase()}`);
  lines.push(`  Generated: ${formatDate(report.generatedAt)}`);
  lines.push(divider);
  lines.push('');

  // Status
  const statusIcon =
    report.status === 'ready' ? '[OK]' : report.status === 'warnings' ? '[!]' : '[X]';
  lines.push(`STATUS: ${statusIcon} ${report.statusMessage}`);
  lines.push('');

  // Summary Section
  lines.push(thinDivider);
  lines.push('SUMMARY');
  lines.push(thinDivider);
  lines.push(`Source Files:        ${report.summary.sourceFiles.length}`);
  for (const file of report.summary.sourceFiles) {
    lines.push(`                     - ${file}`);
  }
  lines.push(`Total Entries:       ${report.summary.totalEntries}`);
  lines.push(`Total Lines:         ${report.summary.totalLines}`);
  lines.push(`Total Debits:        ${formatCurrency(report.summary.totalDebits)}`);
  lines.push(`Total Credits:       ${formatCurrency(report.summary.totalCredits)}`);
  lines.push(
    `Balanced:            ${report.summary.isBalanced ? 'Yes' : 'NO - UNBALANCED'}`
  );
  lines.push(
    `Date Range:          ${report.summary.earliestDate.toISOString().split('T')[0]} to ${report.summary.latestDate.toISOString().split('T')[0]}`
  );
  lines.push(`Accounts Used:       ${report.summary.accountsUsed.length}`);
  lines.push(`Departments Used:    ${report.summary.departmentsUsed.length}`);
  lines.push('');

  // Validation Section
  lines.push(thinDivider);
  lines.push('VALIDATION RESULTS');
  lines.push(thinDivider);
  lines.push(`Total Validated:     ${report.validation.totalEntries}`);
  lines.push(`Valid:               ${report.validation.validEntries}`);
  lines.push(`With Warnings:       ${report.validation.warningEntries}`);
  lines.push(`With Errors:         ${report.validation.errorEntries}`);
  lines.push('');

  // Critical Issues
  if (report.criticalIssues.length > 0) {
    lines.push(thinDivider);
    lines.push(`CRITICAL ISSUES (${report.criticalIssues.length}) - MUST FIX`);
    lines.push(thinDivider);
    for (const issue of report.criticalIssues) {
      lines.push(`[ERROR] ${issue.code}`);
      lines.push(`        ${issue.message}`);
      if (issue.entryId) {
        lines.push(`        Entry: ${issue.entryId}`);
      }
      if (issue.lineNumber !== undefined) {
        lines.push(`        Line: ${issue.lineNumber}`);
      }
      if (issue.suggestion) {
        lines.push(`        Suggestion: ${issue.suggestion}`);
      }
      lines.push('');
    }
  }

  // Warnings
  if (report.warnings.length > 0) {
    lines.push(thinDivider);
    lines.push(`WARNINGS (${report.warnings.length}) - REVIEW BEFORE UPLOAD`);
    lines.push(thinDivider);
    for (const issue of report.warnings) {
      lines.push(`[WARN] ${issue.code}`);
      lines.push(`       ${issue.message}`);
      if (issue.entryId) {
        lines.push(`       Entry: ${issue.entryId}`);
      }
      if (issue.suggestion) {
        lines.push(`       Suggestion: ${issue.suggestion}`);
      }
    }
    lines.push('');
  }

  // Recommendations
  if (report.recommendations.length > 0) {
    lines.push(thinDivider);
    lines.push('RECOMMENDATIONS');
    lines.push(thinDivider);
    for (let i = 0; i < report.recommendations.length; i++) {
      lines.push(`${i + 1}. ${report.recommendations[i]}`);
    }
    lines.push('');
  }

  // Notes
  if (report.notes.length > 0) {
    lines.push(thinDivider);
    lines.push('NOTES');
    lines.push(thinDivider);
    for (const note of report.notes) {
      lines.push(`- ${note}`);
    }
    lines.push('');
  }

  // Issue Summary
  if (Object.keys(report.validation.issueSummary).length > 0) {
    lines.push(thinDivider);
    lines.push('ISSUE SUMMARY BY CODE');
    lines.push(thinDivider);
    const sortedCodes = Object.entries(report.validation.issueSummary).sort(
      (a, b) => b[1] - a[1]
    );
    for (const [code, count] of sortedCodes) {
      lines.push(`  ${code}: ${count}`);
    }
    lines.push('');
  }

  // Footer
  lines.push(divider);
  lines.push(
    report.status === 'blocked'
      ? '  UPLOAD BLOCKED - Fix critical issues before proceeding'
      : '  END OF REPORT'
  );
  lines.push(divider);

  return lines.join('\n');
}

/**
 * Save the report to files
 */
export function saveReport(
  report: PreUploadReport,
  options: ReportOptions = {}
): { textPath?: string; jsonPath?: string } {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const result: { textPath?: string; jsonPath?: string } = {};

  // Ensure output directory exists
  if (!fs.existsSync(opts.outputDir)) {
    fs.mkdirSync(opts.outputDir, { recursive: true });
  }

  // Generate filename base
  const timestamp = report.generatedAt.toISOString().replace(/[:.]/g, '-').split('T')[0];
  const filenameBase = `validation-report_${timestamp}`;

  // Save text report
  if (opts.generateTextFile) {
    const textContent = formatReportAsText(report);
    const textPath = path.join(opts.outputDir, `${filenameBase}.txt`);
    fs.writeFileSync(textPath, textContent, 'utf-8');
    result.textPath = textPath;
  }

  // Save JSON report
  if (opts.generateJsonFile) {
    const jsonPath = path.join(opts.outputDir, `${filenameBase}.json`);
    fs.writeFileSync(jsonPath, JSON.stringify(report, null, 2), 'utf-8');
    result.jsonPath = jsonPath;
  }

  return result;
}

/**
 * Check if upload should be blocked
 */
export function isUploadBlocked(report: PreUploadReport): boolean {
  return report.status === 'blocked';
}

/**
 * Get a quick status check
 */
export function getQuickStatus(
  entries: IntacctJournalEntry[],
  options: ValidationOptions = {}
): {
  canUpload: boolean;
  status: 'ready' | 'warnings' | 'blocked';
  errorCount: number;
  warningCount: number;
  message: string;
} {
  const validation = validateBatch(entries, options);
  const { status, message } = determineStatus(validation);

  return {
    canUpload: status !== 'blocked',
    status,
    errorCount: validation.errorEntries,
    warningCount: validation.warningEntries,
    message,
  };
}

/**
 * Print report to console
 */
export function printReport(report: PreUploadReport): void {
  console.log(formatReportAsText(report));
}

/**
 * Generate and print a quick validation summary
 */
export function quickValidationSummary(entries: IntacctJournalEntry[]): void {
  const report = generatePreUploadReport(entries);
  printReport(report);
}
