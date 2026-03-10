/**
 * Sage Intacct Upload Validation
 *
 * Validates upload results after journal entry import:
 * - Parse confirmation screen
 * - Extract created journal entry IDs
 * - Verify entry counts match expected
 * - Detect and report validation errors from Intacct
 * - Verify debits/credits balance
 */

import { Page } from 'playwright';
import { createLogger } from '../utils/logger';
import {
  ValidationResult,
  ValidationError,
  ValidationWarning,
  JournalEntryConfirmation,
  JournalEntryState,
  UploadResult,
  IntacctConfig,
  DEFAULT_INTACCT_CONFIG,
  IntacctAutomationError,
} from './types';
import {
  getAllSelectorsForElement,
  getSelectorTimeout,
} from './selectors';

const logger = createLogger('intacct:validate');

/**
 * Parse currency string to number
 */
function parseCurrency(value: string | null | undefined): number {
  if (!value) return 0;

  // Remove currency symbols, commas, and whitespace
  const cleaned = value.replace(/[$,\s]/g, '').trim();

  // Handle parentheses for negative numbers
  if (cleaned.startsWith('(') && cleaned.endsWith(')')) {
    return -parseFloat(cleaned.slice(1, -1)) || 0;
  }

  return parseFloat(cleaned) || 0;
}

/**
 * Parse date string to standardized format
 */
function parseDate(value: string | null | undefined): string {
  if (!value) return '';

  // Try to parse common date formats
  const trimmed = value.trim();

  // Already in ISO format
  if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) {
    return trimmed.split('T')[0];
  }

  // MM/DD/YYYY or M/D/YYYY
  const mdyMatch = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (mdyMatch) {
    const [, month, day, year] = mdyMatch;
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  }

  // DD-MM-YYYY or D-M-YYYY
  const dmyMatch = trimmed.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
  if (dmyMatch) {
    const [, day, month, year] = dmyMatch;
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  }

  return trimmed;
}

/**
 * Parse journal entry state from text
 */
function parseEntryState(value: string | null | undefined): JournalEntryState {
  if (!value) return 'Unknown';

  const lower = value.toLowerCase().trim();

  if (lower.includes('posted')) return 'Posted';
  if (lower.includes('approved')) return 'Approved';
  if (lower.includes('submitted')) return 'Submitted';
  if (lower.includes('draft')) return 'Draft';
  if (lower.includes('reversed')) return 'Reversed';

  return 'Unknown';
}

/**
 * Extract journal entry details from results table row
 */
async function parseTableRow(
  row: ReturnType<Page['locator']>
): Promise<Partial<JournalEntryConfirmation>> {
  const entry: Partial<JournalEntryConfirmation> = {};

  try {
    const cells = row.locator('td');
    const cellCount = await cells.count();

    // Extract text from each cell
    const cellTexts: string[] = [];
    for (let i = 0; i < cellCount; i++) {
      const text = await cells.nth(i).textContent();
      cellTexts.push(text?.trim() ?? '');
    }

    // Try to identify columns by content patterns
    for (const text of cellTexts) {
      // Journal number pattern
      if (/^(?:JE-?|GJ-?)?\d{4,}$/.test(text) && !entry.journalNumber) {
        entry.journalNumber = text;
        continue;
      }

      // Record number (pure numeric)
      if (/^\d+$/.test(text) && !entry.recordNo) {
        entry.recordNo = text;
        continue;
      }

      // Date pattern
      if (/^\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}$/.test(text) && !entry.entryDate) {
        entry.entryDate = parseDate(text);
        continue;
      }

      // Currency pattern for amounts
      if (/^[\$\-\d,.\(\)]+$/.test(text) && text.length > 0) {
        const amount = parseCurrency(text);
        if (amount > 0 && !entry.totalDebit) {
          entry.totalDebit = amount;
        } else if (amount > 0 && !entry.totalCredit) {
          entry.totalCredit = amount;
        }
        continue;
      }

      // State pattern
      const state = parseEntryState(text);
      if (state !== 'Unknown' && !entry.state) {
        entry.state = state;
        continue;
      }

      // Symbol (short text like "GJ")
      if (text.length <= 5 && /^[A-Z]+$/.test(text) && !entry.symbol) {
        entry.symbol = text;
        continue;
      }

      // Description (longer text that doesn't match other patterns)
      if (text.length > 10 && !entry.description) {
        entry.description = text;
      }
    }
  } catch (error) {
    logger.debug('Error parsing table row', { error: (error as Error).message });
  }

  return entry;
}

