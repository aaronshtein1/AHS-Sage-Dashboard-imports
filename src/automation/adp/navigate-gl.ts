/**
 * ADP GL Navigation Module
 *
 * Handles navigation from the ADP dashboard to the General Ledger / Payroll Reports section.
 * Features:
 * - Config-driven selectors from adp-selectors.json
 * - Popup window handling
 * - Page verification
 * - Screenshot capture at GL reporting page
 */

import type { Page, BrowserContext } from 'playwright';
import { existsSync, mkdirSync } from 'fs';
import { resolve } from 'path';
import { createLogger } from '../utils/logger';
import {
  type NavigationResult,
  type ADPConfig,
  DEFAULT_ADP_CONFIG,
  ADPAutomationError,
} from './types';
import {
  getNavigationSelectors,
  getGLReportsSelectors,
  getPopupSelectors,
  getPlaywrightSelectors,
  getTimeouts,
  type SelectorWithFallbacks,
} from './selectors';
import { ensureLoggedIn, updateSessionActivity } from './login';

const logger = createLogger('adp:navigate-gl');

// ==================== ELEMENT INTERACTION ====================

/**
 * Find an element using a selector with fallbacks
 * Tries each selector in order until one works
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
      // Try next selector
      continue;
    }
  }

  logger.warn(`Element not found: ${selectorDef.description}`);
  return null;
}

/**
 * Click an element and wait for navigation or specific condition
 */
async function clickAndWait(
  page: Page,
  selectorDef: SelectorWithFallbacks,
  options: {
    waitForNavigation?: boolean;
    waitForSelector?: SelectorWithFallbacks;
    timeout?: number;
  } = {}
): Promise<boolean> {
  const { waitForNavigation = true, waitForSelector, timeout = 30000 } = options;
  const timeouts = getTimeouts();

  const element = await findElement(page, selectorDef, timeouts.elementWait);
  if (!element) {
    return false;
  }

  try {
    if (waitForNavigation) {
      // Click and wait for navigation
      await Promise.all([
        page.waitForLoadState('networkidle', { timeout }),
        element.click(),
      ]);
    } else if (waitForSelector) {
      // Click and wait for specific element
      const targetSelectors = getPlaywrightSelectors(waitForSelector);
      await Promise.all([
        page.waitForSelector(targetSelectors[0], { state: 'visible', timeout }),
        element.click(),
      ]);
    } else {
      await element.click();
    }

    logger.debug(`Clicked: ${selectorDef.description}`);
    return true;
  } catch (error) {
    logger.error(`Failed to click: ${selectorDef.description}`, error);
    return false;
  }
}

// ==================== POPUP HANDLING ====================

/**
 * Handle popup windows that may appear during navigation
 */
async function handlePopups(
  page: Page,
  context: BrowserContext
): Promise<void> {
  const popupSelectors = getPopupSelectors();
  const timeouts = getTimeouts();

  // Close any modal dialogs
  const closeButton = await findElement(page, popupSelectors.closeButton, timeouts.shortWait);
  if (closeButton) {
    try {
      await closeButton.click();
      logger.debug('Closed popup modal');
      await page.waitForTimeout(500);
    } catch {
      // Ignore if close fails
    }
  }

  // Handle any new browser windows/tabs that opened
  // Listen for new pages and handle them
  const pages = context.pages();
  if (pages.length > 1) {
    logger.info('Multiple pages detected, handling popups', { count: pages.length });

    // Find the main page (usually the first one)
    for (let i = 1; i < pages.length; i++) {
      const popupPage = pages[i];
      const popupUrl = popupPage.url();

      // Check if this is an ad or unwanted popup
      if (
        popupUrl.includes('about:blank') ||
        popupUrl.includes('ads') ||
        popupUrl.includes('popup')
      ) {
        logger.debug('Closing unwanted popup', { url: popupUrl });
        await popupPage.close();
      }
    }
  }
}

/**
 * Set up popup handler for the context
 */
