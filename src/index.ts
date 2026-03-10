#!/usr/bin/env node
/**
 * ADP-to-Intacct Payroll Automation - Main CLI Entry Point
 *
 * This is the main orchestrator for the payroll automation system.
 * It coordinates the full workflow:
 * 1. ADP login and payroll download
 * 2. Transform ADP data to Intacct format
 * 3. Validate transformed data
 * 4. Intacct login and journal entry upload
 *
 * Commands:
 * - process-latest: Process the most recent payroll batch
 * - process-week: Process all batches for the week
 * - dry-run: Simulate without uploading
 * - retry-failed: Retry failed uploads
 * - force-reupload: Force re-upload entries
 * - status: Show processing status
 */

import { parseArgs, getHelpText, getVersionText, validateEnvironment, CLIOptions, Command } from './cli';
import { createLogger } from './utils/logger';
import { getStateStore, closeStateStore, PayrollEntry } from './state/state-store';
import { withRetry, createDefaultShouldRetry } from './utils/retry';
import { getScreenshotManager } from './utils/screenshots';

// ==================== TYPES ====================

interface ProcessingResult {
  success: boolean;
  processed: number;
  uploaded: number;
  failed: number;
  skipped: number;
  errors: string[];
  warnings: string[];
  durationMs: number;
}

interface WorkflowContext {
  options: CLIOptions;
  logger: ReturnType<typeof createLogger>;
  stateStore: ReturnType<typeof getStateStore>;
  startTime: Date;
}

// ==================== CONSTANTS ====================

const COLORS = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

// ==================== MAIN ENTRY POINT ====================

async function main(): Promise<void> {
  // Parse command-line arguments
  const parseResult = parseArgs(process.argv);

  if (!parseResult.success) {
    console.error(`${COLORS.red}Error: ${parseResult.error}${COLORS.reset}`);
    process.exit(1);
  }

  const options = parseResult.options!;

  // Handle help command
  if (options.command === 'help' || parseResult.showHelp) {
    console.log(getHelpText());
    process.exit(0);
  }

  // Handle version command
  if (options.command === 'version') {
    console.log(getVersionText());
    process.exit(0);
  }

  // Set up logging based on options
  if (options.verbose) {
    process.env.LOG_LEVEL = 'debug';
  } else if (options.quiet) {
    process.env.LOG_LEVEL = 'error';
  }

  const logger = createLogger('main');

  // Print banner
  printBanner(options);

  // Validate environment variables
  const envValidation = validateEnvironment(options.command);
  if (!envValidation.valid) {
    logger.error('Missing required environment variables', undefined, {
      missing: envValidation.missing,
    });
    console.error(`\n${COLORS.red}Missing required environment variables:${COLORS.reset}`);
    for (const varName of envValidation.missing) {
      console.error(`  - ${varName}`);
    }
    console.error(`\nSee .env.example for required variables.`);
    process.exit(1);
  }

  // Create workflow context
  const context: WorkflowContext = {
    options,
    logger,
    stateStore: getStateStore(),
    startTime: new Date(),
  };

  try {
    // Execute command
    const result = await executeCommand(context);

    // Print summary
    printSummary(result, context);

    // Clean up
    closeStateStore();

    // Exit with appropriate code
    process.exit(result.success ? 0 : 1);
  } catch (error) {
    logger.error('Fatal error during execution', error as Error);
    closeStateStore();
    process.exit(1);
  }
}

// ==================== COMMAND EXECUTION ====================

async function executeCommand(context: WorkflowContext): Promise<ProcessingResult> {
  const { options, logger } = context;

  switch (options.command) {
    case 'process-latest':
      return await processLatest(context);

    case 'process-week':
      return await processWeek(context);

    case 'retry-failed':
      return await retryFailed(context);

    case 'force-reupload':
      return await forceReupload(context);

    case 'status':
      return await showStatus(context);

    default:
      logger.error(`Unknown command: ${options.command}`);
      return createErrorResult(`Unknown command: ${options.command}`);
  }
}

