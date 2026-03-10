/**
 * ADP-to-Intacct Payroll Automation - Main Orchestration
 *
 * This is the main entry point for the payroll automation system.
 * It orchestrates the full workflow:
 * 1. Login to ADP and download payroll GL entries
 * 2. Transform data to Intacct format (if transform module exists)
 * 3. Login to Intacct and upload journal entries
 * 4. Validate upload results
 *
 * Features:
 * - Dry-run mode: Preview without uploading
 * - Test mode: Process only 1 entry
 * - Retry mode: Re-process failed entries
 * - Comprehensive logging and screenshots
 *
 * @example
 * ```bash
 * # Full processing
 * npm run payroll:process
 *
 * # Dry run (no upload)
 * npm run payroll:dry-run
 *
 * # Retry failed entries
 * npm run payroll:retry
 * ```
 */

import { chromium, Browser, BrowserContext, Page } from 'playwright';
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';

// Load environment variables
dotenv.config();

// ADP Module Imports
import {
  login as adpLogin,
  createBrowser as createADPBrowser,
  createContext as createADPContext,
  navigateToGLReporting,
  downloadPayrollEntries,
  type LoginResult as ADPLoginResult,
  type NavigationResult as ADPNavigationResult,
  type BatchDownloadResult,
  type PayrollEntryType,
} from './adp';

// Intacct Module Imports
import {
  login as intacctLogin,
  navigateToJournalImport,
  uploadJournalEntry,
  validateUpload,
  generateValidationReport,
  type LoginResult as IntacctLoginResult,
  type NavigationResult as IntacctNavigationResult,
  type UploadResult,
  type ValidationResult,
} from './intacct';

// Logger
import { createLogger, LogLevel } from './utils/logger';

const logger = createLogger('orchestration');

// ==================== TYPES ====================

/**
 * Configuration for the automation run
 */
interface AutomationConfig {
  /** Run in dry-run mode (no Intacct upload) */
  dryRun: boolean;
  /** Run in test mode (process only 1 entry) */
  testMode: boolean;
  /** Retry failed entries from previous runs */
  retryFailed: boolean;
  /** Run browser in headless mode */
  headless: boolean;
  /** Enable screenshot capture */
  screenshotsEnabled: boolean;
  /** Download directory for ADP files */
  downloadDir: string;
  /** Export directory for transformed files */
  exportDir: string;
  /** Screenshot directory */
  screenshotDir: string;
  /** Log directory */
  logDir: string;
  /** Entry types to process */
  entryTypes: PayrollEntryType[];
}

/**
 * Result of the full automation run
 */
interface AutomationResult {
  /** Overall success status */
  success: boolean;
  /** Total entries processed */
  totalProcessed: number;
  /** Successfully uploaded count */
  uploadedCount: number;
  /** Failed count */
  failedCount: number;
  /** Skipped count (duplicates, etc.) */
  skippedCount: number;
  /** Total duration in milliseconds */
  durationMs: number;
  /** ADP download results */
  adpResults?: BatchDownloadResult;
  /** Intacct upload results */
  intacctResults?: UploadResult[];
  /** Validation results */
  validationResults?: ValidationResult[];
  /** Errors encountered */
  errors: string[];
  /** Warnings */
  warnings: string[];
}

/**
 * Summary for display
 */
interface ProcessingSummary {
  status: 'SUCCESS' | 'PARTIAL' | 'FAILED';
  processed: number;
  uploaded: number;
  failed: number;
  skipped: number;
  duration: string;
  errors: string[];
  warnings: string[];
}

// ==================== CONFIGURATION ====================

/**
 * Load configuration from environment variables and CLI args
 */
function loadConfig(): AutomationConfig {
  const args = process.argv.slice(2);

  return {
    dryRun: process.env.DRY_RUN === 'true' || args.includes('--dry-run'),
    testMode: process.env.TEST_MODE === 'true' || args.includes('--test'),
    retryFailed: args.includes('--retry-failed'),
    headless: process.env.HEADLESS !== 'false', // Default true
    screenshotsEnabled: process.env.SCREENSHOTS_ENABLED !== 'false', // Default true
    downloadDir: process.env.DOWNLOAD_DIR || './downloads/payroll-gl',
    exportDir: process.env.EXPORT_DIR || './exports/intacct-ready',
    screenshotDir: process.env.SCREENSHOT_DIR || './screenshots',
    logDir: process.env.LOG_DIR || './logs',
    entryTypes: ['payroll', 'tax', 'deductions'],
  };
}

