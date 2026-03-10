/**
 * ADP Selector Definitions
 *
 * This module provides resilient selector definitions with fallbacks for ADP browser automation.
 * Selectors are loaded from the config file and enhanced with runtime utilities.
 */

import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';
import type { SelectorWithFallbacks, SelectorStrategy, PageSelectors, MFAIndicators } from './types';
import { createLogger } from '../utils/logger';

const logger = createLogger('adp:selectors');

// ==================== CONFIG LOADING ====================

/**
 * Path to the selector configuration file
 */
const CONFIG_PATH = resolve(process.cwd(), 'config', 'adp-selectors.json');

/**
 * Cached selector configuration
 */
let selectorConfig: ADPSelectorConfig | null = null;

/**
 * Full selector configuration structure from JSON
 */
export interface ADPSelectorConfig {
  version: string;
  lastUpdated: string;
  description: string;
  login: PageSelectors;
  mfa: {
    mfaContainer: SelectorWithFallbacks;
    urlPatterns: string[];
    textPatterns: string[];
  };
  dashboard: PageSelectors;
  navigation: PageSelectors;
  glReports: PageSelectors;
  popups: PageSelectors;
  session: {
    sessionExpiredModal: SelectorWithFallbacks;
    loginRequiredText: string[];
    loginPageIndicators: string[];
  };
  timeouts: {
    pageLoad: number;
    elementWait: number;
    downloadWait: number;
    mfaWait: number;
    shortWait: number;
  };
}

/**
 * Load selector configuration from JSON file
 * Caches the result for subsequent calls
 */
export function loadSelectorConfig(): ADPSelectorConfig {
  if (selectorConfig) {
    return selectorConfig;
  }

  if (!existsSync(CONFIG_PATH)) {
    logger.warn('Selector config file not found, using defaults', { path: CONFIG_PATH });
    return getDefaultSelectorConfig();
  }

  try {
    const configContent = readFileSync(CONFIG_PATH, 'utf-8');
    selectorConfig = JSON.parse(configContent) as ADPSelectorConfig;
    logger.info('Loaded selector configuration', {
      version: selectorConfig.version,
      path: CONFIG_PATH
    });
    return selectorConfig;
  } catch (error) {
    logger.error('Failed to load selector config, using defaults', error);
    return getDefaultSelectorConfig();
  }
}

/**
 * Reload selector configuration (clears cache)
 * Useful for hot-reloading during development
 */
export function reloadSelectorConfig(): ADPSelectorConfig {
  selectorConfig = null;
  return loadSelectorConfig();
}

// ==================== SELECTOR RESOLUTION ====================

/**
 * Get all selectors for a specific element, including primary and fallbacks
 * Returns an array of { selector, strategy } objects in order of preference
 */
export function getSelectorsForElement(
  element: SelectorWithFallbacks
): Array<{ selector: string; strategy: SelectorStrategy }> {
  return [
    { selector: element.primary, strategy: element.primaryStrategy },
    ...element.fallbacks,
  ];
}

/**
 * Convert a selector with strategy to a Playwright-compatible locator string
 */
export function toPlaywrightSelector(selector: string, strategy: SelectorStrategy): string {
  switch (strategy) {
    case 'role':
      // Role selectors need to be handled via page.getByRole()
      // Return as-is for special handling
      return selector;

    case 'label':
      // Label selectors use getByLabel()
      return selector;

    case 'text':
      // Text selectors - handle both regex patterns and plain text
      if (selector.startsWith('text=')) {
        return selector;
      }
      return `text=${selector}`;

    case 'testId':
      // Test ID selectors use getByTestId()
      // Extract the test ID value from the selector
      const testIdMatch = selector.match(/\[data-testid=['"]?([^'">\]]+)['"]?\]/);
      if (testIdMatch) {
        return `[data-testid="${testIdMatch[1]}"]`;
      }
      return selector;

    case 'css':
      // CSS selectors work directly
      return selector;

    case 'xpath':
      // XPath selectors need special handling
      if (selector.startsWith('//') || selector.startsWith('(//')) {
        return `xpath=${selector}`;
      }
      return selector;

    default:
      return selector;
  }
}

