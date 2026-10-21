import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { mountJourney, setLedgerField, settleStyles, type JourneyApiHandler, type JourneyRequest } from './support/journeyFixture';
import { TransactionTemplates, type LineAccountWeight } from '../src/kernel/templates/TransactionTemplates';
import { balanceSheetByLabel, profitByLabel } from '../src/server/reports/byLabel';
import { makeChartAccount, makeTransaction } from '../src/tests/fixtures';
import type { ChartAccount, Transaction } from '../src/types';

/**
 * A-210 · W5 (RELEASE_GATE): labelled invoices, bills and payments — one of them split across two
 * properties — to the two reports by label, in the browser. The figures below were worked by hand
 * (docs/verification/ai3-a210-w5-worked-figures-2026-10-20.md, cents):
 *
 *   invoice INV-1 30,000 (tax 3,000) split A 10,000 : B 17,000
 *   receipt 20,000 split A : B by the same weights (7,407 / 12,593)
 *   bill BILL-1 15,000 (tax 1,500) split A 5,000 : B 8,500
 *   vendor payment 6,000 split A : B (2,222 / 3,778)
 *
 *   Profit by label, January 2026:      A income 10,000 · expense 5,000 · net 5,000
 *                                       B income 17,000 · expense 8,500 · net 8,500
 *   Balance sheet by label, 31 Jan 2026: A cash 5,185 + A/R 3,704 = A/P 3,334 + tax 555 + profit 5,000 = 8,889
 *                                       B cash 8,815 + A/R 6,296 = A/P 5,666 + tax 945 + profit 8,500 = 15,111
 *
 * The screens are mounted from the app's own source against the app's own stores (journeyFixture).
 * The server boundary is answered by the real report code — `profitByLabel` / `balanceSheetByLabel`
 * from src/server/reports/byLabel.ts, the same functions `GET /api/v1/reports/by-label` and
 * `GET /api/v1/reports/balance-sheet-by-label` call — fed this ledger. So the chain checked here is
 * hand figures → the real report → the real screen, with nothing re-implemented in the test.
 */

const WORKSPACE = 'w5-labels-journey';
const DIMENSION = 'property';
const accounts: ChartAccount[] = [
  makeChartAccount({ id: 'cash', code: '1000', name: 'Cash', type: 'asset', category: 'Cash' }),
  makeChartAccount({ id: 'ar', code: '1100', name: 'Accounts receivable', type: 'asset', category: 'Receivables' }),
  makeChartAccount({ id: 'ap', code: '2100', name: 'Accounts payable', type: 'liability', category: 'Payables' }),
  makeChartAccount({ id: 'tax', code: '2200', name: 'Net tax payable', type: 'liability', category: 'Payables' }),
  makeChartAccount({ id: 'revenue', code: '4000', name: 'Rental income', type: 'income', category: 'Revenue' }),
  makeChartAccount({ id: 'repairs', code: '6100', name: 'Repairs', type: 'expense', category: 'Expenses' }),
];
const a = (s: string) => ({ id: s, name: s });
const shares: LineAccountWeight[] = [
  { account: a('revenue'), weightCents: 10_000, dimensions: { [DIMENSION]: 'A' } },
  { account: a('revenue'), weightCents: 17_000, dimensions: { [DIMENSION]: 'B' } },
];
const billShares: LineAccountWeight[] = [
  { account: a('repairs'), weightCents: 5_000, dimensions: { [DIMENSION]: 'A' } },
  { account: a('repairs'), weightCents: 8_500, dimensions: { [DIMENSION]: 'B' } },
];
const tx = (id: string, date: string, lines: Transaction['lines']) => makeTransaction({ id, date, description: id, lines });
const ledger: Transaction[] = [
  tx('invoice-1', '2026-01-05', TransactionTemplates.buildInvoiceLines({
    invoiceNumber: 'INV-1', customerName: 'Tenant', totalCents: 30_000, taxCents: 3_000,
    arAccount: a('ar'), revenueAccount: a('revenue'), taxAccount: a('tax'), lineAccounts: shares,
  })),
  tx('receipt-1', '2026-01-12', TransactionTemplates.buildPaymentLines({
    documentNumber: 'INV-1', entityName: 'Tenant', amountCents: 20_000, cashAccount: a('cash'),
    offsetAccount: a('ar'), isReceipt: true, lineAccounts: shares,
  })),
  tx('bill-1', '2026-01-15', TransactionTemplates.buildBillLines({
    billNumber: 'BILL-1', vendorName: 'Repair vendor', totalCents: 15_000, taxCents: 1_500,
    apAccount: a('ap'), expenseAccount: a('repairs'), taxAccount: a('tax'), lineAccounts: billShares,
  })),
  tx('vendor-payment-1', '2026-01-22', TransactionTemplates.buildPaymentLines({
    documentNumber: 'BILL-1', entityName: 'Repair vendor', amountCents: 6_000, cashAccount: a('cash'),
    offsetAccount: a('ap'), isReceipt: false, lineAccounts: billShares,
  })),
];

