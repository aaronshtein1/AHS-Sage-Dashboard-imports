/**
 * ADP to Sage Intacct Transformation Module
 *
 * This module provides a complete pipeline for converting ADP payroll
 * exports to Sage Intacct import format.
 *
 * Usage:
 * ```typescript
 * import {
 *   parseADPFile,
 *   mapToIntacct,
 *   validateBatch,
 *   generateImportFile,
 *   generatePreUploadReport,
 * } from '@/transform';
 *
 * // 1. Parse ADP CSV file
 * const parseResult = parseADPFile('/downloads/payroll-gl/payroll-2024-01.csv');
 *
 * // 2. Map to Intacct format
 * const mappingResult = mapToIntacct(parseResult.entries);
 *
 * // 3. Validate entries
 * const validationResult = validateBatch(mappingResult.entries);
 *
 * // 4. Generate pre-upload report
 * const report = generatePreUploadReport(mappingResult.entries);
 *
 * // 5. Generate import file (if validation passes)
 * if (report.status !== 'blocked') {
 *   const fileResult = generateImportFile(mappingResult.entries);
 *   console.log('Generated:', fileResult.filePath);
 * }
 * ```
 */

// Type exports
export * from './types';

// Parser exports
export {
  parseADPFile,
  parseADPDirectory,
  parsePayrollGLFiles,
  validateFile,
  DEFAULT_PAYROLL_GL_PATH,
} from './parse-adp';

// Mapping exports
export {
  mapToIntacct,
  quickMap,
  mapEntryToLine,
  mapAccountCode,
  mapDepartmentCode,
  loadAccountMapping,
  loadDepartmentMapping,
  loadTransformConfig,
  formatMemo,
  formatDateForIntacct,
  generateReferenceNumber,
  type MappingResult,
} from './map-to-intacct';

// Validation exports
export {
  validateEntry,
  validateBatch,
  quickValidate,
  isEntryBalanced,
  getValidationSummary,
  type ValidationOptions,
} from './validate-entry';

// File generation exports
export {
  generateImportFile,
  generateAutoNamedFile,
  previewCSV,
  getEntrySummary,
  writeChecksumFile,
  verifyChecksum,
  INTACCT_HEADERS,
  SIMPLE_HEADERS,
  DEFAULT_EXPORT_PATH,
  type GenerationOptions,
} from './generate-import-file';

// Report exports
export {
  generatePreUploadReport,
  formatReportAsText,
  saveReport,
  isUploadBlocked,
  getQuickStatus,
  printReport,
  quickValidationSummary,
  type ReportOptions,
} from './pre-upload-report';

/**
 * Complete transformation pipeline function
 *
 * Runs the full transformation pipeline from ADP file to Intacct import file.
 *
 * @param adpFilePath - Path to ADP export CSV file
 * @param options - Pipeline options
 * @returns Complete result including parse, map, validate, and generation results
 */
