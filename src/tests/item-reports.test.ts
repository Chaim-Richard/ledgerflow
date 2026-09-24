import test, { describe } from 'node:test';
import assert from 'node:assert/strict';
import { computeJournalSheet, computeSalesByItem, NO_ITEM_KEY } from '../server/reports/itemReports';
import { makeChartAccount, makeInvoice, makeTransaction } from './fixtures';
import type { Invoice, Transaction } from '../types';

const accounts = [
  makeChartAccount({ id: 'cash', name: 'Checking', type: 'asset', category: 'Cash' }),
  makeChartAccount({ id: 'ar', name: 'Accounts Receivable', type: 'asset', category: 'Receivables' }),
  makeChartAccount({ id: 'inv', name: 'Inventory', type: 'asset', category: 'Inventory' }),
  makeChartAccount({ id: 'sales', name: 'Sales', type: 'revenue', category: 'Revenue' }),
  makeChartAccount({ id: 'cogs', name: 'Cost of Goods Sold', type: 'expense', category: 'COGS' }),
  makeChartAccount({ id: 'rent', name: 'Rent', type: 'expense', category: 'Rent' }),
];
const items = [
  { id: 'item-w', name: 'Widget', sku: 'W-1', unitCostCents: 400 },
  { id: 'item-g', name: 'Gadget', sku: 'G-1', unitCostCents: 300 },
];
type Line = NonNullable<Invoice['items']>[number];
const line = (over: Partial<Line> & Pick<Line, 'id'>): Line => ({
  description: '', quantity: 1, rateCents: 0, amountCents: 0, accountId: 'sales', ...over,
});

const invoices: Invoice[] = [
  makeInvoice({ id: 'A', date: '2026-03-10', status: 'sent', items: [
    line({ id: 'a1', itemId: 'item-w', description: 'Widget', quantity: 3, rateCents: 1250, amountCents: 3750, unitCostCents: 400 }),
    line({ id: 'a2', description: 'Consulting', quantity: 2, rateCents: 5000, amountCents: 10000 }),
  ] }),
  // EUR invoice at 1.1: sales are converted to the base currency.
  makeInvoice({ id: 'B', date: '2026-04-05', status: 'paid', exchangeRate: 1.1, items: [
    line({ id: 'b1', itemId: 'item-g', description: 'Gadget', quantity: 2, rateCents: 1000, amountCents: 2000, unitCostCents: 300 }),
    line({ id: 'b2', itemId: 'item-w', description: 'Widget', quantity: 1, rateCents: 1300, amountCents: 1300, unitCostCents: 400 }),
    line({ id: 'b3', itemId: 'item-g', description: 'Gadget sample', quantity: 0, rateCents: 1000, amountCents: 0 }),
  ] }),
  makeInvoice({ id: 'D', date: '2026-05-01', status: 'draft', items: [
    line({ id: 'd1', itemId: 'item-w', quantity: 100, amountCents: 125000 }),
  ] }),
  makeInvoice({ id: 'V', date: '2026-05-02', status: 'void', items: [
    line({ id: 'v1', itemId: 'item-g', quantity: 50, amountCents: 50000 }),
  ] }),
  makeInvoice({ id: 'OLD', date: '2025-12-31', status: 'paid', items: [
    line({ id: 'o1', itemId: 'item-w', quantity: 7, amountCents: 8750 }),
  ] }),
];

const cogsTx = (id: string, invoiceId: string, lineId: string, cents: number, extra: Partial<Transaction> = {}): Transaction =>
  makeTransaction({
    id, date: '2026-04-05', type: 'journal', status: 'approved', totalAmountCents: cents,
    metadata: { cogsForInvoiceId: invoiceId, cogsForLineId: lineId },
    lines: [{ accountId: 'cogs', amountCents: cents }, { accountId: 'inv', amountCents: -cents }],
    ...extra,
  });

const transactions: Transaction[] = [
  cogsTx('c-a1', 'A', 'a1', 1200),
  cogsTx('c-b2', 'B', 'b2', 410),
  // Posted then reversed: neither counts.
  cogsTx('c-b1-old', 'B', 'b1', 999),
  makeTransaction({ id: 'c-b1-rev', type: 'reversal', status: 'approved', metadata: { reversesTxId: 'c-b1-old' },
    lines: [{ accountId: 'cogs', amountCents: -999 }, { accountId: 'inv', amountCents: 999 }] }),
  // Cost posted for the draft invoice: the invoice is ignored, so is this.
  cogsTx('c-d1', 'D', 'd1', 40000),
];

