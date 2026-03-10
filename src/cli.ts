/**
 * CLI Argument Parsing and Help for ADP-to-Intacct Payroll Automation
 *
 * Features:
 * - Parse command-line arguments
 * - Display help information
 * - Validate commands and options
 */

// ==================== TYPES ====================

export type Command =
  | 'process-latest'
  | 'process-week'
  | 'dry-run'
  | 'retry-failed'
  | 'force-reupload'
  | 'status'
  | 'help'
  | 'version';

export interface CLIOptions {
  /** The command to execute */
  command: Command;
  /** Dry run mode - no actual uploads */
  dryRun: boolean;
  /** Test mode - process only 1 entry */
  testMode: boolean;
  /** Force reupload of already uploaded entries */
  force: boolean;
  /** Verbose logging */
  verbose: boolean;
  /** Quiet mode - minimal output */
  quiet: boolean;
  /** Specific batch ID to process */
  batchId?: string;
  /** Specific date to process (YYYY-MM-DD) */
  date?: string;
  /** Start date for date range (YYYY-MM-DD) */
  startDate?: string;
  /** End date for date range (YYYY-MM-DD) */
  endDate?: string;
  /** Skip ADP download (use existing files) */
  skipDownload: boolean;
  /** Skip validation step */
  skipValidation: boolean;
  /** Config file path */
  configFile?: string;
  /** Headless browser mode */
  headless: boolean;
}

export interface ParseResult {
  /** Whether parsing succeeded */
  success: boolean;
  /** Parsed options */
  options?: CLIOptions;
  /** Error message if parsing failed */
  error?: string;
  /** Whether to show help */
  showHelp: boolean;
}

// ==================== CONSTANTS ====================

const COMMANDS: Record<Command, string> = {
  'process-latest': 'Process the most recent payroll batch',
  'process-week': 'Process all payroll batches for the current/specified week',
  'dry-run': 'Simulate processing without uploading to Intacct',
  'retry-failed': 'Retry all previously failed uploads',
  'force-reupload': 'Force re-upload of already uploaded entries',
  'status': 'Show current processing status and statistics',
  'help': 'Show this help message',
  'version': 'Show version information',
};

const VERSION = '1.0.0';

// ==================== HELP TEXT ====================

export function getHelpText(): string {
  const commandList = Object.entries(COMMANDS)
    .map(([cmd, desc]) => `  ${cmd.padEnd(18)} ${desc}`)
    .join('\n');

  return `
ADP-to-Intacct Payroll Automation CLI
=====================================

USAGE:
  npx ts-node src/index.ts <command> [options]
  npm run <script> [-- options]

COMMANDS:
${commandList}

OPTIONS:
  --dry-run, -d         Simulate processing without uploading
  --test, -t            Test mode: process only 1 entry
  --force, -f           Force re-process already uploaded entries
  --verbose, -v         Enable verbose logging
  --quiet, -q           Minimal output (errors only)
  --batch-id=<id>       Process specific batch ID
  --date=<YYYY-MM-DD>   Process specific date
  --start-date=<date>   Start date for range processing
  --end-date=<date>     End date for range processing
  --skip-download       Skip ADP download, use existing files
  --skip-validation     Skip validation step
  --config=<path>       Path to config file
  --headless            Run browser in headless mode
  --help, -h            Show this help message
  --version             Show version

EXAMPLES:
  # Process the latest payroll batch
  npm run process-latest

  # Dry run to see what would be processed
  npm run dry-run

  # Process with verbose logging
  npm run process-latest -- --verbose

  # Process specific date
  npx ts-node src/index.ts process-latest --date=2024-01-15

  # Retry failed uploads
  npm run retry-failed

  # Force re-upload a specific batch
  npx ts-node src/index.ts force-reupload --batch-id=PAY-2024-001

ENVIRONMENT VARIABLES:
  ADP_USERNAME          ADP login username
  ADP_PASSWORD          ADP login password
  ADP_LOGIN_URL         ADP login URL
  INTACCT_COMPANY_ID    Intacct company ID
  INTACCT_USER_ID       Intacct user ID
  INTACCT_PASSWORD      Intacct password
  LOG_LEVEL             Logging level (debug, info, warn, error)
  DISABLE_SCREENSHOTS   Disable screenshot capture (true/false)

For more information, see the documentation:
  - README.md         - Quick start guide
  - docs/SETUP.md     - Detailed setup instructions
  - docs/RUNBOOK.md   - Weekly execution runbook
  - docs/TROUBLESHOOTING.md - Common issues and fixes
`;
}

export function getVersionText(): string {
  return `ADP-to-Intacct Payroll Automation v${VERSION}`;
}

