# ADP-to-Intacct Payroll Automation - Troubleshooting Guide

This guide covers common issues and their solutions when running the payroll automation system.

## Table of Contents

- [Quick Diagnostics](#quick-diagnostics)
- [Login Issues](#login-issues)
- [Download Issues](#download-issues)
- [Transformation Issues](#transformation-issues)
- [Validation Errors](#validation-errors)
- [Upload Issues](#upload-issues)
- [Browser Automation Issues](#browser-automation-issues)
- [Database Issues](#database-issues)
- [Getting Help](#getting-help)

---

## Quick Diagnostics

### Check System Status

```bash
# View processing status
npm run payroll:status

# Check recent logs
tail -100 logs/$(date +%Y-%m-%d)_payroll-sync.log

# Check for errors in logs
grep -i "error\|fail" logs/$(date +%Y-%m-%d)_payroll-sync.log
```

### Common Quick Fixes

| Symptom | Quick Fix |
|---------|-----------|
| "Missing environment variables" | Check `.env` file exists and is configured |
| Browser doesn't open | Set `HEADLESS=false` in `.env` |
| MFA timeout | Increase `MFA_TIMEOUT` in `.env` |
| Connection refused | Check network/firewall settings |
| Duplicate entry errors | Use `--force` flag or check Intacct |

---

## Login Issues

### ADP Login Failed

**Symptoms:**
- Error: "Login failed"
- Screenshot shows login page with error message

**Solutions:**

1. **Verify credentials**
   ```bash
   # Check environment variables are set
   echo $ADP_USERNAME
   echo $ADP_LOGIN_URL
   ```

2. **Check for password changes**
   - ADP may require periodic password updates
   - Update `ADP_PASSWORD` in `.env`

3. **Check for account lockout**
   - Too many failed attempts may lock the account
   - Contact ADP support to unlock

4. **Verify URL**
   - Ensure `ADP_LOGIN_URL` is correct
   - Different companies may have different URLs

### Intacct Login Failed

**Symptoms:**
- Error: "Intacct login failed"
- Error: "Invalid company ID"

**Solutions:**

1. **Verify company ID format**
   ```bash
   # Company ID should be your Intacct company identifier
   INTACCT_COMPANY_ID="your-company-id"
   ```

2. **Check user permissions**
   - User must have Web Services access
   - User must have permission to create journal entries

3. **Check session limits**
   - Intacct may limit concurrent sessions
   - Log out of other Intacct sessions

### MFA Timeout

**Symptoms:**
- Error: "MFA timeout"
- Process hangs waiting for MFA

**Solutions:**

1. **Increase MFA timeout**
   ```env
   MFA_TIMEOUT=180000  # 3 minutes
   ```

2. **Have MFA device ready**
   - Keep your phone/authenticator app ready before starting

3. **Consider trusted device**
   - Some systems allow marking devices as trusted

---

## Download Issues

### No Files Downloaded

**Symptoms:**
- "0 files downloaded"
- Download directory is empty

**Solutions:**

1. **Check payroll is posted**
   - Log into ADP manually and verify payroll is available
   - Some payrolls post on weekends

2. **Check download directory permissions**
   ```bash
   ls -la downloads/payroll-gl/
   # Should be writable
   ```

3. **Check browser downloads**
   - Look in browser's default download folder
   - May need to configure download path

### Download Timeout

**Symptoms:**
- Error: "Download timeout"
- File download started but didn't complete

**Solutions:**

1. **Increase download timeout**
   ```env
   DOWNLOAD_TIMEOUT=180000  # 3 minutes
   ```

2. **Check network speed**
   - Large payroll files may take time
   - Consider off-peak hours

3. **Check disk space**
   ```bash
   df -h .
   ```

### Wrong File Downloaded

**Symptoms:**
- File exists but contains wrong data
- Unexpected format

**Solutions:**

1. **Verify report selection in ADP**
   - The automation should select the GL report
   - Check screenshots for navigation issues

2. **Check date range**
   - Verify the correct pay period is selected

---

## Transformation Issues

### Account Mapping Errors

**Symptoms:**
- Error: "Unmapped account: XXXX"
- Validation fails with missing mappings

**Solutions:**

1. **Update account mapping file**
   ```bash
   # Edit config/account-mapping.json
   {
     "mappings": {
       "ADP-ACCOUNT": {
         "adpAccountCode": "ADP-ACCOUNT",
         "intacctAccountNo": "5100",
         "isActive": true
       }
     }
   }
   ```

2. **Set default account (if appropriate)**
   ```json
   {
     "defaultAccount": "5999",
     "failOnUnmapped": false
   }
   ```

### Department Mapping Errors

**Symptoms:**
- Error: "Unmapped department: XXX"

**Solutions:**

1. **Update department mapping file**
   ```bash
   # Edit config/department-mapping.json
   ```

2. **Verify Intacct department IDs**
   - Log into Intacct and check department setup

### Date Parsing Errors

**Symptoms:**
- Error: "Invalid date format"
- Dates appear incorrect in output

**Solutions:**

1. **Check date format in config**
   ```json
   {
     "dateFormat": {
       "inputFormat": "MM/DD/YYYY",
       "outputFormat": "MM/DD/YYYY"
     }
   }
   ```

2. **Verify ADP export format**
   - Different reports may use different date formats

---

## Validation Errors

### Balance Errors

**Symptoms:**
- Error: "Debits do not equal credits"
- Validation fails with balance error

**Solutions:**

1. **Check for rounding**
   - Verify balance tolerance in config
   ```json
   {
     "balanceTolerance": 0.01
   }
   ```

2. **Check source data**
   - Review the ADP export for issues
   - Some entries may be missing

### Missing Required Fields

**Symptoms:**
- Error: "Missing required field: X"

**Solutions:**

1. **Check column mapping**
   - Verify the ADP file has all required columns
   - Update column mapping if column names changed

2. **Check for empty rows**
   - Remove any blank rows from source file

---

## Upload Issues

### Duplicate Entry Detected

**Symptoms:**
- Warning: "Duplicate entry detected"
- Upload skipped or failed

**Solutions:**

1. **Check if entry already exists**
   - Log into Intacct and search for the entry
   - May have been uploaded previously

2. **Force re-upload if needed**
   ```bash
   npm run payroll:force-reupload -- --batch-id=BATCH_ID
   ```

3. **Skip duplicate check**
   ```bash
   npm run payroll:process-latest -- --skip-validation
   ```

### Upload Timeout

**Symptoms:**
- Error: "Upload timeout"
- Entry not created in Intacct

**Solutions:**

1. **Check Intacct responsiveness**
   - Log in manually to verify system is working
   - May be during maintenance window

2. **Retry the upload**
   ```bash
   npm run payroll:retry-failed
   ```

### Permission Denied

**Symptoms:**
- Error: "Permission denied"
- Error: "User does not have access"

**Solutions:**

1. **Check user role in Intacct**
   - User must have General Ledger permissions
   - User must be able to create journal entries

2. **Check journal restrictions**
   - Some journals may have entry restrictions

---

## Browser Automation Issues

### Browser Doesn't Start

**Symptoms:**
- Error: "Could not launch browser"
- Process exits immediately

**Solutions:**

1. **Install Playwright browsers**
   ```bash
   npx playwright install chromium
   ```

2. **Check system dependencies (Linux)**
   ```bash
   npx playwright install-deps
   ```

3. **Check for running Chrome instances**
   ```bash
   # Kill any stuck Chrome processes
   pkill -f chromium
   ```

### Element Not Found

**Symptoms:**
- Error: "Element not found"
- Error: "Timeout waiting for selector"

**Solutions:**

1. **Check for UI changes**
   - ADP or Intacct may have updated their UI
   - Review screenshots for changes

2. **Increase timeout**
   ```env
   ELEMENT_TIMEOUT=60000
   ```

3. **Run in non-headless mode to debug**
   ```env
   HEADLESS=false
   ```

### Screenshot Errors

**Symptoms:**
- Error: "Failed to capture screenshot"
- Missing screenshots

**Solutions:**

1. **Check screenshot directory**
   ```bash
   mkdir -p screenshots
   chmod 755 screenshots
   ```

2. **Check disk space**
   ```bash
   df -h .
   ```

---

## Database Issues

### State Database Locked

**Symptoms:**
- Error: "Database is locked"
- Error: "SQLITE_BUSY"

**Solutions:**

1. **Check for running processes**
   ```bash
   # Find processes using the database
   lsof data/payroll-state.db
   ```

2. **Wait and retry**
   - Another process may be writing
   - Try again after a few seconds

3. **Reset database (last resort)**
   ```bash
   # Backup first!
   cp data/payroll-state.db data/payroll-state.db.backup
   rm data/payroll-state.db
   ```

### Corrupted State

**Symptoms:**
- Error: "Database malformed"
- Unexpected query results

**Solutions:**

1. **Check database integrity**
   ```bash
   sqlite3 data/payroll-state.db "PRAGMA integrity_check;"
   ```

2. **Restore from backup**
   ```bash
   cp data/payroll-state.db.backup data/payroll-state.db
   ```

---

## Environment-Specific Issues

### Windows Issues

1. **Path issues**
   - Use forward slashes in paths
   - Avoid spaces in directory names

2. **Permission issues**
   - Run terminal as Administrator
   - Check Windows Defender settings

### macOS Issues

1. **Notarization warnings**
   - May need to allow Chromium in Security settings

2. **Keychain access**
   - Some credentials may trigger keychain prompts

### Linux Issues

1. **Missing dependencies**
   ```bash
   # Install Playwright dependencies
   npx playwright install-deps
   ```

2. **Display issues (headless)**
   ```bash
   # If running without display
   export DISPLAY=:0
   ```

---

## Getting Help

### Collect Diagnostic Information

Before requesting help, gather:

1. **Log files**
   ```bash
   # Copy recent logs
   cp logs/$(date +%Y-%m-%d)_payroll-sync.log diagnostic-logs.txt
   ```

2. **Screenshots**
   ```bash
   # List recent screenshots
   ls -la screenshots/
   ```

3. **Configuration (sanitized)**
   ```bash
   # Copy .env without passwords
   grep -v PASSWORD .env > diagnostic-env.txt
   ```

4. **Error messages**
   - Full error text
   - Stack trace if available

### Support Channels

- **Internal IT**: [Contact info]
- **ADP Support**: 1-800-225-5237
- **Intacct Support**: support.intacct.com
- **Project Issues**: [GitHub/Issue tracker URL]

---

## Selector Issues

### Understanding Selectors

The automation uses CSS selectors to interact with ADP and Intacct web interfaces. When these services update their UI, selectors may break.

### Identifying Selector Issues

**Symptoms:**
- Error: "Element not found"
- Error: "Timeout waiting for selector"
- Screenshots show unexpected pages

**Diagnosis:**

1. **Run in non-headless mode**
   ```bash
   HEADLESS=false npm run payroll:process
   ```

2. **Check screenshots**
   ```bash
   ls -la screenshots/
   # Look for recent screenshots showing the error state
   ```

3. **Compare with working state**
   - Review what the page looks like
   - Compare to expected workflow

### How to Update Selectors

Selectors are stored in JSON configuration files for easy updates without code changes.

#### ADP Selectors

Location: `config/adp-selectors.json`

Example structure:
```json
{
  "login": {
    "usernameInput": {
      "primary": "#txtUserID",
      "fallbacks": [
        "input[name='USER']",
        "[data-testid='username-input']",
        "input[placeholder*='User ID']"
      ],
      "description": "Username input field"
    },
    "passwordInput": {
      "primary": "#txtPassword",
      "fallbacks": [
        "input[type='password']",
        "[data-testid='password-input']"
      ],
      "description": "Password input field"
    }
  }
}
```

#### Intacct Selectors

Location: `config/intacct-selectors.json`

Example structure:
```json
{
  "login": {
    "companyIdInput": {
      "primary": "#company",
      "fallbacks": [
        "input[name='company']",
        "[data-testid='company-input']"
      ],
      "description": "Company ID input field"
    }
  }
}
```

### Steps to Update Selectors

1. **Open the application in a browser**
   - Navigate to the page where the error occurs

2. **Open Developer Tools**
   - Right-click on the element that needs to be found
   - Select "Inspect" or "Inspect Element"

3. **Find reliable selectors**
   - Look for unique `id` attributes (most reliable)
   - Look for `name` attributes
   - Look for `data-testid` or `data-test-id` attributes
   - Use descriptive class names as last resort

4. **Test selectors in browser console**
   ```javascript
   // Test if selector works
   document.querySelector('#newSelectorId')

   // Test if multiple elements match
   document.querySelectorAll('.someClass').length
   ```

5. **Update the JSON configuration file**
   - Add new primary selector if the old one is broken
   - Keep old selectors as fallbacks (they might work again)
   - Always add multiple fallbacks for resilience

6. **Test the changes**
   ```bash
   npm run payroll:dry-run
   ```

### Selector Best Practices

1. **Prefer stable attributes**
   - `id` attributes (most stable)
   - `name` attributes
   - `data-testid` attributes (if available)
   - ARIA attributes (`aria-label`, `role`)

2. **Avoid fragile selectors**
   - Auto-generated class names (e.g., `css-1a2b3c4`)
   - Position-based selectors (e.g., `:nth-child(3)`)
   - Deep nesting (e.g., `div > div > div > span`)

3. **Add multiple fallbacks**
   - Include at least 2-3 alternative selectors
   - Order by reliability (most reliable first)

4. **Include human-readable descriptions**
   - Help future maintainers understand what each selector targets

### Example: Updating a Broken Selector

Before (broken):
```json
{
  "downloadButton": {
    "primary": ".old-download-btn",
    "fallbacks": [],
    "description": "Download CSV button"
  }
}
```

After (fixed with fallbacks):
```json
{
  "downloadButton": {
    "primary": "#exportCsvButton",
    "fallbacks": [
      "button[data-action='download-csv']",
      "button:has-text('Download CSV')",
      ".btn-export-csv",
      ".old-download-btn"
    ],
    "description": "Download CSV button"
  }
}
```

### Selector Types and Playwright Syntax

| Type | Example | When to Use |
|------|---------|-------------|
| ID | `#submitButton` | Unique element |
| Class | `.btn-primary` | Styled elements |
| Attribute | `[data-testid='login']` | Test attributes |
| Text | `text=Submit` | Buttons with text |
| Role | `role=button[name='Submit']` | Accessible elements |
| Placeholder | `[placeholder='Enter email']` | Input fields |
| Combined | `button.primary[type='submit']` | Specific element |

---

## Appendix: Error Codes

| Code | Description | Common Fix |
|------|-------------|------------|
| LOGIN_FAILED | Authentication failed | Check credentials |
| MFA_TIMEOUT | MFA not completed in time | Increase timeout, have device ready |
| SESSION_EXPIRED | Session timed out | Re-run the command |
| NAVIGATION_FAILED | Page navigation error | Check for UI changes |
| DOWNLOAD_FAILED | File download error | Check network, retry |
| UPLOAD_FAILED | Intacct upload error | Check permissions, retry |
| VALIDATION_FAILED | Data validation error | Check mappings, source data |
| DUPLICATE_ENTRY | Entry already exists | Use --force if appropriate |
| TIMEOUT | Operation timed out | Increase timeout, retry |
| SELECTOR_NOT_FOUND | UI element not found | Update selectors (see above) |