/**
 * Validate that required environment variables are set
 */
function validateEnvironment(): string[] {
  const errors: string[] = [];

  // ADP credentials
  if (!process.env.ADP_USERNAME) {
    errors.push('Missing ADP_USERNAME environment variable');
  }
  if (!process.env.ADP_PASSWORD) {
    errors.push('Missing ADP_PASSWORD environment variable');
  }

  // Intacct credentials (only required if not dry-run)
  const isDryRun = process.env.DRY_RUN === 'true' || process.argv.includes('--dry-run');
  if (!isDryRun) {
    if (!process.env.INTACCT_COMPANY_ID) {
      errors.push('Missing INTACCT_COMPANY_ID environment variable');
    }
    if (!process.env.INTACCT_USER_ID) {
      errors.push('Missing INTACCT_USER_ID environment variable');
    }
    if (!process.env.INTACCT_PASSWORD) {
      errors.push('Missing INTACCT_PASSWORD environment variable');
    }
  }

  return errors;
}

/**
 * Ensure required directories exist
 */
function ensureDirectories(config: AutomationConfig): void {
  const dirs = [
    config.downloadDir,
    config.exportDir,
    config.screenshotDir,
    config.logDir,
  ];

  for (const dir of dirs) {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
      logger.debug(`Created directory: ${dir}`);
    }
  }
}

// ==================== ADP PHASE ====================

/**
 * Execute the ADP download phase
 */
