import { test, expect } from '@playwright/test';

test('account conversion uses the financial endpoint, retains refused preview, and refreshes confirmed amounts', async ({ page }) => {
  const workspaceId = 'rules-financial';
  const accounts = [
    { id: 'bank', name: 'Bank', type: 'asset', category: 'Cash' },
    { id: 'savings', name: 'Savings', type: 'asset', category: 'Cash' },
    { id: 'expense', name: 'Office', type: 'expense', category: 'Expenses' },
  ].map(account => ({ ...account, workspaceId, uid: 'financial-user', currency: 'USD', code: account.id }));
  let entry = { id: 'entry', uid: 'financial-user', workspaceId, description: 'AWS Hebrew חשבון', date: '2026-10-01', type: 'expense', status: 'completed', updatedAt: '2026-10-01T00:00:00.000Z', totalAmountCents: 12345, currency: 'USD', originalCurrency: 'ILS', exchangeRate: 0.27, lines: [{ id: 'bank-line', accountId: 'bank', accountName: 'Bank', amountCents: -12345 }, { id: 'expense-line', accountId: 'expense', accountName: 'Office', amountCents: 12345 }] };
  const rule = { id: 'finance', uid: 'financial-user', workspaceId, name: 'Move to savings', groupName: 'Accounts', priority: 1, isActive: true, condition: { descriptionContains: 'AWS' }, action: { targetAccountId: 'savings', bankAccountId: 'bank', targetTransactionKind: 'transfer' }, confidence: 1, isHardened: true, createdAt: '2026-10-01' };
  let refuse = true; const requests: unknown[] = []; const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.route('**/api/**', async route => {
    if (!route.request().url().includes('/transactions/recategorize')) { await route.fulfill({ status: 200, json: {} }); return; }
    requests.push(route.request().postDataJSON());
    if (refuse) { await route.fulfill({ status: 409, json: { error: 'Entry changed; refresh first', entryId: 'entry' } }); return; }
    const savedEntry = { ...entry, isTransfer: true, transferDetails: { fromAccountId: 'bank', toAccountId: 'savings' }, updatedAt: '2026-10-06T00:00:00.000Z', lines: [entry.lines[0], { ...entry.lines[1], accountId: 'savings', accountName: 'Savings', isTransfer: true }] };
    entry = savedEntry;
    await route.fulfill({ status: 200, json: { status: 'success', changed: 1 } });
  });
  await page.route('**/rest/v1/**', async route => {
    const url = route.request().url();
    const workspace = { id: workspaceId, data: { uid: 'financial-user', name: 'Finance', currency: 'USD', businessType: 'custom', createdAt: '2026-01-01' } };
    const rows = url.includes('/workspaces') ? [workspace] : url.includes('/autoRules') ? [{ id: rule.id, data: rule }] : url.includes('/chartAccounts') ? accounts.map(account => ({ id: account.id, data: account })) : url.includes('/transactions') ? [{ id: entry.id, data: entry }] : [];
    await route.fulfill({ status: 200, json: url.includes('/rpc/') ? null : url.includes('/transactions') && new URL(url).searchParams.has('id') ? rows[0] : rows });
  });
  await page.addInitScript(() => { localStorage.setItem('isGuest', 'true'); localStorage.setItem('has_seen_onboarding', 'true'); });
  await page.goto('/#settings');
  const guest = page.getByRole('button', { name: 'Continue as Guest' }); if (await guest.isVisible()) await guest.click();
  await expect(page.getByRole('heading', { name: 'Settings', exact: true })).toBeVisible();
  await page.evaluate(async ({ workspaceId, accounts, entry, rule }) => {
    const authPath = '/src/stores/useAuthStore.ts'; const uiPath = '/src/stores/useUIStore.ts'; const ledgerPath = '/src/stores/useLedgerStore.ts';
    const { useAuthStore } = await import(authPath); const { useUIStore } = await import(uiPath); const { useLedgerStore } = await import(ledgerPath);
    const user = { uid: 'financial-user', email: 'finance@example.test', isAnonymous: false, getIdToken: async () => 'fixture-token' };
    useAuthStore.setState({ user, isGuest: false, currentWorkspaceId: workspaceId, workspaces: [{ id: workspaceId, uid: user.uid, name: 'Finance', currency: 'USD', businessType: 'custom', createdAt: '2026-01-01' }] });
    useLedgerStore.setState({ accounts, transactions: [entry], autoRules: [rule] }); useUIStore.setState({ activeSettingsTab: 'rules' });
  }, { workspaceId, accounts, entry, rule });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('button', { name: 'Test Against Ledger' }).click();
  await expect(page.getByText('Counterparty account: Savings', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: /Apply 1 Updates/ }).click();
  await expect(page.getByRole('alert')).toContainText('Entry changed');
  await expect(page.getByRole('dialog')).toBeVisible();
  refuse = false; await page.getByRole('button', { name: /Apply 1 Updates/ }).click();
  await expect(page.getByRole('dialog')).not.toBeVisible();
  expect(requests).toEqual([0, 1].map(() => ({ workspaceId, changes: [{ id: 'entry', bankAccountId: 'bank', toAccountId: 'savings', expectedUpdatedAt: '2026-10-01T00:00:00.000Z' }] })));
  const cached = await page.evaluate(async () => { const path = '/src/stores/useLedgerStore.ts'; const { useLedgerStore } = await import(path); return useLedgerStore.getState().transactions.find((tx: { id: string }) => tx.id === 'entry'); });
  expect(cached.lines[0]).toEqual(entry.lines[0]); expect(cached.lines[1].amountCents).toBe(12345); expect(cached.lines[1].accountId).toBe('savings'); expect(cached.isTransfer).toBe(true); expect(cached.originalCurrency).toBe('ILS'); expect(cached.exchangeRate).toBe(0.27); expect(errors).toEqual([]);
});