/**
 * Extract entries from results table
 */
async function extractEntriesFromTable(
  page: Page
): Promise<JournalEntryConfirmation[]> {
  const entries: JournalEntryConfirmation[] = [];
  const tableSelectors = getAllSelectorsForElement('confirmation', 'resultsTable');

  for (const selector of tableSelectors) {
    try {
      const table = page.locator(selector).first();
      if (await table.isVisible({ timeout: 3000 })) {
        const rows = table.locator('tbody tr');
        const rowCount = await rows.count();

        logger.debug('Found results table', { rowCount, selector });

        for (let i = 0; i < rowCount; i++) {
          const row = rows.nth(i);
          const partialEntry = await parseTableRow(row);

          // Only add if we have at least journal number or record number
          if (partialEntry.journalNumber || partialEntry.recordNo) {
            entries.push({
              recordNo: partialEntry.recordNo ?? '',
              journalNumber: partialEntry.journalNumber ?? '',
              symbol: partialEntry.symbol ?? 'GJ',
              entryDate: partialEntry.entryDate ?? '',
              description: partialEntry.description ?? '',
              totalDebit: partialEntry.totalDebit ?? 0,
              totalCredit: partialEntry.totalCredit ?? 0,
              lineCount: partialEntry.lineCount ?? 0,
              state: partialEntry.state ?? 'Unknown',
              entity: partialEntry.entity,
            });
          }
        }

        if (entries.length > 0) {
          return entries;
        }
      }
    } catch (error) {
      logger.debug('Error extracting from table', {
        selector,
        error: (error as Error).message,
      });
    }
  }

  return entries;
}

/**
 * Extract entries from page content when table is not available
 */