export function setupPopupHandler(context: BrowserContext): void {
  context.on('page', async (page) => {
    const url = page.url();
    logger.debug('New page opened', { url });

    // Auto-close known popup patterns
    if (
      url.includes('about:blank') ||
      url.includes('/ads/') ||
      url.includes('popup')
    ) {
      logger.info('Auto-closing popup', { url });
      await page.close();
    }
  });
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

  // Ensure directory exists
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

// ==================== PAGE VERIFICATION ====================

/**
 * Verify that we're on the GL Reports page
 */
async function verifyGLReportsPage(page: Page): Promise<boolean> {
  const glSelectors = getGLReportsSelectors();
  const timeouts = getTimeouts();

  // Check for page header
  const pageHeader = await findElement(page, glSelectors.pageHeader, timeouts.elementWait);
  if (pageHeader) {
    logger.debug('GL Reports page verified via header');
    return true;
  }

  // Check for payroll runs table as backup verification
  const runsTable = await findElement(page, glSelectors.payrollRunsTable, timeouts.shortWait);
  if (runsTable) {
    logger.debug('GL Reports page verified via payroll runs table');
    return true;
  }

  // Check URL patterns
  const currentUrl = page.url().toLowerCase();
  const glUrlPatterns = [
    'general-ledger',
    'gl-reports',
    'payroll-reports',
    'journal-entries',
    'gl/',
  ];

  for (const pattern of glUrlPatterns) {
    if (currentUrl.includes(pattern)) {
      logger.debug('GL Reports page verified via URL pattern', { pattern });
      return true;
    }
  }

  return false;
}

/**
 * Check current page title and URL
 */
async function getPageInfo(page: Page): Promise<{ title: string; url: string }> {
  return {
    title: await page.title(),
    url: page.url(),
  };
}

// ==================== NAVIGATION STEPS ====================

/**
 * Navigate to the Reports menu
 */
async function navigateToReportsMenu(page: Page): Promise<boolean> {
  const navSelectors = getNavigationSelectors();

  logger.info('Navigating to Reports menu');

  const clicked = await clickAndWait(page, navSelectors.reportsMenu, {
    waitForNavigation: false,
    timeout: 10000,
  });

  if (!clicked) {
    logger.error('Failed to click Reports menu');
    return false;
  }

  // Wait for submenu to appear
  await page.waitForTimeout(1000);
  return true;
}

/**
 * Navigate to Payroll section
 */
async function navigateToPayroll(page: Page): Promise<boolean> {
  const navSelectors = getNavigationSelectors();

  logger.info('Navigating to Payroll section');

  const clicked = await clickAndWait(page, navSelectors.payrollLink, {
    waitForNavigation: true,
    timeout: 15000,
  });

  if (!clicked) {
    logger.error('Failed to click Payroll link');
    return false;
  }

  return true;
}

/**
 * Navigate to General Ledger Reports
 */
async function navigateToGLReports(page: Page): Promise<boolean> {
  const navSelectors = getNavigationSelectors();

  logger.info('Navigating to General Ledger Reports');

  const clicked = await clickAndWait(page, navSelectors.glReportsLink, {
    waitForNavigation: true,
    timeout: 15000,
  });

  if (!clicked) {
    // Try alternate path: Journal Entries link
    logger.info('Trying alternate navigation path via Journal Entries');
    const altClicked = await clickAndWait(page, navSelectors.journalEntriesLink, {
      waitForNavigation: true,
      timeout: 15000,
    });

    if (!altClicked) {
      logger.error('Failed to navigate to GL Reports via any path');
      return false;
    }
  }

  return true;
}

// ==================== MAIN NAVIGATION FUNCTION ====================

/**
 * Navigate from ADP dashboard to GL Reports page
 *
 * @param page - Playwright page instance
 * @param context - Browser context for popup handling
 * @param config - Optional configuration overrides
 * @returns NavigationResult with success status and details
 */
export async function navigateToGLReporting(
  page: Page,
  context: BrowserContext,
  config: Partial<ADPConfig> = {}
): Promise<NavigationResult> {
  const fullConfig: ADPConfig = { ...DEFAULT_ADP_CONFIG, ...config };
  const timeouts = getTimeouts();

  logger.info('Starting navigation to GL Reporting area');

  try {
    // Ensure we're logged in
    const loginResult = await ensureLoggedIn(page, config);
    if (!loginResult.success) {
      return {
        success: false,
        currentUrl: page.url(),
        atExpectedPage: false,
        error: `Login failed: ${loginResult.message}`,
      };
    }

    // Handle any initial popups
    await handlePopups(page, context);

    // Step 1: Navigate to Reports menu
    const reportsMenuSuccess = await navigateToReportsMenu(page);
    if (!reportsMenuSuccess) {
      const screenshotPath = await takeScreenshot(page, 'nav-reports-menu-failed', fullConfig);
      return {
        success: false,
        currentUrl: page.url(),
        atExpectedPage: false,
        error: 'Failed to open Reports menu',
        screenshotPath,
      };
    }

    // Handle any popups after menu click
    await handlePopups(page, context);

    // Step 2: Navigate to Payroll section
    const payrollSuccess = await navigateToPayroll(page);
    if (!payrollSuccess) {
      // Try direct GL navigation if Payroll isn't found
      logger.info('Payroll section not found, attempting direct GL navigation');
    }

    // Handle any popups
    await handlePopups(page, context);

    // Step 3: Navigate to GL Reports
    const glSuccess = await navigateToGLReports(page);
    if (!glSuccess) {
      const screenshotPath = await takeScreenshot(page, 'nav-gl-reports-failed', fullConfig);
      return {
        success: false,
        currentUrl: page.url(),
        atExpectedPage: false,
        error: 'Failed to navigate to GL Reports',
        screenshotPath,
      };
    }

    // Handle any popups that appeared after navigation
    await handlePopups(page, context);

    // Wait for page to fully load
    await page.waitForLoadState('networkidle', { timeout: timeouts.pageLoad });

    // Verify we're on the correct page
    const isCorrectPage = await verifyGLReportsPage(page);
    if (!isCorrectPage) {
      const screenshotPath = await takeScreenshot(page, 'nav-verification-failed', fullConfig);
      const pageInfo = await getPageInfo(page);

      logger.warn('Navigation completed but page verification failed', pageInfo);

      return {
        success: false,
        currentUrl: pageInfo.url,
        atExpectedPage: false,
        pageTitle: pageInfo.title,
        error: 'Page verification failed - not on GL Reports page',
        screenshotPath,
      };
    }

    // Update session activity
    updateSessionActivity();

    // Take success screenshot
    const screenshotPath = await takeScreenshot(page, 'gl-reports-page', fullConfig);
    const pageInfo = await getPageInfo(page);

    logger.info('Successfully navigated to GL Reports page', pageInfo);

    return {
      success: true,
      currentUrl: pageInfo.url,
      atExpectedPage: true,
      pageTitle: pageInfo.title,
      screenshotPath,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error('Navigation failed with exception', error);

    const screenshotPath = await takeScreenshot(page, 'nav-exception', fullConfig);

    return {
      success: false,
      currentUrl: page.url(),
      atExpectedPage: false,
      error: errorMessage,
      screenshotPath,
    };
  }
}

/**
 * Quick navigation directly to GL Reports via URL if known
 * Use this when you have a direct URL to the GL Reports page
 */
export async function navigateDirectToGL(
  page: Page,
  glReportsUrl: string,
  config: Partial<ADPConfig> = {}
): Promise<NavigationResult> {
  const fullConfig: ADPConfig = { ...DEFAULT_ADP_CONFIG, ...config };
  const timeouts = getTimeouts();

  logger.info('Direct navigation to GL Reports', { url: glReportsUrl });

  try {
    // Ensure we're logged in first
    const loginResult = await ensureLoggedIn(page, config);
    if (!loginResult.success) {
      return {
        success: false,
        currentUrl: page.url(),
        atExpectedPage: false,
        error: `Login failed: ${loginResult.message}`,
      };
    }

    // Navigate directly
    await page.goto(glReportsUrl, {
      waitUntil: 'networkidle',
      timeout: timeouts.pageLoad,
    });

    // Verify we're on the correct page
    const isCorrectPage = await verifyGLReportsPage(page);
    const pageInfo = await getPageInfo(page);

    if (!isCorrectPage) {
      const screenshotPath = await takeScreenshot(page, 'direct-nav-failed', fullConfig);
      return {
        success: false,
        currentUrl: pageInfo.url,
        atExpectedPage: false,
        pageTitle: pageInfo.title,
        error: 'Direct navigation failed - page verification unsuccessful',
        screenshotPath,
      };
    }

    updateSessionActivity();
    const screenshotPath = await takeScreenshot(page, 'gl-reports-direct', fullConfig);

    logger.info('Direct navigation successful', pageInfo);

    return {
      success: true,
      currentUrl: pageInfo.url,
      atExpectedPage: true,
      pageTitle: pageInfo.title,
      screenshotPath,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error('Direct navigation failed', error);

    const screenshotPath = await takeScreenshot(page, 'direct-nav-exception', fullConfig);

    return {
      success: false,
      currentUrl: page.url(),
      atExpectedPage: false,
      error: errorMessage,
      screenshotPath,
    };
  }
}

// ==================== EXPORTS ====================

export {
  verifyGLReportsPage,
  handlePopups,
  type NavigationResult,
};