describe('Sales by Item', () => {
  const report = computeSalesByItem({ invoices, items, transactions, accounts, startDate: '2026-01-01', endDate: '2026-12-31' });
  const row = (key: string) => report.rows.find(r => r.key === key)!;

  test('rows: items by sales, "No item" last', () => {
    assert.deepEqual(report.rows.map(r => r.key), ['item-w', 'item-g', NO_ITEM_KEY]);
  });

  test('widget: posted cost of goods sold, EUR sale converted', () => {
    const w = row('item-w');
    assert.equal(w.name, 'Widget');
    assert.equal(w.sku, 'W-1');
    assert.equal(w.quantity, 4);          // 3 + 1 (draft 100 and the 2025 sale left out)
    assert.equal(w.salesCents, 5180);     // 3750 + 1300 × 1.1
    assert.equal(w.costCents, 1610);      // 1200 + 410, as posted
    assert.equal(w.marginCents, 3570);
    assert.equal(w.costIsEstimate, false);
    assert.ok(Math.abs((w.marginPct ?? 0) - 68.9189) < 0.001);
  });

  test('gadget: no cost posted (the reversed one does not count), so it is estimated', () => {
    const g = row('item-g');
    assert.equal(g.quantity, 2);          // 2 + 0: a zero quantity stays zero
    assert.equal(g.salesCents, 2200);     // 2000 × 1.1
    assert.equal(g.costCents, 600);       // 2 × 300, estimated
    assert.equal(g.marginCents, 1600);
    assert.equal(g.costIsEstimate, true);
  });

  test('lines without an item are one "No item" row with no cost', () => {
    const n = row(NO_ITEM_KEY);
    assert.equal(n.name, 'No item');
    assert.equal(n.quantity, 2);
    assert.equal(n.salesCents, 10000);
    assert.equal(n.costCents, 0);
    assert.equal(n.marginPct, 100);
  });

  test('totals add up the rows', () => {
    assert.equal(report.totals.quantity, 8);
    assert.equal(report.totals.salesCents, 17380);
    assert.equal(report.totals.costCents, 2210);
    assert.equal(report.totals.marginCents, 15170);
    assert.equal(report.totals.costIsEstimate, true);
    assert.ok(Math.abs((report.totals.marginPct ?? 0) - 87.2842) < 0.001);
  });

  test('no range includes every issued invoice', () => {
    const all = computeSalesByItem({ invoices, items, transactions, accounts });
    assert.equal(all.rows.find(r => r.key === 'item-w')?.quantity, 11);
  });
});

describe('Journal Sheet', () => {
  const txs: Transaction[] = [
    makeTransaction({ id: 't1', date: '2026-02-01', description: 'Cash sale', lines: [
      { id: 'l1', accountId: 'cash', amountCents: 5000 }, { id: 'l2', accountId: 'sales', amountCents: -5000 },
    ] }),
    makeTransaction({ id: 't2', date: '2026-01-15T10:00:00.000Z', description: 'Rent (typo)', lines: [
      { accountId: 'rent', amountCents: 1000 }, { accountId: 'cash', amountCents: -900 },
    ] }),
    makeTransaction({ id: 't3', date: '2026-01-20', status: 'draft', lines: [
      { accountId: 'rent', amountCents: 777 }, { accountId: 'cash', amountCents: -777 },
    ] }),
    makeTransaction({ id: 't4', date: '2026-03-01', description: 'EUR invoice', exchangeRate: 1.1, lines: [
      { accountId: 'ar', amountCents: 1000 }, { accountId: 'gone', accountName: 'Old account', amountCents: -1000 },
    ] }),
    makeTransaction({ id: 't5', date: '2026-03-02', status: 'void', lines: [{ accountId: 'rent', amountCents: 5 }] }),
    makeTransaction({ id: 't6', date: '2025-12-31', lines: [{ accountId: 'rent', amountCents: 5 }] }),
  ];
  const sheet = computeJournalSheet(txs, accounts, '2026-01-01', '2026-12-31');

  test('only posted transactions in the range, oldest first', () => {
    assert.deepEqual(sheet.entries.map(e => e.id), ['t2', 't1', 't4']);
  });

  test('debits and credits in the base currency, with account names', () => {
    const eur = sheet.entries.find(e => e.id === 't4')!;
    assert.deepEqual(eur.lines.map(l => [l.accountName, l.debitCents, l.creditCents]),
      [['Accounts Receivable', 1100, 0], ['Old account', 0, 1100]]);
    assert.equal(eur.isBalanced, true);
    assert.equal(sheet.entries.find(e => e.id === 't1')?.lines[0].key, 'l1');
  });

  test('totals and the unbalanced list', () => {
    assert.deepEqual(sheet.totals, { debitCents: 7100, creditCents: 7000 });
    assert.deepEqual(sheet.unbalanced.map(e => [e.id, e.imbalanceCents]), [['t2', 100]]);
  });
});
