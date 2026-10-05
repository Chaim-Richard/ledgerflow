import { test, expect } from '@playwright/test';

test('reconciliation retains mixed-language search between empty streams and matched history', async ({ page }) => {
  await page.route('**/api/**', route => route.fulfill({ status: 200, json: {} }));
  await page.addInitScript(() => {
    localStorage.setItem('isGuest', 'true');
    localStorage.setItem('has_seen_onboarding', 'true');
  });
  await page.goto('/');
  await page.evaluate(async () => {
    const reactPath = '/node_modules/.vite/deps/react.js';
    const domPath = '/node_modules/.vite/deps/react-dom_client.js';
    const screenPath = '/src/components/ledger/Reconciliation.tsx';
    const authPath = '/src/stores/useAuthStore.ts';
    const ledgerPath = '/src/stores/useLedgerStore.ts';
    const [{ default: React }, { default: { createRoot } }, { default: Reconciliation }, { useAuthStore }, { useLedgerStore }] = await Promise.all([
      import(reactPath), import(domPath), import(screenPath), import(authPath), import(ledgerPath),
    ]);
    useAuthStore.setState({ user: null, currentWorkspaceId: null, workspaces: [] });
    useLedgerStore.setState({ transactions: [], accounts: [], bankLines: [], autoRules: [] });
    const host = document.createElement('div');
    host.id = 'reconciliation-navigation-probe';
    host.style.cssText = 'position:fixed;inset:0;z-index:999999;background:white;overflow:auto';
    document.body.append(host);
    createRoot(host).render(React.createElement(Reconciliation));
  });
  const screen = page.locator('#reconciliation-navigation-probe');
  await expect(screen.getByText('Zero Pending Streams')).toBeVisible();
  const search = screen.getByRole('textbox', { name: 'Search reconciliation amounts or descriptions' });
  await search.fill('קבלה receipt');
  await screen.getByRole('button', { name: 'Matched History (0)' }).click();
  await expect(screen.getByText('No cleared alignment history found')).toBeVisible();
  await expect(search).toHaveValue('קבלה receipt');
  await screen.getByRole('button', { name: 'Streams (0)' }).click();
  await expect(screen.getByText('Zero Pending Streams')).toBeVisible();
});
