/**
 * ADP Automation Type Definitions
 *
 * TypeScript interfaces for the ADP browser automation module.
 * These types define the structure of credentials, configuration,
 * payroll entries, and download results.
 */

// ==================== CREDENTIALS ====================

/**
 * ADP login credentials
 * These should be loaded from environment variables, never hardcoded
 */
export interface ADPCredentials {
  /** ADP username (from ADP_USERNAME env var) */
  username: string;
  /** ADP password (from ADP_PASSWORD env var) */
  password: string;
  /** ADP login URL (from ADP_LOGIN_URL env var) */
  loginUrl: string;
}

// ==================== CONFIGURATION ====================

/**
 * ADP automation configuration
 */
export interface ADPConfig {
  /** Base URL for ADP login */
  loginUrl: string;
  /** Download directory for payroll files */
  downloadDir: string;
  /** Timeout for page loads (ms) */
  pageTimeout: number;
  /** Timeout for element interactions (ms) */
  elementTimeout: number;
  /** Timeout for file downloads (ms) */
  downloadTimeout: number;
  /** Maximum retry attempts */
  maxRetries: number;
  /** Base delay for exponential backoff (ms) */
  retryBaseDelay: number;
  /** Whether to capture screenshots */
  captureScreenshots: boolean;
  /** Screenshot directory */
  screenshotDir: string;
  /** Payroll entry types to download */
  entryTypes: PayrollEntryType[];
  /** Session timeout threshold (ms) - triggers re-login */
  sessionTimeout: number;
}

/**
 * Default configuration values
 */
export const DEFAULT_ADP_CONFIG: ADPConfig = {
  loginUrl: process.env.ADP_LOGIN_URL || 'https://workforcenow.adp.com/',
  downloadDir: './downloads/payroll-gl',
  pageTimeout: 60000,
  elementTimeout: 30000,
  downloadTimeout: 120000,
  maxRetries: 3,
  retryBaseDelay: 1000,
  captureScreenshots: true,
  screenshotDir: './screenshots/adp',
  entryTypes: ['payroll', 'tax', 'deductions'],
  sessionTimeout: 1800000, // 30 minutes
};

// ==================== PAYROLL ENTRIES ====================

/**
 * Types of payroll journal entries available in ADP
 */
export type PayrollEntryType =
  | 'payroll'      // Main payroll entries
  | 'tax'          // Tax-related entries
  | 'deductions'   // Deductions entries
  | 'benefits'     // Benefits entries
  | 'adjustments'  // Adjustment entries
  | 'accruals';    // Accrual entries

/**
 * Represents a payroll journal entry in the ADP system
 */
export interface PayrollEntry {
  /** Unique identifier for the payroll run */
  batchId: string;
  /** Type of entry */
  entryType: PayrollEntryType;
  /** Date of the payroll run */
  payrollDate: Date;
  /** Check/pay date */
  checkDate: Date;
  /** Description of the payroll run */
  description: string;
  /** Status (e.g., 'Posted', 'Pending') */
  status: string;
  /** Company code (if multi-company) */
  companyCode?: string;
  /** Whether the entry is available for download */
  downloadAvailable: boolean;
  /** URL or identifier for downloading */
  downloadRef?: string;
}

/**
 * Metadata for a detected payroll run
 */
export interface PayrollRunInfo {
  /** Unique batch ID */
  batchId: string;
  /** Pay period start date */
  periodStart: Date;
  /** Pay period end date */
  periodEnd: Date;
  /** Check/pay date */
  checkDate: Date;
  /** Available entry types for this run */
  availableEntryTypes: PayrollEntryType[];
  /** Status of the payroll run */
  status: 'completed' | 'pending' | 'processing';
}

// ==================== DOWNLOAD RESULTS ====================

/**
 * Result of a single file download operation
 */
export interface DownloadResult {
  /** Whether the download was successful */
  success: boolean;
  /** Downloaded filename (with full path) */
  filename: string;
  /** Original filename from ADP */
  originalFilename?: string;
  /** Timestamp of download completion */
  downloadedAt: Date;
  /** Date of the payroll run */
  payrollDate: Date;
  /** Batch ID of the payroll run */
  batchId: string;
  /** Type of entry */
  entryType: PayrollEntryType;
  /** Number of rows in the downloaded file */
  rowCount: number;
  /** File size in bytes */
  fileSizeBytes: number;
  /** Error message if download failed */
  error?: string;
  /** Path to screenshot taken after download */
  screenshotPath?: string;
}

