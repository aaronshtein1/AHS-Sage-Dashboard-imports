/**
 * ADP Payroll Journal Entry Download Module
 *
 * Handles downloading payroll journal entries from ADP GL Reports.
 * Features:
 * - Detect available payroll runs for current/recent week
 * - Download configurable entry types (payroll, tax, deductions)
 * - Proper file download handling with timeouts
 * - File naming: {date}_{entryType}_{batchId}.csv
 * - File validation (non-empty, valid structure)
 * - Screenshot capture after each download
 * - Metadata return for each download
 */

import type { Page, Download, BrowserContext } from 'playwright';
import { existsSync, mkdirSync, readFileSync, statSync, renameSync } from 'fs';
import { resolve, basename, join } from 'path';
import { createLogger } from '../utils/logger';
import {
  type DownloadResult,
  type BatchDownloadResult,
  type PayrollEntry,
  type PayrollRunInfo,
  type PayrollEntryType,
  type FileValidationResult,
  type ADPConfig,
  DEFAULT_ADP_CONFIG,
  ADPAutomationError,
} from './types';
import {
  getGLReportsSelectors,
  getPlaywrightSelectors,
  getTimeouts,
  type SelectorWithFallbacks,
} from './selectors';
import { updateSessionActivity } from './login';
import { navigateToGLReporting, verifyGLReportsPage } from './navigate-gl';

const logger = createLogger('adp:download-entries');

// ==================== CONSTANTS ====================

/**
 * Default download directory for payroll GL files
 */
const DEFAULT_DOWNLOAD_DIR = './downloads/payroll-gl';

/**
 * Expected CSV headers for validation
 */
const EXPECTED_CSV_HEADERS = [
  'Account',
  'Debit',
  'Credit',
  'Description',
  'Date',
  'Reference',
];

// ==================== ELEMENT INTERACTION ====================

/**
 * Find an element using a selector with fallbacks
 */
async function findElement(
  page: Page,
  selectorDef: SelectorWithFallbacks,
  timeout: number
): Promise<ReturnType<Page['locator']> | null> {
  const selectors = getPlaywrightSelectors(selectorDef);

  for (const selector of selectors) {
    try {
      const locator = page.locator(selector);
      await locator.waitFor({ state: 'visible', timeout: Math.min(timeout, 5000) });
      logger.debug(`Found element: ${selectorDef.description}`, { selector });
      return locator;
    } catch {
      continue;
    }
  }

  logger.warn(`Element not found: ${selectorDef.description}`);
  return null;
}

/**
 * Find all matching elements
 */
async function findElements(
  page: Page,
  selectorDef: SelectorWithFallbacks,
  timeout: number
): Promise<ReturnType<Page['locator']> | null> {
  const selectors = getPlaywrightSelectors(selectorDef);

  for (const selector of selectors) {
    try {
      const locator = page.locator(selector);
      const count = await locator.count();
      if (count > 0) {
        logger.debug(`Found ${count} elements: ${selectorDef.description}`, { selector });
        return locator;
      }
    } catch {
      continue;
    }
  }

  return null;
}

// ==================== SCREENSHOT UTILITY ====================

/**
 * Take a screenshot and save to disk
 */
