/**
 * ADP Browser Automation Module
 *
 * This module provides browser automation for ADP Workforce Now
 * to export payroll journal entries for import into Sage Intacct.
 *
 * Features:
 * - Secure credential handling via environment variables
 * - MFA support with manual completion
 * - Resilient selectors with fallbacks
 * - Retry logic with exponential backoff
 * - Session timeout detection and re-login
 * - Configurable entry types and download paths
 *
 * Usage:
 * ```typescript
 * import {
 *   login,
 *   createBrowser,
 *   createContext,
 *   navigateToGLReporting,
 *   downloadPayrollEntries,
 * } from './automation/adp';
 *
 * // Set environment variables:
 * // ADP_USERNAME, ADP_PASSWORD, ADP_LOGIN_URL
 *
 * const browser = await createBrowser(false); // headful for MFA
 * const context = await createContext(browser);
 * const page = await context.newPage();
 *
 * // Login (handles MFA)
 * const loginResult = await login(page);
 *
 * // Navigate to GL Reports
 * const navResult = await navigateToGLReporting(page, context);
 *
 * // Download payroll entries
 * const downloadResult = await downloadPayrollEntries(
 *   page,
 *   context,
 *   ['payroll', 'tax', 'deductions']
 * );
 *
 * await browser.close();
 * ```
 */

// ==================== LOGIN MODULE ====================

export {
  // Main login functions
  login,
  ensureLoggedIn,
  loadCredentials,

  // Browser setup
  createBrowser,
  createContext,

  // Session management
  getSessionState,
  updateSessionActivity,
  isSessionExpired,
  clearSession,

  // Types
  type ADPCredentials,
  type LoginResult,
  type SessionState,
  type ADPConfig,
  DEFAULT_ADP_CONFIG,
} from './login';

// ==================== NAVIGATION MODULE ====================

export {
  // Main navigation functions
  navigateToGLReporting,
  navigateDirectToGL,

  // Utilities
  verifyGLReportsPage,
  handlePopups,
  setupPopupHandler,

  // Types
  type NavigationResult,
} from './navigate-gl';

// ==================== DOWNLOAD MODULE ====================

export {
  // Main download functions
  downloadPayrollEntries,
  downloadEntriesForBatch,
  detectPayrollRuns,

  // Utilities
  validateCSVFile,
  generateFilename,
  formatDateForFilename,
  isRecentPayroll,
  getCurrentWeekRange,

  // Types
  type DownloadResult,
  type BatchDownloadResult,
  type PayrollRunInfo,
  type PayrollEntryType,
  type FileValidationResult,
} from './download-entries';

// ==================== SELECTORS MODULE ====================

export {
  // Config loading
  loadSelectorConfig,
  reloadSelectorConfig,

  // Selector utilities
  getSelectorsForElement,
  toPlaywrightSelector,
  getPlaywrightSelectors,

  // Convenience accessors
  getLoginSelectors,
  getMFAIndicators,
  getDashboardSelectors,
  getNavigationSelectors,
  getGLReportsSelectors,
  getPopupSelectors,
  getSessionIndicators,
  getTimeouts,

  // Types
  type ADPSelectorConfig,
  type SelectorWithFallbacks,
  type SelectorStrategy,
  type PageSelectors,
  type MFAIndicators,
  CONFIG_PATH as SELECTOR_CONFIG_PATH,
} from './selectors';

// ==================== TYPE DEFINITIONS ====================

export {
  // Core types
  type PayrollEntry,

  // Error handling
  ADPAutomationError,
  type ADPErrorCode,
} from './types';
