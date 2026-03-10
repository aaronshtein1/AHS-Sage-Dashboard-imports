/**
 * Sage Intacct Journal Entry Upload
 *
 * Handles uploading journal entry CSV/import files to Intacct:
 * - File upload dialog handling
 * - Upload progress monitoring
 * - Result capture (success, warnings, errors)
 * - Duplicate import detection
 * - Screenshot capture before and after upload
 */

import { Page } from 'playwright';
import * as path from 'path';
import * as fs from 'fs';
import { createLogger } from '../utils/logger';
import {
  UploadResult,
  UploadOptions,
  DuplicateEntryInfo,
  IntacctConfig,
  DEFAULT_INTACCT_CONFIG,
  IntacctAutomationError,
} from './types';
import {
  getAllSelectorsForElement,
  getSelectorTimeout,
} from './selectors';
import { isSessionValid, reLogin, loadCredentials } from './login';
import { navigateToJournalImport } from './navigate-import';

const logger = createLogger('intacct:upload');

/**
 * Take a screenshot during upload process
 */
async function takeScreenshot(
  page: Page,
  step: string,
  config: IntacctConfig
): Promise<string> {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `intacct-${step}-${timestamp}.png`;
  const screenshotPath = path.join(config.screenshotDir, filename);

  // Ensure screenshot directory exists
  if (!fs.existsSync(config.screenshotDir)) {
    fs.mkdirSync(config.screenshotDir, { recursive: true });
  }

  await page.screenshot({ path: screenshotPath, fullPage: true });
  logger.info('Screenshot taken', { step, path: screenshotPath });

  return screenshotPath;
}

/**
 * Wait for element using multiple selector strategies
 */
async function waitForSelectorWithFallbacks(
  page: Page,
  group: 'upload' | 'confirmation' | 'common',
  selectorKey: string,
  options: { timeout?: number; state?: 'visible' | 'attached' | 'hidden' } = {}
): Promise<ReturnType<Page['locator']> | null> {
  const selectors = getAllSelectorsForElement(group, selectorKey);
  const timeout = options.timeout ?? getSelectorTimeout(group, selectorKey);
  const state = options.state ?? 'visible';

  for (const selector of selectors) {
    try {
      const locator = page.locator(selector);
      await locator.waitFor({
        timeout: Math.min(timeout / selectors.length, 5000),
        state,
      });
      logger.debug('Found element with selector', { selector });
      return locator;
    } catch {
      logger.debug('Selector not found, trying fallback', { selector });
    }
  }

  return null;
}

/**
 * Wait for any page loading to complete
 */
async function waitForPageLoad(page: Page, timeout: number): Promise<void> {
  try {
    await page.waitForLoadState('networkidle', { timeout });

    // Wait for any loading spinners to disappear
    const loadingSelectors = getAllSelectorsForElement('common', 'loadingSpinner');
    for (const selector of loadingSelectors) {
      try {
        const spinner = page.locator(selector);
        if (await spinner.isVisible({ timeout: 1000 })) {
          await spinner.waitFor({ state: 'hidden', timeout: timeout });
        }
      } catch {
        // Spinner either not found or already hidden
      }
    }
  } catch {
    logger.debug('Page load wait completed');
  }
}

/**
 * Check for duplicate entry warnings
 */
