/**
 * Sage Intacct Navigation to Journal Entry Import
 *
 * Handles navigation from the dashboard to the journal entry import area:
 * - Navigate through General Ledger menu
 * - Handle menu interactions and submenus
 * - Verify correct page reached before proceeding
 * - Screenshot capture at destination
 * - Config-driven selectors from intacct-selectors.json
 */

import { Page } from 'playwright';
import * as path from 'path';
import * as fs from 'fs';
import { createLogger } from '../utils/logger';
import {
  NavigationResult,
  IntacctConfig,
  DEFAULT_INTACCT_CONFIG,
  IntacctAutomationError,
} from './types';
import {
  getSelectors,
  getAllSelectorsForElement,
  getSelectorTimeout,
  getSelectorGroup,
} from './selectors';
import { isSessionValid, reLogin, loadCredentials } from './login';

const logger = createLogger('intacct:navigate');

/**
 * Expected page indicators for the journal import page
 */
const IMPORT_PAGE_INDICATORS = [
  'Import Journal Entries',
  'Import Journals',
  'Journal Import',
  'Import GL',
];

/**
 * Take a screenshot during navigation
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
 * Wait for element using multiple selector strategies with fallbacks
 */
async function waitForSelectorWithFallbacks(
  page: Page,
  group: 'navigation' | 'journalImport' | 'common',
  selectorKey: string,
  options: { timeout?: number; state?: 'visible' | 'attached' | 'hidden' } = {}
): Promise<ReturnType<Page['locator']> | null> {
  const selectors = getAllSelectorsForElement(group, selectorKey);
  const timeout = options.timeout ?? getSelectorTimeout(group, selectorKey);
  const state = options.state ?? 'visible';

  logger.debug('Waiting for element with fallbacks', {
    group,
    selectorKey,
    selectorCount: selectors.length,
    timeout,
  });

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
      // Try next selector
      logger.debug('Selector not found, trying fallback', { selector });
    }
  }

  logger.warn('No selector matched for element', { group, selectorKey });
  return null;
}

/**
 * Click on element with retry and multiple selector strategies
 */
async function clickWithFallbacks(
  page: Page,
  group: 'navigation' | 'journalImport' | 'common',
  selectorKey: string,
  options: { timeout?: number; force?: boolean } = {}
): Promise<boolean> {
  const selectors = getAllSelectorsForElement(group, selectorKey);
  const timeout = options.timeout ?? getSelectorTimeout(group, selectorKey);

  for (const selector of selectors) {
    try {
      const locator = page.locator(selector);

      // Wait for element to be visible
      await locator.waitFor({ timeout: Math.min(timeout, 5000), state: 'visible' });

      // Scroll into view if needed
      await locator.scrollIntoViewIfNeeded();

      // Click the element
      await locator.click({ force: options.force, timeout: 5000 });

      logger.debug('Successfully clicked element', { selector });
      return true;
    } catch (error) {
      logger.debug('Click failed for selector, trying fallback', {
        selector,
        error: (error as Error).message,
      });
    }
  }

  logger.warn('Failed to click element with any selector', { group, selectorKey });
  return false;
}

/**
 * Wait for any page loading to complete
 */
async function waitForPageLoad(page: Page, timeout: number): Promise<void> {
  try {
    // Wait for network to be idle
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
  } catch (error) {
    logger.debug('Page load wait completed with potential timeout', {
      error: (error as Error).message,
    });
  }
}

/**
 * Verify we're on the correct import page
 */
async function verifyImportPage(page: Page): Promise<boolean> {
  const pageTitle = await page.title();
  const pageContent = await page.content();

  // Check page title
  for (const indicator of IMPORT_PAGE_INDICATORS) {
    if (pageTitle.toLowerCase().includes(indicator.toLowerCase())) {
      logger.info('Import page verified by title', { pageTitle });
      return true;
    }
  }

  // Check page content for indicators
  for (const indicator of IMPORT_PAGE_INDICATORS) {
    if (pageContent.toLowerCase().includes(indicator.toLowerCase())) {
      logger.info('Import page verified by content', { indicator });
      return true;
    }
  }

  // Check for import form elements
  const importFormSelectors = getAllSelectorsForElement('journalImport', 'importForm');
  for (const selector of importFormSelectors) {
    try {
      if (await page.locator(selector).isVisible({ timeout: 2000 })) {
        logger.info('Import page verified by form presence');
        return true;
      }
    } catch {
      // Continue checking
    }
  }

  // Check for file upload input
  const fileInputSelectors = getAllSelectorsForElement('upload', 'fileInput');
  for (const selector of fileInputSelectors) {
    try {
      // File inputs might be hidden, so check for attachment too
      const count = await page.locator(selector).count();
      if (count > 0) {
        logger.info('Import page verified by file input presence');
        return true;
      }
    } catch {
      // Continue checking
    }
  }

  return false;
}

/**
 * Navigate using menu hover/click pattern (dropdown menus)
 */