async function extractEntriesFromContent(
  page: Page
): Promise<JournalEntryConfirmation[]> {
  const entries: JournalEntryConfirmation[] = [];

  try {
    const pageContent = await page.content();

    // Find all journal entry patterns
    const jePatterns = [
      /(?:Journal Entry|JE)\s*#?\s*:?\s*(\d+)/gi,
      /(?:Record No|Record #)\s*:?\s*(\d+)/gi,
    ];

    const foundIds = new Set<string>();

    for (const pattern of jePatterns) {
      let match;
      while ((match = pattern.exec(pageContent)) !== null) {
        foundIds.add(match[1]);
      }
    }

    for (const id of foundIds) {
      entries.push({
        recordNo: id,
        journalNumber: `JE-${id}`,
        symbol: 'GJ',
        entryDate: '',
        description: 'Extracted from page content',
        totalDebit: 0,
        totalCredit: 0,
        lineCount: 0,
        state: 'Unknown',
      });
    }
  } catch (error) {
    logger.debug('Error extracting entries from content', {
      error: (error as Error).message,
    });
  }

  return entries;
}

/**
 * Extract validation errors from the page
 */
async function extractValidationErrors(page: Page): Promise<ValidationError[]> {
  const errors: ValidationError[] = [];
  const errorSelectors = getAllSelectorsForElement('confirmation', 'errorMessage');

  for (const selector of errorSelectors) {
    try {
      const elements = page.locator(selector);
      const count = await elements.count();

      for (let i = 0; i < count; i++) {
        const element = elements.nth(i);
        const text = await element.textContent();

        if (text && text.trim()) {
          // Try to parse error details
          const lineMatch = text.match(/(?:line|row)\s*(\d+)/i);
          const fieldMatch = text.match(/(?:field|column)\s*[:\s]*(\w+)/i);
          const codeMatch = text.match(/(?:error\s*code|code)\s*[:\s]*(\w+)/i);

          errors.push({
            code: codeMatch?.[1] ?? 'UNKNOWN',
            message: text.trim(),
            lineNumber: lineMatch ? parseInt(lineMatch[1], 10) : undefined,
            field: fieldMatch?.[1],
          });
        }
      }
    } catch {
      // Continue
    }
  }

  return errors;
}

/**
 * Extract validation warnings from the page
 */
async function extractValidationWarnings(page: Page): Promise<ValidationWarning[]> {
  const warnings: ValidationWarning[] = [];
  const warningSelectors = getAllSelectorsForElement('confirmation', 'warningMessage');

  for (const selector of warningSelectors) {
    try {
      const elements = page.locator(selector);
      const count = await elements.count();

      for (let i = 0; i < count; i++) {
        const element = elements.nth(i);
        const text = await element.textContent();

        if (text && text.trim()) {
          const lineMatch = text.match(/(?:line|row)\s*(\d+)/i);
          const codeMatch = text.match(/(?:warning\s*code|code)\s*[:\s]*(\w+)/i);

          warnings.push({
            code: codeMatch?.[1] ?? 'UNKNOWN',
            message: text.trim(),
            lineNumber: lineMatch ? parseInt(lineMatch[1], 10) : undefined,
          });
        }
      }
    } catch {
      // Continue
    }
  }

  return warnings;
}

/**
 * Validate uploaded journal entries
 *
 * @param page - Playwright page instance
 * @param uploadResult - Result from the upload operation
 * @param expectedCount - Expected number of entries (optional)
 * @param config - Configuration options
 * @returns ValidationResult with details about the uploaded entries
 */
export async function validateUpload(
  page: Page,
  uploadResult: UploadResult,
  expectedCount?: number,
  config: Partial<IntacctConfig> = {}
): Promise<ValidationResult> {
  const fullConfig = { ...DEFAULT_INTACCT_CONFIG, ...config };

  logger.info('Starting upload validation', {
    uploadSuccess: uploadResult.success,
    reportedEntriesCreated: uploadResult.entriesCreated,
    expectedCount,
  });

  // Initialize result
  const result: ValidationResult = {
    isValid: false,
    errors: [],
    warnings: [],
    entryCount: 0,
    entries: [],
    totalDebits: 0,
    totalCredits: 0,
    isBalanced: false,
  };

  try {
    // If upload was not successful, add error and return
    if (!uploadResult.success) {
      result.errors.push({
        code: 'UPLOAD_FAILED',
        message: `Upload failed: ${uploadResult.errors.join('; ') || 'Unknown error'}`,
      });

      // Still try to extract any partial results
      result.errors.push(...await extractValidationErrors(page));
      result.warnings.push(...await extractValidationWarnings(page));

      return result;
    }

    // Extract entries from results table
    let entries = await extractEntriesFromTable(page);

    // Fallback to content extraction if table didn't work
    if (entries.length === 0) {
      entries = await extractEntriesFromContent(page);
    }

    // If we still have no entries but upload reported success, use IDs from upload result
    if (entries.length === 0 && uploadResult.journalEntryIds?.length) {
      entries = uploadResult.journalEntryIds.map(id => ({
        recordNo: id,
        journalNumber: `JE-${id}`,
        symbol: 'GJ',
        entryDate: new Date().toISOString().split('T')[0],
        description: 'Created via import',
        totalDebit: 0,
        totalCredit: 0,
        lineCount: 0,
        state: 'Posted' as JournalEntryState,
      }));
    }

    result.entries = entries;
    result.entryCount = entries.length;

    // Calculate totals
    result.totalDebits = entries.reduce((sum, e) => sum + (e.totalDebit || 0), 0);
    result.totalCredits = entries.reduce((sum, e) => sum + (e.totalCredit || 0), 0);

    // Check balance (with small tolerance for floating point)
    const tolerance = 0.01;
    result.isBalanced = Math.abs(result.totalDebits - result.totalCredits) < tolerance;

    if (!result.isBalanced && result.totalDebits > 0) {
      result.warnings.push({
        code: 'UNBALANCED',
        message: `Debits (${result.totalDebits}) and credits (${result.totalCredits}) do not balance`,
        suggestion: 'Verify the journal entries balance in Intacct',
      });
    }

    // Extract any validation errors from page
    const pageErrors = await extractValidationErrors(page);
    result.errors.push(...pageErrors);

    // Extract warnings
    const pageWarnings = await extractValidationWarnings(page);
    result.warnings.push(...pageWarnings);

    // Add warnings from upload result
    for (const warning of uploadResult.warnings) {
      result.warnings.push({
        code: 'UPLOAD_WARNING',
        message: warning,
      });
    }

    // Validate entry count if expected count provided
    if (expectedCount !== undefined) {
      if (result.entryCount !== expectedCount) {
        result.warnings.push({
          code: 'COUNT_MISMATCH',
          message: `Expected ${expectedCount} entries but found ${result.entryCount}`,
          suggestion: 'Verify all entries were imported correctly',
        });
      }
    }

    // Cross-check with upload result
    if (uploadResult.entriesCreated !== result.entryCount && result.entryCount > 0) {
      result.warnings.push({
        code: 'COUNT_DISCREPANCY',
        message: `Upload reported ${uploadResult.entriesCreated} entries but validation found ${result.entryCount}`,
      });
    }

    // Handle duplicate warnings
    if (uploadResult.duplicatesDetected) {
      result.warnings.push({
        code: 'DUPLICATES_DETECTED',
        message: `${uploadResult.duplicateDetails?.length ?? 'Some'} potential duplicate entries detected`,
        suggestion: 'Review entries to ensure no unintended duplicates',
      });
    }

    // Determine overall validity
    result.isValid =
      result.errors.length === 0 &&
      result.entryCount > 0 &&
      (expectedCount === undefined || result.entryCount === expectedCount);

    logger.info('Validation completed', {
      isValid: result.isValid,
      entryCount: result.entryCount,
      errorCount: result.errors.length,
      warningCount: result.warnings.length,
      totalDebits: result.totalDebits,
      totalCredits: result.totalCredits,
      isBalanced: result.isBalanced,
    });

    return result;

  } catch (error) {
    logger.error('Validation failed with exception', error);

    result.errors.push({
      code: 'VALIDATION_ERROR',
      message: `Validation failed: ${(error as Error).message}`,
    });

    return result;
  }
}

/**
 * Verify specific journal entry was created
 *
 * @param page - Playwright page instance
 * @param journalNumber - Journal entry number to verify
 * @returns Whether the entry was found
 */
export async function verifyJournalEntry(
  page: Page,
  journalNumber: string
): Promise<boolean> {
  logger.debug('Verifying journal entry', { journalNumber });

  try {
    // Check in results table
    const idSelectors = getAllSelectorsForElement('confirmation', 'journalEntryIds');

    for (const selector of idSelectors) {
      try {
        const elements = page.locator(selector);
        const count = await elements.count();

        for (let i = 0; i < count; i++) {
          const text = await elements.nth(i).textContent();
          if (text && text.includes(journalNumber)) {
            logger.debug('Journal entry found in results', { journalNumber });
            return true;
          }
        }
      } catch {
        // Continue
      }
    }

    // Check page content
    const pageContent = await page.content();
    if (pageContent.includes(journalNumber)) {
      logger.debug('Journal entry found in page content', { journalNumber });
      return true;
    }

    logger.warn('Journal entry not found', { journalNumber });
    return false;

  } catch (error) {
    logger.error('Error verifying journal entry', error, { journalNumber });
    return false;
  }
}

/**
 * Generate validation report as formatted string
 */
export function generateValidationReport(result: ValidationResult): string {
  const lines: string[] = [];

  lines.push('=== Journal Entry Upload Validation Report ===');
  lines.push('');
  lines.push(`Overall Status: ${result.isValid ? 'VALID' : 'INVALID'}`);
  lines.push(`Entries Created: ${result.entryCount}`);
  lines.push(`Total Debits: $${result.totalDebits.toFixed(2)}`);
  lines.push(`Total Credits: $${result.totalCredits.toFixed(2)}`);
  lines.push(`Balanced: ${result.isBalanced ? 'Yes' : 'No'}`);
  lines.push('');

  if (result.entries.length > 0) {
    lines.push('--- Created Entries ---');
    for (const entry of result.entries) {
      lines.push(
        `  ${entry.journalNumber || entry.recordNo} | ${entry.entryDate} | ` +
        `${entry.state} | $${entry.totalDebit.toFixed(2)} / $${entry.totalCredit.toFixed(2)}`
      );
    }
    lines.push('');
  }

  if (result.errors.length > 0) {
    lines.push('--- Errors ---');
    for (const error of result.errors) {
      const lineInfo = error.lineNumber ? ` (line ${error.lineNumber})` : '';
      const fieldInfo = error.field ? ` [${error.field}]` : '';
      lines.push(`  [${error.code}]${lineInfo}${fieldInfo}: ${error.message}`);
    }
    lines.push('');
  }

  if (result.warnings.length > 0) {
    lines.push('--- Warnings ---');
    for (const warning of result.warnings) {
      const lineInfo = warning.lineNumber ? ` (line ${warning.lineNumber})` : '';
      lines.push(`  [${warning.code}]${lineInfo}: ${warning.message}`);
      if (warning.suggestion) {
        lines.push(`    Suggestion: ${warning.suggestion}`);
      }
    }
    lines.push('');
  }

  lines.push('='.repeat(45));

  return lines.join('\n');
}

export default validateUpload;
