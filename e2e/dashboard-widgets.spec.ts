import { test, expect } from '@playwright/test';
for (const width of [1280, 390]) {
  test(`dashboard dates, keyboard layout controls and report drill-through at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 850 });
    await page.route('**/api/**', route => route.fulfill({ status: route.request().url().includes('/reports/') ? 401 : 200, json: {} }));
    await page.addInitScript(() => { localStorage.setItem('isGuest', 'true'); localStorage.setItem('has_seen_onboarding', 'true'); });
    await page.goto('/');
    const dashboard = page.getByRole('region', { name: 'Dashboard widgets' });
    await expect(dashboard).toBeVisible();
    await dashboard.getByLabel('Dashboard date range').selectOption('custom');
    await dashboard.getByLabel('Dashboard from').fill('2024-02-10'); await dashboard.getByLabel('Dashboard to').fill('2024-02-29');
    const revenue = dashboard.getByRole('article', { name: 'Revenue', exact: true });
    await expect(revenue.getByRole('img')).toHaveCount(1);
    await revenue.getByText('Monthly values', { exact: true }).click(); await expect(revenue.getByRole('table').locator('tbody tr')).toHaveCount(12);
    await dashboard.getByText('Customize widgets', { exact: true }).click();
    const toggle = dashboard.getByRole('checkbox', { name: 'Revenue', exact: true });
    await toggle.focus(); await toggle.press('Space'); await expect(revenue).toHaveCount(0);
    await page.reload(); await dashboard.getByText('Customize widgets', { exact: true }).click(); await expect(toggle).not.toBeChecked();
    const move = dashboard.getByRole('button', { name: 'Move You owe up', exact: true });
    await move.focus(); await move.press('Enter');
    await dashboard.getByRole('button', { name: 'Reset layout', exact: true }).click(); await expect(revenue).toBeVisible();
    await dashboard.getByLabel('Dashboard date range').selectOption('custom');
    await dashboard.getByLabel('Dashboard from').fill('2024-02-10'); await dashboard.getByLabel('Dashboard to').fill('2024-02-29');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    const target = dashboard.getByLabel('Dashboard date range'); expect((await target.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    await revenue.getByRole('link').click();
    await expect(page).toHaveURL(/start=2024-02-10.*end=2024-02-29.*#reports/);
    await expect(page.getByText('Custom range: 2024-02-10 to 2024-02-29', { exact: true }).first()).toBeVisible();
    await expect(page.getByLabel('Select Year')).toHaveValue('2024');
    await expect(page.getByLabel('Reporting period start date')).toHaveValue('2024-02-10');
    await expect(page.getByLabel('Reporting period end date')).toHaveValue('2024-02-29');
    await page.getByRole('button', { name: 'Month', exact: true }).click();
    await expect(page).not.toHaveURL(/start=/);
  });
}
