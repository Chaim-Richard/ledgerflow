import { test, expect } from '@playwright/test';

for (const theme of ['light', 'dark']) {
  test(`report navigation scrolls without clipping labels: ${theme}`, async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 850 });
    await page.addInitScript(selectedTheme => {
      localStorage.setItem('isGuest', 'true');
      localStorage.setItem('has_seen_onboarding', 'true');
      localStorage.setItem('ledgerflow-cookie-consent', 'accepted');
      localStorage.setItem('lf_theme', selectedTheme);
    }, theme);
    await page.goto('/?report=trial-balance#reports');
    const modules = page.getByRole('navigation', { name: 'Module pages', exact: true });
    await expect(modules).toBeVisible();
    expect(await modules.evaluate(el => {
      const items = [...el.querySelectorAll('button')].map(button => button.getBoundingClientRect());
      return items.every((rect, index) => rect.height >= 44 && (!index || rect.x >= items[index - 1].right));
    })).toBe(true);
    const navigation = page.getByRole('navigation', { name: 'Report pages', exact: true });
    await expect(navigation).toBeVisible();
    const buttons = navigation.getByRole('button');
    expect(await buttons.count()).toBeGreaterThan(5);
    expect(await navigation.evaluate(el => el.scrollWidth > el.clientWidth)).toBe(true);
    expect(await navigation.evaluate(el => {
      const items = [...el.querySelectorAll('button')].map(button => button.getBoundingClientRect());
      return items.every((rect, index) => rect.height >= 44 && Math.abs(rect.y - items[0].y) < 1 && (!index || rect.x >= items[index - 1].right));
    })).toBe(true);
    // Native focus scrolling and activation must keep the newly chosen report in view.
    const last = buttons.last();
    await last.focus();
    await page.keyboard.press('Enter');
    await expect(last).toHaveAttribute('aria-current', 'page');
    await expect.poll(() => navigation.evaluate(el => {
      const item = el.querySelector('[aria-current="page"]')!.getBoundingClientRect();
      const frame = el.getBoundingClientRect();
      return item.left >= frame.left - 1 && item.right <= frame.right + 1;
    })).toBe(true);
    expect(new URL(page.url()).searchParams.get('report')).not.toBe('trial-balance');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.setViewportSize({ width: 1280, height: 850 });
    await expect(last).toHaveAttribute('aria-current', 'page');
  });
}
