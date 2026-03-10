/**
 * Sage Intacct Login Automation
 *
 * Handles authentication to Sage Intacct including:
 * - Credential loading from environment variables
 * - Login form automation with Playwright
 * - MFA detection and user prompt handling
 * - Retry logic with exponential backoff
 * - Session timeout detection and re-login
 * - Screenshot capture after successful login
 */

import { Page, Browser, BrowserContext } from 'playwright';
import * as path from 'path';
import * as fs from 'fs';
import * as readline from 'readline';
import { createLogger } from '../utils/logger';
import {
  IntacctCredentials,
  INTACCT_ENV_VARS,
  LoginResult,
  MfaPromptResult,
  SessionState,
  IntacctConfig,
  DEFAULT_INTACCT_CONFIG,
  IntacctAutomationError,
} from './types';
import {
  getSelectors,
  getSelectorGroup,
  getAllSelectorsForElement,
  getSelectorTimeout,
} from './selectors';

const logger = createLogger('intacct:login');

/**
 * Default Intacct login URL
 */
const DEFAULT_LOGIN_URL = 'https://www.intacct.com/ia/acct/login.phtml';

/**
 * Current session state
 */
let sessionState: SessionState = {
  isLoggedIn: false,
};

/**
 * Load Intacct credentials from environment variables
 * Credentials must NEVER be hardcoded - always use process.env
 *
 * @throws IntacctAutomationError if required credentials are missing
 */
export function loadCredentials(): IntacctCredentials {
  const companyId = process.env[INTACCT_ENV_VARS.COMPANY_ID];
  const userId = process.env[INTACCT_ENV_VARS.USER_ID];
  const password = process.env[INTACCT_ENV_VARS.PASSWORD];
  const loginUrl = process.env[INTACCT_ENV_VARS.LOGIN_URL];

  // Validate required credentials
  const missingVars: string[] = [];

  if (!companyId) missingVars.push(INTACCT_ENV_VARS.COMPANY_ID);
  if (!userId) missingVars.push(INTACCT_ENV_VARS.USER_ID);
  if (!password) missingVars.push(INTACCT_ENV_VARS.PASSWORD);

  if (missingVars.length > 0) {
    throw new IntacctAutomationError(
      `Missing required environment variables: ${missingVars.join(', ')}`,
      'LOGIN_FAILED',
      { missingVariables: missingVars }
    );
  }

  logger.info('Credentials loaded from environment variables', {
    companyId: companyId!.substring(0, 3) + '***', // Log partial for debugging
    userId: userId!.substring(0, 3) + '***',
    hasCustomLoginUrl: !!loginUrl,
  });

  return {
    companyId: companyId!,
    userId: userId!,
    password: password!,
    loginUrl: loginUrl || DEFAULT_LOGIN_URL,
  };
}

/**
 * Wait for element using multiple selector strategies with fallbacks
 */
