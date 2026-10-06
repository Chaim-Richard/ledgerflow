import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';

const fixture = (name: string) => readFileSync(new URL(`../src/tests/fixtures/bank-statements/${name}`, import.meta.url));

test.beforeEach(async ({ page }) => {
  // An authenticated owner fixture: guest mode has no user and correctly cannot import.
  await page.route('**/api/**', route => route.fulfill({ status: 200, json: {} }));
  await page.route('**/rest/v1/**', route => route.fulfill({ status: 200, json: route.request().url().includes('/workspaces')
    ? [{ id: 'ai4-browser', data: { uid: 'ai4-browser-owner', name: 'Parser test', currency: 'USD', businessType: 'custom', createdAt: '2026-01-01' } }]
    : [] }));
  await page.addInitScript(() => {
    localStorage.setItem('isGuest', 'true');
    localStorage.setItem('has_seen_onboarding', 'true');
  });
  await page.goto('/#banking');
  const guest = page.getByRole('button', { name: 'Continue as Guest' });
  if (await guest.isVisible()) await guest.click();
  await expect(page.getByRole('heading', { name: 'Bank & Institution Connections' })).toBeVisible();
  await page.evaluate(async () => {
    const path = '/src/stores/useAuthStore.ts';
    const { useAuthStore } = await import(path);
    const user = { uid: 'ai4-browser-owner', email: 'owner@example.test', getIdToken: async () => 'fixture-token' };
    useAuthStore.setState({ user, isGuest: false, currentWorkspaceId: 'ai4-browser', workspaces: [{ id: 'ai4-browser', uid: user.uid, name: 'Parser test', currency: 'USD', businessType: 'custom', createdAt: '2026-01-01' }] });
  });
  await page.getByRole('button', { name: 'Import statement', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Statement Intelligence' })).toBeVisible();
});

for (const order of ['mdy', 'dmy']) {
  test(`QIF ${order} uses numeric dates, preserves cents, and returns keyboard focus`, async ({ page }) => {
    const dialog = page.getByRole('dialog', { name: 'Statement Intelligence' });
    await dialog.getByLabel('QIF date order').selectOption(order);
    await dialog.locator('input[type=file]').setInputFiles({ name: 'checking.qif', mimeType: 'text/plain', buffer: fixture(`checking-${order}.qif`) });
    await expect(dialog.getByText('שכירות Office - October rent', { exact: true })).toBeVisible();
    await expect(dialog.getByText('-$1,250.50', { exact: true })).toBeVisible();
    await expect(dialog.getByText('+$250.10', { exact: true })).toBeVisible();
    await expect(dialog.getByRole('button', { name: 'Import 2 Entries' })).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Import statement', exact: true })).toBeFocused();
  });
}

test('BAI2 continuations reach review and no parsing request is sent', async ({ page }) => {
  const parserRequests: string[] = [];
  page.on('request', request => { if (/upload-bank|parse-statement|generate/.test(request.url())) parserRequests.push(request.url()); });
  const dialog = page.getByRole('dialog', { name: 'Statement Intelligence' });
  await dialog.locator('input[type=file]').setInputFiles({ name: 'checking.bai2', mimeType: 'text/plain', buffer: fixture('checking.bai2') });
  await expect(dialog.getByText('Customer payment, Acme תשלום October', { exact: true })).toBeVisible();
  await expect(dialog.getByText('Office supplies', { exact: true })).toBeVisible();
  await expect(dialog.getByText('+$250.50', { exact: true })).toBeVisible();
  await expect(dialog.getByText('-$50.00', { exact: true })).toBeVisible();
  await expect(dialog.getByRole('button', { name: 'Import 2 Entries' })).toBeVisible();
  expect(parserRequests).toEqual([]);
});

test('a bad BAI2 control total names its line and leaves the file ready for retry', async ({ page }) => {
  const dialog = page.getByRole('dialog', { name: 'Statement Intelligence' });
  const buffer = Buffer.from(fixture('checking.bai2').toString().replace('49,255100,6', '49,1,6'));
  await dialog.locator('input[type=file]').setInputFiles({ name: 'bad.bai', mimeType: 'text/plain', buffer });
  await expect(dialog.getByRole('alert')).toContainText('BAI2 line 8: Account control total');
  await expect(dialog.getByRole('button', { name: /Import \d+ Entries/ })).toHaveCount(0);
  await dialog.locator('input[type=file]').setInputFiles({ name: 'fixed.bai', mimeType: 'text/plain', buffer: fixture('checking.bai2') });
  await expect(dialog.getByText('Office supplies', { exact: true })).toBeVisible();
});

test('QIF requires a date order before it reads ambiguous dates', async ({ page }) => {
  const dialog = page.getByRole('dialog', { name: 'Statement Intelligence' });
  await dialog.locator('input[type=file]').setInputFiles({ name: 'checking.qif', mimeType: 'text/plain', buffer: fixture('checking-mdy.qif') });
  await expect(dialog.getByRole('alert')).toContainText('Choose the QIF date order');
  await expect(dialog.getByLabel('QIF date order')).toHaveValue('');
});

test('phone upload and review stay within the viewport with reachable new controls', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const dialog = page.getByRole('dialog', { name: 'Statement Intelligence' });
  const order = dialog.getByLabel('QIF date order');
  expect((await order.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  await order.selectOption('mdy');
  await dialog.locator('input[type=file]').setInputFiles({ name: 'checking.qif', mimeType: 'text/plain', buffer: fixture('checking-mdy.qif') });
  await expect(dialog.getByText('שכירות Office - October rent', { exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.keyboard.press('Escape');
  const launch = page.getByRole('button', { name: 'Import statement', exact: true });
  await expect(launch).toBeFocused();
  expect((await launch.boundingBox())!.height).toBeGreaterThanOrEqual(44);
});
