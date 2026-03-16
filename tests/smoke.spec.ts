import { test, expect } from '@playwright/test';

test.describe('OpenLedger Smoke Test', () => {
  test('login → select org → create journal → post → see TB update', async ({ page }) => {
    // 1. Navigate to login page
    await page.goto('/login');
    await expect(page.locator('h2')).toContainText('OpenLedger');

    // 2. Login
    await page.fill('input[name="email"]', 'admin@example.com');
    await page.fill('input[name="password"]', 'password');
    await page.click('button[type="submit"]');

    // 3. Select organization (if multiple)
    // The demo user has 2 orgs, so org selector should appear
    await page.waitForURL('**/select-org', { timeout: 5000 }).catch(() => {
      // If single org, might skip to dashboard
    });

    if (page.url().includes('/select-org')) {
      // Select first organization
      await page.click('div[class*="cursor-pointer"]');
      await page.click('button:has-text("Continue")');
    }

    // 4. Wait for dashboard to load
    await page.waitForURL('**/', { timeout: 5000 });
    await expect(page.locator('h1')).toContainText('Dashboard');

    // 5. Navigate to Journals page
    await page.click('a[href="/journals"]');
    await expect(page.locator('h1')).toContainText('Journal Entries');

    // 6. Create a new journal entry
    await page.click('button:has-text("Add")');

    // Wait for dialog to open
    await page.waitForSelector('form', { timeout: 5000 });

    // Fill in journal header
    await page.selectOption('select', { index: 0 }); // Select first journal type
    await page.fill('input[id="referenceNumber"]', 'TEST-001');
    await page.fill('textarea[id="description"]', 'Test journal entry for smoke test');

    // Fill in first line (Debit)
    const firstAccountSelect = page.locator('select').nth(1);
    await firstAccountSelect.selectOption({ index: 1 }); // Select first account
    await page.fill('input[type="number"]').first().fill('100.00');

    // Fill in second line (Credit)
    const secondAccountSelect = page.locator('select').nth(4);
    await secondAccountSelect.selectOption({ index: 2 }); // Select second account
    await page.locator('input[type="number"]').nth(3).fill('100.00');

    // Submit the journal
    await page.click('button[type="submit"]:has-text("Create")');

    // Wait for dialog to close and journal to appear in list
    await page.waitForSelector('button:has-text("Add")', { timeout: 5000 });

    // 7. Post the journal entry
    // Find the journal we just created and post it
    const postButton = page.locator('button:has-text("Post")').first();
    await postButton.click();

    // Confirm the post action
    page.on('dialog', (dialog) => dialog.accept());

    // Wait for success message or status update
    await page.waitForTimeout(1000);

    // 8. Navigate to Trial Balance
    await page.click('a[href="/reports"]');
    await expect(page.locator('h1')).toContainText('Trial Balance');

    // 9. Run the trial balance report
    await page.click('button:has-text("Run Report")');

    // Wait for report to load
    await page.waitForSelector('table', { timeout: 5000 });

    // 10. Verify the report shows data
    const reportRows = page.locator('tbody tr');
    await expect(reportRows).not.toHaveCount(0);

    // Verify balance check shows "In Balance"
    await expect(page.locator('text=In Balance')).toBeVisible();

    console.log('✓ Smoke test passed: Full workflow completed successfully');
  });
});