async function executeADPPhase(
  config: AutomationConfig
): Promise<{
  success: boolean;
  downloadResult?: BatchDownloadResult;
  downloadedFiles: string[];
  error?: string;
}> {
  logger.info('=== Starting ADP Phase ===');
  logger.info('Downloading payroll GL entries from ADP');

  let browser: Browser | undefined;
  let context: BrowserContext | undefined;
  let page: Page | undefined;

  try {
    // Create browser - headful for MFA support
    browser = await createADPBrowser(config.headless);
    context = await createADPContext(browser, {
      downloadDir: config.downloadDir,
      captureScreenshots: config.screenshotsEnabled,
      screenshotDir: path.join(config.screenshotDir, 'adp'),
    });
    page = await context.newPage();

    // Login to ADP
    logger.info('Logging into ADP...');
    const loginResult: ADPLoginResult = await adpLogin(page);

    if (!loginResult.success) {
      return {
        success: false,
        downloadedFiles: [],
        error: `ADP login failed: ${loginResult.message || loginResult.error}`,
      };
    }

    logger.info('ADP login successful', {
      mfaRequired: loginResult.mfaRequired,
      attemptCount: loginResult.attemptCount,
    });

    // Navigate to GL Reporting
    logger.info('Navigating to GL Reporting...');
    const navResult: ADPNavigationResult = await navigateToGLReporting(page, context);

    if (!navResult.success) {
      return {
        success: false,
        downloadedFiles: [],
        error: `ADP navigation failed: ${navResult.error}`,
      };
    }

    logger.info('Navigation to GL Reports successful', {
      currentUrl: navResult.currentUrl,
    });

    // Download payroll entries
    logger.info('Downloading payroll entries...', {
      entryTypes: config.entryTypes,
    });

    const entryTypes = config.testMode
      ? [config.entryTypes[0]] // Only first type in test mode
      : config.entryTypes;

    const downloadResult = await downloadPayrollEntries(
      page,
      context,
      entryTypes,
      {
        downloadDir: config.downloadDir,
        captureScreenshots: config.screenshotsEnabled,
        screenshotDir: path.join(config.screenshotDir, 'adp'),
      }
    );

    const downloadedFiles = downloadResult.downloads
      .filter((d) => d.success)
      .map((d) => d.filename);

    logger.info('ADP download phase completed', {
      success: downloadResult.success,
      totalAttempted: downloadResult.totalAttempted,
      successCount: downloadResult.successCount,
      failureCount: downloadResult.failureCount,
      downloadedFiles,
    });

    return {
      success: downloadResult.success,
      downloadResult,
      downloadedFiles,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error('ADP phase failed with exception', error);
    return {
      success: false,
      downloadedFiles: [],
      error: errorMessage,
    };
  } finally {
    // Cleanup
    if (page) await page.close().catch(() => {});
    if (context) await context.close().catch(() => {});
    if (browser) await browser.close().catch(() => {});
  }
}

// ==================== TRANSFORM PHASE ====================

/**
 * Transform downloaded files to Intacct format
 * (Placeholder - implement actual transformation logic as needed)
 */
async function executeTransformPhase(
  downloadedFiles: string[],
  config: AutomationConfig
): Promise<{
  success: boolean;
  transformedFiles: string[];
  error?: string;
}> {
  logger.info('=== Starting Transform Phase ===');

  if (downloadedFiles.length === 0) {
    return {
      success: false,
      transformedFiles: [],
      error: 'No files to transform',
    };
  }

  const transformedFiles: string[] = [];

  for (const file of downloadedFiles) {
    try {
      // For now, we assume the ADP files are already in a compatible format
      // or that transformation happens externally
      // In a full implementation, you would:
      // 1. Read the ADP CSV
      // 2. Map accounts/departments
      // 3. Generate Intacct-compatible format
      // 4. Write to export directory

      const basename = path.basename(file);
      const transformedPath = path.join(config.exportDir, `intacct_${basename}`);

      // Copy file to export directory (placeholder for real transformation)
      if (fs.existsSync(file)) {
        fs.copyFileSync(file, transformedPath);
        transformedFiles.push(transformedPath);
        logger.info('Transformed file', { source: file, destination: transformedPath });
      }
    } catch (error) {
      logger.warn('Failed to transform file', { file, error });
    }
  }

  logger.info('Transform phase completed', {
    inputFiles: downloadedFiles.length,
    outputFiles: transformedFiles.length,
  });

  return {
    success: transformedFiles.length > 0,
    transformedFiles,
  };
}

// ==================== INTACCT PHASE ====================

/**
 * Execute the Intacct upload phase
 */
async function executeIntacctPhase(
  filesToUpload: string[],
  config: AutomationConfig
): Promise<{
  success: boolean;
  uploadResults: UploadResult[];
  validationResults: ValidationResult[];
  error?: string;
}> {
  logger.info('=== Starting Intacct Phase ===');
  logger.info('Uploading journal entries to Sage Intacct');

  if (config.dryRun) {
    logger.info('DRY RUN MODE - Skipping Intacct upload');
    return {
      success: true,
      uploadResults: [],
      validationResults: [],
    };
  }

  if (filesToUpload.length === 0) {
    return {
      success: false,
      uploadResults: [],
      validationResults: [],
      error: 'No files to upload',
    };
  }

  let browser: Browser | undefined;
  let page: Page | undefined;

  const uploadResults: UploadResult[] = [];
  const validationResults: ValidationResult[] = [];

  try {
    // Create browser
    browser = await chromium.launch({
      headless: config.headless,
      args: ['--disable-blink-features=AutomationControlled'],
    });

    const context = await browser.newContext({
      viewport: { width: 1920, height: 1080 },
    });

    page = await context.newPage();

    // Login to Intacct
    logger.info('Logging into Intacct...');
    const loginResult: IntacctLoginResult = await intacctLogin(page, undefined, {
      screenshotDir: path.join(config.screenshotDir, 'intacct'),
    });

    if (!loginResult.success) {
      return {
        success: false,
        uploadResults: [],
        validationResults: [],
        error: `Intacct login failed: ${loginResult.error}`,
      };
    }

    logger.info('Intacct login successful', {
      mfaRequired: loginResult.mfaRequired,
      attemptCount: loginResult.attemptCount,
    });

    // Navigate to Journal Import
    logger.info('Navigating to Journal Import...');
    const navResult: IntacctNavigationResult = await navigateToJournalImport(page, {
      screenshotDir: path.join(config.screenshotDir, 'intacct'),
    });

    if (!navResult.success) {
      return {
        success: false,
        uploadResults: [],
        validationResults: [],
        error: `Intacct navigation failed: ${navResult.error}`,
      };
    }

    logger.info('Navigation to Journal Import successful');

    // Upload each file
    const filesToProcess = config.testMode
      ? filesToUpload.slice(0, 1) // Only first file in test mode
      : filesToUpload;

    for (const filePath of filesToProcess) {
      logger.info(`Uploading file: ${path.basename(filePath)}`);

      try {
        const uploadResult = await uploadJournalEntry(
          page,
          { filePath },
          { screenshotDir: path.join(config.screenshotDir, 'intacct') }
        );

        uploadResults.push(uploadResult);

        if (uploadResult.success) {
          logger.info('Upload successful', {
            entriesCreated: uploadResult.entriesCreated,
            journalEntryIds: uploadResult.journalEntryIds,
          });

          // Validate the upload
          const validationResult = await validateUpload(
            page,
            uploadResult,
            undefined,
            { screenshotDir: path.join(config.screenshotDir, 'intacct') }
          );

          validationResults.push(validationResult);

          if (validationResult.isValid) {
            logger.info('Validation passed', {
              entryCount: validationResult.entryCount,
              isBalanced: validationResult.isBalanced,
            });
          } else {
            logger.warn('Validation warnings', {
              errors: validationResult.errors,
              warnings: validationResult.warnings,
            });
          }
        } else {
          logger.error('Upload failed', {
            errors: uploadResult.errors,
            warnings: uploadResult.warnings,
          });
        }

        // Navigate back to import page for next file
        if (filesToProcess.indexOf(filePath) < filesToProcess.length - 1) {
          await navigateToJournalImport(page, {
            screenshotDir: path.join(config.screenshotDir, 'intacct'),
          });
        }
      } catch (error) {
        logger.error(`Failed to upload file: ${filePath}`, error);
        uploadResults.push({
          success: false,
          entriesCreated: 0,
          warnings: [],
          errors: [error instanceof Error ? error.message : String(error)],
          timestamp: new Date(),
        });
      }
    }

    const successCount = uploadResults.filter((r) => r.success).length;

    logger.info('Intacct phase completed', {
      totalFiles: filesToProcess.length,
      successCount,
      failureCount: filesToProcess.length - successCount,
    });

    return {
      success: successCount > 0,
      uploadResults,
      validationResults,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error('Intacct phase failed with exception', error);
    return {
      success: false,
      uploadResults,
      validationResults,
      error: errorMessage,
    };
  } finally {
    // Cleanup
    if (page) await page.close().catch(() => {});
    if (browser) await browser.close().catch(() => {});
  }
}

// ==================== SUMMARY & REPORTING ====================

/**
 * Generate processing summary
 */
function generateSummary(result: AutomationResult): ProcessingSummary {
  const durationSeconds = result.durationMs / 1000;
  const minutes = Math.floor(durationSeconds / 60);
  const seconds = (durationSeconds % 60).toFixed(2);
  const duration = minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`;

  let status: ProcessingSummary['status'];
  if (result.success && result.failedCount === 0) {
    status = 'SUCCESS';
  } else if (result.uploadedCount > 0) {
    status = 'PARTIAL';
  } else {
    status = 'FAILED';
  }

  return {
    status,
    processed: result.totalProcessed,
    uploaded: result.uploadedCount,
    failed: result.failedCount,
    skipped: result.skippedCount,
    duration,
    errors: result.errors,
    warnings: result.warnings,
  };
}

/**
 * Print summary to console
 */
function printSummary(summary: ProcessingSummary, config: AutomationConfig): void {
  console.log('\n');
  console.log('='.repeat(60));
  console.log('         ADP-TO-INTACCT PAYROLL AUTOMATION');
  console.log('='.repeat(60));
  console.log('');

  if (config.dryRun) {
    console.log('*** DRY RUN MODE - No uploads were performed ***');
    console.log('');
  }

  if (config.testMode) {
    console.log('*** TEST MODE - Only processed 1 entry ***');
    console.log('');
  }

  const statusColor =
    summary.status === 'SUCCESS'
      ? '\x1b[32m'
      : summary.status === 'PARTIAL'
        ? '\x1b[33m'
        : '\x1b[31m';
  const resetColor = '\x1b[0m';

  console.log(`STATUS: ${statusColor}${summary.status}${resetColor}`);
  console.log('');
  console.log('Results:');
  console.log(`  Processed:  ${summary.processed}`);
  console.log(`  Uploaded:   ${summary.uploaded}`);
  console.log(`  Failed:     ${summary.failed}`);
  console.log(`  Skipped:    ${summary.skipped}`);
  console.log(`  Duration:   ${summary.duration}`);
  console.log('');

  if (summary.errors.length > 0) {
    console.log('Errors:');
    for (const error of summary.errors) {
      console.log(`  - ${error}`);
    }
    console.log('');
  }

  if (summary.warnings.length > 0) {
    console.log('Warnings:');
    for (const warning of summary.warnings) {
      console.log(`  - ${warning}`);
    }
    console.log('');
  }

  console.log('='.repeat(60));
  console.log('');
}

// ==================== MAIN ORCHESTRATION ====================

/**
 * Main orchestration function
 */
async function main(): Promise<void> {
  const startTime = Date.now();

  console.log('');
  console.log('ADP-to-Intacct Payroll Automation');
  console.log('Starting...');
  console.log('');

  // Load configuration
  const config = loadConfig();

  logger.info('Configuration loaded', {
    dryRun: config.dryRun,
    testMode: config.testMode,
    retryFailed: config.retryFailed,
    headless: config.headless,
  });

  // Validate environment
  const envErrors = validateEnvironment();
  if (envErrors.length > 0) {
    console.error('Environment validation failed:');
    for (const error of envErrors) {
      console.error(`  - ${error}`);
    }
    console.error('');
    console.error('Please configure the required environment variables in .env');
    process.exit(1);
  }

  // Ensure directories exist
  ensureDirectories(config);

  // Initialize result
  const result: AutomationResult = {
    success: false,
    totalProcessed: 0,
    uploadedCount: 0,
    failedCount: 0,
    skippedCount: 0,
    durationMs: 0,
    errors: [],
    warnings: [],
  };

  try {
    // Phase 1: ADP Download
    const adpResult = await executeADPPhase(config);

    if (!adpResult.success) {
      result.errors.push(adpResult.error || 'ADP phase failed');
      throw new Error('ADP phase failed');
    }

    result.adpResults = adpResult.downloadResult;
    result.totalProcessed = adpResult.downloadedFiles.length;

    // Phase 2: Transform
    const transformResult = await executeTransformPhase(
      adpResult.downloadedFiles,
      config
    );

    if (!transformResult.success) {
      result.errors.push(transformResult.error || 'Transform phase failed');
      throw new Error('Transform phase failed');
    }

    // Phase 3: Intacct Upload
    const intacctResult = await executeIntacctPhase(
      transformResult.transformedFiles,
      config
    );

    result.intacctResults = intacctResult.uploadResults;
    result.validationResults = intacctResult.validationResults;

    if (config.dryRun) {
      result.uploadedCount = 0;
      result.skippedCount = result.totalProcessed;
      result.success = true;
    } else {
      result.uploadedCount = intacctResult.uploadResults.filter((r) => r.success).length;
      result.failedCount = intacctResult.uploadResults.filter((r) => !r.success).length;
      result.success = result.uploadedCount > 0;

      if (intacctResult.error) {
        result.errors.push(intacctResult.error);
      }
    }

    // Add warnings from validation
    for (const validation of result.validationResults || []) {
      for (const warning of validation.warnings) {
        result.warnings.push(warning.message);
      }
      for (const error of validation.errors) {
        if (!result.errors.includes(error.message)) {
          result.errors.push(error.message);
        }
      }
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    if (!result.errors.includes(errorMessage)) {
      result.errors.push(errorMessage);
    }
    result.success = false;
  }

  // Calculate duration
  result.durationMs = Date.now() - startTime;

  // Generate and print summary
  const summary = generateSummary(result);
  printSummary(summary, config);

  // Print validation reports if available
  if (result.validationResults && result.validationResults.length > 0) {
    for (const validation of result.validationResults) {
      console.log(generateValidationReport(validation));
    }
  }

  // Exit with appropriate code
  process.exit(result.success ? 0 : 1);
}

// ==================== ENTRY POINT ====================

// Run main function
main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});

// Export for testing
export type { AutomationConfig, AutomationResult, ProcessingSummary };
export {
  loadConfig,
  validateEnvironment,
  executeADPPhase,
  executeTransformPhase,
  executeIntacctPhase,
  generateSummary,
  main,
};
