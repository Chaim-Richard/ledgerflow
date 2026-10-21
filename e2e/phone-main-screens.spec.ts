import { test, expect } from '@playwright/test';

const screens = [
  { tab: 'dashboard', heading: 'Dashboard', action: 'Add Entry' },
  { tab: 'transactions', heading: 'Journal Entries', action: 'Create new entry' },
  { tab: 'sales', heading: 'Invoicing & Customer Accounts', action: 'Add Invoice' },
  { tab: 'purchases', heading: 'Purchases & AP', action: 'Record Bill' },
  { tab: 'reports', heading: 'Reports', action: 'Generate' },
  { tab: 'settings', heading: 'Settings', action: 'Backup & Export' },
];

for (const screen of screens) {
  test(`${screen.tab}: main action is reachable at 390px without page overflow`, async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.route('**/api/**', route => route.fulfill({ status: 200, json: {} }));
    await page.addInitScript(() => {
      localStorage.setItem('isGuest', 'true');
      localStorage.setItem('has_seen_onboarding', 'true');
    });
    await page.goto(`/#${screen.tab}`);
    await expect(page.getByRole('heading', { name: screen.heading, exact: true })).toBeVisible();
    const action = page.locator('#main-content').getByRole('button', { name: screen.action, exact: true });
    await expect(action).toBeEnabled();
    await action.scrollIntoViewIfNeeded();
    await expect.poll(async () => page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
    const box = (await action.boundingBox())!;
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(391);
    expect(box.width).toBeGreaterThanOrEqual(44);
    expect(box.height).toBeGreaterThanOrEqual(44);
    await action.focus();
    await expect(action).toBeFocused();
    await action.press('Enter');
    if (['dashboard', 'transactions', 'sales', 'purchases'].includes(screen.tab)) {
      await expect(page.getByRole('dialog')).toHaveCount(1);
    } else if (screen.tab === 'settings') {
      await expect(page.getByRole('button', { name: 'Choose export', exact: true })).toBeVisible();
    } else {
      await expect(page.getByRole('heading', { name: screen.heading, exact: true })).toBeVisible();
    }
  });
}