const queries: JourneyRequest[] = [];
const api: JourneyApiHandler = request => {
  const url = new URL(request.url);
  const q = url.searchParams;
  const ask = (dimensionId: string | null, value: string | null, startDate: string | null, endDate: string | null) => {
    if (!dimensionId || !endDate) return null;
    queries.push(request);
    return {
      json: startDate
        ? profitByLabel(accounts, ledger, dimensionId, startDate, endDate)
        : balanceSheetByLabel(accounts, ledger, dimensionId, value || '', endDate),
    };
  };
  if (url.pathname.endsWith('/api/v1/reports/by-label')) return ask(q.get('dimensionId'), null, q.get('startDate'), q.get('endDate'));
  if (url.pathname.endsWith('/api/v1/reports/balance-sheet-by-label')) return ask(q.get('dimensionId'), q.get('value'), null, q.get('endDate'));
  return null;
};

/** mounts both by-label reports with the Property label (A: Harbour flats, B: Hill house) */
async function mountReports(page: import('@playwright/test').Page) {
  queries.length = 0;
  const handle = await mountJourney(page, {
    workspaceId: WORKSPACE,
    ledger: { accounts, transactions: ledger },
    mounts: [
      { module: '/src/components/reporting/LabelProfitReportView.tsx' },
      { module: '/src/components/reporting/LabelBalanceSheetReportView.tsx' },
    ],
    api,
  });
  await page.evaluate(async workspaceId => {
    const { useAuthStore } = await import('/src/stores/useAuthStore.ts');
    const state = useAuthStore.getState();
    useAuthStore.setState({
      workspaces: state.workspaces.map(w => (w.id === workspaceId ? { ...w, dimensions: [{ id: 'property', name: 'Property' }] } : w)),
    } as never);
  }, WORKSPACE);
  await setLedgerField(page, 'dimensionNodes', [
    { id: 'A', dimensionId: DIMENSION, description: 'Harbour flats' },
    { id: 'B', dimensionId: DIMENSION, description: 'Hill house' },
  ]);
  return handle;
}

const lastQuery = (path: string) => {
  const found = [...queries].reverse().find(r => new URL(r.url).pathname.endsWith(path));
  expect(found, `the screen asked ${path}`).toBeTruthy();
  return new URL(found!.url).searchParams;
};

test('W5 browser: profit by label shows the hand-worked January figures for both properties', async ({ page }, testInfo) => {
  test.setTimeout(120000);
  await page.setViewportSize({ width: 1280, height: 900 });
  const { errors } = await mountReports(page);

  const profit = page.getByRole('heading', { name: 'Profit by label', exact: true }).locator('xpath=ancestor::section[1]');
  await expect(profit).toBeVisible();
  await profit.getByLabel('From', { exact: true }).fill('2026-01-01');
  await profit.getByLabel('To', { exact: true }).fill('2026-01-31');
  await expect(profit.getByText('Each value of Property', { exact: false })).toBeVisible();

  const rows = await profit.locator('tbody tr, tfoot tr').evaluateAll(trs => trs.map(tr => tr.textContent || ''));
  const line = (re: RegExp) => rows.find(t => re.test(t));
  expect(line(/4000 Rental income\$100\.00.*\$170\.00.*\$270\.00/), rows.join(' | ')).toBeTruthy();
  expect(line(/6100 Repairs\$50\.00.*\$85\.00.*\$135\.00/), rows.join(' | ')).toBeTruthy();
  expect(line(/Total income\$100\.00.*\$170\.00.*\$270\.00/), rows.join(' | ')).toBeTruthy();
  expect(line(/Total expenses\$50\.00.*\$85\.00.*\$135\.00/), rows.join(' | ')).toBeTruthy();
  // gross profit is income less cost of goods sold (there is none here), then expenses come off
  expect(line(/^Gross profit\$100\.00\$170\.00\$270\.00$/), rows.join(' | ')).toBeTruthy();
  expect(line(/^Net income\$50\.00\$85\.00\$135\.00$/), rows.join(' | ')).toBeTruthy();

  // the column headings are the label's values, and the request carried the period I typed
  await expect(profit.getByRole('columnheader', { name: 'Harbour flats' })).toBeVisible();
  await expect(profit.getByRole('columnheader', { name: 'Hill house' })).toBeVisible();
  const asked = lastQuery('/api/v1/reports/by-label');
  expect({ dimensionId: asked.get('dimensionId'), startDate: asked.get('startDate'), endDate: asked.get('endDate') })
    .toEqual({ dimensionId: DIMENSION, startDate: '2026-01-01', endDate: '2026-01-31' });

  await settleStyles(page);
  const axe = await new AxeBuilder({ page }).include('table').analyze();
  const serious = axe.violations.filter(v => v.impact === 'serious' || v.impact === 'critical');
  await testInfo.attach('w5-profit-by-label-axe', { body: JSON.stringify(axe.violations, null, 2), contentType: 'application/json' });
  expect(serious, JSON.stringify(serious.map(v => ({ id: v.id, nodes: v.nodes.length })))).toEqual([]);
  expect(errors).toEqual([]);
});

