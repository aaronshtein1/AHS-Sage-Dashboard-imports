# ADP-to-Intacct Payroll Automation - Setup Guide

Complete setup instructions for the payroll automation system, including installation, configuration, and scheduling.

## Table of Contents

- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Configuration](#configuration)
- [Account Mapping Setup](#account-mapping-setup)
- [Testing Your Setup](#testing-your-setup)
- [Scheduling Automation](#scheduling-automation)
- [Setup Wizard](#setup-wizard)
- [Security Considerations](#security-considerations)

---

## Prerequisites

### System Requirements

- **Node.js**: v18.0.0 or higher
- **npm**: v9.0.0 or higher
- **Operating System**: Windows 10+, macOS 12+, or Linux (Ubuntu 20.04+)
- **RAM**: 4GB minimum, 8GB recommended
- **Disk Space**: 1GB for application, plus space for downloads/logs

### Account Requirements

- **ADP Workforce Now** account with:
  - Access to GL Reports (Payroll > Reports > GL Report)
  - Export/download permissions

- **Sage Intacct** account with:
  - Web Services enabled
  - Permission to create Journal Entries
  - General Ledger access

### Network Requirements

- Access to:
  - `workforcenow.adp.com` (ADP)
  - `*.intacct.com` (Sage Intacct)
- Outbound HTTPS (port 443)

---

## Installation

### Step 1: Clone or Download

```bash
# Clone the repository
git clone https://github.com/your-org/AHS-Sage-Dashboard-imports.git
cd AHS-Sage-Dashboard-imports

# Or download and extract the ZIP
```

### Step 2: Install Node.js Dependencies

```bash
npm install
```

### Step 3: Install Playwright Browsers

```bash
# Install Chromium browser for automation
npx playwright install chromium

# On Linux, also install system dependencies
npx playwright install-deps
```

### Step 4: Create Directory Structure

The directories are created automatically, but you can verify:

```bash
ls -la downloads/payroll-gl/
ls -la exports/intacct-ready/
ls -la screenshots/
ls -la logs/
ls -la config/
```

### Step 5: Configure Environment Variables

```bash
# Copy the example file
cp .env.example .env

# Edit with your actual values
nano .env  # or use your preferred editor
```

---

## Configuration

### Environment Variables

Edit `.env` with your credentials:

```env
# ADP Credentials
ADP_USERNAME="your-adp-username"
ADP_PASSWORD="your-adp-password"
ADP_LOGIN_URL="https://workforcenow.adp.com/"

# Intacct Credentials
INTACCT_COMPANY_ID="your-company-id"
INTACCT_USER_ID="your-user-id"
INTACCT_USER_PASSWORD="your-password"

# Logging (optional)
LOG_LEVEL="info"
LOG_TO_FILE="true"

# Browser Settings (optional)
HEADLESS="false"  # Set to true for scheduled runs
```

### Important Security Notes

1. **Never commit `.env` to version control**
2. **Use a dedicated service account** for both ADP and Intacct
3. **Rotate credentials periodically**
4. **Limit account permissions** to only what's needed

---

## Account Mapping Setup

### Account Mapping File

Create `config/account-mapping.json`:

```json
{
  "version": "1.0",
  "lastUpdated": "2024-01-15",
  "failOnUnmapped": true,
  "mappings": {
    "5100-SALARY": {
      "adpAccountCode": "5100-SALARY",
      "intacctAccountNo": "5100",
      "intacctAccountTitle": "Salaries & Wages",
      "isActive": true,
      "description": "Regular salaries"
    },
    "5110-OVERTIME": {
      "adpAccountCode": "5110-OVERTIME",
      "intacctAccountNo": "5110",
      "intacctAccountTitle": "Overtime",
      "isActive": true
    },
    "5200-BENEFITS": {
      "adpAccountCode": "5200-BENEFITS",
      "intacctAccountNo": "5200",
      "intacctAccountTitle": "Employee Benefits",
      "isActive": true
    },
    "2100-PAYROLL-LIAB": {
      "adpAccountCode": "2100-PAYROLL-LIAB",
      "intacctAccountNo": "2100",
      "intacctAccountTitle": "Payroll Liabilities",
      "isActive": true
    }
  }
}
```

### Department Mapping File

Create `config/department-mapping.json`:

```json
{
  "version": "1.0",
  "lastUpdated": "2024-01-15",
  "failOnUnmapped": false,
  "defaultDepartment": "ADMIN",
  "mappings": {
    "ADMIN": {
      "adpDepartmentCode": "ADMIN",
      "intacctDepartmentId": "100",
      "intacctDepartmentName": "Administration",
      "isActive": true
    },
    "CLINICAL": {
      "adpDepartmentCode": "CLINICAL",
      "intacctDepartmentId": "200",
      "intacctDepartmentName": "Clinical Operations",
      "isActive": true
    },
    "BILLING": {
      "adpDepartmentCode": "BILLING",
      "intacctDepartmentId": "300",
      "intacctDepartmentName": "Billing Department",
      "isActive": true
    }
  }
}
```

### Getting Account Codes

**From ADP:**
1. Log into ADP Workforce Now
2. Navigate to Payroll > Reports > GL Report
3. Run the report and note the account codes used

**From Intacct:**
1. Log into Sage Intacct
2. Navigate to General Ledger > Chart of Accounts
3. Export or note the account numbers

---

## Testing Your Setup

### Step 1: Verify Environment

```bash
# Check Node.js version
node --version  # Should be v18+

# Check npm version
npm --version   # Should be v9+

# Verify installation
npm run payroll:help
```

### Step 2: Run Dry-Run Test

```bash
# This simulates the process without uploading
npm run payroll:dry-run
```

Watch for:
- Successful ADP login
- Correct payroll detection
- Transformation without errors
- Validation passing

### Step 3: Test with Single Entry

```bash
# Process with test mode (1 entry only)
npm run payroll:process-latest -- --test
```

### Step 4: Verify in Intacct

1. Log into Sage Intacct
2. Navigate to General Ledger > Journal Entries
3. Find the test entry
4. Verify:
   - Correct account numbers
   - Correct amounts
   - Debits = Credits
   - Correct posting date

### Step 5: Full Test

```bash
# Full processing
npm run payroll:process-latest

# Check status
npm run payroll:status
```

---

## Scheduling Automation

### Windows Task Scheduler

#### Creating the Scheduled Task

1. **Open Task Scheduler**
   - Press `Win + R`, type `taskschd.msc`, press Enter

2. **Create Basic Task**
   - Click "Create Basic Task..." in right panel
   - Name: "ADP-Intacct Payroll Automation"
   - Description: "Weekly payroll journal entry automation"

3. **Set Trigger**
   - Select "Weekly"
   - Start: Next Monday, 10:00 AM
   - Recur every 1 week
   - Check "Monday"

4. **Set Action**
   - Select "Start a program"
   - Program/script: `cmd.exe`
   - Arguments: `/c cd /d "C:\path\to\AHS-Sage-Dashboard-imports" && npm run payroll:process-latest`

5. **Configure Settings**
   - Check "Run whether user is logged on or not"
   - Check "Run with highest privileges"
   - Configure for: Windows 10

6. **Save and Test**
   - Enter your Windows password when prompted
   - Right-click the task and select "Run" to test

#### PowerShell Alternative

Create `run-payroll.ps1`:

```powershell
# run-payroll.ps1
Set-Location "C:\path\to\AHS-Sage-Dashboard-imports"

# Load environment variables
Get-Content .env | ForEach-Object {
    if ($_ -match '^([^#][^=]+)=(.*)$') {
        [Environment]::SetEnvironmentVariable($matches[1], $matches[2])
    }
}

# Run the automation
npm run payroll:process-latest

# Send notification (optional)
if ($LASTEXITCODE -eq 0) {
    Write-Host "Payroll processing completed successfully"
} else {
    Write-Host "Payroll processing failed with exit code $LASTEXITCODE"
}
```

### Linux/macOS Cron

#### Setting Up Cron Job

```bash
# Edit crontab
crontab -e
```

Add the following line:

```cron
# ADP-Intacct Payroll Automation - Every Monday at 10:00 AM
0 10 * * 1 cd /path/to/AHS-Sage-Dashboard-imports && /usr/bin/npm run payroll:process-latest >> /var/log/payroll-automation.log 2>&1
```

#### Using a Shell Script

Create `scripts/run-payroll.sh`:

```bash
#!/bin/bash
# run-payroll.sh

# Set working directory
cd /path/to/AHS-Sage-Dashboard-imports

# Load environment variables
export $(cat .env | grep -v '^#' | xargs)

# Run the automation
npm run payroll:process-latest

# Exit with the same code
exit $?
```

Make it executable:

```bash
chmod +x scripts/run-payroll.sh
```

### Systemd Timer (Linux)

Create `/etc/systemd/system/payroll-automation.service`:

```ini
[Unit]
Description=ADP-Intacct Payroll Automation
After=network.target

[Service]
Type=oneshot
WorkingDirectory=/path/to/AHS-Sage-Dashboard-imports
EnvironmentFile=/path/to/AHS-Sage-Dashboard-imports/.env
ExecStart=/usr/bin/npm run payroll:process-latest
User=payroll
Group=payroll

[Install]
WantedBy=multi-user.target
```

Create `/etc/systemd/system/payroll-automation.timer`:

```ini
[Unit]
Description=Run payroll automation weekly

[Timer]
OnCalendar=Mon 10:00
Persistent=true

[Install]
WantedBy=timers.target
```

Enable the timer:

```bash
sudo systemctl enable payroll-automation.timer
sudo systemctl start payroll-automation.timer
```

---

## Setup Wizard

For first-time setup, we recommend using the interactive setup wizard (coming soon):

```bash
npm run payroll:setup
```

The wizard will guide you through:

1. **Credential Configuration**
   - ADP username/password
   - Intacct company/user credentials
   - Test connections

2. **Directory Setup**
   - Verify folder structure
   - Set permissions

3. **Mapping Configuration**
   - Import account list from Intacct
   - Map ADP accounts to Intacct
   - Map departments

4. **Test Run**
   - Download sample file
   - Transform and validate
   - Preview results

5. **Schedule Setup**
   - Configure automated runs
   - Set up notifications

Until the wizard is available, follow the manual steps in this guide.

---

## Security Considerations

### Credential Storage

1. **Use environment variables** - Never hardcode credentials
2. **Restrict file permissions** on `.env`:
   ```bash
   chmod 600 .env
   ```
3. **Use a secrets manager** for production (e.g., HashiCorp Vault, AWS Secrets Manager)

### Service Accounts

Create dedicated service accounts for automation:

**ADP Service Account:**
- Create a user specifically for automation
- Grant minimal required permissions
- Enable audit logging

**Intacct Service Account:**
- Create a Web Services user
- Assign role with only GL access
- Enable API access logging

### Network Security

- Use VPN if required by corporate policy
- Whitelist automation server IP if possible
- Enable SSL certificate verification

### Audit Trail

The system maintains:
- Log files in `/logs/`
- State database in `/data/`
- Screenshots in `/screenshots/`

Retain these for audit purposes.

---

## Verification Checklist

Before going live, verify:

- [ ] Node.js v18+ installed
- [ ] All npm dependencies installed
- [ ] Playwright browser installed
- [ ] `.env` configured with all credentials
- [ ] Account mapping file created
- [ ] Department mapping file created
- [ ] Dry-run completes successfully
- [ ] Test entry uploaded to Intacct correctly
- [ ] Scheduled task configured (if automating)
- [ ] Notification system configured (if desired)
- [ ] Backup procedure documented
- [ ] Rollback procedure tested

---

## Next Steps

1. Complete the setup checklist above
2. Run your first live payroll processing
3. Review [RUNBOOK.md](RUNBOOK.md) for weekly procedures
4. Bookmark [TROUBLESHOOTING.md](TROUBLESHOOTING.md) for issue resolution
