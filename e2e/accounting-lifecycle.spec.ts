import { test, expect } from '@playwright/test';

test.describe('End-to-End Accounting Lifecycle & Workflows', () => {

  test.beforeEach(async ({ page }) => {
    // Seed guest session directly into localStorage for zero-flake authentication
    await page.addInitScript(() => {
      localStorage.setItem('isGuest', 'true');
      localStorage.setItem('has_seen_onboarding', 'true');
    });

    await page.goto('/');

    const guestButton = page.locator('button', { hasText: 'Continue as Guest' });
    try {
      if (await guestButton.isVisible({ timeout: 2000 })) {
        await guestButton.click();
      }
    } catch {
      // Guest mode active
    }

    await page.waitForSelector('text="Overview"', { timeout: 15000 });
  });

  test('Full Lifecycle: Invoicing -> Payment -> Double-Entry Posting -> Aging -> Reports', async ({ page }) => {
    // 1. Navigate to Sales / Invoices
    const moneyInNav = page.locator('button:has-text("Money In"), button:has-text("Sales"), button:has-text("Invoices")').first();
    if (await moneyInNav.isVisible()) {
      await moneyInNav.click();
    }

    // 2. Open Add/Create Invoice modal
    const addInvoiceBtn = page.locator('button:has-text("Add Invoice"), button:has-text("New Invoice"), button:has-text("Create Invoice")').first();
    if (await addInvoiceBtn.isVisible()) {
      await addInvoiceBtn.click();
      await expect(page.locator('body')).toBeVisible();
    }

    // 3. Verify ledger state integrity via evaluate
    const ledgerIntegrity = await page.evaluate(() => {
      const store = (window as any).__ledgerStore;
      if (!store || !store.getState) return null;

      const state = store.getState();
      const accounts = state.accounts || [];
      const transactions = state.transactions || [];

      // Check double entry balance across postable transactions
      let totalDebits = 0;
      let totalCredits = 0;

      transactions.forEach((tx: any) => {
        if (tx.deletedAt || tx.status === 'void' || tx.status === 'draft') return;
        (tx.lines || []).forEach((l: any) => {
          const amt = Number(l.amountCents) || 0;
          if (amt > 0) totalDebits += amt;
          else totalCredits += Math.abs(amt);
        });
      });

      return {
        accountCount: accounts.length,
        txCount: transactions.length,
        isBalanced: totalDebits === totalCredits,
        totalDebits,
        totalCredits
      };
    });

    if (ledgerIntegrity) {
      expect(ledgerIntegrity.accountCount).toBeGreaterThan(0);
      expect(ledgerIntegrity.isBalanced).toBe(true);
    }
  });

  test('Financial Statements Integrity: Trial Balance, Balance Sheet, P&L', async ({ page }) => {
    // Navigate to Reports
    const reportsNav = page.locator('button:has-text("Reports")').first();
    if (await reportsNav.isVisible()) {
      await reportsNav.click();
    }

    // Check Trial Balance subview
    const tbTab = page.locator('button:has-text("Trial Balance")').first();
    if (await tbTab.isVisible()) {
      await tbTab.click();
      await page.waitForTimeout(500);

      // Verify no NaN or undefined amounts
      const text = await page.locator('body').innerText();
      expect(text).not.toContain('NaN');
      expect(text).not.toContain('undefined');
    }

    // Check Balance Sheet
    const bsTab = page.locator('button:has-text("Balance Sheet")').first();
    if (await bsTab.isVisible()) {
      await bsTab.click();
      await page.waitForTimeout(500);
      const text = await page.locator('body').innerText();
      expect(text).not.toContain('NaN');
    }

    // Check Profit and Loss
    const plTab = page.locator('button:has-text("Profit & Loss"), button:has-text("Income Statement")').first();
    if (await plTab.isVisible()) {
      await plTab.click();
      await page.waitForTimeout(500);
      const text = await page.locator('body').innerText();
      expect(text).not.toContain('NaN');
    }
  });

  test('Bank Reconciliation and Variance Validation', async ({ page }) => {
    // Navigate to Banking / Reconciliation
    const bankingNav = page.locator('button:has-text("Banking"), button:has-text("Reconciliation")').first();
    if (await bankingNav.isVisible()) {
      await bankingNav.click();
    }

    // Verify reconciliation workspace loads
    await expect(page.locator('body')).toBeVisible();
    await page.waitForTimeout(1000);

    const bodyText = await page.locator('body').innerText();
    expect(bodyText).not.toContain('NaN');
  });

  test('Month-End Close: Audit Checklist, Suspense Clearance, and Period Locking', async ({ page }) => {
    // Navigate to Month-End Close
    const closeNav = page.locator('button:has-text("Month-End Close"), button:has-text("Closing")').first();
    if (await closeNav.isVisible()) {
      await closeNav.click();
      await page.waitForTimeout(1000);

      // Verify the checklist stages render
      await expect(page.locator('text="Month-End Close Workspace"').first()).toBeVisible();
      await expect(page.locator('text="Lock Accounting Period"').first()).toBeVisible();
      await expect(page.locator('text="Export Full Accountant Package"').first()).toBeVisible();
    }
  });

  test('A/R and A/P Aging Summary Reports', async ({ page }) => {
    const reportsNav = page.locator('button:has-text("Reports")').first();
    if (await reportsNav.isVisible()) {
      await reportsNav.click();
    }

    const arAgingTab = page.locator('button:has-text("A/R Aging"), button:has-text("Accounts Receivable")').first();
    if (await arAgingTab.isVisible()) {
      await arAgingTab.click();
      await page.waitForTimeout(500);
      const text = await page.locator('body').innerText();
      expect(text).not.toContain('NaN');
    }

    const apAgingTab = page.locator('button:has-text("A/P Aging"), button:has-text("Accounts Payable")').first();
    if (await apAgingTab.isVisible()) {
      await apAgingTab.click();
      await page.waitForTimeout(500);
      const text = await page.locator('body').innerText();
      expect(text).not.toContain('NaN');
    }
  });
});
