import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

for (const width of [390, 1280]) for (const theme of ['light', 'dark']) {
  test(`retained earnings remains readable ${width} ${theme}`, async ({ page }) => {
    await page.setViewportSize({ width, height: 850 });
    await page.addInitScript(selectedTheme => {
      localStorage.setItem('isGuest', 'true');
      localStorage.setItem('has_seen_onboarding', 'true');
      localStorage.setItem('ledgerflow-cookie-consent', 'accepted');
      localStorage.setItem('lf_theme', selectedTheme);
    }, theme);
    await page.goto('/?report=balance-sheet&end=2026-09-30&start=2026-09-01#reports');
    const row = page.getByTitle('Click to drill down into Retained Earnings transaction activity', { exact: true });
    await expect(row).toBeVisible();
    await row.scrollIntoViewIfNeeded();
    expect((await row.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    for (const state of ['normal', 'hover', 'focus']) {
      if (state === 'hover') await row.hover();
      if (state === 'focus') { await page.mouse.move(0, 0); await row.focus(); await expect(row).toBeFocused(); }
      const audit = await new AxeBuilder({ page }).include('button[title="Click to drill down into Retained Earnings transaction activity"]').withRules(['color-contrast']).analyze();
      expect(audit.violations, state).toEqual([]);
    }
    await page.keyboard.press('Enter');
    await expect(page.getByRole('dialog')).toBeVisible();
  });
}
