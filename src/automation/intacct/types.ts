/**
 * Sage Intacct Browser Automation Types
 *
 * TypeScript interfaces for the journal entry upload automation module.
 * These types define the structure of credentials, results, and configurations.
 */

/**
 * Credentials for Intacct login
 * All values should come from environment variables - never hardcode credentials
 */
export interface IntacctCredentials {
  /** Company ID for Intacct login */
  companyId: string;
  /** User ID for Intacct login */
  userId: string;
  /** User password for Intacct login */
  password: string;
  /** Optional custom login URL (uses default if not provided) */
  loginUrl?: string;
}

/**
 * Environment variable names for credentials
 */
export const INTACCT_ENV_VARS = {
  COMPANY_ID: 'INTACCT_COMPANY_ID',
  USER_ID: 'INTACCT_USER_ID',
  PASSWORD: 'INTACCT_PASSWORD',
  LOGIN_URL: 'INTACCT_LOGIN_URL',
} as const;

/**
 * Result of a journal entry upload operation
 */
export interface UploadResult {
  /** Whether the upload was successful */
  success: boolean;
  /** Number of journal entries created */
  entriesCreated: number;
  /** List of warning messages from Intacct */
  warnings: string[];
  /** List of error messages from Intacct */
  errors: string[];
  /** Path to the screenshot taken after upload */
  screenshotPath?: string;
  /** Timestamp of the upload */
  timestamp: Date;
  /** Duration of the upload operation in milliseconds */
  durationMs?: number;
  /** IDs of created journal entries */
  journalEntryIds?: string[];
  /** Whether duplicate entries were detected */
  duplicatesDetected?: boolean;
  /** Details about duplicates if detected */
  duplicateDetails?: DuplicateEntryInfo[];
}

/**
 * Information about a duplicate entry detected during upload
 */
export interface DuplicateEntryInfo {
  /** Journal number of the duplicate */
  journalNumber: string;
  /** Date of the existing entry */
  existingDate: string;
  /** Description of the existing entry */
  description?: string;
}

/**
 * Confirmation details for a created journal entry
 */
export interface JournalEntryConfirmation {
  /** Unique identifier/record number from Intacct */
  recordNo: string;
  /** Journal entry number */
  journalNumber: string;
  /** Journal entry symbol/type (e.g., "GJ" for General Journal) */
  symbol: string;
  /** Date of the journal entry */
  entryDate: string;
  /** Description of the journal entry */
  description: string;
  /** Total debit amount */
  totalDebit: number;
  /** Total credit amount */
  totalCredit: number;
  /** Number of line items */
  lineCount: number;
  /** State of the entry (e.g., "Posted", "Draft") */
  state: JournalEntryState;
  /** Entity/location the entry belongs to */
  entity?: string;
}

/**
 * Possible states of a journal entry in Intacct
 */
export type JournalEntryState =
  | 'Draft'
  | 'Submitted'
  | 'Approved'
  | 'Posted'
  | 'Reversed'
  | 'Unknown';

/**
 * Configuration for the Intacct automation module
 */
export interface IntacctConfig {
  /** Base URL for Intacct (default: https://www.intacct.com) */
  baseUrl: string;
  /** Default timeout for page operations in milliseconds */
  defaultTimeout: number;
  /** Number of retry attempts for failed operations */
  retryAttempts: number;
  /** Base delay for exponential backoff in milliseconds */
  retryBaseDelay: number;
  /** Directory for storing screenshots */
  screenshotDir: string;
  /** Whether to run browser in headless mode */
  headless: boolean;
  /** Viewport width */
  viewportWidth: number;
  /** Viewport height */
  viewportHeight: number;
  /** Maximum time to wait for MFA completion in milliseconds */
  mfaTimeout: number;
  /** Session timeout detection threshold in milliseconds */
  sessionTimeout: number;
}

/**
 * Default configuration values
 */
export const DEFAULT_INTACCT_CONFIG: IntacctConfig = {
  baseUrl: 'https://www.intacct.com',
  defaultTimeout: 30000,
  retryAttempts: 3,
  retryBaseDelay: 1000,
  screenshotDir: './screenshots',
  headless: false,
  viewportWidth: 1920,
  viewportHeight: 1080,
  mfaTimeout: 120000, // 2 minutes for MFA
  sessionTimeout: 1800000, // 30 minutes
};