async function navigateViaMenu(
  page: Page,
  config: IntacctConfig
): Promise<boolean> {
  logger.debug('Attempting navigation via menu system');

  try {
    // First, try to find and hover over General Ledger menu
    const glMenuSelectors = getAllSelectorsForElement('navigation', 'generalLedgerMenu');

    for (const selector of glMenuSelectors) {
      try {
        const menuItem = page.locator(selector).first();
        if (await menuItem.isVisible({ timeout: 5000 })) {
          // Hover to trigger submenu
          await menuItem.hover();
          logger.debug('Hovered over General Ledger menu');

          // Wait for submenu to appear
          await page.waitForTimeout(500);

          // Try to find Import Journal Entries option
          const importSelectors = getAllSelectorsForElement('navigation', 'importJournalEntries');

          for (const importSelector of importSelectors) {
            try {
              const importLink = page.locator(importSelector).first();
              if (await importLink.isVisible({ timeout: 3000 })) {
                await importLink.click();
                logger.debug('Clicked Import Journal Entries link');

                // Wait for page to load
                await waitForPageLoad(page, config.defaultTimeout);
                return true;
              }
            } catch {
              // Try next import selector
            }
          }

          // If direct import link not found, try Journal Entries submenu first
          const journalEntriesSelectors = getAllSelectorsForElement(
            'navigation',
            'journalEntriesMenu'
          );

          for (const jeSelector of journalEntriesSelectors) {
            try {
              const jeMenu = page.locator(jeSelector).first();
              if (await jeMenu.isVisible({ timeout: 2000 })) {
                await jeMenu.hover();
                await page.waitForTimeout(300);

                // Now look for Import option
                for (const importSelector of importSelectors) {
                  try {
                    const importLink = page.locator(importSelector).first();
                    if (await importLink.isVisible({ timeout: 2000 })) {
                      await importLink.click();
                      await waitForPageLoad(page, config.defaultTimeout);
                      return true;
                    }
                  } catch {
                    // Continue trying
                  }
                }
              }
            } catch {
              // Continue
            }
          }
        }
      } catch {
        // Try next GL menu selector
      }
    }

    return false;
  } catch (error) {
    logger.warn('Menu navigation failed', { error: (error as Error).message });
    return false;
  }
}

/**
 * Navigate using direct URL (if known)
 */
async function navigateViaDirectUrl(
  page: Page,
  config: IntacctConfig
): Promise<boolean> {
  logger.debug('Attempting navigation via direct URL');

  // Common Intacct import journal entry URLs
  const possibleUrls = [
    '/ia/acct/glimport.phtml',
    '/ia/acct/import_journal.phtml',
    '/ia/gl/import',
    '/platform/import/journal-entries',
  ];

  const currentUrl = new URL(page.url());
  const baseUrl = `${currentUrl.protocol}//${currentUrl.host}`;

  for (const urlPath of possibleUrls) {
    try {
      const targetUrl = `${baseUrl}${urlPath}`;
      logger.debug('Trying direct URL', { url: targetUrl });

      await page.goto(targetUrl, {
        waitUntil: 'networkidle',
        timeout: config.defaultTimeout,
      });

      // Check if we landed on the right page (not redirected to login/error)
      const newUrl = page.url();
      if (!newUrl.includes('login') && !newUrl.includes('error')) {
        if (await verifyImportPage(page)) {
          logger.info('Successfully navigated via direct URL', { url: targetUrl });
          return true;
        }
      }
    } catch (error) {
      logger.debug('Direct URL navigation failed', {
        url: urlPath,
        error: (error as Error).message,
      });
    }
  }

  return false;
}

/**
 * Navigate using search/quick access feature
 */
async function navigateViaSearch(
  page: Page,
  config: IntacctConfig
): Promise<boolean> {
  logger.debug('Attempting navigation via search/quick access');

  // Try to find a global search box
  const searchSelectors = [
    'input[type="search"]',
    '#global-search',
    '.search-input',
    '[placeholder*="Search"]',
    '[aria-label*="Search"]',
  ];

  for (const selector of searchSelectors) {
    try {
      const searchInput = page.locator(selector).first();
      if (await searchInput.isVisible({ timeout: 3000 })) {
        await searchInput.click();
        await searchInput.fill('Import Journal Entries');
        await page.keyboard.press('Enter');

        await waitForPageLoad(page, config.defaultTimeout);

        // Check if we found results and can click on import
        const importLink = page.locator('a:has-text("Import Journal Entries")').first();
        if (await importLink.isVisible({ timeout: 3000 })) {
          await importLink.click();
          await waitForPageLoad(page, config.defaultTimeout);
          return true;
        }
      }
    } catch {
      // Try next search selector
    }
  }

  return false;
}

