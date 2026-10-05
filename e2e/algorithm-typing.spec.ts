import { test, expect } from '@playwright/test';
test('the actual algorithm dialog supports typed parameters, valid reset, help and local Escape', async ({ page }) => {
 await page.route('**/api/**', route => route.fulfill({ status: 200, json: {} }));
 await page.addInitScript(() => { localStorage.setItem('isGuest', 'true'); localStorage.setItem('has_seen_onboarding', 'true'); });
 await page.goto('/');
 await page.evaluate(async () => {
  const reactPath = '/node_modules/.vite/deps/react.js', domPath = '/node_modules/.vite/deps/react-dom_client.js', sandboxPath = '/src/components/platform/ToolSandbox.tsx', ledgerPath = '/src/stores/useLedgerStore.ts';
  const [{ default: React }, { default: { createRoot } }, { default: ToolSandbox }, { useLedgerStore }] = await Promise.all([import(reactPath), import(domPath), import(sandboxPath), import(ledgerPath)]);
  useLedgerStore.setState({ transactions: [], accounts: [], computedAccounts: [], truncatedCollections: { transactions: true } });
  function Harness() { const [open, setOpen] = React.useState(true); return open && React.createElement(ToolSandbox, { toolId: 'planning_4', toolName: 'Monte Carlo', onClose: () => setOpen(false) }); }
  const node = document.createElement('div'); document.body.appendChild(node); createRoot(node).render(React.createElement(Harness));
 });
 const dialog = page.getByRole('dialog'); await expect(dialog).toHaveCount(1);
 const input = dialog.getByRole('spinbutton', { name: 'Simulation Horizon (Days)' }); await expect(input).toHaveValue('90');
 await input.fill('120'); await input.press('Enter'); await expect(dialog.getByRole('slider', { name: 'Simulation Horizon (Days) slider' })).toHaveValue('120');
 await input.fill('9999'); await input.press('Tab'); await expect(dialog.getByRole('alert')).toBeVisible(); await expect(dialog.getByRole('slider', { name: 'Simulation Horizon (Days) slider' })).toHaveValue('120');
 await input.focus(); await input.press('Escape'); await expect(input).toHaveValue('120'); await expect(dialog).toBeVisible();
 await dialog.getByRole('button', { name: 'Reset' }).click(); await expect(input).toHaveValue('90');
 await input.fill('9999'); await input.press('Enter'); await expect(dialog.getByRole('alert')).toBeVisible(); await dialog.getByRole('button', { name: 'Reset' }).click(); await expect(input).toHaveValue('90'); await expect(dialog.getByRole('alert')).toHaveCount(0);
 await dialog.getByText('How this tool works', { exact: true }).click(); await expect(dialog.getByText(/5,000 paths over 90 days/)).toBeVisible(); await expect(dialog.getByRole('status')).toContainText('incomplete');
 await dialog.getByRole('button', { name: 'Close', exact: true }).focus(); await page.keyboard.press('Escape'); await expect(dialog).toHaveCount(0);
});
