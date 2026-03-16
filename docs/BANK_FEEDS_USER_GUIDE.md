# Bank Feeds User Guide

## Table of Contents

1. [Introduction](#introduction)
2. [Getting Started](#getting-started)
3. [Connecting Bank Accounts](#connecting-bank-accounts)
4. [Managing Transactions](#managing-transactions)
5. [Creating Matching Rules](#creating-matching-rules)
6. [Reconciliation](#reconciliation)
7. [Importing Transactions](#importing-transactions)
8. [Best Practices](#best-practices)
9. [Troubleshooting](#troubleshooting)
10. [FAQ](#faq)

---

## Introduction

The Bank Feeds system automates the process of importing bank transactions, matching them to general ledger accounts, and posting them as journal entries. This guide will help you understand how to use the system effectively.

### Key Features

- **Automatic Bank Connections**: Connect your bank accounts using secure Plaid integration
- **Smart Matching**: Automatically match transactions to GL accounts using customizable rules
- **Batch Operations**: Process multiple transactions at once
- **Reconciliation Tools**: Auto-match bank transactions to journal entries
- **CSV Import**: Import transactions from CSV files for banks not supported by Plaid

### Benefits

- Save time by automating transaction entry
- Reduce errors with rule-based matching
- Improve cash visibility with daily transaction imports
- Streamline month-end reconciliation

---

## Getting Started

### Accessing Bank Feeds

1. Log in to your account
2. Select your organization from the organization selector
3. Navigate to **Bank Feeds** from the main menu

### Understanding Transaction Status

Transactions flow through these statuses:

- **Unmatched**: New transactions that haven't been matched to a GL account
- **Matched**: Transactions assigned to a GL account but not yet posted
- **Posted**: Transactions that have been posted to the general ledger as journal entries
- **Ignored**: Transactions marked to be excluded from processing

---

## Connecting Bank Accounts

### Using Plaid Link

Plaid Link provides secure connections to over 10,000 financial institutions.

#### Step-by-Step Instructions

1. Go to **Bank Feeds** > **Bank Accounts** tab
2. Click **Connect Bank Account**
3. The Plaid Link dialog will appear
4. Search for your financial institution
5. Enter your online banking credentials
6. Select the accounts you want to connect
7. Click **Continue**

The system will automatically import your accounts and begin syncing transactions.

#### Supported Account Types

- Checking accounts
- Savings accounts
- Credit cards
- Money market accounts
- Line of credit accounts

### Security & Privacy

- Your banking credentials are never stored in our system
- All connections use bank-level encryption
- You can disconnect accounts at any time
- Connections are read-only (no ability to initiate transactions)

### Managing Connected Accounts

#### View Account Details

1. Go to **Bank Feeds** > **Bank Accounts**
2. Click on any account to view:
   - Current balance
   - Available balance
   - Account number (masked)
   - Last sync date
   - Sync history

#### Refresh Transaction Data

1. Locate the account in the Bank Accounts list
2. Click the **Refresh** icon
3. Wait for sync to complete (usually 5-10 seconds)

The system automatically syncs transactions daily, but you can manually refresh at any time.

#### Disconnect an Account

1. Go to **Bank Feeds** > **Bank Accounts**
2. Find the account you want to disconnect
3. Click the **Disconnect** button
4. Confirm the disconnection

Note: Disconnecting an account does not delete historical transactions.

---

## Managing Transactions

### Viewing Transactions

#### Transaction List View

The main Transactions tab shows all imported transactions in a table format with:

- **Date**: Transaction date
- **Description**: Transaction description from the bank
- **Merchant**: Recognized merchant name (if available)
- **Amount**: Transaction amount (negative for debits, positive for credits)
- **Status**: Current status (unmatched/matched/posted/ignored)
- **Account**: Matched GL account (if matched)
- **Actions**: Available actions for the transaction

#### Filtering Transactions

Use filters to find specific transactions:

**By Status:**
1. Click the **Status** dropdown
2. Select a status (Unmatched, Matched, Posted, Ignored, or All)

**By Date Range:**
1. Click the **Date Range** picker
2. Select start and end dates
3. Click **Apply**

**By Amount:**
1. Click the **Amount** filter
2. Enter minimum and/or maximum amounts
3. Click **Apply**

**By Search:**
1. Enter text in the search box
2. Searches description and merchant name
3. Results update automatically

**Clear Filters:**
- Click **Clear Filters** to reset all filters

### Matching Transactions

Matching assigns a transaction to a GL account and dimensions.

#### Manual Matching (Single Transaction)

1. Find the transaction in the list
2. Click on the transaction row to expand details
3. Select the **GL Account** from the dropdown
4. Select **Dimension Values** (Department, Location, etc.)
5. Add **Notes** if needed (optional)
6. Click **Save Match**

The transaction status changes to "Matched".

#### Batch Matching (Multiple Transactions)

For transactions that should use the same account and dimensions:

1. Filter to **Unmatched** transactions
2. Check the boxes next to transactions to match
3. Click **Match Selected** button
4. In the batch match dialog:
   - Select the GL account
   - Select dimension values
   - Optionally add notes
5. Click **Apply to All**

All selected transactions will be matched at once.

#### Automatic Matching with Rules

The system can automatically match transactions using matching rules (see [Creating Matching Rules](#creating-matching-rules)).

To run automatic matching:

1. Go to **Bank Feeds** > **Matching Rules**
2. Click **Run All Rules**
3. The system will process all unmatched transactions
4. Review the results

### Editing Transactions

You can edit transaction details if needed:

1. Click the **Edit** icon on a transaction
2. Modify fields:
   - Description
   - Merchant name
   - Category
   - Amount (if imported incorrectly)
3. Click **Save**

Note: You cannot edit posted transactions.

### Posting Transactions

Posting creates a journal entry in the general ledger.

#### Post Single Transaction

1. Ensure the transaction is **Matched**
2. Click the **Post** button
3. Review the journal entry details:
   - Journal type
   - Entry date
   - Description
4. Confirm posting

The transaction status changes to "Posted" and a journal entry is created.

#### Batch Posting

1. Filter to **Matched** transactions
2. Select multiple transactions using checkboxes
3. Click **Post Selected**
4. Review batch posting details
5. Confirm batch posting

All selected transactions will be posted as individual journal entries.

### Ignoring Transactions

Some transactions should not be matched or posted (e.g., transfers between connected accounts, personal transactions).

To ignore a transaction:

1. Find the transaction
2. Click the **Ignore** button
3. The transaction is marked as "Ignored" and will not appear in unmatched lists

To un-ignore a transaction:

1. Filter to **Ignored** status
2. Find the transaction
3. Click **Un-ignore**

---

## Creating Matching Rules

Matching rules automatically categorize transactions based on patterns.

### Understanding Rule Components

Each rule has:

- **Name**: Descriptive name for the rule
- **Match Type**: Algorithm used to match transactions
- **Pattern**: The text, regex, or criteria to match
- **Target Account**: GL account to assign matched transactions
- **Dimensions**: Dimension values to apply (optional)
- **Priority**: Order in which rules are evaluated (higher = first)
- **Auto-Post**: Whether to automatically post high-confidence matches
- **Active Status**: Whether the rule is currently enabled

### Match Types

#### EXACT_MERCHANT

Matches transactions where the merchant name exactly matches the pattern.

**Confidence**: HIGH
**Use Case**: Recurring vendors with consistent merchant names

**Example:**
- Pattern: `Amazon`
- Matches: Transactions from "Amazon"
- Does not match: "Amazon.com", "AMAZON WEB SERVICES"

#### CONTAINS_TEXT

Matches transactions where the description contains the pattern text.

**Confidence**: MEDIUM
**Use Case**: Vendors that appear with variations in their name

**Example:**
- Pattern: `AMAZON`
- Matches: "AMAZON.COM*ABC123", "AMAZON WEB SERVICES", "WWW.AMAZON.COM"

#### REGEX_PATTERN

Matches transactions using a regular expression.

**Confidence**: MEDIUM
**Use Case**: Complex matching scenarios

**Example:**
- Pattern: `AMAZON\.(COM|CO\.UK)`
- Matches: "AMAZON.COM", "AMAZON.CO.UK"
- Does not match: "AMAZON.FR"

#### CATEGORY_MATCH

Matches transactions by Plaid category.

**Confidence**: LOW
**Use Case**: Broad categorization for similar transaction types

**Example:**
- Pattern: `Food and Drink`
- Matches: All transactions categorized by Plaid as food/drink

#### AMOUNT_RANGE

Matches transactions within an amount range.

**Confidence**: LOW
**Use Case**: Recurring payments with fixed amounts

**Example:**
- Pattern: `1000-1100`
- Matches: Transactions between $1,000 and $1,100

### Creating a New Rule

1. Go to **Bank Feeds** > **Matching Rules**
2. Click **Create Rule**
3. Fill in the form:
   - **Name**: "Amazon Office Supplies"
   - **Match Type**: CONTAINS_TEXT
   - **Pattern**: "AMAZON"
   - **Target Account**: "6000 - Office Supplies"
   - **Dimensions**:
     - Department: Administration
     - Location: HQ
   - **Priority**: 10
   - **Auto-Post**: Checked (if you want automatic posting)
   - **Min Confidence**: MEDIUM
4. Click **Create Rule**

### Rule Priority

When multiple rules could match a transaction, the rule with the highest priority is used.

**Best Practice:**
- Specific rules (EXACT_MERCHANT): Priority 50-100
- Moderate rules (CONTAINS_TEXT): Priority 25-50
- Broad rules (CATEGORY_MATCH): Priority 1-25

### Testing Rules

Before activating a rule, test it:

1. Go to **Bank Feeds** > **Matching Rules**
2. Find the rule you want to test
3. Click **Test**
4. The system shows which transactions would match
5. Review the results
6. Adjust the rule if needed

### Editing Rules

1. Go to **Bank Feeds** > **Matching Rules**
2. Click **Edit** on the rule
3. Modify any fields
4. Click **Save Changes**

### Deactivating Rules

To temporarily disable a rule without deleting it:

1. Find the rule in the list
2. Toggle the **Active** switch to off

The rule will not be applied until reactivated.

### Deleting Rules

1. Find the rule in the list
2. Click **Delete**
3. Confirm deletion

Note: Deleting a rule does not affect previously matched transactions.

### Rule Examples

#### Example 1: Office Rent

```
Name: Monthly Office Rent
Match Type: EXACT_MERCHANT
Pattern: ABC Property Management
Account: 7200 - Rent Expense
Dimensions:
  - Department: Administration
  - Location: HQ
Priority: 75
Auto-Post: Yes
```

#### Example 2: Utility Bills

```
Name: Electric Utility
Match Type: CONTAINS_TEXT
Pattern: ELECTRIC COMPANY
Account: 7300 - Utilities
Dimensions:
  - Department: Administration
Priority: 50
Auto-Post: Yes
```

#### Example 3: Travel Expenses

```
Name: Airline Travel
Match Type: CATEGORY_MATCH
Pattern: Travel, Airlines and Aviation Services
Account: 7500 - Travel Expense
Dimensions:
  - Department: Sales
Priority: 25
Auto-Post: No
```

---

## Reconciliation

The reconciliation feature helps match bank feed transactions to existing journal entries.

### Use Cases

- Match bank transactions to manually entered journal entries
- Reconcile bank accounts at month-end
- Identify missing or duplicate entries

### Configuring Auto-Match Settings

1. Go to **Bank Feeds** > **Transactions**
2. Click **Reconciliation** button
3. Configure settings:
   - **Date Tolerance**: How many days difference is acceptable (1-7 days)
   - **Strict Amount Match**: Require exact amount match (recommended: OFF for small rounding differences)
   - **Similarity Threshold**: How similar descriptions must be (0.0-1.0, recommended: 0.75)
4. Click **Save Settings**

### Running Auto-Match

1. Open the Reconciliation panel
2. Select:
   - Bank account (optional, leave blank for all accounts)
   - Date range
3. Click **Run Auto-Match**
4. Wait for processing to complete

The system will display:
- Number of transactions processed
- Number of matches found
- List of match suggestions

### Reviewing Match Suggestions

Each suggestion shows:
- Bank transaction details
- Potential matching journal entry
- Confidence score (0-100%)
- Matching reasons

**Actions:**
- **Accept**: Create the match between transaction and journal entry
- **Reject**: Skip this suggestion
- **View Details**: See full transaction and journal entry details

### Manual Reconciliation

If auto-match doesn't find a match:

1. View the unmatched transaction
2. Search for the corresponding journal entry
3. Click **Link to Journal Entry**
4. Select the journal entry from the list
5. Confirm the match

---

## Importing Transactions

For banks not supported by Plaid, you can import transactions from CSV files.

### CSV File Format

Your CSV file should include these columns:

- **Date**: Transaction date (format: YYYY-MM-DD, MM/DD/YYYY, or DD/MM/YYYY)
- **Description**: Transaction description
- **Amount**: Transaction amount (negative for debits, positive for credits)
- **Type** (optional): "debit" or "credit"

**Example CSV:**
```csv
Date,Description,Amount,Type
2024-01-15,Amazon Purchase,-125.50,debit
2024-01-16,Client Payment,1500.00,credit
2024-01-17,Office Supplies,-75.00,debit
```

### Import Steps

1. Go to **Bank Feeds** > **Transactions**
2. Click **Import** button
3. Select **CSV File** option
4. Choose your CSV file
5. Map columns:
   - Select which CSV column contains Date
   - Select which column contains Description
   - Select which column contains Amount
   - Select date format if needed
6. Select the bank account to import to
7. Click **Import**

The system will:
- Validate the file format
- Check for duplicates
- Import new transactions
- Display import results

### Import Results

After import, you'll see:
- **Imported**: Number of new transactions added
- **Duplicates**: Number of transactions already in the system (skipped)
- **Errors**: Number of rows that couldn't be imported

Review any errors and correct your CSV file if needed.

### Handling Duplicates

The system automatically detects duplicates using:
- Transaction date
- Amount
- Description similarity

Duplicate transactions are skipped during import to prevent double-entry.

---

## Best Practices

### Rule Creation

1. **Start Specific, Then Broaden**
   - Create rules for your most common vendors first
   - Use EXACT_MERCHANT or CONTAINS_TEXT for high accuracy
   - Use CATEGORY_MATCH sparingly for catch-all scenarios

2. **Use Appropriate Priority**
   - High priority (75-100): Exact matches for specific vendors
   - Medium priority (25-75): Partial text matches
   - Low priority (1-25): Category or amount-based matches

3. **Test Before Activating**
   - Always test new rules before enabling
   - Review a few weeks of historical transactions
   - Adjust patterns as needed

4. **Enable Auto-Post Carefully**
   - Only enable auto-post for HIGH confidence rules
   - Start with auto-post disabled and enable after verifying accuracy
   - Regularly review auto-posted transactions

### Transaction Management

1. **Review Daily**
   - Check for new unmatched transactions daily
   - Address matching issues promptly
   - Keep the unmatched queue under control

2. **Use Batch Operations**
   - Group similar transactions together
   - Use batch match for recurring vendors
   - Post transactions in batches to save time

3. **Maintain Data Quality**
   - Edit transaction descriptions when unclear
   - Add notes for unusual transactions
   - Use consistent dimension values

### Reconciliation

1. **Regular Reconciliation**
   - Reconcile at least monthly
   - Use narrower date ranges for initial reconciliations
   - Review all match suggestions carefully

2. **Investigate Discrepancies**
   - Follow up on unmatched transactions
   - Check for missing bank imports
   - Verify journal entry dates and amounts

### Security

1. **Access Control**
   - Limit bank feed access to accounting staff
   - Use separate logins for each user
   - Review audit logs regularly

2. **Account Monitoring**
   - Monitor for unusual transactions
   - Set up alerts for large amounts
   - Review ignored transactions periodically

---

## Troubleshooting

### Connection Issues

**Problem**: "Unable to connect to bank"

**Solutions:**
- Verify your online banking credentials
- Check if your bank requires 2FA (two-factor authentication)
- Wait 24 hours and try reconnecting
- Contact support if issue persists

**Problem**: "Connection requires re-authentication"

**Solutions:**
- Plaid connections expire after 90 days for security
- Click **Re-authenticate** on the bank account
- Enter your credentials again

### Import Issues

**Problem**: Duplicate transactions imported

**Solutions:**
- Check date formats match between imports
- Ensure transaction amounts are consistent
- Contact support to remove duplicates

**Problem**: Transactions missing after sync

**Solutions:**
- Check the date range - some banks limit historical data
- Verify the account is correctly connected
- Try a manual refresh

### Matching Issues

**Problem**: Rule not matching expected transactions

**Solutions:**
- Use **Test Rule** to see which transactions match
- Review the transaction descriptions carefully
- Check if another higher-priority rule is matching first
- Try CONTAINS_TEXT instead of EXACT_MERCHANT for variations

**Problem**: Too many false matches

**Solutions:**
- Make your pattern more specific
- Increase the rule priority
- Use EXACT_MERCHANT instead of CONTAINS_TEXT
- Add additional criteria (amount range, category)

### Posting Issues

**Problem**: "Cannot post unmatched transaction"

**Solutions:**
- Ensure the transaction is matched to a GL account
- Verify all required dimensions are filled
- Check that the transaction isn't already posted

**Problem**: "Insufficient permissions to post"

**Solutions:**
- Verify your user role has posting permissions
- Contact your system administrator

---

## FAQ

### General Questions

**Q: How often do transactions sync?**
A: Automatically once per day, usually overnight. You can manually sync anytime.

**Q: Can I connect multiple accounts from the same bank?**
A: Yes, you can connect as many accounts as needed.

**Q: What happens to old transactions when I connect an account?**
A: The system imports up to 90 days of historical transactions on initial connection.

**Q: Are my banking credentials secure?**
A: Yes. Credentials are encrypted and handled directly by Plaid, never stored in our system.

### Transaction Management

**Q: Can I delete a transaction?**
A: No, transactions from the bank cannot be deleted. Use "Ignore" to exclude transactions.

**Q: What if a transaction amount is wrong?**
A: You can edit the transaction amount before posting. This is useful for bank import errors.

**Q: Can I un-post a transaction?**
A: No. Once posted, the journal entry is permanent. You would need to create a reversing entry.

**Q: How do I handle split transactions?**
A: Currently, transactions must be matched to a single account. For splits, create a journal entry manually and use reconciliation to match the bank transaction.

### Matching Rules

**Q: How many rules can I create?**
A: There's no limit, but we recommend staying under 50 for best performance.

**Q: What happens if multiple rules match?**
A: The rule with the highest priority is used. If priorities are equal, the first created rule wins.

**Q: Can a rule match transactions retroactively?**
A: Yes. Click "Run All Rules" to apply rules to existing unmatched transactions.

**Q: Can I export my rules?**
A: Contact support for rule export functionality.

### Reconciliation

**Q: What's the difference between matching and reconciliation?**
A: Matching assigns bank transactions to GL accounts. Reconciliation links bank transactions to existing journal entries.

**Q: Why won't a transaction reconcile?**
A: Check date tolerance, amount differences, and description similarity settings. The transaction and journal entry must be close matches.

**Q: Can I reconcile a posted transaction?**
A: Yes. Reconciliation works with transactions in any status.

### Importing

**Q: What file formats are supported for import?**
A: Currently, only CSV files are supported.

**Q: Can I import credit card transactions?**
A: Yes, either through Plaid connection or CSV import.

**Q: What's the maximum file size for CSV imports?**
A: 10MB or approximately 50,000 transactions per file.

### Troubleshooting

**Q: A rule isn't working as expected. What should I do?**
A: Use the "Test Rule" feature to see which transactions match. Review the pattern and adjust as needed.

**Q: I'm getting duplicate transactions. Why?**
A: This can happen if you're both syncing via Plaid and importing via CSV for the same account. Choose one method per account.

**Q: Transactions aren't syncing. What should I do?**
A: Try a manual refresh. If that doesn't work, disconnect and reconnect the account.

---

## Additional Resources

- **API Documentation**: For developers integrating with the Bank Feeds API
- **Video Tutorials**: Step-by-step video guides (coming soon)
- **Support Portal**: https://support.example.com
- **Release Notes**: See what's new in each release

## Need Help?

Contact our support team:

- **Email**: support@example.com
- **Phone**: 1-800-SUPPORT
- **Live Chat**: Available Monday-Friday, 9 AM - 5 PM EST
- **Support Portal**: https://support.example.com

---

*Last Updated: January 2024*
*Version: 1.0*