async function checkForDuplicates(page: Page): Promise<{
  detected: boolean;
  details: DuplicateEntryInfo[];
}> {
  const duplicates: DuplicateEntryInfo[] = [];
  const duplicateSelectors = getAllSelectorsForElement('confirmation', 'duplicateWarning');

  for (const selector of duplicateSelectors) {
    try {
      const elements = page.locator(selector);
      const count = await elements.count();

      if (count > 0) {
        logger.info('Duplicate warnings detected', { count });

        // Try to extract duplicate details
        for (let i = 0; i < count; i++) {
          const element = elements.nth(i);
          const text = await element.textContent();

          if (text) {
            // Try to parse journal number from text
            const journalMatch = text.match(/(?:JE-?|Journal\s*#?\s*)(\d+)/i);
            const dateMatch = text.match(/(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/);

            duplicates.push({
              journalNumber: journalMatch?.[1] ?? 'Unknown',
              existingDate: dateMatch?.[1] ?? 'Unknown',
              description: text.substring(0, 200),
            });
          }
        }

        return { detected: true, details: duplicates };
      }
    } catch {
      // Continue checking other selectors
    }
  }

  return { detected: false, details: [] };
}

/**
 * Extract created entry count from confirmation page
 */
async function extractEntryCount(page: Page): Promise<number> {
  // Try to find explicit count element
  const countSelectors = getAllSelectorsForElement('confirmation', 'entriesCreatedCount');

  for (const selector of countSelectors) {
    try {
      const element = page.locator(selector).first();
      if (await element.isVisible({ timeout: 2000 })) {
        const text = await element.textContent();
        if (text) {
          const match = text.match(/(\d+)/);
          if (match) {
            return parseInt(match[1], 10);
          }
        }
      }
    } catch {
      // Continue
    }
  }

  // Try to count rows in results table
  const tableSelectors = getAllSelectorsForElement('confirmation', 'resultsTable');

  for (const selector of tableSelectors) {
    try {
      const table = page.locator(selector).first();
      if (await table.isVisible({ timeout: 2000 })) {
        // Count data rows (excluding header)
        const rows = table.locator('tbody tr');
        const count = await rows.count();
        if (count > 0) {
          return count;
        }
      }
    } catch {
      // Continue
    }
  }

  // Try to find entry IDs and count them
  const idSelectors = getAllSelectorsForElement('confirmation', 'journalEntryIds');

  for (const selector of idSelectors) {
    try {
      const ids = page.locator(selector);
      const count = await ids.count();
      if (count > 0) {
        return count;
      }
    } catch {
      // Continue
    }
  }

  // Parse page content for "X entries created" pattern
  const pageContent = await page.content();
  const patterns = [
    /(\d+)\s*(?:journal\s+)?entr(?:y|ies)\s+(?:created|imported)/i,
    /(?:created|imported)\s+(\d+)\s*(?:journal\s+)?entr(?:y|ies)/i,
    /successfully\s+(?:created|imported)\s+(\d+)/i,
  ];

  for (const pattern of patterns) {
    const match = pageContent.match(pattern);
    if (match) {
      return parseInt(match[1], 10);
    }
  }

  return 0;
}

/**
 * Extract created journal entry IDs
 */
async function extractJournalEntryIds(page: Page): Promise<string[]> {
  const ids: string[] = [];
  const idSelectors = getAllSelectorsForElement('confirmation', 'journalEntryIds');

  for (const selector of idSelectors) {
    try {
      const elements = page.locator(selector);
      const count = await elements.count();

      for (let i = 0; i < count; i++) {
        const element = elements.nth(i);
        const text = await element.textContent();

        if (text) {
          // Extract journal entry ID patterns
          const matches = text.match(/(?:JE-?|GJ-?|#)(\d+)/gi);
          if (matches) {
            ids.push(...matches.map(m => m.replace(/[^0-9]/g, '')));
          }
        }
      }

      if (ids.length > 0) {
        return [...new Set(ids)]; // Remove duplicates
      }
    } catch {
      // Continue
    }
  }

  // Try parsing from page content
  const pageContent = await page.content();
  const contentMatches = pageContent.match(/(?:Journal\s+Entry\s+)?(?:JE-?|GJ-?)(\d{4,})/gi);
  if (contentMatches) {
    const extracted = contentMatches.map(m => {
      const numMatch = m.match(/(\d+)/);
      return numMatch ? numMatch[1] : null;
    }).filter((id): id is string => id !== null);

    ids.push(...extracted);
  }

  return [...new Set(ids)];
}

/**
 * Extract warnings from upload result
 */
async function extractWarnings(page: Page): Promise<string[]> {
  const warnings: string[] = [];
  const warningSelectors = getAllSelectorsForElement('confirmation', 'warningMessage');

  for (const selector of warningSelectors) {
    try {
      const elements = page.locator(selector);
      const count = await elements.count();

      for (let i = 0; i < count; i++) {
        const text = await elements.nth(i).textContent();
        if (text && text.trim()) {
          warnings.push(text.trim());
        }
      }
    } catch {
      // Continue
    }
  }

  return warnings;
}

/**
 * Extract errors from upload result
 */
async function extractErrors(page: Page): Promise<string[]> {
  const errors: string[] = [];
  const errorSelectors = getAllSelectorsForElement('confirmation', 'errorMessage');

  for (const selector of errorSelectors) {
    try {
      const elements = page.locator(selector);
      const count = await elements.count();

      for (let i = 0; i < count; i++) {
        const text = await elements.nth(i).textContent();
        if (text && text.trim()) {
          errors.push(text.trim());
        }
      }
    } catch {
      // Continue
    }
  }

  return errors;
}

/**
 * Wait for upload to complete (processing to finish)
 */
async function waitForUploadCompletion(
  page: Page,
  config: IntacctConfig
): Promise<{ success: boolean; error?: string }> {
  const maxWait = config.defaultTimeout * 2; // Double timeout for upload processing
  const startTime = Date.now();

  logger.info('Waiting for upload to complete');

  while (Date.now() - startTime < maxWait) {
    // Check for success message
    const successSelectors = getAllSelectorsForElement('confirmation', 'successMessage');
    for (const selector of successSelectors) {
      try {
        if (await page.locator(selector).isVisible({ timeout: 1000 })) {
          logger.info('Upload success message detected');
          return { success: true };
        }
      } catch {
        // Continue
      }
    }

    // Check for error message
    const errorSelectors = getAllSelectorsForElement('confirmation', 'errorMessage');
    for (const selector of errorSelectors) {
      try {
        const errorElement = page.locator(selector).first();
        if (await errorElement.isVisible({ timeout: 500 })) {
          const errorText = await errorElement.textContent();
          logger.warn('Upload error message detected', { error: errorText });
          return { success: false, error: errorText ?? 'Upload failed' };
        }
      } catch {
        // Continue
      }
    }

    // Check for upload/processing indicator
    const uploadingSelectors = getAllSelectorsForElement('upload', 'uploadingMessage');
    let stillProcessing = false;

    for (const selector of uploadingSelectors) {
      try {
        if (await page.locator(selector).isVisible({ timeout: 500 })) {
          stillProcessing = true;
          break;
        }
      } catch {
        // Continue
      }
    }

    if (!stillProcessing) {
      // Check loading spinner
      const loadingSelectors = getAllSelectorsForElement('common', 'loadingSpinner');
      for (const selector of loadingSelectors) {
        try {
          if (await page.locator(selector).isVisible({ timeout: 500 })) {
            stillProcessing = true;
            break;
          }
        } catch {
          // Continue
        }
      }
    }

    if (!stillProcessing) {
      // No processing indicator, check if we have results
      const resultCount = await extractEntryCount(page);
      if (resultCount > 0) {
        return { success: true };
      }

      // Wait a bit more and check again
      await page.waitForTimeout(1000);

      const finalResultCount = await extractEntryCount(page);
      if (finalResultCount > 0) {
        return { success: true };
      }

      // Check one more time for any visible confirmation
      await page.waitForTimeout(2000);
      break;
    }

    await page.waitForTimeout(500);
  }

  // Timeout reached - check final state
  const finalErrors = await extractErrors(page);
  if (finalErrors.length > 0) {
    return { success: false, error: finalErrors.join('; ') };
  }

  const finalCount = await extractEntryCount(page);
  if (finalCount > 0) {
    return { success: true };
  }

  return {
    success: false,
    error: 'Upload completion could not be determined - please verify manually',
  };
}

/**
 * Handle file selection via the file input
 */
async function selectFile(
  page: Page,
  filePath: string,
  config: IntacctConfig
): Promise<boolean> {
  const absolutePath = path.resolve(filePath);

  // Verify file exists
  if (!fs.existsSync(absolutePath)) {
    throw new IntacctAutomationError(
      `Import file not found: ${absolutePath}`,
      'UPLOAD_FAILED',
      { filePath: absolutePath }
    );
  }

  logger.info('Selecting file for upload', { filePath: absolutePath });

  // Find file input
  const fileInputSelectors = getAllSelectorsForElement('upload', 'fileInput');

  for (const selector of fileInputSelectors) {
    try {
      const fileInput = page.locator(selector).first();

      // Set input files - this works even for hidden inputs
      await fileInput.setInputFiles(absolutePath);
      logger.debug('File selected via input', { selector });

      // Give a moment for the file to be processed
      await page.waitForTimeout(500);

      return true;
    } catch (error) {
      logger.debug('File selection failed for selector', {
        selector,
        error: (error as Error).message,
      });
    }
  }

  // Try using file chooser promise approach for browse button
  try {
    const browseSelectors = getAllSelectorsForElement('upload', 'browseButton');

    for (const selector of browseSelectors) {
      try {
        const browseButton = page.locator(selector).first();
        if (await browseButton.isVisible({ timeout: 2000 })) {
          // Setup file chooser handler
          const [fileChooser] = await Promise.all([
            page.waitForEvent('filechooser', { timeout: 5000 }),
            browseButton.click(),
          ]);

          await fileChooser.setFiles(absolutePath);
          logger.debug('File selected via file chooser');

          await page.waitForTimeout(500);
          return true;
        }
      } catch {
        // Continue
      }
    }
  } catch (error) {
    logger.debug('File chooser approach failed', {
      error: (error as Error).message,
    });
  }

  return false;
}

/**
 * Upload a journal entry file to Intacct
 *
 * @param page - Playwright page instance
 * @param options - Upload options including file path
 * @param config - Configuration options
 * @returns UploadResult with success status and details
 */
export async function uploadJournalEntry(
  page: Page,
  options: UploadOptions,
  config: Partial<IntacctConfig> = {}
): Promise<UploadResult> {
  const startTime = Date.now();
  const fullConfig = { ...DEFAULT_INTACCT_CONFIG, ...config };

  logger.info('Starting journal entry upload', {
    filePath: options.filePath,
    expectedEntryCount: options.expectedEntryCount,
  });

  // Initialize result
  const result: UploadResult = {
    success: false,
    entriesCreated: 0,
    warnings: [],
    errors: [],
    timestamp: new Date(),
  };

  try {
    // Check session validity
    const sessionValid = await isSessionValid(page);
    if (!sessionValid) {
      logger.warn('Session is not valid, attempting re-login');
      const credentials = loadCredentials();
      const loginResult = await reLogin(page, credentials, fullConfig);

      if (!loginResult.success) {
        result.errors.push('Session expired and re-login failed');
        return result;
      }
    }

    // Ensure we're on the import page
    const currentUrl = page.url();
    if (!currentUrl.includes('import')) {
      logger.info('Not on import page, navigating');
      const navResult = await navigateToJournalImport(page, fullConfig);

      if (!navResult.success) {
        result.errors.push(`Navigation to import page failed: ${navResult.error}`);
        return result;
      }
    }

    // Take pre-upload screenshot
    const preScreenshot = await takeScreenshot(page, 'pre-upload', fullConfig);
    logger.debug('Pre-upload screenshot taken', { path: preScreenshot });

    // Select the file
    const fileSelected = await selectFile(page, options.filePath, fullConfig);

    if (!fileSelected) {
      result.errors.push('Failed to select file for upload');
      return result;
    }

    // Wait a moment for file to be validated
    await page.waitForTimeout(1000);

    // Click upload/submit button
    const uploadSelectors = getAllSelectorsForElement('upload', 'uploadButton');
    let uploadClicked = false;

    for (const selector of uploadSelectors) {
      try {
        const uploadButton = page.locator(selector).first();
        if (await uploadButton.isVisible({ timeout: 3000 })) {
          await uploadButton.click();
          uploadClicked = true;
          logger.debug('Upload button clicked', { selector });
          break;
        }
      } catch {
        // Try next selector
      }
    }

    if (!uploadClicked) {
      result.errors.push('Failed to click upload button');
      return result;
    }

    // Wait for upload to complete
    const uploadCompletion = await waitForUploadCompletion(page, fullConfig);

    if (!uploadCompletion.success) {
      result.errors.push(uploadCompletion.error ?? 'Upload failed');
    }

    // Check for duplicates
    const duplicateCheck = await checkForDuplicates(page);
    result.duplicatesDetected = duplicateCheck.detected;
    result.duplicateDetails = duplicateCheck.details;

    if (duplicateCheck.detected) {
      result.warnings.push(
        `Duplicate entries detected: ${duplicateCheck.details.length} potential duplicates`
      );
    }

    // Extract results
    result.entriesCreated = await extractEntryCount(page);
    result.journalEntryIds = await extractJournalEntryIds(page);
    result.warnings.push(...await extractWarnings(page));
    result.errors.push(...await extractErrors(page));

    // Determine overall success
    result.success = uploadCompletion.success && result.entriesCreated > 0;

    // Verify against expected count if provided
    if (options.expectedEntryCount !== undefined) {
      if (result.entriesCreated !== options.expectedEntryCount) {
        result.warnings.push(
          `Entry count mismatch: expected ${options.expectedEntryCount}, got ${result.entriesCreated}`
        );
      }
    }

    // Take post-upload screenshot
    result.screenshotPath = await takeScreenshot(page, 'post-upload', fullConfig);

    // Calculate duration
    result.durationMs = Date.now() - startTime;

    logger.info('Upload completed', {
      success: result.success,
      entriesCreated: result.entriesCreated,
      warnings: result.warnings.length,
      errors: result.errors.length,
      durationMs: result.durationMs,
    });

    return result;

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown upload error';
    logger.error('Upload failed with exception', error);

    result.errors.push(errorMessage);
    result.durationMs = Date.now() - startTime;

    // Try to take error screenshot
    try {
      result.screenshotPath = await takeScreenshot(page, 'upload-error', fullConfig);
    } catch {
      // Screenshot failed, continue
    }

    return result;
  }
}

/**
 * Close any upload result dialogs/modals
 */
export async function closeUploadResultDialog(
  page: Page,
  config: Partial<IntacctConfig> = {}
): Promise<boolean> {
  const fullConfig = { ...DEFAULT_INTACCT_CONFIG, ...config };

  // Try to find and click close button
  const closeSelectors = getAllSelectorsForElement('confirmation', 'closeButton');

  for (const selector of closeSelectors) {
    try {
      const closeButton = page.locator(selector).first();
      if (await closeButton.isVisible({ timeout: 2000 })) {
        await closeButton.click();
        await waitForPageLoad(page, fullConfig.defaultTimeout);
        logger.debug('Upload result dialog closed');
        return true;
      }
    } catch {
      // Try next selector
    }
  }

  // Try modal close button
  const modalCloseSelectors = getAllSelectorsForElement('common', 'modalCloseButton');

  for (const selector of modalCloseSelectors) {
    try {
      const closeButton = page.locator(selector).first();
      if (await closeButton.isVisible({ timeout: 2000 })) {
        await closeButton.click();
        await waitForPageLoad(page, fullConfig.defaultTimeout);
        logger.debug('Modal closed');
        return true;
      }
    } catch {
      // Continue
    }
  }

  // Press Escape key as fallback
  try {
    await page.keyboard.press('Escape');
    await page.waitForTimeout(500);
    return true;
  } catch {
    // Continue
  }

  return false;
}

export default uploadJournalEntry;
