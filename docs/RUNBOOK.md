# ADP-to-Intacct Payroll Automation - Weekly Runbook

This runbook provides step-by-step procedures for running the payroll automation on a weekly basis.

## Table of Contents

- [Weekly Schedule](#weekly-schedule)
- [Pre-Processing Checklist](#pre-processing-checklist)
- [Standard Weekly Procedure](#standard-weekly-procedure)
- [Verification Steps](#verification-steps)
- [Rollback Procedures](#rollback-procedures)
- [Emergency Contacts](#emergency-contacts)

---

## Weekly Schedule

### Recommended Timing

| Day | Time | Activity |
|-----|------|----------|
| Monday | 9:00 AM | Check ADP for posted payroll |
| Monday | 10:00 AM | Run payroll automation |
| Monday | 11:00 AM | Verify entries in Intacct |
| Monday | 2:00 PM | Address any failures |

### Prerequisites

- Payroll must be posted in ADP (typically Saturday or Sunday)
- You have access to both ADP and Intacct
- The automation environment is configured (see [SETUP.md](SETUP.md))

---

## Pre-Processing Checklist

Before running the automation, verify:

- [ ] Payroll has been posted in ADP
- [ ] Previous week's entries were successful (check status)
- [ ] No system maintenance is scheduled
- [ ] You have your MFA device ready (if required)
- [ ] Environment variables are correctly configured

### Check Status

```bash
npm run payroll:status
```

This shows:
- Total entries processed
- Uploaded vs pending vs failed counts
- Any entries requiring attention

---

## Standard Weekly Procedure

### Step 1: Dry Run (Recommended)

First, run a dry-run to see what will be processed:

```bash
npm run payroll:dry-run
```

**What to look for:**
- Number of entries to be processed
- Any validation warnings
- Confirmation that the correct payroll date is detected

### Step 2: Process Latest Payroll

If the dry run looks correct, process the actual payroll:

```bash
npm run payroll:process-latest
```

**During Processing:**

1. **ADP Login**: The browser will open and navigate to ADP
2. **MFA** (if required): Complete any MFA prompts within 2 minutes
3. **Download**: Payroll GL reports are downloaded automatically
4. **Transform**: Data is converted to Intacct format
5. **Validate**: Entries are checked for errors
6. **Upload**: Journal entries are created in Intacct

### Step 3: Review Results

After processing completes, review the summary:

```
=== SUMMARY ===
STATUS: SUCCESS

Processed:  4
Uploaded:   4
Failed:     0
Skipped:    0
Duration:   45.23s
```

### Step 4: Verify in Intacct

Log into Sage Intacct and verify:

1. Navigate to General Ledger > Journal Entries
2. Filter by today's date
3. Confirm entries match expected payroll amounts
4. Check that debits equal credits
5. Verify the correct posting date

---

## Verification Steps

### Check Log Files

Review the log file for details:

```bash
# View today's log
cat logs/$(date +%Y-%m-%d)_payroll-sync.log | head -50

# Search for errors
grep -i error logs/$(date +%Y-%m-%d)_payroll-sync.log

# Search for warnings
grep -i warn logs/$(date +%Y-%m-%d)_payroll-sync.log
```

### Verify Account Totals

In Intacct, run a quick trial balance to verify:

1. Total payroll expense (5xxx accounts)
2. Total payroll liability (2xxx accounts)
3. Cash/clearing account entries

### Screenshot Review

Check screenshots for any unexpected behavior:

```bash
ls -la screenshots/
```

Screenshots are named with timestamps and step names for easy identification.

---

## Handling Failures

### Retry Failed Entries

If some entries failed:

```bash
npm run payroll:retry-failed
```

### Force Re-upload

If entries need to be re-uploaded (e.g., after correction):

```bash
# Re-upload a specific batch
npm run payroll:force-reupload -- --batch-id=PAY-2024-001
```

### Manual Processing

If automation fails completely:

1. Download payroll file manually from ADP
2. Save to `downloads/payroll-gl/`
3. Run with skip-download flag:

```bash
npm run payroll:process-latest -- --skip-download
```

---

## Rollback Procedures

### If Journal Entries Need Reversal

1. **In Intacct**: Navigate to the journal entry
2. Select "Reverse" to create reversing entry
3. Re-run automation after fixing the issue

### If Duplicate Entries Were Created

1. **Identify duplicates** using entry IDs from logs
2. **In Intacct**: Delete or reverse duplicate entries
3. **Update state database**:

```bash
# Mark batch as pending to allow re-upload
npm run payroll:dev -- --command=mark-pending --batch-id=BATCH_ID
```

---

## Automation via Task Scheduler

### Windows Task Scheduler

1. Open Task Scheduler
2. Create Basic Task: "Weekly Payroll Automation"
3. Trigger: Weekly, Monday at 10:00 AM
4. Action: Start a Program
   - Program: `cmd.exe`
   - Arguments: `/c cd C:\path\to\project && npm run payroll:process-latest`
5. Configure: "Run whether user is logged in or not"

### Linux/macOS Cron

Add to crontab (`crontab -e`):

```cron
# Run payroll automation every Monday at 10:00 AM
0 10 * * 1 cd /path/to/project && npm run payroll:process-latest >> /var/log/payroll.log 2>&1
```

---

## Emergency Contacts

| Role | Name | Contact |
|------|------|---------|
| Finance Lead | [Name] | [Email/Phone] |
| IT Support | [Name] | [Email/Phone] |
| ADP Support | ADP Help | 1-800-225-5237 |
| Intacct Support | Sage Support | support.intacct.com |

---

## Quick Reference Commands

```bash
# Check status
npm run payroll:status

# Dry run (simulation)
npm run payroll:dry-run

# Process latest
npm run payroll:process-latest

# Process with verbose logging
npm run payroll:process-latest -- --verbose

# Retry failures
npm run payroll:retry-failed

# Force re-upload
npm run payroll:force-reupload -- --batch-id=ID

# Show help
npm run payroll:help
```

---

## Appendix: Process Flow Diagram

```
+----------------+     +----------------+     +----------------+
|    ADP Login   | --> | Download Files | --> |   Transform    |
+----------------+     +----------------+     +----------------+
        |                     |                      |
        v                     v                      v
   MFA if needed      Save to disk          Map accounts/depts
                                                     |
                                                     v
+----------------+     +----------------+     +----------------+
| Intacct Upload | <-- |    Validate    | <-- | Generate File  |
+----------------+     +----------------+     +----------------+
        |
        v
   Record results
   in state DB
```
