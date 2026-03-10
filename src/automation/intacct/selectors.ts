/**
 * Sage Intacct Selector Definitions
 *
 * Provides resilient selectors with fallbacks for browser automation.
 * Selectors are organized by page/feature and include multiple strategies:
 * - Role-based (ARIA roles)
 * - Label-based (for form fields)
 * - Text-based (for buttons, links)
 * - CSS fallbacks (for complex elements)
 *
 * Selectors can be overridden via config/intacct-selectors.json
 */

import * as fs from 'fs';
import * as path from 'path';
import { createLogger } from '../utils/logger';

const logger = createLogger('intacct:selectors');

/**
 * Selector with multiple fallback strategies
 */
export interface SelectorWithFallbacks {
  /** Description of what this selector targets */
  description: string;
  /** Primary selector (most reliable) */
  primary: string;
  /** Array of fallback selectors in order of preference */
  fallbacks: string[];
  /** Maximum time to wait for this selector in milliseconds */
  timeout?: number;
}

/**
 * Collection of selectors for a specific page or feature
 */
export interface SelectorGroup {
  [key: string]: SelectorWithFallbacks;
}

/**
 * All selector groups for Intacct automation
 */
export interface IntacctSelectors {
  login: SelectorGroup;
  mfa: SelectorGroup;
  navigation: SelectorGroup;
  journalImport: SelectorGroup;
  upload: SelectorGroup;
  confirmation: SelectorGroup;
  common: SelectorGroup;
}

/**
 * Default selectors for Intacct automation
 * These are based on typical Intacct UI patterns and may need adjustment
 */
