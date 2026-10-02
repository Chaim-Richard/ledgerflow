import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import fs from 'fs';
import path from 'path';

/**
 * Text contrast in both themes (E-27): axe's color-contrast check on the main screens, in light and
 * dark. e2e/contrast-baseline.json holds how many elements still fail per theme and screen; the
 * numbers may only go down (fix screens, then lower them).
 */
const baselinePath = path.resolve(process.cwd(), 'e2e/contrast-baseline.json');
const baseline: Record<string, number> = fs.existsSync(baselinePath) ? JSON.parse(fs.readFileSync(baselinePath, 'utf8')) : {};
const views = ['Overview', 'Transactions', 'Sales', 'Purchases', 'Reports', 'Settings'];

for (const theme of ['light', 'dark'] as const) {
  test.describe(`Contrast (${theme})`, () => {
    test.beforeEach(async ({ page }) => {
      await page.addInitScript((t) => {
        localStorage.setItem('isGuest', 'true');
        localStorage.setItem('has_seen_onboarding', 'true');
        localStorage.setItem('lf_theme', t);
      }, theme);
      await page.goto('/');
      await page.waitForSelector('text="Overview"', { timeout: 15000 });
    });

    for (const view of views) {
      test(`${theme}: ${view}`, async ({ page }) => {
        const btn = page.locator(`button:has-text("${view}")`).first();
        if (await btn.isVisible()) await btn.click();
        // let entrance animations finish: text fading in is measured at its final colour
        await page.waitForTimeout(1500);
        const results = await new AxeBuilder({ page }).withRules(['color-contrast']).analyze();
        const failing = results.violations.reduce((n, v) => n + v.nodes.length, 0);
        const key = `${theme}:${view}`;
        console.log(`[contrast] ${key} ${failing}`);
        expect(failing, `${key}: text below the contrast minimum (baseline ${baseline[key] ?? 0})`).toBeLessThanOrEqual(baseline[key] ?? 0);
      });
    }
  });
}
