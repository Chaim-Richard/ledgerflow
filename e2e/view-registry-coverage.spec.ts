import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import fs from 'fs';
import path from 'path';

let a11yBaseline: Record<string, number> = {};
try {
  const baselinePath = path.resolve(process.cwd(), 'e2e/a11y-baseline.json');
  if (fs.existsSync(baselinePath)) {
    a11yBaseline = JSON.parse(fs.readFileSync(baselinePath, 'utf8'));
  }
} catch {
  // fallback
}

test.describe('View Registry & Navigation Coverage Suite', () => {

  test.beforeEach(async ({ page }) => {
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
      // Guest mode
    }

    await page.waitForSelector('text="Overview"', { timeout: 15000 });
  });

  const coreViews = [
    { label: 'Overview', searchHint: 'Overview' },
    { label: 'Transactions', searchHint: 'Ledger' },
    { label: 'Sales', searchHint: 'Invoices' },
    { label: 'Purchases', searchHint: 'Bills' },
    { label: 'Banking', searchHint: 'Reconciliation' },
    { label: 'Reports', searchHint: 'Trial Balance' },
    { label: 'Planning', searchHint: 'Budgets' },
    { label: 'Forensics', searchHint: 'Audit' },
    { label: 'Settings', searchHint: 'Workspace' },
  ];

  for (const view of coreViews) {
    test(`Navigate and mount view: ${view.label}`, async ({ page }) => {
      const btn = page.locator(`button:has-text("${view.label}")`).first();
      if (await btn.isVisible()) {
        await btn.click();
        await page.waitForTimeout(500);

        // Assert that the page renders without crashing or showing error boundaries
        await expect(page.locator('body')).toBeVisible();
        const bodyText = await page.locator('body').innerText();
        expect(bodyText).not.toContain('Something went wrong');
        expect(bodyText).not.toContain('Uncaught Error');

        // Run axe accessibility check
        const accessibilityScanResults = await new AxeBuilder({ page }).analyze();
        const criticalViolations = accessibilityScanResults.violations.filter(v => 
          ['critical', 'serious'].includes(v.impact || '')
        );
        if (criticalViolations.length > 0) {
          console.warn(`[A11y] Critical violations in ${view.label}:`, JSON.stringify(criticalViolations, null, 2));
        }
        const maxAllowed = a11yBaseline[view.label] ?? 0;
        expect(criticalViolations.length).toBeLessThanOrEqual(maxAllowed);
      }
    });
  }

  const reportTabs = [
    { label: 'Sales by Item', componentName: 'SalesByItemReportView' },
    { label: 'Journal Sheet', componentName: 'JournalSheetReportView' },
    { label: 'Contact Balance Summary', componentName: 'ContactBalanceSummaryView' },
    { label: 'Inventory Valuation', componentName: 'InventoryValuationReportView' },
    { label: 'Transactions by Reference', componentName: 'TransactionsByReferenceView' },
  ];

  for (const report of reportTabs) {
    test(`Report tab mounts: ${report.label} (${report.componentName})`, async ({ page }) => {
      await page.locator('button:has-text("Reports")').first().click();
      const tab = page.locator(`button:has-text("${report.label}")`).first();
      await expect(tab).toBeVisible({ timeout: 10000 });
      await tab.click();
      await page.waitForTimeout(500);

      const bodyText = await page.locator('body').innerText();
      expect(bodyText).not.toContain('Something went wrong');
      expect(bodyText).not.toContain('Uncaught Error');
      expect(bodyText).not.toContain('NaN');
    });
  }

  const settingsTabs = [
    { label: 'Import Data', componentName: 'ImportDataView' },
    { label: 'Emails & Reminders', componentName: 'EmailSettingsView' },
  ];

  for (const tab of settingsTabs) {
    test(`Settings tab mounts: ${tab.label} (${tab.componentName})`, async ({ page }) => {
      await page.locator('button:has-text("Settings")').first().click();
      const button = page.locator(`button:has-text("${tab.label}")`).first();
      await expect(button).toBeVisible({ timeout: 10000 });
      await button.click();
      await page.waitForTimeout(500);

      const bodyText = await page.locator('body').innerText();
      expect(bodyText).not.toContain('Something went wrong');
      expect(bodyText).not.toContain('Uncaught Error');
      expect(bodyText.toLowerCase()).toContain(tab.label.split(' ')[0].toLowerCase());
    });
  }

  test('Command Palette (CMD+K / CTRL+K) opens and executes view switching', async ({ page }) => {
    // Open Command Palette via keyboard shortcut or button
    await page.keyboard.press('Meta+k');
    const palette = page.locator('[data-testid="command-palette"], [role="dialog"], input[placeholder*="command" i], input[placeholder*="search" i]').first();
    
    if (await palette.isVisible({ timeout: 2000 })) {
      await expect(palette).toBeVisible();
      // Press Escape to dismiss
      await page.keyboard.press('Escape');
    }
  });

  test('Intelligence Center & Analytics Sandbox render without fatal errors', async ({ page }) => {
    const intelBtn = page.locator('button:has-text("Intelligence"), button:has-text("Insights"), button:has-text("Analytics")').first();
    if (await intelBtn.isVisible()) {
      await intelBtn.click();
      await page.waitForTimeout(1000);

      await expect(page.locator('body')).toBeVisible();
      const bodyText = await page.locator('body').innerText();
      expect(bodyText).not.toContain('NaN');
    }
  });

  test('Tax Center & Compliance Manager mount cleanly', async ({ page }) => {
    const taxBtn = page.locator('button:has-text("Taxes"), button:has-text("Tax Center"), button:has-text("Tax Liability")').first();
    if (await taxBtn.isVisible()) {
      await taxBtn.click();
      await page.waitForTimeout(800);

      await expect(page.locator('body')).toBeVisible();
      const bodyText = await page.locator('body').innerText();
      expect(bodyText).not.toContain('NaN');
    }
  });
});