export const DEFAULT_SELECTORS: IntacctSelectors = {
  /**
   * Login page selectors
   */
  login: {
    companyIdInput: {
      description: 'Company ID input field',
      primary: 'input[name="cid"]',
      fallbacks: [
        '#company_id',
        'input[placeholder*="Company"]',
        'input[aria-label*="Company"]',
        '[data-testid="company-id-input"]',
      ],
      timeout: 10000,
    },
    userIdInput: {
      description: 'User ID input field',
      primary: 'input[name="uid"]',
      fallbacks: [
        '#user_id',
        'input[placeholder*="User"]',
        'input[aria-label*="User ID"]',
        '[data-testid="user-id-input"]',
      ],
      timeout: 10000,
    },
    passwordInput: {
      description: 'Password input field',
      primary: 'input[name="pwd"]',
      fallbacks: [
        '#password',
        'input[type="password"]',
        'input[placeholder*="Password"]',
        'input[aria-label*="Password"]',
      ],
      timeout: 10000,
    },
    loginButton: {
      description: 'Login submit button',
      primary: 'button[type="submit"]',
      fallbacks: [
        'input[type="submit"]',
        'button:has-text("Sign In")',
        'button:has-text("Log In")',
        '#login-button',
        '[data-testid="login-button"]',
      ],
      timeout: 10000,
    },
    errorMessage: {
      description: 'Login error message',
      primary: '.login-error',
      fallbacks: [
        '.error-message',
        '[role="alert"]',
        '.alert-danger',
        '#login-error',
      ],
      timeout: 5000,
    },
    dashboardIndicator: {
      description: 'Element indicating successful login (dashboard loaded)',
      primary: '#dashboard',
      fallbacks: [
        '.dashboard-container',
        '[data-page="dashboard"]',
        '#main-content',
        '.intacct-home',
      ],
      timeout: 30000,
    },
  },

  /**
   * MFA (Multi-Factor Authentication) selectors
   */
  mfa: {
    mfaPrompt: {
      description: 'MFA prompt container',
      primary: '.mfa-container',
      fallbacks: [
        '#mfa-prompt',
        '[data-testid="mfa-prompt"]',
        '.two-factor-auth',
        '.verification-prompt',
        'form[action*="mfa"]',
      ],
      timeout: 5000,
    },
    mfaCodeInput: {
      description: 'MFA code input field',
      primary: 'input[name="mfa_code"]',
      fallbacks: [
        '#mfa-code',
        'input[placeholder*="code"]',
        'input[placeholder*="Code"]',
        'input[aria-label*="verification"]',
        'input[type="text"][maxlength="6"]',
      ],
      timeout: 5000,
    },
    mfaSubmitButton: {
      description: 'MFA submit button',
      primary: 'button[type="submit"]',
      fallbacks: [
        'button:has-text("Verify")',
        'button:has-text("Submit")',
        'button:has-text("Continue")',
        '#mfa-submit',
      ],
      timeout: 5000,
    },
    mfaMessage: {
      description: 'MFA instruction message',
      primary: '.mfa-message',
      fallbacks: [
        '.mfa-instructions',
        '[data-testid="mfa-message"]',
        '.verification-message',
      ],
      timeout: 5000,
    },
  },

  /**
   * Navigation selectors
   */
  navigation: {
    mainMenu: {
      description: 'Main navigation menu',
      primary: '#main-menu',
      fallbacks: [
        'nav[role="navigation"]',
        '.main-navigation',
        '#navigation',
        '.nav-menu',
      ],
      timeout: 10000,
    },
    generalLedgerMenu: {
      description: 'General Ledger menu item',
      primary: 'a:has-text("General Ledger")',
      fallbacks: [
        '[data-menu="general-ledger"]',
        'li:has-text("General Ledger")',
        '#menu-gl',
        'a[href*="general-ledger"]',
        'span:has-text("General Ledger")',
      ],
      timeout: 10000,
    },
    journalEntriesMenu: {
      description: 'Journal Entries submenu item',
      primary: 'a:has-text("Journal Entries")',
      fallbacks: [
        '[data-submenu="journal-entries"]',
        'li:has-text("Journal Entries")',
        'a[href*="journal-entries"]',
      ],
      timeout: 10000,
    },
    importJournalEntries: {
      description: 'Import Journal Entries link',
      primary: 'a:has-text("Import Journal Entries")',
      fallbacks: [
        'a:has-text("Import")',
        '[data-action="import-journal"]',
        'a[href*="import"]',
        'button:has-text("Import")',
      ],
      timeout: 10000,
    },
    submenu: {
      description: 'Submenu container that appears on hover/click',
      primary: '.submenu',
      fallbacks: [
        '.dropdown-menu',
        '[role="menu"]',
        '.nav-submenu',
        'ul.submenu',
      ],
      timeout: 5000,
    },
  },

  /**
   * Journal entry import page selectors
   */
  journalImport: {
    pageTitle: {
      description: 'Import page title',
      primary: 'h1:has-text("Import Journal Entries")',
      fallbacks: [
        '.page-title:has-text("Import")',
        'h2:has-text("Import")',
        '[data-page-title]',
      ],
      timeout: 10000,
    },
    importForm: {
      description: 'Import form container',
      primary: 'form#import-form',
      fallbacks: [
        'form[action*="import"]',
        '.import-form',
        '[data-form="journal-import"]',
      ],
      timeout: 10000,
    },
    fileTypeSelect: {
      description: 'File type selection dropdown',
      primary: 'select[name="file_type"]',
      fallbacks: [
        '#file-type-select',
        'select[aria-label*="file type"]',
        '.file-type-dropdown',
      ],
      timeout: 5000,
    },
    importTemplateLink: {
      description: 'Link to download import template',
      primary: 'a:has-text("Download Template")',
      fallbacks: [
        'a:has-text("template")',
        'a[href*="template"]',
        '.template-download',
      ],
      timeout: 5000,
    },
  },

  /**
   * File upload selectors
   */
  upload: {
    fileInput: {
      description: 'File input for upload',
      primary: 'input[type="file"]',
      fallbacks: [
        '#file-upload',
        'input[accept*=".csv"]',
        '[data-testid="file-input"]',
      ],
      timeout: 10000,
    },
    browseButton: {
      description: 'Browse/Choose file button',
      primary: 'button:has-text("Browse")',
      fallbacks: [
        'button:has-text("Choose File")',
        'label[for="file-upload"]',
        '.file-browse-btn',
      ],
      timeout: 10000,
    },
    uploadButton: {
      description: 'Upload/Submit button',
      primary: 'button:has-text("Upload")',
      fallbacks: [
        'button:has-text("Import")',
        'button[type="submit"]',
        'input[type="submit"]',
        '#upload-btn',
      ],
      timeout: 10000,
    },
    uploadProgress: {
      description: 'Upload progress indicator',
      primary: '.upload-progress',
      fallbacks: [
        '.progress-bar',
        '[role="progressbar"]',
        '.uploading-indicator',
      ],
      timeout: 5000,
    },
    uploadingMessage: {
      description: 'Uploading/processing message',
      primary: '.uploading-message',
      fallbacks: [
        ':has-text("Uploading")',
        ':has-text("Processing")',
        '.loading-message',
      ],
      timeout: 5000,
    },
  },

  /**
   * Confirmation/results page selectors
   */
  confirmation: {
    successMessage: {
      description: 'Success message after upload',
      primary: '.success-message',
      fallbacks: [
        '.alert-success',
        '[role="alert"]:has-text("success")',
        '.import-success',
        ':has-text("successfully imported")',
      ],
      timeout: 30000,
    },
    errorMessage: {
      description: 'Error message after upload',
      primary: '.error-message',
      fallbacks: [
        '.alert-danger',
        '.alert-error',
        '[role="alert"]:has-text("error")',
        '.import-error',
      ],
      timeout: 5000,
    },
    warningMessage: {
      description: 'Warning message after upload',
      primary: '.warning-message',
      fallbacks: [
        '.alert-warning',
        '[role="alert"]:has-text("warning")',
        '.import-warning',
      ],
      timeout: 5000,
    },
    entriesCreatedCount: {
      description: 'Number of entries created',
      primary: '.entries-created-count',
      fallbacks: [
        '.import-count',
        '[data-count="entries"]',
        ':has-text("entries created")',
      ],
      timeout: 5000,
    },
    journalEntryIds: {
      description: 'Created journal entry IDs/links',
      primary: '.journal-entry-id',
      fallbacks: [
        'a[href*="journal-entry"]',
        '.entry-link',
        'td:has-text("JE-")',
      ],
      timeout: 5000,
    },
    duplicateWarning: {
      description: 'Duplicate entry warning',
      primary: '.duplicate-warning',
      fallbacks: [
        ':has-text("duplicate")',
        ':has-text("already exists")',
        '.duplicate-alert',
      ],
      timeout: 5000,
    },
    resultsTable: {
      description: 'Results table showing imported entries',
      primary: 'table.import-results',
      fallbacks: [
        '.results-table',
        'table[data-results]',
        '.journal-entries-table',
      ],
      timeout: 10000,
    },
    closeButton: {
      description: 'Close/Done button on results',
      primary: 'button:has-text("Close")',
      fallbacks: [
        'button:has-text("Done")',
        'button:has-text("OK")',
        '.close-btn',
      ],
      timeout: 5000,
    },
  },

  /**
   * Common UI elements
   */
  common: {
    loadingSpinner: {
      description: 'Loading spinner/indicator',
      primary: '.loading-spinner',
      fallbacks: [
        '.spinner',
        '[role="progressbar"]',
        '.loading',
        '.busy-indicator',
      ],
      timeout: 5000,
    },
    modal: {
      description: 'Modal dialog container',
      primary: '.modal',
      fallbacks: [
        '[role="dialog"]',
        '.dialog',
        '.popup',
        '.overlay-content',
      ],
      timeout: 5000,
    },
    modalCloseButton: {
      description: 'Modal close button',
      primary: '.modal-close',
      fallbacks: [
        'button[aria-label="Close"]',
        '.close-modal',
        'button.close',
        '[data-dismiss="modal"]',
      ],
      timeout: 5000,
    },
    confirmButton: {
      description: 'Confirm action button',
      primary: 'button:has-text("Confirm")',
      fallbacks: [
        'button:has-text("Yes")',
        'button:has-text("OK")',
        '.btn-confirm',
        '.btn-primary',
      ],
      timeout: 5000,
    },
    cancelButton: {
      description: 'Cancel action button',
      primary: 'button:has-text("Cancel")',
      fallbacks: [
        'button:has-text("No")',
        '.btn-cancel',
        '.btn-secondary',
      ],
      timeout: 5000,
    },
    sessionExpiredMessage: {
      description: 'Session expired message',
      primary: ':has-text("session expired")',
      fallbacks: [
        ':has-text("Session Expired")',
        ':has-text("logged out")',
        ':has-text("timed out")',
        '.session-expired',
      ],
      timeout: 5000,
    },
    userMenu: {
      description: 'User profile/settings menu',
      primary: '#user-menu',
      fallbacks: [
        '.user-dropdown',
        '[aria-label="User menu"]',
        '.profile-menu',
      ],
      timeout: 5000,
    },
    logoutLink: {
      description: 'Logout link',
      primary: 'a:has-text("Logout")',
      fallbacks: [
        'a:has-text("Sign Out")',
        'a:has-text("Log Out")',
        '#logout',
        '[data-action="logout"]',
      ],
      timeout: 5000,
    },
  },
};

