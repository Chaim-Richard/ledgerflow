import { test, expect } from '@playwright/test';
test('recent records reopen by typed link from another page', async ({ page }) => {
  await page.route('**/api/**', route => route.fulfill({ status: 200, json: {} }));
  await page.addInitScript(() => { localStorage.setItem('isGuest', 'true'); localStorage.setItem('has_seen_onboarding', 'true'); });
  await page.goto('/#transactions');
  await expect(page.getByRole('heading', { name: 'Journal Entries' })).toBeVisible();
  await page.evaluate(async () => {
    const { useUIStore } = await import('/src/stores/useUIStore.ts');
    useUIStore.getState().openRecord({ type: 'account', id: 'cash-recent' });
    useUIStore.getState().setActiveTab('transactions');
  });
  await page.keyboard.press('Control+k');
  const input = page.getByRole('textbox', { name: 'Search commands or enter a transaction' });
  await expect(input).toBeFocused();
  await expect(page.getByRole('dialog', { name: 'Command palette' })).toHaveCount(1);
  await expect(page.getByRole('heading', { name: 'Recent items', exact: true })).toBeVisible();
  await page.getByRole('button', { name: /Account cash-recent/ }).click();
  await expect(page).toHaveURL(/#ledger\/account\/cash-recent$/);
  await page.evaluate(async () => {
    const { useLedgerStore } = await import('/src/stores/useLedgerStore.ts');
    useLedgerStore.setState({ vendors: [{ id: 'vendor-he', uid: '', workspaceId: '', name: 'שלום Supply', category: 'Supplier' }], customers: [{ id: 'customer-he', uid: '', workspaceId: '', name: 'שלום Customer' }] });
  });
  await page.keyboard.press('Control+k'); await input.fill('שָׁלוֹם');
  await expect(page.getByRole('heading', { name: 'Customers', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Vendors', exact: true })).toBeVisible();
  await page.keyboard.press('Escape');
});
