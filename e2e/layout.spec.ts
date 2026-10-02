import { test, expect } from '@playwright/test';

/**
 * Every screen fits a 1280 px laptop: nothing sticks out past the right edge of the main area (the
 * Overview was cut off on screens under ~1600 px), and the screen draws something. Opened by
 * address (#tab), as a shared link would.
 */
const screens = [
  'dashboard', 'inbox', 'copilot', 'transactions', 'credit-notes', 'assets', 'register', 'ledger',
  'intercompany', 'recurring', 'query-builder', 'banking', 'audit-trail', 'reconciliation',
  'month-end-close', 'fiscal-periods', 'sales', 'estimates', 'payments', 'purchases',
  'purchase-orders', 'payroll', 'reports', 'charts', 'forecaster', 'intelligence', 'settings',
  'data-health', 'support', 'help', 'vault', 'pricing', 'api-hub',
];

test.describe('Layout at 1280 x 800', () => {
  for (const screen of screens) {
    test(`${screen} fits the window`, async ({ page }) => {
      await page.setViewportSize({ width: 1280, height: 800 });
      await page.addInitScript(() => {
        localStorage.setItem('isGuest', 'true');
        localStorage.setItem('has_seen_onboarding', 'true');
      });
      await page.goto(`/#${screen}`);
      const main = page.locator('#main-content');
      await main.waitFor({ timeout: 15000 });
      await page.waitForTimeout(1500); // lazy screen + entrance animation
      const { overflow, text } = await main.evaluate(el => ({ overflow: el.scrollWidth - el.clientWidth, text: el.innerText.trim().length }));
      expect(overflow, `${screen} is ${overflow}px wider than the window`).toBeLessThanOrEqual(1);
      expect(text, `${screen} drew nothing`).toBeGreaterThan(20);
    });
  }
});
