import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { mountJourney, remountJourney, settleStyles } from './support/journeyFixture';

/**
 * W13 (RELEASE_GATE): stock — purchase → stock → sale → valuation, in the browser, with the figures of
 * src/tests/w13-gold.test.ts (the server side of the same journey, on a real database). Cents:
 *   bill B-1 (Oak Supply)  10 chairs at 4,000 = 40,000
 *   bill B-2 (Elm Supply)  10 chairs at 4,600 = 46,000      → 20 on hand at an average of 4,300
 *   invoice INV-1 (Acme)   12 sold; cost of goods 12 × 4,300 = 51,600 → 8 on hand
 *   Inventory account 40,000 + 46,000 − 51,600 = 34,400 = 8 × 4,300 → "agree"
 *   revalue to 45.00: 8 × 4,500 − 8 × 4,300 = +1,600 (the request carries exactly that change)
 *   Stock Sources and Uses: bought from Oak Supply 10 (400.00), from Elm Supply 10 (460.00); sold to Acme 12 (516.00);
 *   closing 8 (344.00) and the check "Opening + came from − went to = closing."
 * The ledger is seeded as the server leaves it after posting; the server's replies are stubbed and recorded.
 */
const WORKSPACE = 'w13-browser';
const INVENTORY = { id: 'acct-inv', uid: 'journey-user', workspaceId: WORKSPACE, code: '1300', name: 'Inventory', type: 'asset', category: 'Inventory' };
const AP = { id: 'acct-ap', uid: 'journey-user', workspaceId: WORKSPACE, code: '2000', name: 'Accounts Payable', type: 'liability', category: 'Accounts Payable' };
const COGS = { id: 'acct-cogs', uid: 'journey-user', workspaceId: WORKSPACE, code: '5000', name: 'Cost of goods sold', type: 'cost_of_goods' };
const REVAL = { id: 'acct-reval', uid: 'journey-user', workspaceId: WORKSPACE, code: '5150', name: 'Inventory revaluation', type: 'expense' };
const CHAIR = { id: 'chair', uid: 'journey-user', workspaceId: WORKSPACE, name: 'Chair', sku: 'CH', itemType: 'stock', quantityAtHand: 8, unitCostCents: 4300, unitPriceCents: 9000, reorderPoint: 0 };
const entry = (id: string, date: string, debit: string, credit: string, cents: number, metadata: Record<string, unknown>) => ({
  id, uid: 'journey-user', workspaceId: WORKSPACE, date, description: id, status: 'completed', type: 'actual', totalAmountCents: cents, currency: 'USD', metadata,
  lines: [{ accountId: debit, amountCents: cents }, { accountId: credit, amountCents: -cents }],
});
const TRANSACTIONS = [
  entry('tx-b1', '2026-04-01', INVENTORY.id, AP.id, 40000, { type: 'bill-accrual', billId: 'b1' }),
  entry('tx-b2', '2026-04-10', INVENTORY.id, AP.id, 46000, { type: 'bill-accrual', billId: 'b2' }),
  entry('tx-cogs', '2026-04-15', COGS.id, INVENTORY.id, 51600, { type: 'invoice-cogs-auto', invoiceId: 'inv1', inventoryItemId: 'chair', quantity: 12 }),
];
const move = (key: string, date: string, kind: string, quantity: number, quantityAfter: number, valueCents: number, extra: Record<string, unknown>) =>
  ({ key, date, kind, quantity, quantityAfter, valueCents, unitCostCents: Math.round(Math.abs(valueCents / quantity)), ...extra });
const HISTORY = [{
  itemId: 'chair', itemName: 'Chair', opening: { quantity: 0, valueCents: 0 }, received: 20, issued: 12, closing: { quantity: 8, valueCents: 34400 },
  moves: [
    move('m1', '2026-04-01', 'purchase', 10, 10, 40000, { documentType: 'bill', documentId: 'b1', documentLine: 0, vendorId: 'oak', transactionId: 'tx-b1' }),
    move('m2', '2026-04-10', 'purchase', 10, 20, 46000, { documentType: 'bill', documentId: 'b2', documentLine: 0, vendorId: 'elm', transactionId: 'tx-b2' }),
    move('m3', '2026-04-15', 'sale', -12, 8, -51600, { documentType: 'invoice', documentId: 'inv1', customerId: 'acme', documentLineId: 'l1', transactionId: 'tx-cogs' }),
  ],
}];

