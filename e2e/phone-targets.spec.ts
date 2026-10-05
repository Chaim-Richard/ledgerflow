import { test, expect } from '@playwright/test';
test('phone navigation, transaction controls and selection targets are at least 44px', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.route('**/api/**', route => route.fulfill({ status: 200, json: {} }));
  await page.addInitScript(() => { localStorage.setItem('isGuest', 'true'); localStorage.setItem('has_seen_onboarding', 'true'); });
  await page.goto('/#transactions');
  await expect(page.getByRole('heading', { name: 'Journal Entries' })).toBeVisible();
  for (const control of [page.getByRole('button', { name: 'Open navigation menu' }), page.getByRole('button', { name: 'Open Help & Operational Guide' }), page.getByRole('button', { name: 'Open Notifications' }), page.getByRole('button', { name: 'Pin this page', exact: true }), page.getByRole('button', { name: 'Columns', exact: true }), page.getByRole('checkbox', { name: 'Select all transactions' })]) {
    await expect(control).toBeVisible();
    await expect.poll(async () => (await control.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    await expect.poll(async () => (await control.boundingBox())!.width).toBeGreaterThanOrEqual(44);
  }
  await page.getByRole('button', { name: 'Pin this page', exact: true }).click();
  const pinned = page.getByRole('navigation', { name: 'Pinned pages' }).getByRole('button', { name: '1 Transactions', exact: true });
  await expect.poll(async () => (await pinned.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  await page.getByRole('button', { name: 'Open navigation menu' }).click();
  await page.getByRole('navigation', { name: 'Main navigation' }).getByRole('button', { name: 'Reports', exact: true }).click();
  await expect(page).toHaveURL(/#reports/);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth);
  expect(overflow).toBe(false);
  await page.keyboard.press('Alt+1'); await expect(page).toHaveURL(/#transactions$/);
  await page.reload(); await expect(pinned).toBeVisible();
  await pinned.click(); await expect(page).toHaveURL(/#transactions$/);
  await page.getByRole('navigation', { name: 'Pinned pages' }).getByRole('button', { name: 'Unpin Transactions', exact: true }).click();
  await expect(pinned).toHaveCount(0);
});