/**
 * Session state for tracking login status
 */
export interface SessionState {
  /** Whether user is currently logged in */
  isLoggedIn: boolean;
  /** Timestamp of last successful login */
  loginTime?: Date;
  /** Timestamp of last activity */
  lastActivityTime?: Date;
  /** Current page URL */
  currentUrl?: string;
  /** Company ID of current session */
  companyId?: string;
  /** User ID of current session */
  userId?: string;
}

/**
 * Login result with session details
 */
export interface LoginResult {
  /** Whether login was successful */
  success: boolean;
  /** Error message if login failed */
  error?: string;
  /** Path to screenshot taken after login */
  screenshotPath?: string;
  /** Whether MFA was required */
  mfaRequired: boolean;
  /** Session state after login */
  session?: SessionState;
  /** Number of attempts taken to login */
  attemptCount: number;
}

/**
 * Navigation result
 */
export interface NavigationResult {
  /** Whether navigation was successful */
  success: boolean;
  /** Error message if navigation failed */
  error?: string;
  /** Path to screenshot taken at destination */
  screenshotPath?: string;
  /** Current page URL after navigation */
  currentUrl?: string;
  /** Page title after navigation */
  pageTitle?: string;
  /** Whether the correct page was reached */
  isCorrectPage: boolean;
}

/**
 * File upload options
 */
export interface UploadOptions {
  /** Path to the file to upload */
  filePath: string;
  /** Expected number of entries in the file */
  expectedEntryCount?: number;
  /** Whether to skip duplicate checking */
  skipDuplicateCheck?: boolean;
  /** Description to add to the import */
  importDescription?: string;
  /** Whether to auto-post entries after import */
  autoPost?: boolean;
}

/**
 * Validation result for uploaded entries
 */
export interface ValidationResult {
  /** Whether validation passed */
  isValid: boolean;
  /** List of validation errors */
  errors: ValidationError[];
  /** List of validation warnings */
  warnings: ValidationWarning[];
  /** Number of entries validated */
  entryCount: number;
  /** Confirmed journal entry details */
  entries: JournalEntryConfirmation[];
  /** Total debits across all entries */
  totalDebits: number;
  /** Total credits across all entries */
  totalCredits: number;
  /** Whether debits and credits balance */
  isBalanced: boolean;
}

/**
 * Validation error details
 */
export interface ValidationError {
  /** Error code from Intacct */
  code: string;
  /** Error message */
  message: string;
  /** Line number in import file (if applicable) */
  lineNumber?: number;
  /** Field that caused the error (if applicable) */
  field?: string;
}

/**
 * Validation warning details
 */
export interface ValidationWarning {
  /** Warning code from Intacct */
  code: string;
  /** Warning message */
  message: string;
  /** Line number in import file (if applicable) */
  lineNumber?: number;
  /** Suggested action to resolve warning */
  suggestion?: string;
}

/**
 * MFA prompt detection result
 */
export interface MfaPromptResult {
  /** Whether MFA prompt was detected */
  detected: boolean;
  /** Type of MFA if detected */
  mfaType?: 'sms' | 'email' | 'authenticator' | 'unknown';
  /** Message displayed on MFA prompt */
  promptMessage?: string;
}

/**
 * Screenshot metadata
 */
export interface ScreenshotInfo {
  /** Full path to screenshot file */
  path: string;
  /** Timestamp when screenshot was taken */
  timestamp: Date;
  /** Description of what the screenshot shows */
  description: string;
  /** Step in the process when screenshot was taken */
  step: string;
}

/**
 * Error types specific to Intacct automation
 */
export class IntacctAutomationError extends Error {
  constructor(
    message: string,
    public readonly code: IntacctErrorCode,
    public readonly details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'IntacctAutomationError';
  }
}

/**
 * Error codes for Intacct automation
 */
export type IntacctErrorCode =
  | 'LOGIN_FAILED'
  | 'MFA_TIMEOUT'
  | 'SESSION_EXPIRED'
  | 'NAVIGATION_FAILED'
  | 'PAGE_NOT_FOUND'
  | 'UPLOAD_FAILED'
  | 'DUPLICATE_ENTRY'
  | 'VALIDATION_FAILED'
  | 'SELECTOR_NOT_FOUND'
  | 'TIMEOUT'
  | 'NETWORK_ERROR'
  | 'UNKNOWN_ERROR';