async function takeScreenshot(
  page: Page,
  name: string,
  config: ADPConfig
): Promise<string | undefined> {
  if (!config.captureScreenshots) {
    return undefined;
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `${timestamp}_${name}.png`;
  const screenshotDir = resolve(process.cwd(), config.screenshotDir);
  const filepath = resolve(screenshotDir, filename);

  if (!existsSync(screenshotDir)) {
    mkdirSync(screenshotDir, { recursive: true });
  }

  try {
    await page.screenshot({ path: filepath, fullPage: true });
    logger.debug('Screenshot saved', { path: filepath });
    return filepath;
  } catch (error) {
    logger.warn('Failed to save screenshot', { name, error });
    return undefined;
  }
}

// ==================== DATE UTILITIES ====================

/**
 * Format date for filename
 */
function formatDateForFilename(date: Date): string {
  return date.toISOString().split('T')[0].replace(/-/g, '');
}

/**
 * Get the current week's date range
 */
function getCurrentWeekRange(): { start: Date; end: Date } {
  const now = new Date();
  const dayOfWeek = now.getDay();

  // Start of week (Sunday)
  const start = new Date(now);
  start.setDate(now.getDate() - dayOfWeek);
  start.setHours(0, 0, 0, 0);

  // End of week (Saturday)
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  end.setHours(23, 59, 59, 999);

  return { start, end };
}

/**
 * Check if a date is within the current or recent week
 */
function isRecentPayroll(payrollDate: Date, weeksBack: number = 2): boolean {
  const now = new Date();
  const cutoffDate = new Date(now);
  cutoffDate.setDate(now.getDate() - weeksBack * 7);

  return payrollDate >= cutoffDate && payrollDate <= now;
}

// ==================== FILE HANDLING ====================

/**
 * Ensure download directory exists
 */
function ensureDownloadDir(config: ADPConfig): string {
  const downloadDir = resolve(process.cwd(), config.downloadDir);

  if (!existsSync(downloadDir)) {
    mkdirSync(downloadDir, { recursive: true });
    logger.debug('Created download directory', { path: downloadDir });
  }

  return downloadDir;
}

/**
 * Generate filename for downloaded file
 */
function generateFilename(
  payrollDate: Date,
  entryType: PayrollEntryType,
  batchId: string
): string {
  const dateStr = formatDateForFilename(payrollDate);
  // Sanitize batchId for filename
  const sanitizedBatchId = batchId.replace(/[^a-zA-Z0-9-_]/g, '_');
  return `${dateStr}_${entryType}_${sanitizedBatchId}.csv`;
}

/**
 * Validate downloaded CSV file
 */
function validateCSVFile(filepath: string): FileValidationResult {
  const result: FileValidationResult = {
    isValid: false,
    exists: false,
    hasContent: false,
    hasValidStructure: false,
    rowCount: 0,
    columnCount: 0,
    errors: [],
  };

  // Check if file exists
  if (!existsSync(filepath)) {
    result.errors.push('File does not exist');
    return result;
  }
  result.exists = true;

  // Check file size
  const stats = statSync(filepath);
  if (stats.size === 0) {
    result.errors.push('File is empty (0 bytes)');
    return result;
  }
  result.hasContent = true;

  // Read and parse CSV
  try {
    const content = readFileSync(filepath, 'utf-8');
    const lines = content.trim().split('\n');

    if (lines.length < 2) {
      result.errors.push('File has no data rows (only header or empty)');
      return result;
    }

    // Parse header
    const header = lines[0].split(',').map((h: string) => h.trim().replace(/^"|"$/g, ''));
    result.headers = header;
    result.columnCount = header.length;

    // Validate structure - check for at least some expected columns
    const foundExpectedHeaders = EXPECTED_CSV_HEADERS.filter((expected: string) =>
      header.some((h: string) => h.toLowerCase().includes(expected.toLowerCase()))
    );

    if (foundExpectedHeaders.length >= 2) {
      result.hasValidStructure = true;
    } else {
      result.errors.push(
        `CSV structure doesn't match expected format. Found headers: ${header.join(', ')}`
      );
    }

    // Count data rows (excluding header)
    result.rowCount = lines.length - 1;

    // Overall validation
    result.isValid = result.exists && result.hasContent && result.rowCount > 0;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    result.errors.push(`Failed to parse CSV: ${errorMessage}`);
  }

  return result;
}

/**
 * Handle file download with proper wait and timeout
 */
async function handleFileDownload(
  page: Page,
  downloadTrigger: () => Promise<void>,
  config: ADPConfig
): Promise<{ download: Download; tempPath: string } | null> {
  const timeouts = getTimeouts();
  const downloadDir = ensureDownloadDir(config);

  try {
    // Start waiting for download before triggering it
    const downloadPromise = page.waitForEvent('download', {
      timeout: timeouts.downloadWait,
    });

    // Trigger the download
    await downloadTrigger();

    // Wait for download to start
    const download = await downloadPromise;
    logger.info('Download started', { suggestedFilename: download.suggestedFilename() });

    // Wait for download to complete and get the path
    const tempPath = await download.path();
    if (!tempPath) {
      logger.error('Download failed - no file path returned');
      return null;
    }

    logger.debug('Download completed', {
      tempPath,
      suggestedFilename: download.suggestedFilename(),
    });

    return { download, tempPath };
  } catch (error) {
    logger.error('Download failed', error);
    return null;
  }
}

// ==================== PAYROLL RUN DETECTION ====================

/**
 * Detect available payroll runs from the GL Reports page
 */
export async function detectPayrollRuns(
  page: Page,
  config: Partial<ADPConfig> = {}
): Promise<PayrollRunInfo[]> {
  const glSelectors = getGLReportsSelectors();
  const timeouts = getTimeouts();

  logger.info('Detecting available payroll runs');

  const payrollRuns: PayrollRunInfo[] = [];

  // Find the payroll runs table
  const runsTable = await findElement(page, glSelectors.payrollRunsTable, timeouts.elementWait);
  if (!runsTable) {
    logger.warn('Payroll runs table not found');
    return payrollRuns;
  }

  // Find all rows in the table
  const rows = await findElements(page, glSelectors.payrollRunRow, timeouts.shortWait);
  if (!rows) {
    logger.warn('No payroll run rows found');
    return payrollRuns;
  }

  const rowCount = await rows.count();
  logger.debug(`Found ${rowCount} payroll run rows`);

  // Parse each row
  for (let i = 0; i < rowCount; i++) {
    try {
      const row = rows.nth(i);

      // Extract batch ID
      const batchIdCell = row.locator(
        getPlaywrightSelectors(glSelectors.batchIdCell)[0]
      );
      const batchId = (await batchIdCell.textContent()) || '';

      // Extract date
      const dateCell = row.locator(
        getPlaywrightSelectors(glSelectors.dateCell)[0]
      );
      const dateText = (await dateCell.textContent()) || '';

      // Extract status
      const statusCell = row.locator(
        getPlaywrightSelectors(glSelectors.statusCell)[0]
      );
      const statusText = ((await statusCell.textContent()) || '').toLowerCase();

      // Parse the date
      const payrollDate = new Date(dateText);
      if (isNaN(payrollDate.getTime())) {
        logger.debug(`Skipping row with invalid date: ${dateText}`);
        continue;
      }

      // Determine status
      let status: 'completed' | 'pending' | 'processing' = 'pending';
      if (statusText.includes('completed') || statusText.includes('posted')) {
        status = 'completed';
      } else if (statusText.includes('processing')) {
        status = 'processing';
      }

      // Check if this is a recent payroll
      if (isRecentPayroll(payrollDate)) {
        payrollRuns.push({
          batchId: batchId.trim(),
          periodStart: new Date(payrollDate),
          periodEnd: new Date(payrollDate),
          checkDate: new Date(payrollDate),
          availableEntryTypes: ['payroll', 'tax', 'deductions'],
          status,
        });

        logger.debug('Found payroll run', {
          batchId: batchId.trim(),
          date: payrollDate.toISOString(),
          status,
        });
      }
    } catch (error) {
      logger.warn(`Failed to parse row ${i}`, { error });
    }
  }

  logger.info(`Detected ${payrollRuns.length} recent payroll runs`);
  return payrollRuns;
}

// ==================== SINGLE ENTRY DOWNLOAD ====================

/**
 * Download a single payroll journal entry
 */
async function downloadSingleEntry(
  page: Page,
  payrollRun: PayrollRunInfo,
  entryType: PayrollEntryType,
  config: ADPConfig
): Promise<DownloadResult> {
  const glSelectors = getGLReportsSelectors();
  const timeouts = getTimeouts();
  const downloadDir = ensureDownloadDir(config);

  logger.info(`Downloading ${entryType} entry for batch ${payrollRun.batchId}`);

  const result: DownloadResult = {
    success: false,
    filename: '',
    downloadedAt: new Date(),
    payrollDate: payrollRun.checkDate,
    batchId: payrollRun.batchId,
    entryType,
    rowCount: 0,
    fileSizeBytes: 0,
  };

  try {
    // Select entry type if dropdown exists
    const entryTypeDropdown = await findElement(
      page,
      glSelectors.entryTypeDropdown,
      timeouts.shortWait
    );
    if (entryTypeDropdown) {
      await entryTypeDropdown.selectOption({ label: entryType });
      logger.debug(`Selected entry type: ${entryType}`);
      await page.waitForTimeout(500);
    }

    // Select CSV format if option exists
    const csvOption = await findElement(page, glSelectors.csvFormatOption, timeouts.shortWait);
    if (csvOption) {
      await csvOption.click();
      logger.debug('Selected CSV format');
    }

    // Find the download button
    const downloadButton = await findElement(
      page,
      glSelectors.downloadButton,
      timeouts.elementWait
    );
    if (!downloadButton) {
      result.error = 'Download button not found';
      return result;
    }

    // Handle the download
    const downloadResult = await handleFileDownload(
      page,
      async () => {
        await downloadButton.click();
      },
      config
    );

    if (!downloadResult) {
      result.error = 'Download failed or timed out';
      const screenshotPath = await takeScreenshot(
        page,
        `download-failed-${entryType}-${payrollRun.batchId}`,
        config
      );
      result.screenshotPath = screenshotPath;
      return result;
    }

    const { download, tempPath } = downloadResult;

    // Generate final filename
    const finalFilename = generateFilename(
      payrollRun.checkDate,
      entryType,
      payrollRun.batchId
    );
    const finalPath = join(downloadDir, finalFilename);

    // Move file to final location
    renameSync(tempPath, finalPath);
    logger.info(`File saved to: ${finalPath}`);

    // Validate the file
    const validation = validateCSVFile(finalPath);
    if (!validation.isValid) {
      result.error = `File validation failed: ${validation.errors.join('; ')}`;
      logger.warn('Downloaded file failed validation', {
        filename: finalFilename,
        errors: validation.errors,
      });
    } else {
      result.success = true;
    }

    // Update result
    result.filename = finalPath;
    result.originalFilename = download.suggestedFilename();
    result.downloadedAt = new Date();
    result.rowCount = validation.rowCount;
    result.fileSizeBytes = existsSync(finalPath) ? statSync(finalPath).size : 0;

    // Take screenshot after download
    result.screenshotPath = await takeScreenshot(
      page,
      `download-success-${entryType}-${payrollRun.batchId}`,
      config
    );

    updateSessionActivity();

    return result;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error(`Failed to download ${entryType} entry`, error);

    result.error = errorMessage;
    result.screenshotPath = await takeScreenshot(
      page,
      `download-exception-${entryType}-${payrollRun.batchId}`,
      config
    );

    return result;
  }
}

// ==================== BATCH DOWNLOAD ====================

/**
 * Download multiple payroll journal entries
 *
 * @param page - Playwright page instance
 * @param context - Browser context
 * @param entryTypes - Array of entry types to download (default: ['payroll', 'tax', 'deductions'])
 * @param config - Optional configuration overrides
 * @returns BatchDownloadResult with all download results
 */
export async function downloadPayrollEntries(
  page: Page,
  context: BrowserContext,
  entryTypes: PayrollEntryType[] = ['payroll', 'tax', 'deductions'],
  config: Partial<ADPConfig> = {}
): Promise<BatchDownloadResult> {
  const fullConfig: ADPConfig = { ...DEFAULT_ADP_CONFIG, ...config };
  const startedAt = new Date();

  logger.info('Starting batch download of payroll entries', {
    entryTypes,
    downloadDir: fullConfig.downloadDir,
  });

  const batchResult: BatchDownloadResult = {
    success: false,
    totalAttempted: 0,
    successCount: 0,
    failureCount: 0,
    downloads: [],
    startedAt,
    completedAt: new Date(),
    durationMs: 0,
  };

  try {
    // Ensure we're on the GL Reports page
    const isOnGLPage = await verifyGLReportsPage(page);
    if (!isOnGLPage) {
      logger.info('Not on GL Reports page, navigating...');
      const navResult = await navigateToGLReporting(page, context, config);
      if (!navResult.success) {
        batchResult.completedAt = new Date();
        batchResult.durationMs = batchResult.completedAt.getTime() - startedAt.getTime();
        return batchResult;
      }
    }

    // Detect available payroll runs
    const payrollRuns = await detectPayrollRuns(page, config);
    if (payrollRuns.length === 0) {
      logger.warn('No payroll runs available for download');
      batchResult.completedAt = new Date();
      batchResult.durationMs = batchResult.completedAt.getTime() - startedAt.getTime();
      return batchResult;
    }

    // Use the most recent payroll run
    const latestRun = payrollRuns.sort(
      (a, b) => b.checkDate.getTime() - a.checkDate.getTime()
    )[0];

    logger.info(`Processing payroll run: ${latestRun.batchId}`, {
      checkDate: latestRun.checkDate.toISOString(),
    });

    // Download each entry type
    for (const entryType of entryTypes) {
      batchResult.totalAttempted++;

      // Check if this entry type is available for this run
      if (!latestRun.availableEntryTypes.includes(entryType)) {
        logger.debug(`Entry type ${entryType} not available for this payroll run`);
        continue;
      }

      const downloadResult = await downloadSingleEntry(
        page,
        latestRun,
        entryType,
        fullConfig
      );

      batchResult.downloads.push(downloadResult);

      if (downloadResult.success) {
        batchResult.successCount++;
        logger.info(`Successfully downloaded ${entryType} entry`, {
          filename: downloadResult.filename,
          rowCount: downloadResult.rowCount,
        });
      } else {
        batchResult.failureCount++;
        logger.warn(`Failed to download ${entryType} entry`, {
          error: downloadResult.error,
        });
      }

      // Brief pause between downloads
      await page.waitForTimeout(1000);
    }

    // Set overall success based on having at least one successful download
    batchResult.success = batchResult.successCount > 0;
  } catch (error) {
    logger.error('Batch download failed with exception', error);
  }

  batchResult.completedAt = new Date();
  batchResult.durationMs = batchResult.completedAt.getTime() - startedAt.getTime();

  logger.info('Batch download completed', {
    success: batchResult.success,
    totalAttempted: batchResult.totalAttempted,
    successCount: batchResult.successCount,
    failureCount: batchResult.failureCount,
    durationMs: batchResult.durationMs,
  });

  return batchResult;
}

/**
 * Download entries for a specific payroll run by batch ID
 */
export async function downloadEntriesForBatch(
  page: Page,
  context: BrowserContext,
  batchId: string,
  entryTypes: PayrollEntryType[] = ['payroll', 'tax', 'deductions'],
  config: Partial<ADPConfig> = {}
): Promise<BatchDownloadResult> {
  const fullConfig: ADPConfig = { ...DEFAULT_ADP_CONFIG, ...config };
  const startedAt = new Date();

  logger.info(`Downloading entries for specific batch: ${batchId}`, { entryTypes });

  const batchResult: BatchDownloadResult = {
    success: false,
    totalAttempted: 0,
    successCount: 0,
    failureCount: 0,
    downloads: [],
    startedAt,
    completedAt: new Date(),
    durationMs: 0,
  };

  try {
    // Ensure we're on the GL Reports page
    const isOnGLPage = await verifyGLReportsPage(page);
    if (!isOnGLPage) {
      const navResult = await navigateToGLReporting(page, context, config);
      if (!navResult.success) {
        batchResult.completedAt = new Date();
        batchResult.durationMs = batchResult.completedAt.getTime() - startedAt.getTime();
        return batchResult;
      }
    }

    // Detect all available runs
    const allRuns = await detectPayrollRuns(page, config);

    // Find the specific batch
    const targetRun = allRuns.find((run) => run.batchId === batchId);
    if (!targetRun) {
      logger.error(`Batch ${batchId} not found`);
      batchResult.completedAt = new Date();
      batchResult.durationMs = batchResult.completedAt.getTime() - startedAt.getTime();
      return batchResult;
    }

    // Download each entry type
    for (const entryType of entryTypes) {
      batchResult.totalAttempted++;

      const downloadResult = await downloadSingleEntry(
        page,
        targetRun,
        entryType,
        fullConfig
      );

      batchResult.downloads.push(downloadResult);

      if (downloadResult.success) {
        batchResult.successCount++;
      } else {
        batchResult.failureCount++;
      }

      await page.waitForTimeout(1000);
    }

    batchResult.success = batchResult.successCount > 0;
  } catch (error) {
    logger.error('Download for specific batch failed', error);
  }

  batchResult.completedAt = new Date();
  batchResult.durationMs = batchResult.completedAt.getTime() - startedAt.getTime();

  return batchResult;
}

// ==================== EXPORTS ====================

export {
  validateCSVFile,
  generateFilename,
  formatDateForFilename,
  isRecentPayroll,
  getCurrentWeekRange,
  type DownloadResult,
  type BatchDownloadResult,
  type PayrollRunInfo,
  type PayrollEntryType,
  type FileValidationResult,
};