test('W13 browser: the valuation agrees with the books, a revaluation sends the worked change, and every unit is traced', async ({ page }, testInfo) => {
  test.setTimeout(120000);
  await page.setViewportSize({ width: 1280, height: 900 });

  const { errors, requests } = await mountJourney(page, {
    workspaceId: WORKSPACE,
    ledger: {
      accounts: [INVENTORY, AP, COGS, REVAL], inventory: [CHAIR], transactions: TRANSACTIONS,
      vendors: [{ id: 'oak', workspaceId: WORKSPACE, name: 'Oak Supply' }, { id: 'elm', workspaceId: WORKSPACE, name: 'Elm Supply' }],
      customers: [{ id: 'acme', workspaceId: WORKSPACE, name: 'Acme' }], invoices: [], bills: [],
    },
    mounts: [{ module: '/src/components/reporting/InventoryValuationReportView.tsx', exportName: 'InventoryValuationReportView' }],
    api: request => {
      if (request.url.includes('/api/v1/reports/inventory-details')) return { json: { items: HISTORY } };
      if (request.url.endsWith('/api/v1/inventory/revalue')) return { json: { transactionId: 'tx-reval', itemId: 'chair', name: 'Chair', quantity: 8, oldUnitCostCents: 4300, newUnitCostCents: 4500, valueCents: 1600, replayed: false } };
      return null;
    },
  });

  // 1. Valuation: 8 chairs at 43.00 = 344.00, and the Inventory account holds the same 344.00.
  const chairRow = page.getByRole('row', { name: /Chair/ }).first();
  await expect(chairRow).toContainText('8');
  await expect(chairRow).toContainText('$43.00');
  await expect(chairRow).toContainText('$344.00');
  await expect(page.getByText('The stock list and the Inventory account agree.', { exact: true })).toBeVisible();

  // 2. Revalue the 8 chairs to 45.00: the dialog shows +16.00 and the request carries exactly the change.
  await remountJourney(page, [{ module: '/src/components/inventory/StockRevalueDialog.tsx', props: { item: CHAIR, workspaceId: WORKSPACE, accounts: [INVENTORY, AP, COGS, REVAL], currency: 'USD' } }]);
  const dialog = page.getByRole('dialog', { name: 'Revalue stock' });
  await dialog.getByLabel('New cost per unit').fill('45.00');
  await dialog.getByLabel('Revaluation gain or loss account').selectOption(REVAL.id);
  await dialog.getByLabel('Reason').fill('Supplier price list');
  await expect(dialog.getByTestId('stock-revalue-value')).toHaveText('$16.00');
  await dialog.getByRole('button', { name: 'Save revaluation' }).click();
  await expect.poll(() => requests.filter(r => r.url.endsWith('/api/v1/inventory/revalue')).length).toBe(1);
  expect(requests.find(r => r.url.endsWith('/api/v1/inventory/revalue'))!.body).toMatchObject({
    workspaceId: WORKSPACE, itemId: 'chair', newUnitCostCents: 4500, inventoryAccountId: INVENTORY.id, offsetAccountId: REVAL.id, reason: 'Supplier price list',
  });

  // 3. Stock Sources and Uses for April: where the 20 came from and where the 12 went; 8 left; the check holds.
  await remountJourney(page, [{ module: '/src/components/reporting/StockSourcesUsesReportView.tsx' }]);
  await page.getByRole('textbox', { name: 'From', exact: true }).fill('2026-04-01');
  await page.getByRole('textbox', { name: 'To', exact: true }).fill('2026-04-30');
  const flow = page.getByTestId('stock-flow');
  await expect(flow.getByRole('row', { name: /Bought from Oak Supply/ })).toContainText('10$400.00');
  await expect(flow.getByRole('row', { name: /Bought from Elm Supply/ })).toContainText('10$460.00');
  await expect(flow.getByRole('row', { name: /Sold to Acme/ })).toContainText('12$516.00');
  await expect(flow.getByRole('row', { name: /^Closing/ })).toContainText('8$344.00');
  await expect(flow.getByText('Opening + came from − went to = closing.', { exact: true })).toBeVisible();

  await settleStyles(page);
  const axe = await new AxeBuilder({ page }).include('[data-testid="stock-flow"]').analyze();
  const serious = axe.violations.filter(v => v.impact === 'serious' || v.impact === 'critical');
  await testInfo.attach('w13-sources-uses-axe', { body: JSON.stringify(axe.violations, null, 2), contentType: 'application/json' });
  expect(serious, JSON.stringify(serious.map(v => ({ id: v.id, nodes: v.nodes.length })))).toEqual([]);

  expect(errors).toEqual([]);
});