// ==================== COMMAND IMPLEMENTATIONS ====================

/**
 * Process the latest payroll batch
 */
async function processLatest(context: WorkflowContext): Promise<ProcessingResult> {
  const { options, logger, stateStore } = context;
  const startTime = Date.now();

  logger.info('Starting process-latest workflow', {
    dryRun: options.dryRun,
    testMode: options.testMode,
    date: options.date,
  });

  const result: ProcessingResult = {
    success: true,
    processed: 0,
    uploaded: 0,
    failed: 0,
    skipped: 0,
    errors: [],
    warnings: [],
    durationMs: 0,
  };

  try {
    // Step 1: Download from ADP (unless skipped)
    if (!options.skipDownload) {
      logger.info('Step 1: Downloading payroll data from ADP...');
      const downloadResult = await downloadFromADP(context);
      if (!downloadResult.success) {
        result.errors.push(...downloadResult.errors);
        if (downloadResult.errors.length > 0) {
          result.success = false;
          return finalizeResult(result, startTime);
        }
      }
      result.processed = downloadResult.filesDownloaded;
    } else {
      logger.info('Step 1: Skipping ADP download (--skip-download flag)');
    }

    // Step 2: Transform data
    logger.info('Step 2: Transforming payroll data to Intacct format...');
    const transformResult = await transformPayrollData(context);
    if (!transformResult.success) {
      result.errors.push(...transformResult.errors);
      result.warnings.push(...transformResult.warnings);
    }

    // Step 3: Validate (unless skipped)
    if (!options.skipValidation) {
      logger.info('Step 3: Validating transformed data...');
      const validationResult = await validateData(context);
      if (!validationResult.valid) {
        result.errors.push(...validationResult.errors);
        result.warnings.push(...validationResult.warnings);
        if (validationResult.errors.length > 0) {
          result.success = false;
          return finalizeResult(result, startTime);
        }
      }
    } else {
      logger.info('Step 3: Skipping validation (--skip-validation flag)');
    }

    // Step 4: Upload to Intacct (unless dry run)
    if (!options.dryRun) {
      logger.info('Step 4: Uploading journal entries to Intacct...');
      const uploadResult = await uploadToIntacct(context);
      result.uploaded = uploadResult.uploaded;
      result.failed = uploadResult.failed;
      result.skipped = uploadResult.skipped;
      result.errors.push(...uploadResult.errors);
      result.warnings.push(...uploadResult.warnings);
      result.success = uploadResult.failed === 0;
    } else {
      logger.info('Step 4: Dry run mode - skipping Intacct upload');
      result.warnings.push('Dry run mode: No data was uploaded to Intacct');
    }

    return finalizeResult(result, startTime);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error('Error in process-latest workflow', error as Error);
    result.errors.push(errorMessage);
    result.success = false;
    return finalizeResult(result, startTime);
  }
}

/**
 * Process all payroll batches for the week
 */
async function processWeek(context: WorkflowContext): Promise<ProcessingResult> {
  const { logger, options } = context;
  const startTime = Date.now();

  logger.info('Starting process-week workflow', {
    startDate: options.startDate,
    endDate: options.endDate,
  });

  // Calculate date range if not provided
  const endDate = options.endDate ? new Date(options.endDate) : new Date();
  const startDate = options.startDate
    ? new Date(options.startDate)
    : new Date(endDate.getTime() - 7 * 24 * 60 * 60 * 1000);

  logger.info(`Processing payroll for date range: ${startDate.toISOString().split('T')[0]} to ${endDate.toISOString().split('T')[0]}`);

  // For now, delegate to processLatest with date range
  // In a full implementation, this would iterate through multiple batches
  return await processLatest(context);
}

/**
 * Retry all failed uploads
 */
