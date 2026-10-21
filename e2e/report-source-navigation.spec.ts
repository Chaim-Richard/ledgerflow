import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('isGuest', 'true');
    localStorage.setItem('has_seen_onboarding', 'true');
  });
  await page.goto('/');
  await expect(page.getByText('Overview', { exact: true }).first()).toBeVisible();
});

// The real report components over isolated cached data. This does not claim authenticated writes.
async function mountReport(page: import('@playwright/test').Page, kind: 'delivery' | 'vendor' | 'quote') {
  await page.evaluate(async kind => {
    const resource = (part: string) => performance.getEntriesByType('resource').map(entry => entry.name).find(name => name.includes(part));
    const { useAuthStore } = await import(/* @vite-ignore */ resource('/src/stores/useAuthStore.ts') || '/src/stores/useAuthStore.ts');
    const { useLedgerStore } = await import(/* @vite-ignore */ resource('/src/stores/useLedgerStore.ts') || '/src/stores/useLedgerStore.ts');
    const [React, dom, report] = await Promise.all([
      import(/* @vite-ignore */ '/node_modules/.vite/deps/react.js'),
      import(/* @vite-ignore */ '/node_modules/.vite/deps/react-dom_client.js'),
      import(/* @vite-ignore */ kind === 'delivery' ? '/src/components/reporting/DeliveryNotesReportView.tsx' : kind === 'quote' ? '/src/components/reporting/CustomerQuotesReportView.tsx' : '/src/components/reporting/VendorScorecardReportView.tsx'),
    ]);
    const workspaceId = useAuthStore.getState().currentWorkspaceId || 'guest';
    useAuthStore.setState({ isGuest: true, currentWorkspaceId: workspaceId, workspaces: [{ id: workspaceId, uid: 'demo', name: 'Demo books', currency: 'ILS' }] });
    useLedgerStore.setState({
      estimates: [{ id: 'order-1', workspaceId: workspaceId, number: 'SO-2026-014', customerId: 'customer-1', customerName: 'קפה Coffee', date: '2026-09-01', status: 'sent', expiryDate: '2026-09-30', amountCents: 42500, lines: [{ description: 'פולים Beans', quantity: 5, unitPriceCents: 8500, amountCents: 42500 }] }],
      invoices: [], inventory: [], customers: [{ id: 'customer-1', workspaceId: workspaceId, name: 'קפה Coffee', currency: 'ILS' }],
      vendors: [{ id: 'vendor-1', workspaceId: workspaceId, name: 'ספק Supplies' }],
      bills: [{ id: 'bill-1', workspaceId: workspaceId, vendorId: 'vendor-1', number: 'חשבונית B-1', date: '2026-09-01', splits: [] }],
      vendorCredits: [], transactions: [], truncatedCollections: {},
    });
    const host = document.createElement('div');
    host.style.cssText = 'position:fixed;inset:0;z-index:999999;overflow:auto;background:var(--surface);color:var(--text);padding:12px';
    host.setAttribute('data-testid', 'source-report-host');
    document.body.append(host);
    dom.default.createRoot(host).render(React.default.createElement(kind !== 'vendor' ? report.default : report.VendorScorecardPanel,
      kind !== 'vendor' ? {} : { orders: [], endDate: '2026-10-19' }));
  }, kind);
}

test('delivery source filters retain Hebrew data and refuse an unrelated printable fallback', async ({ page }, testInfo) => {
  await mountReport(page, 'delivery');
  await expect(page.getByRole('article', { name: 'Printable delivery note' })).toContainText('קפה Coffee');
  await page.getByLabel('Find source document', { exact: true }).fill('קפה');
  await page.getByLabel('Source type', { exact: true }).selectOption('invoice');
  await expect(page.getByRole('article', { name: 'Printable delivery note' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Print delivery note', exact: true })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Download CSV', exact: true })).toBeDisabled();
  await page.getByLabel('Source type', { exact: true }).selectOption('all');
  await expect(page.getByRole('article', { name: 'Printable delivery note' })).toContainText('SO-2026-014');
  const print = page.getByRole('button', { name: 'Print delivery note', exact: true });
  expect((await print.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  const host = page.getByTestId('source-report-host');
  expect(await host.evaluate(node => node.scrollWidth <= node.clientWidth)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath('delivery-source-filters.png') });
});

test('vendor source bills support keyboard activation and exact record navigation', async ({ page }, testInfo) => {
  await mountReport(page, 'vendor');
  await page.getByLabel('Find vendor', { exact: true }).fill('ספק');
  const summary = page.getByText('Review source bills', { exact: true });
  await summary.focus();
  await page.keyboard.press('Enter');
  const bill = page.getByRole('button', { name: /חשבונית B-1/ });
  await expect(bill).toBeVisible();
  expect((await bill.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  await bill.scrollIntoViewIfNeeded();
  expect(await page.getByTestId('source-report-host').evaluate(node => node.scrollWidth <= node.clientWidth)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath('vendor-source-bills.png') });
  await bill.focus();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/#purchases\/bill\/bill-1$/);
});

test('quote follow-up drafts are keyboard accessible and distinguish expired quotes', async ({ page }, testInfo) => {
  await mountReport(page, 'quote');
  await page.getByLabel('Assessment date', { exact: true }).fill('2026-10-19');
  await page.getByLabel('Quote state', { exact: true }).selectOption('expired');
  const summary = page.getByText('Follow-up draft', { exact: true });
  await summary.focus();
  await page.keyboard.press('Enter');
  const draft = page.getByLabel('Follow-up draft for SO-2026-014', { exact: true });
  await expect(draft).toHaveValue(/Hello קפה Coffee/);
  await expect(draft).toHaveValue(/ended on 2026-09-30/);
  await expect(draft).toHaveAttribute('readonly', '');
  await draft.scrollIntoViewIfNeeded();
  await page.screenshot({ path: testInfo.outputPath('quote-follow-up.png') });
  await page.getByLabel('Quote state', { exact: true }).selectOption('signed');
  await expect(draft).toHaveCount(0);
});