test('W5 browser: balance sheet by label shows A 8,889 and B 15,111 at 31 Jan, each balancing', async ({ page }, testInfo) => {
  test.setTimeout(120000);
  await page.setViewportSize({ width: 1280, height: 900 });
  const { errors } = await mountReports(page);

  const section = page.getByRole('heading', { name: 'Balance sheet by label', exact: true }).locator('xpath=ancestor::section[1]');
  await expect(section).toBeVisible();
  await section.getByLabel('As of', { exact: true }).fill('2026-01-31');

  // Property A — Harbour flats: cash 5,185 + A/R 3,704 = A/P 3,334 + tax 555 + profit 5,000
  const card = page.getByTestId('label-balance-sheet');
  await expect(card.getByText('Harbour flats on 2026-01-31', { exact: false })).toBeVisible();
  let rows = await card.locator('tbody tr, tfoot tr').evaluateAll(trs => trs.map(tr => tr.textContent || ''));
  expect(rows.some(t => /^1000 Cash\$51\.85$/.test(t)), rows.join(' | ')).toBe(true);
  expect(rows.some(t => /^1100 Accounts receivable\$37\.04$/.test(t)), rows.join(' | ')).toBe(true);
  expect(rows.some(t => /^2100 Accounts payable\$33\.34$/.test(t)), rows.join(' | ')).toBe(true);
  expect(rows.some(t => /^2200 Net tax payable\$5\.55$/.test(t)), rows.join(' | ')).toBe(true);
  expect(rows.some(t => /^Profit to date\$50\.00$/.test(t)), rows.join(' | ')).toBe(true);
  expect(rows.some(t => /^Total assets\$88\.89$/.test(t)), rows.join(' | ')).toBe(true);
  expect(rows.some(t => /^Total liabilities and equity\$88\.89$/.test(t)), rows.join(' | ')).toBe(true);
  await expect(card.getByText(/Assets = liabilities \+ equity for Harbour flats\./)).toBeVisible();

  // Property B — Hill house: cash 8,815 + A/R 6,296 = A/P 5,666 + tax 945 + profit 8,500
  await section.getByLabel('Value').selectOption('B');
  await expect(card.getByText('Hill house on 2026-01-31', { exact: false })).toBeVisible();
  rows = await card.locator('tbody tr, tfoot tr').evaluateAll(trs => trs.map(tr => tr.textContent || ''));
  expect(rows.some(t => /^1000 Cash\$88\.15$/.test(t)), rows.join(' | ')).toBe(true);
  expect(rows.some(t => /^1100 Accounts receivable\$62\.96$/.test(t)), rows.join(' | ')).toBe(true);
  expect(rows.some(t => /^2100 Accounts payable\$56\.66$/.test(t)), rows.join(' | ')).toBe(true);
  expect(rows.some(t => /^2200 Net tax payable\$9\.45$/.test(t)), rows.join(' | ')).toBe(true);
  expect(rows.some(t => /^Profit to date\$85\.00$/.test(t)), rows.join(' | ')).toBe(true);
  expect(rows.some(t => /^Total assets\$151\.11$/.test(t)), rows.join(' | ')).toBe(true);
  expect(rows.some(t => /^Total liabilities and equity\$151\.11$/.test(t)), rows.join(' | ')).toBe(true);
  await expect(card.getByText(/Assets = liabilities \+ equity for Hill house\./)).toBeVisible();

  const asked = lastQuery('/api/v1/reports/balance-sheet-by-label');
  expect({ dimensionId: asked.get('dimensionId'), value: asked.get('value'), endDate: asked.get('endDate') })
    .toEqual({ dimensionId: DIMENSION, value: 'B', endDate: '2026-01-31' });

  await settleStyles(page);
  const axe = await new AxeBuilder({ page }).include('[data-testid="label-balance-sheet"]').analyze();
  const serious = axe.violations.filter(v => v.impact === 'serious' || v.impact === 'critical');
  await testInfo.attach('w5-balance-sheet-by-label-axe', { body: JSON.stringify(axe.violations, null, 2), contentType: 'application/json' });
  expect(serious, JSON.stringify(serious.map(v => ({ id: v.id, nodes: v.nodes.length })))).toEqual([]);
  expect(errors).toEqual([]);
});