/**
 * Get a flat list of Playwright-compatible selectors for an element
 */
export function getPlaywrightSelectors(element: SelectorWithFallbacks): string[] {
  const selectors = getSelectorsForElement(element);
  return selectors.map(({ selector, strategy }) =>
    toPlaywrightSelector(selector, strategy)
  );
}

// ==================== CONVENIENCE ACCESSORS ====================

/**
 * Get login page selectors
 */
export function getLoginSelectors(): PageSelectors {
  return loadSelectorConfig().login;
}

/**
 * Get MFA detection indicators
 */
export function getMFAIndicators(): MFAIndicators {
  const config = loadSelectorConfig();
  return {
    pageSelectors: [
      config.mfa.mfaContainer.primary,
      ...config.mfa.mfaContainer.fallbacks.map(f => f.selector),
    ],
    urlPatterns: config.mfa.urlPatterns,
    textPatterns: config.mfa.textPatterns,
  };
}

/**
 * Get dashboard selectors
 */
export function getDashboardSelectors(): PageSelectors {
  return loadSelectorConfig().dashboard;
}

/**
 * Get navigation selectors
 */
export function getNavigationSelectors(): PageSelectors {
  return loadSelectorConfig().navigation;
}

/**
 * Get GL reports page selectors
 */
export function getGLReportsSelectors(): PageSelectors {
  return loadSelectorConfig().glReports;
}

/**
 * Get popup/modal selectors
 */
export function getPopupSelectors(): PageSelectors {
  return loadSelectorConfig().popups;
}

/**
 * Get session-related selectors and patterns
 */
export function getSessionIndicators(): ADPSelectorConfig['session'] {
  return loadSelectorConfig().session;
}

/**
 * Get timeout configurations
 */
export function getTimeouts(): ADPSelectorConfig['timeouts'] {
  return loadSelectorConfig().timeouts;
}

// ==================== DEFAULT CONFIGURATION ====================

/**
 * Default selector configuration fallback
 * Used when config file is missing or invalid
 */