/**
 * Path to the config file for selector overrides
 */
const CONFIG_PATH = path.join(
  process.cwd(),
  'config',
  'intacct-selectors.json'
);

/**
 * Cached selectors (merged defaults with config overrides)
 */
let cachedSelectors: IntacctSelectors | null = null;

/**
 * Load selector overrides from config file
 */
function loadSelectorConfig(): Partial<IntacctSelectors> | null {
  try {
    if (fs.existsSync(CONFIG_PATH)) {
      const configContent = fs.readFileSync(CONFIG_PATH, 'utf-8');
      const config = JSON.parse(configContent);
      logger.debug('Loaded selector config from file', { path: CONFIG_PATH });
      return config;
    }
  } catch (error) {
    logger.warn('Failed to load selector config', { error, path: CONFIG_PATH });
  }
  return null;
}

/**
 * Deep merge selector configs, with overrides taking precedence
 */
function mergeSelectors(
  defaults: IntacctSelectors,
  overrides: Partial<IntacctSelectors>
): IntacctSelectors {
  const merged = { ...defaults };

  for (const groupKey of Object.keys(overrides) as (keyof IntacctSelectors)[]) {
    if (overrides[groupKey]) {
      merged[groupKey] = {
        ...defaults[groupKey],
        ...overrides[groupKey],
      };
    }
  }

  return merged;
}