async function waitForSelectorWithFallbacks(
  page: Page,
  group: 'login' | 'mfa' | 'common',
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
      await locator.waitFor({ timeout: Math.min(timeout / selectors.length, 5000), state });
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
 * Detect if MFA prompt is displayed
 */
async function detectMfaPrompt(page: Page): Promise<MfaPromptResult> {
  logger.debug('Checking for MFA prompt');

  const mfaSelectors = getSelectorGroup('mfa');
  const mfaPromptSelectors = getAllSelectorsForElement('mfa', 'mfaPrompt');

  for (const selector of mfaPromptSelectors) {
    try {
      const isVisible = await page.locator(selector).isVisible({ timeout: 2000 });
      if (isVisible) {
        logger.info('MFA prompt detected');

        // Try to determine MFA type from message
        let mfaType: MfaPromptResult['mfaType'] = 'unknown';
        let promptMessage: string | undefined;

        try {
          const messageElement = await waitForSelectorWithFallbacks(page, 'mfa', 'mfaMessage', {
            timeout: 2000,
          });
          if (messageElement) {
            promptMessage = await messageElement.textContent() ?? undefined;

            // Detect MFA type from message content
            if (promptMessage) {
              const lowerMessage = promptMessage.toLowerCase();
              if (lowerMessage.includes('sms') || lowerMessage.includes('text')) {
                mfaType = 'sms';
              } else if (lowerMessage.includes('email')) {
                mfaType = 'email';
              } else if (lowerMessage.includes('authenticator') || lowerMessage.includes('app')) {
                mfaType = 'authenticator';
              }
            }
          }
        } catch {
          // Message extraction failed, continue with unknown type
        }

        return {
          detected: true,
          mfaType,
          promptMessage,
        };
      }
    } catch {
      // Continue checking other selectors
    }
  }

  return { detected: false };
}

/**
 * Prompt user to complete MFA and wait for completion
 */
async function handleMfaPrompt(
  page: Page,
  config: IntacctConfig
): Promise<boolean> {
  logger.info('MFA prompt detected - waiting for user to complete authentication');

  // Create readline interface for user prompt
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  // Prompt user
  console.log('\n' + '='.repeat(60));
  console.log('MFA VERIFICATION REQUIRED');
  console.log('='.repeat(60));
  console.log('\nPlease complete the MFA verification in the browser.');
  console.log('Press ENTER once you have completed the verification...\n');

  // Wait for user input
  await new Promise<void>((resolve) => {
    rl.question('', () => {
      rl.close();
      resolve();
    });
  });

  // Give a moment for the page to process after MFA
  await page.waitForTimeout(2000);

  // Check if we successfully passed MFA
  const dashboardSelectors = getAllSelectorsForElement('login', 'dashboardIndicator');

  for (const selector of dashboardSelectors) {
    try {
      const isVisible = await page.locator(selector).isVisible({ timeout: 5000 });
      if (isVisible) {
        logger.info('MFA verification successful - dashboard loaded');
        return true;
      }
    } catch {
      // Continue checking
    }
  }

  // Check if still on MFA page
  const stillOnMfa = await detectMfaPrompt(page);
  if (stillOnMfa.detected) {
    logger.warn('Still on MFA page after user confirmation');
    return false;
  }

  // Assume success if no MFA prompt and page has navigated
  return true;
}

/**
 * Take a screenshot with timestamp and step information
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
 * Check if session is still valid (not timed out)
 */
export async function isSessionValid(page: Page): Promise<boolean> {
  if (!sessionState.isLoggedIn) {
    return false;
  }

  // Check for session timeout indicators
  const sessionExpiredSelectors = getAllSelectorsForElement('common', 'sessionExpiredMessage');

  for (const selector of sessionExpiredSelectors) {
    try {
      const isVisible = await page.locator(selector).isVisible({ timeout: 1000 });
      if (isVisible) {
        logger.warn('Session expired detected');
        sessionState.isLoggedIn = false;
        return false;
      }
    } catch {
      // Continue checking
    }
  }

  // Check if we're back on login page
  const currentUrl = page.url();
  if (currentUrl.includes('login')) {
    logger.warn('Redirected to login page - session may have expired');
    sessionState.isLoggedIn = false;
    return false;
  }

  // Update last activity time
  sessionState.lastActivityTime = new Date();
  return true;
}

/**
 * Get current session state
 */
export function getSessionState(): SessionState {
  return { ...sessionState };
}

/**
 * Calculate exponential backoff delay
 */
function calculateBackoffDelay(attempt: number, baseDelay: number): number {
  // Exponential backoff: baseDelay * 2^attempt with jitter
  const exponentialDelay = baseDelay * Math.pow(2, attempt);
  const jitter = Math.random() * 1000; // Up to 1 second jitter
  return Math.min(exponentialDelay + jitter, 30000); // Max 30 seconds
}

/**
 * Perform login to Sage Intacct
 *
 * @param page - Playwright page instance
 * @param credentials - Login credentials (optional, loads from env if not provided)
 * @param config - Configuration options (optional, uses defaults if not provided)
 * @returns LoginResult with success status and details
 */
export async function login(
  page: Page,
  credentials?: IntacctCredentials,
  config: Partial<IntacctConfig> = {}
): Promise<LoginResult> {
  const startTime = Date.now();
  const fullConfig = { ...DEFAULT_INTACCT_CONFIG, ...config };
  let attemptCount = 0;
  let lastError: Error | undefined;

  // Load credentials from environment if not provided
  const creds = credentials ?? loadCredentials();

  logger.info('Starting Intacct login', {
    companyId: creds.companyId.substring(0, 3) + '***',
    loginUrl: creds.loginUrl,
    maxAttempts: fullConfig.retryAttempts,
  });

  // Retry loop with exponential backoff
  for (let attempt = 0; attempt < fullConfig.retryAttempts; attempt++) {
    attemptCount = attempt + 1;
    logger.info(`Login attempt ${attemptCount} of ${fullConfig.retryAttempts}`);

    try {
      // Navigate to login page
      await page.goto(creds.loginUrl!, {
        waitUntil: 'networkidle',
        timeout: fullConfig.defaultTimeout,
      });

      logger.debug('Login page loaded');

      // Find and fill company ID
      const companyInput = await waitForSelectorWithFallbacks(page, 'login', 'companyIdInput');
      if (!companyInput) {
        throw new IntacctAutomationError(
          'Could not find company ID input field',
          'SELECTOR_NOT_FOUND',
          { selector: 'companyIdInput' }
        );
      }
      await companyInput.fill(creds.companyId);
      logger.debug('Company ID entered');

      // Find and fill user ID
      const userInput = await waitForSelectorWithFallbacks(page, 'login', 'userIdInput');
      if (!userInput) {
        throw new IntacctAutomationError(
          'Could not find user ID input field',
          'SELECTOR_NOT_FOUND',
          { selector: 'userIdInput' }
        );
      }
      await userInput.fill(creds.userId);
      logger.debug('User ID entered');

      // Find and fill password
      const passwordInput = await waitForSelectorWithFallbacks(page, 'login', 'passwordInput');
      if (!passwordInput) {
        throw new IntacctAutomationError(
          'Could not find password input field',
          'SELECTOR_NOT_FOUND',
          { selector: 'passwordInput' }
        );
      }
      await passwordInput.fill(creds.password);
      logger.debug('Password entered');

      // Click login button
      const loginButton = await waitForSelectorWithFallbacks(page, 'login', 'loginButton');
      if (!loginButton) {
        throw new IntacctAutomationError(
          'Could not find login button',
          'SELECTOR_NOT_FOUND',
          { selector: 'loginButton' }
        );
      }
      await loginButton.click();
      logger.debug('Login button clicked');

      // Wait for navigation/response
      await page.waitForLoadState('networkidle', { timeout: fullConfig.defaultTimeout });

      // Check for login errors
      const errorSelectors = getAllSelectorsForElement('login', 'errorMessage');
      for (const selector of errorSelectors) {
        try {
          const errorElement = page.locator(selector);
          if (await errorElement.isVisible({ timeout: 2000 })) {
            const errorText = await errorElement.textContent();
            throw new IntacctAutomationError(
              `Login failed: ${errorText}`,
              'LOGIN_FAILED',
              { errorMessage: errorText }
            );
          }
        } catch (e) {
          if (e instanceof IntacctAutomationError) throw e;
          // Selector not found, continue
        }
      }

      // Check for MFA prompt
      const mfaResult = await detectMfaPrompt(page);
      let mfaRequired = false;

      if (mfaResult.detected) {
        mfaRequired = true;
        logger.info('MFA required', { mfaType: mfaResult.mfaType });

        const mfaSuccess = await handleMfaPrompt(page, fullConfig);
        if (!mfaSuccess) {
          throw new IntacctAutomationError(
            'MFA verification failed or timed out',
            'MFA_TIMEOUT'
          );
        }
      }

      // Wait for dashboard to confirm successful login
      const dashboardElement = await waitForSelectorWithFallbacks(
        page,
        'login',
        'dashboardIndicator',
        { timeout: fullConfig.defaultTimeout }
      );

      if (!dashboardElement) {
        // Check if still on login page with error
        const currentUrl = page.url();
        if (currentUrl.includes('login')) {
          throw new IntacctAutomationError(
            'Login did not complete - still on login page',
            'LOGIN_FAILED'
          );
        }
        // May have landed on a different valid page
        logger.warn('Dashboard indicator not found, but login may have succeeded');
      }

      // Update session state
      sessionState = {
        isLoggedIn: true,
        loginTime: new Date(),
        lastActivityTime: new Date(),
        currentUrl: page.url(),
        companyId: creds.companyId,
        userId: creds.userId,
      };

      // Take success screenshot
      const screenshotPath = await takeScreenshot(page, 'login-success', fullConfig);

      const duration = Date.now() - startTime;
      logger.info('Login successful', {
        duration,
        mfaRequired,
        attemptCount,
      });

      return {
        success: true,
        screenshotPath,
        mfaRequired,
        session: sessionState,
        attemptCount,
      };

    } catch (error) {
      lastError = error as Error;
      logger.error(`Login attempt ${attemptCount} failed`, error);

      // Don't retry on certain errors
      if (error instanceof IntacctAutomationError) {
        if (error.code === 'LOGIN_FAILED' && attemptCount >= 2) {
          // Stop retrying after 2 failed login attempts to avoid account lockout
          logger.warn('Stopping login attempts to avoid account lockout');
          break;
        }
      }

      // Calculate backoff delay
      if (attempt < fullConfig.retryAttempts - 1) {
        const delay = calculateBackoffDelay(attempt, fullConfig.retryBaseDelay);
        logger.info(`Waiting ${delay}ms before retry`);
        await page.waitForTimeout(delay);
      }
    }
  }

  // All attempts failed
  const duration = Date.now() - startTime;
  logger.error('All login attempts failed', lastError, { duration, attemptCount });

  return {
    success: false,
    error: lastError?.message || 'Login failed after all attempts',
    mfaRequired: false,
    attemptCount,
  };
}

/**
 * Perform re-login after session expiration
 */
export async function reLogin(
  page: Page,
  credentials?: IntacctCredentials,
  config: Partial<IntacctConfig> = {}
): Promise<LoginResult> {
  logger.info('Attempting re-login after session expiration');

  // Clear session state
  sessionState = { isLoggedIn: false };

  return login(page, credentials, config);
}

/**
 * Logout from Intacct
 */
export async function logout(page: Page): Promise<boolean> {
  if (!sessionState.isLoggedIn) {
    logger.debug('Not logged in, skipping logout');
    return true;
  }

  try {
    // Find and click logout link
    const logoutSelectors = getAllSelectorsForElement('common', 'logoutLink');

    // First try to open user menu if needed
    try {
      const userMenu = await waitForSelectorWithFallbacks(page, 'common', 'userMenu', {
        timeout: 5000,
      });
      if (userMenu) {
        await userMenu.click();
        await page.waitForTimeout(500);
      }
    } catch {
      // User menu might not be needed
    }

    // Click logout
    for (const selector of logoutSelectors) {
      try {
        const logoutLink = page.locator(selector);
        if (await logoutLink.isVisible({ timeout: 2000 })) {
          await logoutLink.click();
          await page.waitForLoadState('networkidle');

          sessionState = { isLoggedIn: false };
          logger.info('Logout successful');
          return true;
        }
      } catch {
        // Try next selector
      }
    }

    logger.warn('Could not find logout link');
    return false;

  } catch (error) {
    logger.error('Logout failed', error);
    return false;
  }
}

export default login;