// ==================== ARGUMENT PARSING ====================

/**
 * Parse command-line arguments
 */
export function parseArgs(argv: string[]): ParseResult {
  // Remove node and script path
  const args = argv.slice(2);

  // Default options
  const options: CLIOptions = {
    command: 'help',
    dryRun: false,
    testMode: false,
    force: false,
    verbose: false,
    quiet: false,
    skipDownload: false,
    skipValidation: false,
    headless: false,
  };

  // Check for help/version flags first
  if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
    return { success: true, options: { ...options, command: 'help' }, showHelp: true };
  }

  if (args.includes('--version')) {
    return { success: true, options: { ...options, command: 'version' }, showHelp: false };
  }

  // Parse command
  const commandArg = args[0];
  if (!commandArg.startsWith('-')) {
    if (commandArg in COMMANDS) {
      options.command = commandArg as Command;
    } else {
      return {
        success: false,
        error: `Unknown command: ${commandArg}\nRun with --help to see available commands.`,
        showHelp: false,
      };
    }
  }

  // Parse options
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    // Boolean flags
    if (arg === '--dry-run' || arg === '-d') {
      options.dryRun = true;
    } else if (arg === '--test' || arg === '-t') {
      options.testMode = true;
    } else if (arg === '--force' || arg === '-f') {
      options.force = true;
    } else if (arg === '--verbose' || arg === '-v') {
      options.verbose = true;
    } else if (arg === '--quiet' || arg === '-q') {
      options.quiet = true;
    } else if (arg === '--skip-download') {
      options.skipDownload = true;
    } else if (arg === '--skip-validation') {
      options.skipValidation = true;
    } else if (arg === '--headless') {
      options.headless = true;
    }
    // Options with values
    else if (arg.startsWith('--batch-id=')) {
      options.batchId = arg.split('=')[1];
    } else if (arg.startsWith('--date=')) {
      options.date = arg.split('=')[1];
      if (!isValidDate(options.date)) {
        return {
          success: false,
          error: `Invalid date format: ${options.date}. Use YYYY-MM-DD.`,
          showHelp: false,
        };
      }
    } else if (arg.startsWith('--start-date=')) {
      options.startDate = arg.split('=')[1];
      if (!isValidDate(options.startDate)) {
        return {
          success: false,
          error: `Invalid start date format: ${options.startDate}. Use YYYY-MM-DD.`,
          showHelp: false,
        };
      }
    } else if (arg.startsWith('--end-date=')) {
      options.endDate = arg.split('=')[1];
      if (!isValidDate(options.endDate)) {
        return {
          success: false,
          error: `Invalid end date format: ${options.endDate}. Use YYYY-MM-DD.`,
          showHelp: false,
        };
      }
    } else if (arg.startsWith('--config=')) {
      options.configFile = arg.split('=')[1];
    }
  }

  // Handle dry-run command
  if (options.command === 'dry-run') {
    options.dryRun = true;
    // Set actual command to process-latest for dry-run
    options.command = 'process-latest';
  }

  // Validate conflicting options
  if (options.verbose && options.quiet) {
    return {
      success: false,
      error: 'Cannot use both --verbose and --quiet options.',
      showHelp: false,
    };
  }

  return { success: true, options, showHelp: false };
}

/**
 * Validate date string format (YYYY-MM-DD)
 */
function isValidDate(dateStr: string): boolean {
  const regex = /^\d{4}-\d{2}-\d{2}$/;
  if (!regex.test(dateStr)) {
    return false;
  }

  const date = new Date(dateStr);
  return !isNaN(date.getTime());
}

// ==================== VALIDATION ====================

/**
 * Validate required environment variables for a command
 */
export function validateEnvironment(command: Command): { valid: boolean; missing: string[] } {
  const missing: string[] = [];

  // Commands that need ADP credentials
  const needsADP = ['process-latest', 'process-week'];
  if (needsADP.includes(command)) {
    if (!process.env.ADP_USERNAME) missing.push('ADP_USERNAME');
    if (!process.env.ADP_PASSWORD) missing.push('ADP_PASSWORD');
  }

  // Commands that need Intacct credentials
  const needsIntacct = ['process-latest', 'process-week', 'retry-failed', 'force-reupload'];
  if (needsIntacct.includes(command)) {
    if (!process.env.INTACCT_COMPANY_ID) missing.push('INTACCT_COMPANY_ID');
    if (!process.env.INTACCT_USER_ID) missing.push('INTACCT_USER_ID');
    if (!process.env.INTACCT_PASSWORD) missing.push('INTACCT_PASSWORD');
  }

  return { valid: missing.length === 0, missing };
}

export default parseArgs;