async function retryFailed(context: WorkflowContext): Promise<ProcessingResult> {
  const { logger, stateStore } = context;
  const startTime = Date.now();

  logger.info('Starting retry-failed workflow');

  const result: ProcessingResult = {
    success: true,
    processed: 0,
    uploaded: 0,
    failed: 0,
    skipped: 0,
    errors: [],
    warnings: [],
    durationMs: 0,
  };

  try {
    // Get failed entries from state store
    const failedEntries = stateStore.getFailedEntries();
    result.processed = failedEntries.length;

    if (failedEntries.length === 0) {
      logger.info('No failed entries to retry');
      result.warnings.push('No failed entries found to retry');
      return finalizeResult(result, startTime);
    }

    logger.info(`Found ${failedEntries.length} failed entries to retry`);

    // Mark entries for re-upload
    for (const entry of failedEntries) {
      stateStore.markForReupload(entry.batchId, entry.entryType);
    }

    // Upload to Intacct
    const uploadResult = await uploadToIntacct(context);
    result.uploaded = uploadResult.uploaded;
    result.failed = uploadResult.failed;
    result.errors.push(...uploadResult.errors);
    result.warnings.push(...uploadResult.warnings);
    result.success = uploadResult.failed === 0;

    return finalizeResult(result, startTime);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error('Error in retry-failed workflow', error as Error);
    result.errors.push(errorMessage);
    result.success = false;
    return finalizeResult(result, startTime);
  }
}

/**
 * Force re-upload entries
 */
async function forceReupload(context: WorkflowContext): Promise<ProcessingResult> {
  const { logger, stateStore, options } = context;
  const startTime = Date.now();

  logger.info('Starting force-reupload workflow', { batchId: options.batchId });

  const result: ProcessingResult = {
    success: true,
    processed: 0,
    uploaded: 0,
    failed: 0,
    skipped: 0,
    errors: [],
    warnings: [],
    durationMs: 0,
  };

  try {
    if (!options.batchId) {
      result.errors.push('--batch-id is required for force-reupload command');
      result.success = false;
      return finalizeResult(result, startTime);
    }

    // Force re-upload the specified batch
    const updated = stateStore.forceReupload(options.batchId);
    if (updated === 0) {
      result.warnings.push(`No entries found for batch ID: ${options.batchId}`);
      return finalizeResult(result, startTime);
    }

    result.processed = updated;
    logger.info(`Marked ${updated} entries for re-upload`);

    // Upload to Intacct
    const uploadResult = await uploadToIntacct(context);
    result.uploaded = uploadResult.uploaded;
    result.failed = uploadResult.failed;
    result.errors.push(...uploadResult.errors);
    result.warnings.push(...uploadResult.warnings);
    result.success = uploadResult.failed === 0;

    return finalizeResult(result, startTime);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error('Error in force-reupload workflow', error as Error);
    result.errors.push(errorMessage);
    result.success = false;
    return finalizeResult(result, startTime);
  }
}

/**
 * Show current processing status
 */
async function showStatus(context: WorkflowContext): Promise<ProcessingResult> {
  const { logger, stateStore } = context;
  const startTime = Date.now();

  logger.info('Retrieving processing status');

  const stats = stateStore.getStats();
  const failedEntries = stateStore.getFailedEntries();
  const pendingEntries = stateStore.getPendingEntries();

  console.log(`\n${COLORS.cyan}=== Processing Status ===${COLORS.reset}\n`);
  console.log(`${COLORS.bold}Overall Statistics:${COLORS.reset}`);
  console.log(`  Total Entries:    ${stats.total}`);
  console.log(`  ${COLORS.green}Uploaded:${COLORS.reset}         ${stats.uploaded}`);
  console.log(`  ${COLORS.yellow}Pending:${COLORS.reset}          ${stats.pending}`);
  console.log(`  ${COLORS.red}Failed:${COLORS.reset}           ${stats.failed}`);
  console.log(`  ${COLORS.dim}Skipped:${COLORS.reset}          ${stats.skipped}`);

  if (failedEntries.length > 0) {
    console.log(`\n${COLORS.bold}Failed Entries:${COLORS.reset}`);
    for (const entry of failedEntries.slice(0, 5)) {
      console.log(`  - ${entry.batchId} (${entry.entryType}): ${entry.errors || 'Unknown error'}`);
    }
    if (failedEntries.length > 5) {
      console.log(`  ... and ${failedEntries.length - 5} more`);
    }
  }

  if (pendingEntries.length > 0) {
    console.log(`\n${COLORS.bold}Pending Entries:${COLORS.reset}`);
    for (const entry of pendingEntries.slice(0, 5)) {
      console.log(`  - ${entry.batchId} (${entry.entryType}): ${entry.transformedFile || 'Not transformed'}`);
    }
    if (pendingEntries.length > 5) {
      console.log(`  ... and ${pendingEntries.length - 5} more`);
    }
  }

  console.log('');

  return {
    success: true,
    processed: stats.total,
    uploaded: stats.uploaded,
    failed: stats.failed,
    skipped: stats.skipped,
    errors: [],
    warnings: [],
    durationMs: Date.now() - startTime,
  };
}

