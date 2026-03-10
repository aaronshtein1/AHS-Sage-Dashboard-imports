/**
 * ADP Login Automation
 *
 * Handles browser-based login to ADP Workforce Now with:
 * - Environment-based credentials (never hardcoded)
 * - MFA detection and manual completion pause
 * - Retry logic with exponential backoff
 * - Session timeout detection and re-login
 * - Resilient selectors with fallbacks
 */

import type { Page, Browser, BrowserContext } from 'playwright';
import { chromium } from 'playwright';
import { existsSync, mkdirSync } from 'fs';
import { resolve, dirname } from 'path';
import { createLogger } from '../utils/logger';
import {
  type ADPCredentials,
  type LoginResult,
  type SessionState,
  type ADPConfig,
  DEFAULT_ADP_CONFIG,
  ADPAutomationError,
} from './types';
import {
  loadSelectorConfig,
  getLoginSelectors,
  getMFAIndicators,
  getDashboardSelectors,
  getSessionIndicators,
  getPlaywrightSelectors,
  getTimeouts,
  type SelectorWithFallbacks,
} from './selectors';

const logger = createLogger('adp:login');

// ==================== CREDENTIAL LOADING ====================

/**
 * Load ADP credentials from environment variables
 * @throws Error if required credentials are missing
 */
export function loadCredentials(): ADPCredentials {
  const username = process.env.ADP_USERNAME;
  const password = process.env.ADP_PASSWORD;
  const loginUrl = process.env.ADP_LOGIN_URL || DEFAULT_ADP_CONFIG.loginUrl;

  if (!username) {
    throw new ADPAutomationError(
      'ADP_USERNAME environment variable is not set',
      'LOGIN_FAILED',
      { missingVar: 'ADP_USERNAME' }
    );
  }

  if (!password) {
    throw new ADPAutomationError(
      'ADP_PASSWORD environment variable is not set',
      'LOGIN_FAILED',
      { missingVar: 'ADP_PASSWORD' }
    );
  }

  logger.debug('Credentials loaded from environment variables');

  return {
    username,
    password,
    loginUrl,
  };
}

// ==================== SESSION MANAGEMENT ====================

/**
 * Track the current session state
 */
let currentSession: SessionState = {
  isLoggedIn: false,
  isExpired: false,
};

/**
 * Get the current session state
 */
export function getSessionState(): SessionState {
  return { ...currentSession };
}

/**
 * Update session activity timestamp
 */
export function updateSessionActivity(): void {
  if (currentSession.isLoggedIn) {
    currentSession.lastActivityAt = new Date();
  }
}

/**
 * Check if session has timed out
 */
export function isSessionExpired(config: ADPConfig = DEFAULT_ADP_CONFIG): boolean {
  if (!currentSession.isLoggedIn || !currentSession.lastActivityAt) {
    return true;
  }

  const elapsed = Date.now() - currentSession.lastActivityAt.getTime();
  return elapsed > config.sessionTimeout;
}

/**
 * Clear the current session
 */
export function clearSession(): void {
  currentSession = {
    isLoggedIn: false,
    isExpired: true,
  };
  logger.info('Session cleared');
}

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
      // Wait briefly for element to be visible
      await locator.waitFor({ state: 'visible', timeout: Math.min(timeout, 5000) });
      logger.debug(`Found element with selector: ${selector}`, {
        description: selectorDef.description,
      });
      return locator;
    } catch {
      // Try next selector
      continue;
    }
  }

  logger.warn(`Could not find element: ${selectorDef.description}`, {
    triedSelectors: selectors.length,
  });
  return null;
}

/**
 * Wait for any of the given selectors to appear
 */
