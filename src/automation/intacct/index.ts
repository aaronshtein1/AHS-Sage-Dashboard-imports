/**
 * Sage Intacct Browser Automation Module
 *
 * Provides automated uploading of payroll journal entries to Sage Intacct.
 *
 * This module includes:
 * - Login automation with MFA support
 * - Navigation to journal entry import
 * - File upload handling
 * - Upload validation
 *
 * @example
 * ```typescript
 * import { chromium } from 'playwright';
 * import {
 *   login,
 *   navigateToJournalImport,
 *   uploadJournalEntry,
 *   validateUpload,
 * } from './automation/intacct';
 *
 * async function uploadPayroll(filePath: string) {
 *   const browser = await chromium.launch({ headless: false });
 *   const page = await browser.newPage();
 *
 *   try {
 *     // Login (credentials loaded from environment variables)
 *     const loginResult = await login(page);
 *     if (!loginResult.success) {
 *       throw new Error(`Login failed: ${loginResult.error}`);
 *     }
 *
 *     // Navigate to import page
 *     const navResult = await navigateToJournalImport(page);
 *     if (!navResult.success) {
 *       throw new Error(`Navigation failed: ${navResult.error}`);
 *     }
 *
 *     // Upload journal entry file
 *     const uploadResult = await uploadJournalEntry(page, {
 *       filePath,
 *       expectedEntryCount: 1,
 *     });
 *
 *     // Validate the upload
 *     const validationResult = await validateUpload(page, uploadResult);
 *
 *     return {
 *       success: uploadResult.success && validationResult.isValid,
 *       entriesCreated: uploadResult.entriesCreated,
 *       validation: validationResult,
 *     };
 *   } finally {
 *     await browser.close();
 *   }
 * }
 * ```
 *
 * @module automation/intacct
 */

// Types
export {
  IntacctCredentials,
  INTACCT_ENV_VARS,
  UploadResult,
  DuplicateEntryInfo,
  JournalEntryConfirmation,
  JournalEntryState,
  IntacctConfig,
  DEFAULT_INTACCT_CONFIG,
  SessionState,
  LoginResult,
  NavigationResult,
  UploadOptions,
  ValidationResult,
  ValidationError,
  ValidationWarning,
  MfaPromptResult,
  ScreenshotInfo,
  IntacctAutomationError,
  IntacctErrorCode,
} from './types';

// Selectors
export {
  SelectorWithFallbacks,
  SelectorGroup,
  IntacctSelectors,
  DEFAULT_SELECTORS,
  getSelectors,
  clearSelectorCache,
  getSelectorGroup,
  getSelector,
  getAllSelectorsForElement,
  getSelectorTimeout,
} from './selectors';

// Login
export {
  loadCredentials,
  login,
  reLogin,
  logout,
  isSessionValid,
  getSessionState,
} from './login';

// Navigation
export {
  navigateToJournalImport,
  navigateToDashboard,
} from './navigate-import';

// Upload
export {
  uploadJournalEntry,
  closeUploadResultDialog,
} from './upload-journal';

// Validation
export {
  validateUpload,
  verifyJournalEntry,
  generateValidationReport,
} from './validate-upload';
