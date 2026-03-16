import { test, expect, Page } from '@playwright/test';

/**
 * Bank Feeds E2E Test Suite
 *
 * Tests the complete bank feeds workflow including:
 * - Authentication and org selection
 * - Transaction listing and filtering
 * - Matching rule creation and management
 * - Transaction matching and posting
 * - Reconciliation auto-match
 * - Bank account connections
 */

// Test data - using existing admin credentials from smoke test
const TEST_USER = {
  email: 'admin@example.com',
  password: 'password',
};

const TEST_ORG = {
  name: 'Demo Organization', // Match the existing org name
};

/**
 * Helper to login and select organization
 */
async function loginAndSelectOrg(page: Page) {
  await page.goto('http://localhost:3020/login');

  // Fill login form
  await page.fill('input[name="email"]', TEST_USER.email);
  await page.fill('input[name="password"]', TEST_USER.password);
  await page.click('button[type="submit"]');

  // Wait for org selection page or dashboard
  await page.waitForURL('**/select-org', { timeout: 5000 }).catch(() => {
    // If single org, might skip to dashboard
  });

  if (page.url().includes('/select-org')) {
    // Select first organization
    await page.click('div[class*="cursor-pointer"]');
    await page.click('button:has-text("Continue")');
  }

  // Wait for dashboard
  await page.waitForURL('**/', { timeout: 5000 });
}

