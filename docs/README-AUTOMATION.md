# ADP-to-Intacct Payroll Automation System

This automation system downloads payroll journal entries from ADP Workforce Now and uploads them to Sage Intacct, eliminating manual data entry and reducing errors.

## Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Configuration](#configuration)
- [Usage](#usage)
- [CLI Commands](#cli-commands)
- [Workflow](#workflow)
- [Troubleshooting](#troubleshooting)
- [Security](#security)
- [Development](#development)

---

## Overview

### What This System Does

1. **Logs into ADP Workforce Now** using browser automation (Playwright)
2. **Navigates to GL Reports** and downloads payroll journal entries
3. **Transforms the data** to Intacct-compatible format (account/department mapping)
4. **Logs into Sage Intacct** via browser automation
5. **Uploads journal entries** and validates the results
6. **Reports results** with detailed logging and screenshots

### Key Features

- **MFA Support**: Pauses for manual MFA completion when required
- **Resilient Selectors**: Uses multiple fallback selectors for reliability
- **Retry Logic**: Automatic retries with exponential backoff
- **Dry-Run Mode**: Test the workflow without uploading to Intacct
- **Test Mode**: Process only one entry for verification
- **Comprehensive Logging**: Detailed logs and screenshots for debugging
- **Session Management**: Detects and handles session timeouts

---

## Architecture

```
src/automation/
├── index.ts              # Main orchestration entry point
├── adp/                  # ADP automation modules
│   ├── index.ts          # ADP module exports
│   ├── login.ts          # ADP login with MFA support
│   ├── navigate-gl.ts    # Navigation to GL Reports
│   ├── download-entries.ts # Payroll entry downloads
│   ├── selectors.ts      # UI selectors with fallbacks
│   └── types.ts          # TypeScript type definitions
├── intacct/              # Intacct automation modules
│   ├── index.ts          # Intacct module exports
│   ├── login.ts          # Intacct login with MFA support
│   ├── navigate-import.ts # Navigation to Journal Import
│   ├── upload-journal.ts  # Journal entry upload
│   ├── validate-upload.ts # Upload validation
│   ├── selectors.ts      # UI selectors with fallbacks
│   └── types.ts          # TypeScript type definitions
└── utils/
    └── logger.ts         # Structured logging utility
```

### Data Flow

```
ADP Workforce Now                    Sage Intacct
      │                                   │
      ▼                                   │
┌─────────────┐                           │
│   Login     │ ◄── MFA if required       │
└─────────────┘                           │
      │                                   │
      ▼                                   │
┌─────────────┐                           │
│  Navigate   │                           │
│  to GL      │                           │
└─────────────┘                           │
      │                                   │
      ▼                                   │
┌─────────────┐                           │
│  Download   │                           │
│  Payroll    │──────► CSV Files          │
└─────────────┘             │             │
                            ▼             │
                    ┌─────────────┐       │
                    │  Transform  │       │
                    │  & Map      │       │
                    └─────────────┘       │
                            │             │
                            ▼             │
                    ┌─────────────┐       │
                    │   Login     │───────►
                    └─────────────┘       │
                            │             │
                            ▼             │
                    ┌─────────────┐       │
                    │   Upload    │───────►
                    └─────────────┘       │
                            │             │
                            ▼             │
                    ┌─────────────┐       │
                    │  Validate   │───────►
                    └─────────────┘       │
```

---

## Prerequisites

### System Requirements

- **Node.js**: Version 18.x or higher
- **npm**: Version 8.x or higher (comes with Node.js)
- **Operating System**: Windows, macOS, or Linux

### Account Requirements

- **ADP Workforce Now** account with access to GL Reports
- **Sage Intacct** account with permission to create journal entries
- MFA devices ready for both systems (if enabled)

### Dependencies

The system uses:
- **Playwright**: Browser automation
- **dotenv**: Environment variable management
- **better-sqlite3**: Local state database (optional)

---

## Installation

### 1. Clone the Repository

```bash
git clone <repository-url>
cd AHS-Sage-Dashboard-imports
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Install Playwright Browsers

```bash
npx playwright install chromium
```

On Linux, you may also need system dependencies:

```bash
npx playwright install-deps
```

### 4. Configure Environment

```bash
# Copy the example environment file
cp .env.example .env

# Edit with your credentials
nano .env  # or use your preferred editor
```

### 5. Verify Installation

```bash
# Run a dry-run test
npm run payroll:dry-run
```

---

## Configuration

### Environment Variables

Create a `.env` file with the following variables:

```env
# ============================================
# ADP Credentials (REQUIRED)
# ============================================
ADP_USERNAME="your-adp-username"
ADP_PASSWORD="your-adp-password"
ADP_LOGIN_URL="https://workforcenow.adp.com/"

# ============================================
# Sage Intacct Credentials (REQUIRED)
# ============================================
INTACCT_COMPANY_ID="your-company-id"
INTACCT_USER_ID="your-user-id"
INTACCT_PASSWORD="your-password"
INTACCT_LOGIN_URL="https://www.intacct.com/ia/acct/login.phtml"

# ============================================
# Automation Settings
# ============================================
# Log level: debug, info, warn, error
LOG_LEVEL="info"

# Capture screenshots during automation
SCREENSHOTS_ENABLED="true"

# Dry-run mode (no Intacct upload)
DRY_RUN="false"

# ============================================
# Browser Settings
# ============================================
# Run browser in headless mode (set to false for debugging)
HEADLESS="false"

# ============================================
# Timeout Settings (milliseconds)
# ============================================
PAGE_TIMEOUT="60000"
ELEMENT_TIMEOUT="30000"
DOWNLOAD_TIMEOUT="120000"
MFA_TIMEOUT="120000"

# ============================================
# Retry Settings
# ============================================
MAX_RETRIES="3"
RETRY_BASE_DELAY="1000"

# ============================================
# Directory Paths (optional)
# ============================================
DOWNLOAD_DIR="./downloads/payroll-gl"
EXPORT_DIR="./exports/intacct-ready"
SCREENSHOT_DIR="./screenshots"
LOG_DIR="./logs"
```

### Security Notes

- **NEVER** commit `.env` to version control
- Store credentials securely
- Use environment variables in CI/CD pipelines
- Consider using a secrets manager for production

---

## Usage

### Quick Start

```bash
# Process the latest payroll
npm run payroll:process

# Preview without uploading (dry-run)
npm run payroll:dry-run

# Retry failed entries from previous run
npm run payroll:retry
```

### Step-by-Step Process

1. **Prepare for MFA**: Have your MFA device ready
2. **Start the automation**: Run `npm run payroll:process`
3. **Complete MFA when prompted**: The browser will pause for MFA
4. **Monitor progress**: Watch the console for status updates
5. **Review results**: Check the summary at completion

### Example Output

```
ADP-to-Intacct Payroll Automation
Starting...

[10:15:32] INFO  [orchestration] Configuration loaded
[10:15:32] INFO  [orchestration] === Starting ADP Phase ===
[10:15:33] INFO  [adp:login] Navigating to login page
[10:15:35] INFO  [adp:login] Login form submitted

============================================================
MFA VERIFICATION REQUIRED
============================================================
Please complete the MFA verification in the browser window.
The automation will resume once you reach the dashboard.
Timeout: 120 seconds
============================================================

[10:16:02] INFO  [adp:login] Login successful
[10:16:05] INFO  [adp:navigate-gl] Navigation to GL Reports successful
[10:16:10] INFO  [adp:download-entries] Downloading payroll entry
[10:16:25] INFO  [adp:download-entries] Download completed

============================================================
         ADP-TO-INTACCT PAYROLL AUTOMATION
============================================================

STATUS: SUCCESS

Results:
  Processed:  3
  Uploaded:   3
  Failed:     0
  Skipped:    0
  Duration:   45.23s

============================================================
```

---

## CLI Commands

### NPM Scripts

| Command | Description |
|---------|-------------|
| `npm run payroll:process` | Run full automation |
| `npm run payroll:dry-run` | Preview without uploading |
| `npm run payroll:retry` | Retry failed entries |
| `npm run payroll:status` | Show processing status |
| `npm run payroll:help` | Show help information |

### Command-Line Options

```bash
# Enable dry-run mode
npm run payroll:process -- --dry-run

# Enable test mode (1 entry only)
npm run payroll:process -- --test

# Retry failed entries
npm run payroll:process -- --retry-failed

# Verbose logging
LOG_LEVEL=debug npm run payroll:process
```

### Environment Variable Overrides

```bash
# Run with specific settings
DRY_RUN=true npm run payroll:process
HEADLESS=false npm run payroll:process
LOG_LEVEL=debug npm run payroll:process
```

---

## Workflow

### Weekly Payroll Processing

1. **Monday Morning**: Check that payroll is posted in ADP
2. **Pre-flight Check**: Run `npm run payroll:dry-run`
3. **Process Payroll**: Run `npm run payroll:process`
4. **Verify in Intacct**: Check journal entries were created
5. **Handle Failures**: Use `npm run payroll:retry` if needed

### Automated Scheduling

#### Windows Task Scheduler

```
Program: cmd.exe
Arguments: /c cd C:\path\to\project && npm run payroll:process
Schedule: Weekly, Monday at 10:00 AM
```

#### Linux/macOS Cron

```cron
# Run every Monday at 10:00 AM
0 10 * * 1 cd /path/to/project && npm run payroll:process >> /var/log/payroll.log 2>&1
```

---

## Troubleshooting

See [TROUBLESHOOTING.md](./TROUBLESHOOTING.md) for detailed solutions to common issues.

### Quick Fixes

| Issue | Solution |
|-------|----------|
| Login fails | Check credentials in `.env` |
| MFA timeout | Increase `MFA_TIMEOUT`, have device ready |
| Element not found | Check for UI changes, update selectors |
| Browser doesn't open | Set `HEADLESS=false`, run `npx playwright install` |
| Download fails | Check disk space, network connectivity |

### Debug Mode

Run with verbose logging to diagnose issues:

```bash
LOG_LEVEL=debug HEADLESS=false npm run payroll:process
```

---

## Security

### Credential Management

- Credentials are loaded from environment variables
- Never hardcode credentials in source code
- The `.env` file is excluded from git via `.gitignore`

### Session Security

- Sessions are not persisted between runs
- Browser state is cleared after each run
- No cookies or tokens are stored

### Access Control

- Use dedicated service accounts with minimal permissions
- ADP account needs read-only access to GL Reports
- Intacct account needs journal entry creation permission only

---

## Development

### Project Structure

```
.
├── src/
│   └── automation/
│       ├── index.ts          # Main entry point
│       ├── adp/              # ADP modules
│       ├── intacct/          # Intacct modules
│       └── utils/            # Utilities
├── config/
│   ├── adp-selectors.json    # ADP UI selectors
│   └── intacct-selectors.json # Intacct UI selectors
├── docs/
│   ├── README-AUTOMATION.md  # This file
│   ├── RUNBOOK.md           # Weekly procedures
│   └── TROUBLESHOOTING.md   # Troubleshooting guide
├── downloads/                # Downloaded ADP files
├── exports/                  # Transformed files
├── screenshots/              # Debug screenshots
├── logs/                     # Log files
├── .env.example              # Environment template
└── package.json              # Dependencies and scripts
```

### Adding New Features

1. Create feature branch
2. Implement changes
3. Add tests
4. Update documentation
5. Submit pull request

### Updating Selectors

When ADP or Intacct updates their UI:

1. Run in non-headless mode to see the new UI
2. Use browser DevTools to find new selectors
3. Update `config/adp-selectors.json` or `config/intacct-selectors.json`
4. Add multiple fallback selectors for resilience

---

## Support

### Getting Help

1. Check [TROUBLESHOOTING.md](./TROUBLESHOOTING.md)
2. Review recent logs in `./logs/`
3. Check screenshots in `./screenshots/`
4. Contact IT support with diagnostic information

### Reporting Issues

Include the following when reporting issues:

- Error message and stack trace
- Log file contents (sanitized)
- Screenshots if available
- Environment (OS, Node version)
- Steps to reproduce

---

## License

Internal use only. All rights reserved.