/**
 * Get all selectors with config overrides applied
 */
export function getSelectors(): IntacctSelectors {
  if (cachedSelectors) {
    return cachedSelectors;
  }

  const configOverrides = loadSelectorConfig();

  if (configOverrides) {
    cachedSelectors = mergeSelectors(DEFAULT_SELECTORS, configOverrides);
    logger.info('Selectors loaded with config overrides');
  } else {
    cachedSelectors = DEFAULT_SELECTORS;
    logger.info('Using default selectors (no config overrides found)');
  }

  return cachedSelectors;
}

/**
 * Clear cached selectors (useful for testing or hot-reloading config)
 */
export function clearSelectorCache(): void {
  cachedSelectors = null;
  logger.debug('Selector cache cleared');
}

/**
 * Get a specific selector group
 */
export function getSelectorGroup(
  group: keyof IntacctSelectors
): SelectorGroup {
  const selectors = getSelectors();
  return selectors[group];
}

/**
 * Get a specific selector with its fallbacks
 */
export function getSelector(
  group: keyof IntacctSelectors,
  selector: string
): SelectorWithFallbacks | undefined {
  const selectorGroup = getSelectorGroup(group);
  return selectorGroup[selector];
}

/**
 * Get all selectors for a specific element as an array (primary + fallbacks)
 */
export function getAllSelectorsForElement(
  group: keyof IntacctSelectors,
  selector: string
): string[] {
  const selectorDef = getSelector(group, selector);

  if (!selectorDef) {
    logger.warn('Selector not found', { group, selector });
    return [];
  }

  return [selectorDef.primary, ...selectorDef.fallbacks];
}

/**
 * Get the timeout for a specific selector
 */
export function getSelectorTimeout(
  group: keyof IntacctSelectors,
  selector: string,
  defaultTimeout = 10000
): number {
  const selectorDef = getSelector(group, selector);
  return selectorDef?.timeout ?? defaultTimeout;
}

export default getSelectors;