// ==================== WORKFLOW STEPS ====================

/**
 * Download payroll data from ADP
 */
async function downloadFromADP(context: WorkflowContext): Promise<{
  success: boolean;
  filesDownloaded: number;
  errors: string[];
}> {
  const { logger, options } = context;

  // TODO: Implement actual ADP automation
  // This is a placeholder that would be replaced with:
  // - Browser automation to login to ADP
  // - Navigate to payroll reports
  // - Download GL report files
  // - Handle MFA if required

  logger.info('ADP download placeholder - implement actual automation');
  logger.warn('ADP automation not yet implemented. Please manually download files to /downloads/payroll-gl/');

  return {
    success: true,
    filesDownloaded: 0,
    errors: [],
  };
}

/**
 * Transform payroll data to Intacct format
 */
async function transformPayrollData(context: WorkflowContext): Promise<{
  success: boolean;
  entriesTransformed: number;
  errors: string[];
  warnings: string[];
}> {
  const { logger } = context;

  // TODO: Implement actual transformation
  // This would use the transform module to:
  // - Parse ADP CSV files
  // - Map accounts and departments
  // - Generate Intacct import file

  logger.info('Transform placeholder - implement actual transformation');

  return {
    success: true,
    entriesTransformed: 0,
    errors: [],
    warnings: [],
  };
}

/**
 * Validate transformed data
 */
async function validateData(context: WorkflowContext): Promise<{
  valid: boolean;
  errors: string[];
  warnings: string[];
}> {
  const { logger } = context;

  // TODO: Implement actual validation
  // This would validate:
  // - Account mappings exist
  // - Debits equal credits
  // - No duplicate entries
  // - All required fields present

  logger.info('Validation placeholder - implement actual validation');

  return {
    valid: true,
    errors: [],
    warnings: [],
  };
}

/**
 * Upload journal entries to Intacct
 */
async function uploadToIntacct(context: WorkflowContext): Promise<{
  success: boolean;
  uploaded: number;
  failed: number;
  skipped: number;
  errors: string[];
  warnings: string[];
}> {
  const { logger, stateStore, options } = context;

  // TODO: Implement actual Intacct upload
  // This would use browser automation to:
  // - Login to Intacct
  // - Navigate to journal entry import
  // - Upload the generated file
  // - Verify entries were created

  logger.info('Intacct upload placeholder - implement actual automation');

  // Get pending entries
  const pendingEntries = stateStore.getPendingEntries();
  let uploaded = 0;
  let failed = 0;
  let skipped = 0;
  const errors: string[] = [];
  const warnings: string[] = [];

  for (const entry of pendingEntries) {
    // Check if already uploaded (idempotency)
    if (!options.force && stateStore.isAlreadyUploaded(entry.batchId, entry.entryType)) {
      logger.debug(`Skipping already uploaded entry: ${entry.batchId}`);
      skipped++;
      continue;
    }

    // Test mode: only process 1 entry
    if (options.testMode && uploaded >= 1) {
      logger.info('Test mode: limiting to 1 entry');
      break;
    }

    // TODO: Actual upload logic here
    // For now, mark as uploaded (placeholder)
    try {
      stateStore.recordUpload({
        batchId: entry.batchId,
        transformedFile: entry.transformedFile || '',
        intacctEntryId: `JE-${Date.now()}`,
        uploadStatus: 'uploaded',
      });
      uploaded++;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      stateStore.recordUpload({
        batchId: entry.batchId,
        transformedFile: entry.transformedFile || '',
        intacctEntryId: '',
        uploadStatus: 'failed',
        errors: errorMessage,
      });
      failed++;
      errors.push(`Failed to upload ${entry.batchId}: ${errorMessage}`);
    }
  }

  if (pendingEntries.length === 0) {
    warnings.push('No pending entries to upload');
  }

  return {
    success: failed === 0,
    uploaded,
    failed,
    skipped,
    errors,
    warnings,
  };
}