/**
 * Aggregated result of a download batch operation
 */
export interface BatchDownloadResult {
  /** Overall success status */
  success: boolean;
  /** Total number of downloads attempted */
  totalAttempted: number;
  /** Number of successful downloads */
  successCount: number;
  /** Number of failed downloads */
  failureCount: number;
  /** Individual download results */
  downloads: DownloadResult[];
  /** Start time of the batch operation */
  startedAt: Date;
  /** End time of the batch operation */
  completedAt: Date;
  /** Total duration in milliseconds */
  durationMs: number;
}

// ==================== LOGIN & SESSION ====================

/**
 * Result of a login attempt
 */
export interface LoginResult {
  /** Whether login was successful */
  success: boolean;
  /** Human-readable message */
  message: string;
  /** MFA was required and waiting for user */
  mfaRequired?: boolean;
  /** Session token or identifier */
  sessionId?: string;
  /** Path to screenshot of dashboard after login */
  screenshotPath?: string;
  /** Error details if login failed */
  error?: string;
  /** Number of attempts made */
  attemptCount?: number;
}

/**
 * Session state tracking
 */
export interface SessionState {
  /** Whether user is currently logged in */
  isLoggedIn: boolean;
  /** Timestamp of last successful login */
  lastLoginAt?: Date;
  /** Timestamp of last activity */
  lastActivityAt?: Date;
  /** Session identifier */
  sessionId?: string;
  /** Whether session is expired */
  isExpired: boolean;
}

// ==================== NAVIGATION ====================

/**
 * Result of a navigation operation
 */
export interface NavigationResult {
  /** Whether navigation was successful */
  success: boolean;
  /** Current page URL after navigation */
  currentUrl: string;
  /** Whether the expected page was reached */
  atExpectedPage: boolean;
  /** Title of the current page */
  pageTitle?: string;
  /** Path to screenshot */
  screenshotPath?: string;
  /** Error message if navigation failed */
  error?: string;
}

// ==================== SELECTORS ====================

/**
 * Selector with fallbacks for resilient element location
 */
export interface SelectorWithFallbacks {
  /** Primary selector (preferred) */
  primary: string;
  /** Strategy for primary selector */
  primaryStrategy: SelectorStrategy;
  /** Fallback selectors in order of preference */
  fallbacks: Array<{
    selector: string;
    strategy: SelectorStrategy;
  }>;
  /** Human-readable description for logging */
  description: string;
}

/**
 * Selector strategy types
 */
export type SelectorStrategy =
  | 'role'        // ARIA role-based (most resilient)
  | 'label'       // Label text-based
  | 'text'        // Visible text content
  | 'testId'      // data-testid attribute
  | 'css'         // CSS selector (least resilient)
  | 'xpath';      // XPath expression

/**
 * Collection of selectors for a page section
 */
export interface PageSelectors {
  [elementName: string]: SelectorWithFallbacks;
}

/**
 * MFA detection indicators
 */
export interface MFAIndicators {
  /** Selectors that indicate MFA page */
  pageSelectors: string[];
  /** URL patterns that indicate MFA */
  urlPatterns: string[];
  /** Text patterns on MFA page */
  textPatterns: string[];
}

// ==================== ERROR TYPES ====================

/**
 * Custom error types for ADP automation
 */
export class ADPAutomationError extends Error {
  constructor(
    message: string,
    public readonly code: ADPErrorCode,
    public readonly details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'ADPAutomationError';
  }
}

export type ADPErrorCode =
  | 'LOGIN_FAILED'
  | 'MFA_TIMEOUT'
  | 'SESSION_EXPIRED'
  | 'NAVIGATION_FAILED'
  | 'ELEMENT_NOT_FOUND'
  | 'DOWNLOAD_FAILED'
  | 'FILE_VALIDATION_FAILED'
  | 'TIMEOUT'
  | 'UNKNOWN';

// ==================== FILE VALIDATION ====================

/**
 * File validation result
 */
export interface FileValidationResult {
  /** Whether the file is valid */
  isValid: boolean;
  /** File exists on disk */
  exists: boolean;
  /** File is not empty */
  hasContent: boolean;
  /** File has expected CSV structure */
  hasValidStructure: boolean;
  /** Number of rows (excluding header) */
  rowCount: number;
  /** Number of columns */
  columnCount: number;
  /** Column headers found */
  headers?: string[];
  /** Validation errors */
  errors: string[];
}
