import { test, expect } from '@playwright/test';

// Contract and browser behavior only: no live authenticator is enrolled by this fixture.
test.beforeEach(async ({ page }) => {
  await page.route('**/api/**', route => route.fulfill({ status: 200, json: {} }));
  await page.route('**/rest/v1/**', route => route.fulfill({ status: 200, json: route.request().url().includes('/workspaces') ? [{ id: 'mfa-browser', data: { uid: 'mfa-user', name: 'MFA test', currency: 'USD', businessType: 'custom', createdAt: '2026-01-01' } }] : [] }));
  await page.addInitScript(() => { localStorage.setItem('isGuest', 'true'); localStorage.setItem('has_seen_onboarding', 'true'); });
  await page.goto('/#settings');
  const guest = page.getByRole('button', { name: 'Continue as Guest' });
  if (await guest.isVisible()) await guest.click();
  await expect(page.getByRole('heading', { name: 'Settings', exact: true })).toBeVisible();
  await page.evaluate(async () => {
    const authPath = '/src/stores/useAuthStore.ts';
    const uiPath = '/src/stores/useUIStore.ts';
    const clientPath = '/src/lib/db/client.ts';
    const { useAuthStore } = await import(authPath);
    const { useUIStore } = await import(uiPath);
    const { getSupabase } = await import(clientPath);
    const user = { uid: 'mfa-user', email: 'mfa@example.test', isAnonymous: false, getIdToken: async () => 'fixture-token' };
    let factors = [{ id: 'phone', status: 'verified', factor_type: 'totp', friendly_name: 'Test phone' }];
    const client = getSupabase();
    client.auth.getUser = async () => ({ data: { user: { id: user.uid } }, error: null });
    client.auth.mfa.listFactors = async () => ({ data: { all: factors, totp: factors.filter(f => f.status === 'verified'), phone: [] }, error: null });
    client.auth.mfa.enroll = async () => { factors.push({ id: 'new', status: 'unverified', factor_type: 'totp', friendly_name: 'New phone' }); return { data: { id: 'new', totp: { secret: 'BROWSER-TEST-KEY', qr_code: 'data:image/svg+xml,%3Csvg/%3E', uri: 'otpauth://totp/test' } }, error: null }; };
    client.auth.mfa.challenge = async () => ({ data: { id: 'challenge' }, error: null });
    client.auth.mfa.verify = async ({ factorId }: { factorId: string }) => { factors = factors.map(f => f.id === factorId ? { ...f, status: 'verified' } : f); return { data: {}, error: null }; };
    client.auth.mfa.challengeAndVerify = async ({ code }: { code: string }) => ({ data: {}, error: code === '123456' ? null : new Error('Wrong code') });
    client.auth.mfa.unenroll = async ({ factorId }: { factorId: string }) => { factors = factors.filter(f => f.id !== factorId); return { data: { id: factorId }, error: null }; };
    useAuthStore.setState({ user, isGuest: false, currentWorkspaceId: 'mfa-browser', workspaces: [{ id: 'mfa-browser', uid: user.uid, name: 'MFA test', currency: 'USD', businessType: 'custom', createdAt: '2026-01-01' }] });
    useUIStore.setState({ activeSettingsTab: 'security' });
  });
  await expect(page.getByRole('region', { name: 'Two-step login' }).getByText('Two-step login is on (1 authenticator).')).toBeVisible();
});

test('keyboard enrollment and verified removal retain focus, status and retry', async ({ page }) => {
  const panel = page.getByRole('region', { name: 'Two-step login' });
  await panel.getByRole('button', { name: 'Add authenticator' }).focus();
  await page.keyboard.press('Enter');
  const code = panel.getByLabel('Current 6-digit authenticator code');
  await expect(code).toBeFocused();
  await code.fill('123456');
  await panel.getByRole('button', { name: 'Verify and add' }).click();
  await expect(panel.getByText('Two-step login is on (2 authenticators).')).toBeFocused();
  await expect(panel.getByText('BROWSER-TEST-KEY')).toHaveCount(0);
  await panel.getByRole('button', { name: 'Remove Test phone' }).click();
  await expect(code).toBeFocused();
  await code.fill('000000');
  await panel.getByRole('button', { name: 'Verify and remove' }).click();
  await expect(panel.getByRole('alert')).toContainText('Wrong code');
  await expect(code).toBeFocused();
  await code.fill('123456');
  await panel.getByRole('button', { name: 'Verify and remove' }).click();
  await expect(panel.getByText('Two-step login is on (1 authenticator).')).toBeFocused();
  await expect(panel.getByRole('button', { name: 'Remove Test phone' })).toHaveCount(0);
});

test('phone controls fit the screen and cancel setup without leaving its key', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const panel = page.getByRole('region', { name: 'Two-step login' });
  await panel.getByRole('button', { name: 'Add authenticator' }).click();
  for (const control of await panel.locator('button,input').all()) expect((await control.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  const bounds = (await panel.boundingBox())!;
  expect(bounds.x).toBeGreaterThanOrEqual(0);
  expect(bounds.x + bounds.width).toBeLessThanOrEqual(390);
  expect(await panel.evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true);
  await panel.getByRole('button', { name: 'Cancel setup' }).click();
  await expect(panel.getByText('BROWSER-TEST-KEY')).toHaveCount(0);
  await expect(panel.getByText('Two-step login is on (1 authenticator).')).toBeFocused();
});