function getDefaultSelectorConfig(): ADPSelectorConfig {
  return {
    version: '1.0.0-default',
    lastUpdated: new Date().toISOString().split('T')[0],
    description: 'Default ADP selector configuration',

    login: {
      usernameInput: {
        primary: "input[name='user']",
        primaryStrategy: 'css',
        fallbacks: [
          { selector: '#user-id', strategy: 'css' },
          { selector: "input[type='text']", strategy: 'css' },
        ],
        description: 'Username input field',
      },
      passwordInput: {
        primary: "input[name='password']",
        primaryStrategy: 'css',
        fallbacks: [
          { selector: '#password', strategy: 'css' },
          { selector: "input[type='password']", strategy: 'css' },
        ],
        description: 'Password input field',
      },
      submitButton: {
        primary: "button[type='submit']",
        primaryStrategy: 'css',
        fallbacks: [
          { selector: '#submit-btn', strategy: 'css' },
        ],
        description: 'Submit button',
      },
      rememberMeCheckbox: {
        primary: "input[name='rememberMe']",
        primaryStrategy: 'css',
        fallbacks: [],
        description: 'Remember me checkbox',
      },
    },

    mfa: {
      mfaContainer: {
        primary: "[data-testid='mfa-container']",
        primaryStrategy: 'testId',
        fallbacks: [
          { selector: '.mfa-verification', strategy: 'css' },
        ],
        description: 'MFA container',
      },
      urlPatterns: ['/mfa/', '/verify/', '/two-factor/'],
      textPatterns: ['Enter verification code', 'Two-factor authentication'],
    },

    dashboard: {
      mainContainer: {
        primary: "[data-testid='dashboard-container']",
        primaryStrategy: 'testId',
        fallbacks: [
          { selector: '#main-dashboard', strategy: 'css' },
        ],
        description: 'Dashboard container',
      },
      userGreeting: {
        primary: "[data-testid='user-greeting']",
        primaryStrategy: 'testId',
        fallbacks: [],
        description: 'User greeting',
      },
      navigationMenu: {
        primary: "nav[role='navigation']",
        primaryStrategy: 'role',
        fallbacks: [],
        description: 'Navigation menu',
      },
    },

    navigation: {
      reportsMenu: {
        primary: "button:has-text('Reports')",
        primaryStrategy: 'text',
        fallbacks: [],
        description: 'Reports menu',
      },
      payrollLink: {
        primary: "a:has-text('Payroll')",
        primaryStrategy: 'text',
        fallbacks: [],
        description: 'Payroll link',
      },
      glReportsLink: {
        primary: "a:has-text('General Ledger')",
        primaryStrategy: 'text',
        fallbacks: [],
        description: 'GL Reports link',
      },
      journalEntriesLink: {
        primary: "a:has-text('Journal Entries')",
        primaryStrategy: 'text',
        fallbacks: [],
        description: 'Journal entries link',
      },
    },

    glReports: {
      pageHeader: {
        primary: "h1:has-text('General Ledger')",
        primaryStrategy: 'text',
        fallbacks: [],
        description: 'GL page header',
      },
      payrollRunsTable: {
        primary: "table[data-testid='payroll-runs']",
        primaryStrategy: 'testId',
        fallbacks: [
          { selector: 'table.data-grid', strategy: 'css' },
        ],
        description: 'Payroll runs table',
      },
      payrollRunRow: {
        primary: "tr[data-testid='payroll-run-row']",
        primaryStrategy: 'testId',
        fallbacks: [
          { selector: 'tbody tr', strategy: 'css' },
        ],
        description: 'Payroll run row',
      },
      batchIdCell: {
        primary: "td[data-field='batchId']",
        primaryStrategy: 'css',
        fallbacks: [],
        description: 'Batch ID cell',
      },
      dateCell: {
        primary: "td[data-field='payrollDate']",
        primaryStrategy: 'css',
        fallbacks: [],
        description: 'Date cell',
      },
      statusCell: {
        primary: "td[data-field='status']",
        primaryStrategy: 'css',
        fallbacks: [],
        description: 'Status cell',
      },
      entryTypeDropdown: {
        primary: "select[name='entryType']",
        primaryStrategy: 'css',
        fallbacks: [],
        description: 'Entry type dropdown',
      },
      downloadButton: {
        primary: "button:has-text('Download')",
        primaryStrategy: 'text',
        fallbacks: [],
        description: 'Download button',
      },
      csvFormatOption: {
        primary: "input[value='csv']",
        primaryStrategy: 'css',
        fallbacks: [],
        description: 'CSV format option',
      },
    },

    popups: {
      closeButton: {
        primary: "button[aria-label='Close']",
        primaryStrategy: 'css',
        fallbacks: [],
        description: 'Close button',
      },
      modalContainer: {
        primary: "[role='dialog']",
        primaryStrategy: 'role',
        fallbacks: [],
        description: 'Modal container',
      },
    },

    session: {
      sessionExpiredModal: {
        primary: "[data-testid='session-expired']",
        primaryStrategy: 'testId',
        fallbacks: [],
        description: 'Session expired modal',
      },
      loginRequiredText: ['Your session has expired', 'Please log in again'],
      loginPageIndicators: ['/login', '/signin'],
    },

    timeouts: {
      pageLoad: 60000,
      elementWait: 30000,
      downloadWait: 120000,
      mfaWait: 180000,
      shortWait: 5000,
    },
  };
}

// ==================== EXPORTS ====================

export {
  CONFIG_PATH,
  type SelectorWithFallbacks,
  type SelectorStrategy,
  type PageSelectors,
  type MFAIndicators,
};