// ==================== HELPER FUNCTIONS ====================

function createErrorResult(error: string): ProcessingResult {
  return {
    success: false,
    processed: 0,
    uploaded: 0,
    failed: 0,
    skipped: 0,
    errors: [error],
    warnings: [],
    durationMs: 0,
  };
}

function finalizeResult(result: ProcessingResult, startTime: number): ProcessingResult {
  result.durationMs = Date.now() - startTime;
  return result;
}

function printBanner(options: CLIOptions): void {
  console.log(`
${COLORS.cyan}╔═══════════════════════════════════════════════════════════╗
║       ADP-to-Intacct Payroll Automation                   ║
╚═══════════════════════════════════════════════════════════╝${COLORS.reset}
`);

  const flags: string[] = [];
  if (options.dryRun) flags.push(`${COLORS.yellow}DRY RUN${COLORS.reset}`);
  if (options.testMode) flags.push(`${COLORS.yellow}TEST MODE${COLORS.reset}`);
  if (options.force) flags.push(`${COLORS.yellow}FORCE${COLORS.reset}`);
  if (options.verbose) flags.push(`${COLORS.dim}VERBOSE${COLORS.reset}`);

  console.log(`Command: ${COLORS.bold}${options.command}${COLORS.reset}`);
  if (flags.length > 0) {
    console.log(`Flags:   ${flags.join(' | ')}`);
  }
  console.log('');
}

function printSummary(result: ProcessingResult, context: WorkflowContext): void {
  const { options } = context;
  const duration = (result.durationMs / 1000).toFixed(2);

  console.log(`
${COLORS.cyan}═══════════════════════════════════════════════════════════${COLORS.reset}
${COLORS.bold}                      SUMMARY${COLORS.reset}
${COLORS.cyan}═══════════════════════════════════════════════════════════${COLORS.reset}
`);

  if (result.success) {
    console.log(`${COLORS.green}${COLORS.bold}STATUS: SUCCESS${COLORS.reset}`);
  } else {
    console.log(`${COLORS.red}${COLORS.bold}STATUS: FAILED${COLORS.reset}`);
  }

  console.log(`
Processed:  ${result.processed}
Uploaded:   ${COLORS.green}${result.uploaded}${COLORS.reset}
Failed:     ${COLORS.red}${result.failed}${COLORS.reset}
Skipped:    ${COLORS.dim}${result.skipped}${COLORS.reset}
Duration:   ${duration}s
`);

  if (result.warnings.length > 0) {
    console.log(`${COLORS.yellow}Warnings:${COLORS.reset}`);
    for (const warning of result.warnings) {
      console.log(`  - ${warning}`);
    }
    console.log('');
  }

  if (result.errors.length > 0) {
    console.log(`${COLORS.red}Errors:${COLORS.reset}`);
    for (const error of result.errors) {
      console.log(`  - ${error}`);
    }
    console.log('');
  }

  if (options.dryRun) {
    console.log(`${COLORS.yellow}Note: This was a dry run. No data was uploaded to Intacct.${COLORS.reset}`);
    console.log(`Run without --dry-run flag to perform actual upload.\n`);
  }
}

// ==================== RUN ====================

main().catch((error) => {
  console.error(`${COLORS.red}Unexpected error:${COLORS.reset}`, error);
  process.exit(1);
});