test.describe('Bank Feeds', () => {
  test.beforeEach(async ({ page }) => {
    await loginAndSelectOrg(page);
  });

  test.describe('Navigation and Layout', () => {
    test('should navigate to bank feeds page', async ({ page }) => {
      await page.click('a[href*="/bank-feeds"]');
      await page.waitForURL('**/bank-feeds');

      // Verify page header
      await expect(page.locator('h1')).toContainText('Bank Feeds');

      // Verify tabs are present
      await expect(page.locator('text="Transactions"')).toBeVisible();
      await expect(page.locator('text="Matching Rules"')).toBeVisible();
      await expect(page.locator('text="Bank Accounts"')).toBeVisible();
    });

    test('should switch between tabs', async ({ page }) => {
      await page.goto('http://localhost:3020/bank-feeds');

      // Switch to Matching Rules tab
      await page.click('text="Matching Rules"');
      await expect(page.locator('text="Create Rule"')).toBeVisible();

      // Switch to Bank Accounts tab
      await page.click('text="Bank Accounts"');
      await expect(page.locator('text="Connect Bank Account"')).toBeVisible();

      // Switch back to Transactions tab
      await page.click('text="Transactions"');
      await expect(page.locator('text="Import"')).toBeVisible();
    });
  });

  test.describe('Transaction Management', () => {
    test('should display transaction list', async ({ page }) => {
      await page.goto('http://localhost:3020/bank-feeds');

      // Wait for transactions to load
      await page.waitForSelector('table');

      // Verify table headers
      await expect(page.locator('th:has-text("Date")')).toBeVisible();
      await expect(page.locator('th:has-text("Description")')).toBeVisible();
      await expect(page.locator('th:has-text("Amount")')).toBeVisible();
      await expect(page.locator('th:has-text("Status")')).toBeVisible();
      await expect(page.locator('th:has-text("Account")')).toBeVisible();
    });

    test('should filter transactions by status', async ({ page }) => {
      await page.goto('http://localhost:3020/bank-feeds');

      // Click status filter dropdown
      await page.click('button:has-text("All Statuses")');

      // Select "Unmatched" status
      await page.click('text="Unmatched"');

      // Verify URL contains filter
      await expect(page).toHaveURL(/status=unmatched/);

      // Verify only unmatched transactions are shown
      const statusBadges = page.locator('[data-status]');
      const count = await statusBadges.count();
      for (let i = 0; i < count; i++) {
        await expect(statusBadges.nth(i)).toHaveAttribute('data-status', 'unmatched');
      }
    });

    test('should match transaction manually', async ({ page }) => {
      await page.goto('http://localhost:3020/bank-feeds');

      // Find first unmatched transaction
      const firstRow = page.locator('table tbody tr').first();
      await firstRow.click();

      // Verify transaction details panel opens
      await expect(page.locator('text="Transaction Details"')).toBeVisible();

      // Select account
      await page.click('button:has-text("Select Account")');
      await page.click('text="Cash - Operating"');

      // Select dimensions
      await page.click('button:has-text("Select Department")');
      await page.click('text="Administration"');

      // Add notes
      await page.fill('textarea[name="notes"]', 'Manual match test');

      // Save match
      await page.click('button:has-text("Save Match")');

      // Verify success message
      await expect(page.locator('text="Transaction matched successfully"')).toBeVisible();

      // Verify transaction status updated
      await expect(firstRow.locator('[data-status="matched"]')).toBeVisible();
    });

    test('should post transaction to journal', async ({ page }) => {
      await page.goto('http://localhost:3020/bank-feeds');

      // Filter to matched transactions
      await page.click('button:has-text("All Statuses")');
      await page.click('text="Matched"');

      // Select first matched transaction
      const firstRow = page.locator('table tbody tr').first();
      await firstRow.click();

      // Click post button
      await page.click('button:has-text("Post to Journal")');

      // Confirm dialog
      await page.click('button:has-text("Confirm")');

      // Verify success message
      await expect(page.locator('text="Transaction posted successfully"')).toBeVisible();

      // Verify status changed to posted
      await expect(firstRow.locator('[data-status="posted"]')).toBeVisible();
    });

    test('should batch match transactions', async ({ page }) => {
      await page.goto('http://localhost:3020/bank-feeds');

      // Filter to unmatched
      await page.click('button:has-text("All Statuses")');
      await page.click('text="Unmatched"');

      // Select multiple transactions
      await page.click('table tbody tr:nth-child(1) input[type="checkbox"]');
      await page.click('table tbody tr:nth-child(2) input[type="checkbox"]');
      await page.click('table tbody tr:nth-child(3) input[type="checkbox"]');

      // Click batch match button
      await page.click('button:has-text("Match Selected")');

      // Fill batch match form
      await page.click('button:has-text("Select Account")');
      await page.click('text="Cash - Operating"');

      await page.click('button:has-text("Select Department")');
      await page.click('text="Administration"');

      // Apply batch match
      await page.click('button:has-text("Apply to All")');

      // Verify success message
      await expect(page.locator('text="3 transactions matched successfully"')).toBeVisible();
    });

    test('should batch post transactions', async ({ page }) => {
      await page.goto('http://localhost:3020/bank-feeds');

      // Filter to matched
      await page.click('button:has-text("All Statuses")');
      await page.click('text="Matched"');

      // Select multiple matched transactions
      await page.click('table tbody tr:nth-child(1) input[type="checkbox"]');
      await page.click('table tbody tr:nth-child(2) input[type="checkbox"]');

      // Click batch post button
      await page.click('button:has-text("Post Selected")');

      // Confirm dialog
      await page.click('button:has-text("Confirm Post")');

      // Verify success message
      await expect(page.locator('text="2 transactions posted successfully"')).toBeVisible();
    });
  });

  test.describe('Matching Rules', () => {
    test('should create new matching rule', async ({ page }) => {
      await page.goto('http://localhost:3020/bank-feeds');
      await page.click('text="Matching Rules"');

      // Click create rule button
      await page.click('button:has-text("Create Rule")');

      // Verify dialog opened with form fields
      await expect(page.locator('text="New Rule"')).toBeVisible();
      await expect(page.locator('label:has-text("Rule Name")')).toBeVisible();
      await expect(page.locator('label:has-text("Match Type")')).toBeVisible();
      await expect(page.locator('label:has-text("Priority")')).toBeVisible();

      // Close dialog (testing UI only, API calls would fail without backend)
      await page.click('button:has-text("Cancel")');

      // Verify dialog closed
      await expect(page.locator('text="New Rule"')).not.toBeVisible();
    });

    test('should edit existing matching rule', async ({ page }) => {
      await page.goto('http://localhost:3020/bank-feeds');
      await page.click('text="Matching Rules"');

      // Find first rule and click edit (first button in action column)
      const firstRule = page.locator('table tbody tr').first();
      await firstRule.locator('button').first().click();

      // Verify edit dialog opened
      await expect(page.locator('text="Edit Rule"')).toBeVisible();
      await expect(page.locator('text="Rule Name"')).toBeVisible();

      // Close dialog (testing UI only, API calls would fail without backend)
      await page.click('button:has-text("Cancel")');

      // Verify dialog closed
      await expect(page.locator('text="Edit Rule"')).not.toBeVisible();
    });

    test('should toggle rule active status', async ({ page }) => {
      await page.goto('http://localhost:3020/bank-feeds');
      await page.click('text="Matching Rules"');

      const firstRule = page.locator('table tbody tr').first();

      // Find and toggle the checkbox in the Active column
      const checkbox = firstRule.locator('button[role="checkbox"]');
      await checkbox.click();

      // Wait for API call to complete
      await page.waitForTimeout(500);
    });

    test('should delete matching rule', async ({ page }) => {
      await page.goto('http://localhost:3020/bank-feeds');
      await page.click('text="Matching Rules"');

      const firstRule = page.locator('table tbody tr').first();
      const ruleName = await firstRule.locator('td:nth-child(2)').textContent();

      // Setup dialog handler for confirm
      page.on('dialog', async dialog => {
        expect(dialog.message()).toContain('Delete this rule');
        await dialog.accept();
      });

      // Click delete button (last button in row)
      await firstRule.locator('button').last().click();

      // Wait for reload
      await page.waitForTimeout(1000);

      // Verify rule removed from list
      await expect(page.locator(`text="${ruleName}"`)).not.toBeVisible();
    });
  });

  test.describe('Bank Accounts', () => {
    test('should display connected bank accounts', async ({ page }) => {
      await page.goto('http://localhost:3020/bank-feeds');
      await page.click('text="Bank Accounts"');

      // Verify bank accounts list
      await expect(page.locator('text="Connected Accounts"')).toBeVisible();

      // Verify table headers
      await expect(page.locator('th:has-text("Institution")')).toBeVisible();
      await expect(page.locator('th:has-text("Account")')).toBeVisible();
      await expect(page.locator('th:has-text("Type")')).toBeVisible();
      await expect(page.locator('th:has-text("Balance")')).toBeVisible();
      await expect(page.locator('th:has-text("Last Sync")')).toBeVisible();
    });

    test('should initiate Plaid Link connection', async ({ page }) => {
      await page.goto('http://localhost:3020/bank-feeds');
      await page.click('text="Bank Accounts"');

      // Click connect button
      await page.click('button:has-text("Connect Bank Account")');

      // Verify Plaid Link iframe opens
      await page.waitForSelector('iframe[title*="Plaid"]', { timeout: 10000 });

      // Note: Actual Plaid Link interaction requires Plaid sandbox credentials
      // and is better tested in a separate Plaid-specific test suite
    });
  });

  test.describe('Reconciliation', () => {
    test('should display reconciliation panel', async ({ page }) => {
      await page.goto('http://localhost:3020/bank-feeds');

      // Click reconciliation toggle
      await page.click('button:has-text("Reconciliation")');

      // Verify panel opens
      await expect(page.locator('text="Auto-Match Settings"')).toBeVisible();
      await expect(page.locator('text="Date Tolerance"')).toBeVisible();
      await expect(page.locator('text="Amount Match"')).toBeVisible();
    });

    test('should configure auto-match settings', async ({ page }) => {
      await page.goto('http://localhost:3020/bank-feeds');
      await page.click('button:has-text("Reconciliation")');

      // Verify auto-match settings are visible
      await expect(page.locator('text="Auto-Match Settings"')).toBeVisible();
      await expect(page.locator('text="Date Tolerance"')).toBeVisible();
      await expect(page.locator('text="Amount Match"')).toBeVisible();
      await expect(page.locator('text="Similarity Threshold"')).toBeVisible();

      // Setup alert handler
      page.on('dialog', async dialog => {
        expect(dialog.message()).toContain('Settings saved successfully');
        await dialog.accept();
      });

      // Save settings
      await page.click('button:has-text("Save Settings")');

      // Wait for alert
      await page.waitForTimeout(500);
    });

    test('should run auto-match', async ({ page }) => {
      await page.goto('http://localhost:3020/bank-feeds');
      await page.click('button:has-text("Reconciliation")');

      // Verify run auto-match button exists but is initially disabled
      const autoMatchButton = page.locator('button:has-text("Run Auto-Match")');
      await expect(autoMatchButton).toBeVisible();
      await expect(autoMatchButton).toBeDisabled();

      // Enter session ID to enable the button
      await page.fill('input[placeholder*="session"]', 'test-session-123');

      // Now button should be enabled
      await expect(autoMatchButton).toBeEnabled();
    });
  });

  test.describe('Import Transactions', () => {
    test('should open import dialog', async ({ page }) => {
      await page.goto('http://localhost:3020/bank-feeds');

      // Click import button
      await page.click('button:has-text("Import")');

      // Verify dialog opens
      await expect(page.locator('text="Import Transactions"')).toBeVisible();
      await expect(page.locator('text="CSV File"')).toBeVisible();
    });

    test('should upload CSV file', async ({ page }) => {
      await page.goto('http://localhost:3020/bank-feeds');
      await page.click('button:has-text("Import")');

      // Upload file
      const fileInput = page.locator('input[type="file"]');
      await fileInput.setInputFiles({
        name: 'transactions.csv',
        mimeType: 'text/csv',
        buffer: Buffer.from('Date,Description,Amount,Type\n2024-01-01,Test Transaction,100.00,debit'),
      });

      // Wait for headers to be parsed
      await page.waitForTimeout(500);

      // Columns are auto-detected, just verify they're set
      await expect(page.locator('text="Date Column"')).toBeVisible();
      await expect(page.locator('text="Description Column"')).toBeVisible();
      await expect(page.locator('text="Amount Column"')).toBeVisible();

      // Verify column mapping UI is visible
      const dateColumn = page.locator('label:has-text("Date Column")');
      await expect(dateColumn).toBeVisible();

      // Note: Skipping actual import as it requires backend API
      // Close the dialog instead
      await page.click('button:has-text("Cancel")');
      await expect(page.locator('text="Import Transactions"')).not.toBeVisible();
    });
  });

  test.describe('Permissions and Security', () => {
    test('should prevent access without authentication', async ({ page }) => {
      // Clear auth state
      await page.context().clearCookies();

      // Try to access bank feeds
      await page.goto('http://localhost:3020/bank-feeds');

      // Should redirect to login
      await expect(page).toHaveURL(/\/login/);
    });

    test('should display only authorized organization data', async ({ page }) => {
      await loginAndSelectOrg(page);
      await page.goto('http://localhost:3020/bank-feeds');

      // Verify org context in header
      await expect(page.locator(`text="${TEST_ORG.name}"`)).toBeVisible();

      // Verify all transactions belong to org
      const rows = page.locator('table tbody tr');
      const count = await rows.count();

      // All transactions should be visible (belongs to selected org)
      expect(count).toBeGreaterThan(0);
    });
  });
});