/**
 * Main navigation function to reach journal entry import page
 *
 * Tries multiple strategies:
 * 1. Menu navigation (General Ledger > Import Journal Entries)
 * 2. Direct URL navigation
 * 3. Search/quick access
 *
 * @param page - Playwright page instance
 * @param config - Configuration options
 * @returns NavigationResult with success status and details
 */
export async function navigateToJournalImport(
  page: Page,
  config: Partial<IntacctConfig> = {}
): Promise<NavigationResult> {
  const startTime = Date.now();
  const fullConfig = { ...DEFAULT_INTACCT_CONFIG, ...config };

  logger.info('Starting navigation to journal entry import');

  // Check if session is still valid
  const sessionValid = await isSessionValid(page);
  if (!sessionValid) {
    logger.warn('Session is not valid, attempting re-login');

    try {
      const credentials = loadCredentials();
      const loginResult = await reLogin(page, credentials, fullConfig);

      if (!loginResult.success) {
        return {
          success: false,
          error: 'Session expired and re-login failed',
          isCorrectPage: false,
        };
      }
    } catch (error) {
      return {
        success: false,
        error: `Re-login failed: ${(error as Error).message}`,
        isCorrectPage: false,
      };
    }
  }

  try {
    // Strategy 1: Try menu navigation
    logger.info('Attempting menu navigation');
    let navigationSuccessful = await navigateViaMenu(page, fullConfig);

    if (!navigationSuccessful) {
      // Strategy 2: Try direct URL
      logger.info('Menu navigation failed, trying direct URL');
      navigationSuccessful = await navigateViaDirectUrl(page, fullConfig);
    }

    if (!navigationSuccessful) {
      // Strategy 3: Try search
      logger.info('Direct URL failed, trying search');
      navigationSuccessful = await navigateViaSearch(page, fullConfig);
    }

    if (!navigationSuccessful) {
      throw new IntacctAutomationError(
        'Failed to navigate to import page using all strategies',
        'NAVIGATION_FAILED'
      );
    }

    // Verify we're on the correct page
    const isCorrectPage = await verifyImportPage(page);

    if (!isCorrectPage) {
      logger.warn('Navigation completed but page verification failed');
    }

    // Take screenshot
    const screenshotPath = await takeScreenshot(page, 'import-page', fullConfig);

    const currentUrl = page.url();
    const pageTitle = await page.title();
    const duration = Date.now() - startTime;

    logger.info('Navigation completed', {
      duration,
      currentUrl,
      pageTitle,
      isCorrectPage,
    });

    return {
      success: true,
      screenshotPath,
      currentUrl,
      pageTitle,
      isCorrectPage,
    };

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown navigation error';
    logger.error('Navigation failed', error);

    // Take error screenshot
    let screenshotPath: string | undefined;
    try {
      screenshotPath = await takeScreenshot(page, 'navigation-error', fullConfig);
    } catch {
      // Screenshot failed, continue
    }

    return {
      success: false,
      error: errorMessage,
      screenshotPath,
      currentUrl: page.url(),
      pageTitle: await page.title(),
      isCorrectPage: false,
    };
  }
}

/**
 * Navigate back to the dashboard
 */
export async function navigateToDashboard(
  page: Page,
  config: Partial<IntacctConfig> = {}
): Promise<NavigationResult> {
  const fullConfig = { ...DEFAULT_INTACCT_CONFIG, ...config };

  logger.info('Navigating to dashboard');

  try {
    // Try clicking home/dashboard link
    const dashboardSelectors = [
      'a:has-text("Dashboard")',
      'a:has-text("Home")',
      '#home-link',
      '.dashboard-link',
      'a[href*="dashboard"]',
      'a[href="/"]',
    ];

    for (const selector of dashboardSelectors) {
      try {
        const link = page.locator(selector).first();
        if (await link.isVisible({ timeout: 2000 })) {
          await link.click();
          await waitForPageLoad(page, fullConfig.defaultTimeout);

          const dashboardIndicator = await waitForSelectorWithFallbacks(
            page,
            'common',
            'userMenu', // Use user menu as indicator of being on main UI
            { timeout: 5000 }
          );

          if (dashboardIndicator) {
            logger.info('Successfully navigated to dashboard');
            return {
              success: true,
              currentUrl: page.url(),
              pageTitle: await page.title(),
              isCorrectPage: true,
            };
          }
        }
      } catch {
        // Try next selector
      }
    }

    // Fallback: navigate to base URL
    const currentUrl = new URL(page.url());
    const baseUrl = `${currentUrl.protocol}//${currentUrl.host}`;

    await page.goto(baseUrl, {
      waitUntil: 'networkidle',
      timeout: fullConfig.defaultTimeout,
    });

    return {
      success: true,
      currentUrl: page.url(),
      pageTitle: await page.title(),
      isCorrectPage: true,
    };

  } catch (error) {
    logger.error('Failed to navigate to dashboard', error);
    return {
      success: false,
      error: (error as Error).message,
      currentUrl: page.url(),
      isCorrectPage: false,
    };
  }
}

export default navigateToJournalImport;