async function waitForAnySelector(
  page: Page,
  selectors: string[],
  timeout: number
): Promise<string | null> {
  const promises = selectors.map(async (selector) => {
    try {
      await page.locator(selector).waitFor({ state: 'visible', timeout });
      return selector;
    } catch {
      return null;
    }
  });

  // Race to see which selector appears first
  const results = await Promise.race([
    Promise.any(promises.filter(p => p !== null)),
    new Promise<null>((resolve) => setTimeout(() => resolve(null), timeout)),
  ]);

  return results;
}

// ==================== MFA HANDLING ====================

/**
 * Check if the current page is an MFA prompt
 */
async function isMFAPage(page: Page): Promise<boolean> {
  const mfaIndicators = getMFAIndicators();
  const currentUrl = page.url();

  // Check URL patterns
  for (const pattern of mfaIndicators.urlPatterns) {
    if (currentUrl.includes(pattern)) {
      logger.info('MFA detected via URL pattern', { pattern, url: currentUrl });
      return true;
    }
  }

  // Check for MFA page elements
  for (const selector of mfaIndicators.pageSelectors) {
    try {
      const element = page.locator(selector);
      const isVisible = await element.isVisible();
      if (isVisible) {
        logger.info('MFA detected via page selector', { selector });
        return true;
      }
    } catch {
      // Selector not found, continue
    }
  }

  // Check for MFA text patterns
  const pageContent = await page.content();
  for (const textPattern of mfaIndicators.textPatterns) {
    if (pageContent.includes(textPattern)) {
      logger.info('MFA detected via text pattern', { pattern: textPattern });
      return true;
    }
  }

  return false;
}

/**
 * Wait for user to complete MFA manually
 * Pauses execution and prompts user to complete MFA
 */
async function waitForMFACompletion(
  page: Page,
  config: ADPConfig
): Promise<boolean> {
  const mfaTimeout = getTimeouts().mfaWait;

  logger.info('MFA required - waiting for manual completion', {
    timeoutSeconds: mfaTimeout / 1000,
  });

  // Log instructions for the user
  console.log('\n' + '='.repeat(60));
  console.log('MFA VERIFICATION REQUIRED');
  console.log('='.repeat(60));
  console.log('Please complete the MFA verification in the browser window.');
  console.log('The automation will resume once you reach the dashboard.');
  console.log(`Timeout: ${mfaTimeout / 1000} seconds`);
  console.log('='.repeat(60) + '\n');

  const dashboardSelectors = getDashboardSelectors();
  const startTime = Date.now();

  // Poll for dashboard to appear (indicating MFA complete)
  while (Date.now() - startTime < mfaTimeout) {
    // Check if we've left the MFA page
    const stillOnMFA = await isMFAPage(page);
    if (!stillOnMFA) {
      // Check if we're on the dashboard
      const dashboardElement = await findElement(
        page,
        dashboardSelectors.mainContainer,
        5000
      );
      if (dashboardElement) {
        logger.info('MFA completed successfully - dashboard detected');
        return true;
      }
    }

    // Wait a bit before checking again
    await page.waitForTimeout(2000);
  }

  logger.error('MFA completion timed out', {
    elapsed: Date.now() - startTime,
    timeout: mfaTimeout,
  });
  return false;
}

// ==================== SESSION TIMEOUT DETECTION ====================

/**
 * Check if we're on a session timeout/login required page
 */