export async function runTransformPipeline(
  adpFilePath: string,
  options: {
    dryRun?: boolean;
    verbose?: boolean;
    outputDir?: string;
    entryType?: string;
  } = {}
): Promise<{
  success: boolean;
  parseResult: import('./types').ParseResult;
  mappingResult: import('./map-to-intacct').MappingResult;
  validationResult: import('./types').ValidationResult;
  report: import('./types').PreUploadReport;
  generationResult?: import('./types').GenerationResult;
  error?: string;
}> {
  const { parseADPFile } = await import('./parse-adp');
  const { mapToIntacct } = await import('./map-to-intacct');
  const { validateBatch } = await import('./validate-entry');
  const { generateImportFile } = await import('./generate-import-file');
  const { generatePreUploadReport } = await import('./pre-upload-report');

  // Step 1: Parse ADP file
  if (options.verbose) {
    console.log(`Parsing: ${adpFilePath}`);
  }
  const parseResult = parseADPFile(adpFilePath);

  if (!parseResult.success) {
    return {
      success: false,
      parseResult,
      mappingResult: {
        success: false,
        entries: [],
        errors: [],
        warnings: [],
        stats: { totalInputEntries: 0, mappedEntries: 0, unmappedAccounts: [], unmappedDepartments: [] },
      },
      validationResult: {
        isValid: false,
        canProceed: false,
        totalEntries: 0,
        validEntries: 0,
        errorEntries: 0,
        warningEntries: 0,
        issues: [],
        issueSummary: {},
        totalDebits: 0,
        totalCredits: 0,
        netDifference: 0,
        entryResults: [],
        validatedAt: new Date(),
      },
      report: {
        generatedAt: new Date(),
        title: 'Pre-Upload Report',
        status: 'blocked',
        statusMessage: 'Parse failed',
        summary: {
          sourceFiles: [adpFilePath],
          totalSourceRows: 0,
          totalEntries: 0,
          totalLines: 0,
          totalDebits: 0,
          totalCredits: 0,
          isBalanced: false,
          earliestDate: new Date(),
          latestDate: new Date(),
          accountsUsed: [],
          departmentsUsed: [],
          locationsUsed: [],
        },
        validation: {
          isValid: false,
          canProceed: false,
          totalEntries: 0,
          validEntries: 0,
          errorEntries: 0,
          warningEntries: 0,
          issues: parseResult.errors,
          issueSummary: {},
          totalDebits: 0,
          totalCredits: 0,
          netDifference: 0,
          entryResults: [],
          validatedAt: new Date(),
        },
        criticalIssues: parseResult.errors,
        warnings: parseResult.warnings,
        notes: [],
        recommendations: ['Fix parse errors before proceeding'],
      },
      error: 'Failed to parse ADP file',
    };
  }

  if (options.verbose) {
    console.log(`Parsed ${parseResult.parsedRows} rows from ${adpFilePath}`);
  }

  // Step 2: Map to Intacct format
  if (options.verbose) {
    console.log('Mapping to Intacct format...');
  }
  const mappingResult = mapToIntacct(parseResult.entries);

  if (!mappingResult.success && mappingResult.entries.length === 0) {
    return {
      success: false,
      parseResult,
      mappingResult,
      validationResult: {
        isValid: false,
        canProceed: false,
        totalEntries: 0,
        validEntries: 0,
        errorEntries: 0,
        warningEntries: 0,
        issues: mappingResult.errors,
        issueSummary: {},
        totalDebits: 0,
        totalCredits: 0,
        netDifference: 0,
        entryResults: [],
        validatedAt: new Date(),
      },
      report: generatePreUploadReport(mappingResult.entries),
      error: 'Failed to map entries to Intacct format',
    };
  }

  if (options.verbose) {
    console.log(`Mapped ${mappingResult.entries.length} journal entries`);
  }

  // Step 3: Validate entries
  if (options.verbose) {
    console.log('Validating entries...');
  }
  const validationResult = validateBatch(mappingResult.entries);

  // Step 4: Generate pre-upload report
  const report = generatePreUploadReport(mappingResult.entries);

  if (options.verbose) {
    console.log(`Validation status: ${report.status}`);
  }

  // Step 5: Generate import file (unless dry run or blocked)
  let generationResult: import('./types').GenerationResult | undefined;

  if (!options.dryRun && report.status !== 'blocked') {
    if (options.verbose) {
      console.log('Generating import file...');
    }
    generationResult = generateImportFile(mappingResult.entries, {
      outputDir: options.outputDir,
      entryType: options.entryType || 'payroll',
    });

    if (options.verbose) {
      console.log(`Generated: ${generationResult.filePath}`);
    }
  } else if (options.verbose && options.dryRun) {
    console.log('Dry run - skipping file generation');
  } else if (options.verbose && report.status === 'blocked') {
    console.log('Upload blocked - skipping file generation');
  }

  return {
    success: report.status !== 'blocked',
    parseResult,
    mappingResult,
    validationResult,
    report,
    generationResult,
  };
}
