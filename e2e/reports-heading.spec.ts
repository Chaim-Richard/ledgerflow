import { test, expect } from '@playwright/test';

for (const width of [390, 1280]) for (const theme of ['light', 'dark']) {
  test(`compact reports heading ${width} ${theme}`, async ({ page }) => {
    await page.setViewportSize({ width, height: 850 });
    await page.addInitScript(selectedTheme => {
      localStorage.setItem('isGuest', 'true');
      localStorage.setItem('has_seen_onboarding', 'true');
      localStorage.setItem('ledgerflow-cookie-consent', 'accepted');
      localStorage.setItem('lf_theme', selectedTheme);
    }, theme);
    await page.goto('/?report=pnl&y=2026&m=9&t=month#reports');
    const heading = page.getByRole('region', { name: 'Reports heading', exact: true });
    await expect(heading.getByRole('heading', { name: 'Reports', exact: true })).toBeVisible();
    expect((await heading.boundingBox())!.height).toBeLessThanOrEqual(120);
    for (const name of ['Export', 'Print / PDF']) {
      const button = heading.getByRole('button', { name, exact: true });
      await expect(button).toBeVisible();
      expect((await button.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    }
    let printCalls = 0;
    await page.exposeFunction('recordPrint', () => { printCalls++; });
    await page.evaluate(() => { window.print = () => { void (window as unknown as { recordPrint: () => Promise<void> }).recordPrint(); }; });
    await heading.getByRole('button', { name: 'Print / PDF', exact: true }).click();
    await expect.poll(() => printCalls).toBe(1);
    await page.getByRole('region', { name: 'Report period', exact: true }).getByRole('button', { name: 'Quarter', exact: true }).click();
    await page.getByLabel('Select Quarter', { exact: true }).selectOption('1');
    await expect(heading).toContainText('Q2');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  });
}