async function isSessionExpiredPage(page: Page): Promise<boolean> {
  const sessionIndicators = getSessionIndicators();
  const currentUrl = page.url();

  // Check URL patterns
  for (const pattern of sessionIndicators.loginPageIndicators) {
    if (currentUrl.includes(pattern)) {
      logger.debug('Session expired - redirected to login page', { url: currentUrl });
      return true;
    }
  }

  // Check for session expired modal
  try {
    const modalSelectors = getPlaywrightSelectors(sessionIndicators.sessionExpiredModal);
    for (const selector of modalSelectors) {
      const element = page.locator(selector);
      const isVisible = await element.isVisible();
      if (isVisible) {
        logger.debug('Session expired - modal detected');
        return true;
      }
    }
  } catch {
    // Element not found
  }

  // Check for session expired text
  const pageContent = await page.content();
  for (const text of sessionIndicators.loginRequiredText) {
    if (pageContent.includes(text)) {
      logger.debug('Session expired - text pattern detected', { pattern: text });
      return true;
    }
  }

  return false;
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

// ==================== RETRY LOGIC ====================

/**
 * Calculate exponential backoff delay
 */
function getBackoffDelay(attempt: number, baseDelay: number): number {
  // Exponential backoff with jitter: baseDelay * 2^attempt + random jitter
  const exponentialDelay = baseDelay * Math.pow(2, attempt);
  const jitter = Math.random() * baseDelay;
  return exponentialDelay + jitter;
}

/**
 * Sleep for specified milliseconds
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ==================== LOGIN IMPLEMENTATION ====================

/**
 * Perform login with the given credentials
 */
async function performLogin(
  page: Page,
  credentials: ADPCredentials,
  config: ADPConfig
): Promise<LoginResult> {
  const loginSelectors = getLoginSelectors();
  const timeouts = getTimeouts();

  logger.info('Navigating to login page', { url: credentials.loginUrl });

  // Navigate to login page
  await page.goto(credentials.loginUrl, {
    waitUntil: 'networkidle',
    timeout: timeouts.pageLoad,
  });

  // Find and fill username
  const usernameInput = await findElement(
    page,
    loginSelectors.usernameInput,
    timeouts.elementWait
  );
  if (!usernameInput) {
    return {
      success: false,
      message: 'Could not find username input field',
      error: 'ELEMENT_NOT_FOUND: username input',
    };
  }

  await usernameInput.fill(credentials.username);
  logger.debug('Username entered');

  // Find and fill password
  const passwordInput = await findElement(
    page,
    loginSelectors.passwordInput,
    timeouts.elementWait
  );
  if (!passwordInput) {
    return {
      success: false,
      message: 'Could not find password input field',
      error: 'ELEMENT_NOT_FOUND: password input',
    };
  }

  await passwordInput.fill(credentials.password);
  logger.debug('Password entered');

  // Find and click submit button
  const submitButton = await findElement(
    page,
    loginSelectors.submitButton,
    timeouts.elementWait
  );
  if (!submitButton) {
    return {
      success: false,
      message: 'Could not find submit button',
      error: 'ELEMENT_NOT_FOUND: submit button',
    };
  }

  await submitButton.click();
  logger.info('Login form submitted');

  // Wait for navigation
  await page.waitForLoadState('networkidle', { timeout: timeouts.pageLoad });

  // Check for MFA
  const mfaRequired = await isMFAPage(page);
  if (mfaRequired) {
    const mfaCompleted = await waitForMFACompletion(page, config);
    if (!mfaCompleted) {
      return {
        success: false,
        message: 'MFA verification timed out',
        mfaRequired: true,
        error: 'MFA_TIMEOUT',
      };
    }
  }

  // Verify we're on the dashboard
  const dashboardSelectors = getDashboardSelectors();
  const dashboardElement = await findElement(
    page,
    dashboardSelectors.mainContainer,
    timeouts.elementWait
  );

  if (!dashboardElement) {
    // Take screenshot for debugging
    const screenshotPath = await takeScreenshot(page, 'login-failed', config);
    return {
      success: false,
      message: 'Login appeared to fail - dashboard not detected',
      error: 'Dashboard verification failed',
      screenshotPath,
    };
  }

  // Take success screenshot
  const screenshotPath = await takeScreenshot(page, 'login-success', config);

  // Update session state
  currentSession = {
    isLoggedIn: true,
    lastLoginAt: new Date(),
    lastActivityAt: new Date(),
    isExpired: false,
  };

  logger.info('Login successful');

  return {
    success: true,
    message: 'Successfully logged in to ADP',
    mfaRequired,
    screenshotPath,
  };
}

// ==================== MAIN LOGIN FUNCTION ====================

/**
 * Login to ADP with retry logic
 *
 * @param page - Playwright page instance
 * @param config - Optional configuration overrides
 * @returns LoginResult with success status and details
 */
export async function login(
  page: Page,
  config: Partial<ADPConfig> = {}
): Promise<LoginResult> {
  const fullConfig: ADPConfig = { ...DEFAULT_ADP_CONFIG, ...config };
  const credentials = loadCredentials();

  let lastError: string | undefined;
  let attemptCount = 0;

  for (let attempt = 0; attempt < fullConfig.maxRetries; attempt++) {
    attemptCount = attempt + 1;

    try {
      logger.info(`Login attempt ${attemptCount}/${fullConfig.maxRetries}`);

      const result = await performLogin(page, credentials, fullConfig);

      if (result.success) {
        result.attemptCount = attemptCount;
        return result;
      }

      lastError = result.error || result.message;
      logger.warn(`Login attempt ${attemptCount} failed: ${lastError}`);
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
      logger.error(`Login attempt ${attemptCount} threw error`, error);
    }

    // Don't wait after the last attempt
    if (attempt < fullConfig.maxRetries - 1) {
      const delay = getBackoffDelay(attempt, fullConfig.retryBaseDelay);
      logger.info(`Waiting ${Math.round(delay)}ms before retry`);
      await sleep(delay);
    }
  }

  // All attempts failed
  const screenshotPath = await takeScreenshot(page, 'login-all-attempts-failed', fullConfig);

  return {
    success: false,
    message: `Login failed after ${attemptCount} attempts`,
    error: lastError,
    attemptCount,
    screenshotPath,
  };
}

/**
 * Check if currently logged in and session is valid
 * Optionally re-login if session has expired
 */
export async function ensureLoggedIn(
  page: Page,
  config: Partial<ADPConfig> = {}
): Promise<LoginResult> {
  const fullConfig: ADPConfig = { ...DEFAULT_ADP_CONFIG, ...config };

  // Check if session appears valid
  if (currentSession.isLoggedIn && !isSessionExpired(fullConfig)) {
    // Verify we're still on a valid page
    const isExpiredPage = await isSessionExpiredPage(page);
    if (!isExpiredPage) {
      updateSessionActivity();
      logger.debug('Session is valid');
      return {
        success: true,
        message: 'Session is valid',
      };
    }

    logger.info('Session expired - page indicates login required');
    clearSession();
  }

  // Need to login
  logger.info('Re-authentication required');
  return login(page, config);
}

// ==================== BROWSER SETUP ====================

/**
 * Create a new browser instance configured for ADP automation
 */
export async function createBrowser(
  headless: boolean = false
): Promise<Browser> {
  logger.info('Launching browser', { headless });

  const browser = await chromium.launch({
    headless,
    args: [
      '--disable-blink-features=AutomationControlled',
      '--disable-features=IsolateOrigins,site-per-process',
    ],
  });

  return browser;
}

/**
 * Create a new browser context with appropriate settings
 */
export async function createContext(
  browser: Browser,
  config: Partial<ADPConfig> = {}
): Promise<BrowserContext> {
  const fullConfig: ADPConfig = { ...DEFAULT_ADP_CONFIG, ...config };
  const downloadDir = resolve(process.cwd(), fullConfig.downloadDir);

  // Ensure download directory exists
  if (!existsSync(downloadDir)) {
    mkdirSync(downloadDir, { recursive: true });
  }

  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    acceptDownloads: true,
    userAgent:
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
  });

  // Set download path for the context
  // Note: Downloads will need to be handled per-download
  // as Playwright doesn't support setting a default download path directly

  logger.debug('Browser context created', { downloadDir });

  return context;
}

// ==================== EXPORTS ====================

export {
  type ADPCredentials,
  type LoginResult,
  type SessionState,
  type ADPConfig,
  DEFAULT_ADP_CONFIG,
};
