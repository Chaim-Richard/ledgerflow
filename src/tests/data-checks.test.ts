/**
 * Data-health checks (src/lib/dataChecks.ts, launch step 8): each check finds its problem and
 * nothing else, and every finding links to its record.
 */
import test, { describe } from 'node:test';
import assert from 'node:assert/strict';
import { DATA_CHECKS, runDataChecks, RECORD_TABS } from '../lib/dataChecks';
import type { CheckContext } from '../lib/dataChecks';
import { makeBill, makeChartAccount, makeInvoice, makeTransaction } from './fixtures';
import { parseRecordHash, recordHash } from '../lib/recordLinks';

const base = (): CheckContext => ({
  transactions: [], accounts: [makeChartAccount({ id: 'cash' }), makeChartAccount({ id: 'rev', type: 'income' })],
  invoices: [], bills: [], recurring: [], inventory: [], today: '2026-09-28', baseCurrency: 'USD',
});
const ids = (ctx: CheckContext, checkId: string) => runDataChecks(ctx).filter(f => f.checkId === checkId).map(f => f.record?.id);

describe('Data-health checks', () => {
  test('a clean workspace has no findings', () => {
    const ctx = base();
    ctx.transactions = [makeTransaction({ id: 't1', date: '2026-09-01', lines: [{ accountId: 'cash', amountCents: 500 }, { accountId: 'rev', amountCents: -500 }] })];
    ctx.invoices = [makeInvoice({ id: 'i1', number: 'INV-1', status: 'sent', amountCents: 500, dueDate: '2026-10-01', items: [{ id: 'a', description: 'x', quantity: 1, rateCents: 500, amountCents: 500, accountId: 'rev' }] })];
    assert.deepEqual(runDataChecks(ctx), []);
  });

  test('unbalanced entries are found using each line\'s exchange rate', () => {
    const ctx = base();
    ctx.transactions = [
      makeTransaction({ id: 'bad', date: '2026-09-01', lines: [{ accountId: 'cash', amountCents: 500 }, { accountId: 'rev', amountCents: -400 }] }),
      // 100 at 1.1 = 110 against −110: balanced in the home currency
      makeTransaction({ id: 'fx', date: '2026-09-01', lines: [{ accountId: 'cash', amountCents: 100, exchangeRate: 1.1 }, { accountId: 'rev', amountCents: -110 }] }),
      makeTransaction({ id: 'draft', date: '2026-09-01', status: 'draft', lines: [{ accountId: 'cash', amountCents: 1 }] }),
    ];
    assert.deepEqual(ids(ctx, 'unbalanced'), ['bad']);
  });

  test('duplicate invoice numbers and bills entered twice for the same vendor', () => {
    const ctx = base();
    ctx.invoices = [
      makeInvoice({ id: 'a', number: 'INV-7', status: 'sent', amountCents: 1 }), makeInvoice({ id: 'b', number: 'inv-7 ', status: 'paid', amountCents: 1 }),
      makeInvoice({ id: 'c', number: 'INV-7', status: 'void', amountCents: 1 }), makeInvoice({ id: 'd', number: 'INV-8', status: 'sent', amountCents: 1 }),
    ];
    ctx.bills = [
      makeBill({ id: 'x', vendorId: 'v1', number: 'A-100', status: 'pending' }), makeBill({ id: 'y', vendorId: 'v1', number: 'A-100', status: 'paid' }),
      makeBill({ id: 'z', vendorId: 'v2', number: 'A-100', status: 'pending' }),
    ];
    assert.deepEqual(ids(ctx, 'duplicate-invoice-number'), ['b']);
    assert.deepEqual(ids(ctx, 'duplicate-bill'), ['y']);
  });

  test('future-dated entries, empty invoices, overpayments, foreign documents at rate 1, negative stock', () => {
    const ctx = base();
    ctx.transactions = [makeTransaction({ id: 'late', date: '2026-12-01', lines: [{ accountId: 'cash', amountCents: 5 }, { accountId: 'rev', amountCents: -5 }] })];
    ctx.invoices = [
      makeInvoice({ id: 'empty', status: 'sent', amountCents: 0, items: [] }),
      makeInvoice({ id: 'noacct', status: 'sent', amountCents: 500, items: [{ id: 'a', description: 'x', quantity: 1, rateCents: 500, amountCents: 500, accountId: '' }] }),
      makeInvoice({ id: 'over', status: 'paid', amountCents: 500, amountPaidCents: 600, items: [{ id: 'a', description: 'x', quantity: 1, rateCents: 500, amountCents: 500, accountId: 'rev' }] }),
      makeInvoice({ id: 'eur', status: 'sent', amountCents: 500, currency: 'EUR', exchangeRate: 1, items: [{ id: 'a', description: 'x', quantity: 1, rateCents: 500, amountCents: 500, accountId: 'rev' }] }),
    ];
    ctx.inventory = [{ id: 'widget', name: 'Widget', quantityAtHand: -2 }, { id: 'ok', quantityAtHand: 3 }];
    assert.deepEqual(ids(ctx, 'future-dated'), ['late']);
    assert.deepEqual(ids(ctx, 'empty-invoice'), ['empty', 'noacct']);
    assert.deepEqual(ids(ctx, 'overpaid'), ['over']);
    assert.deepEqual(ids(ctx, 'foreign-without-rate'), ['eur']);
    assert.deepEqual(ids(ctx, 'negative-stock'), ['widget']);
  });

  test('every check has a remedy, and every record type opens a screen', () => {
    for (const check of DATA_CHECKS) assert.ok(check.remedy.length > 10, check.id);
    for (const tab of Object.values(RECORD_TABS)) assert.ok(tab.length > 0);
    assert.equal(new Set(DATA_CHECKS.map(c => c.id)).size, DATA_CHECKS.length, 'ids are unique');
  });

  test('record links: a hash names the screen and the record, and round-trips', () => {
    assert.equal(recordHash({ type: 'invoice', id: 'abc 1/2' }), 'sales/invoice/abc%201%2F2');
    assert.deepEqual(parseRecordHash('#sales/invoice/abc%201%2F2'), { tab: 'sales', record: { type: 'invoice', id: 'abc 1/2' } });
    assert.deepEqual(parseRecordHash('#transactions'), { tab: 'transactions' });
    assert.deepEqual(parseRecordHash('#access_token=eyJ.x.y&expires_in=3600&provider=google'), { tab: '' }, 'sign-in data is not a page: the dashboard opens');
    assert.deepEqual(parseRecordHash('#error=access_denied&error_description=x'), { tab: '' });
    assert.deepEqual(parseRecordHash('#sales/unknown/x'), { tab: 'sales' });
    assert.deepEqual(parseRecordHash('#sales/invoice/%E0%A4%A'), { tab: 'sales' });
    assert.deepEqual(parseRecordHash(''), { tab: '' });
  });
});

describe('Data-health checks added later', () => {
  test('a balanced foreign entry is not called unbalanced because of rounding (L-164)', () => {
    const ctx = base();
    // €0.05 and −€0.05 at 1.1: each line rounds on its own (6 and −5), the entry still balances
    ctx.transactions = [makeTransaction({ id: 'eur', date: '2026-09-01', currency: 'EUR', exchangeRate: 1.1, lines: [{ accountId: 'cash', amountCents: 5 }, { accountId: 'rev', amountCents: -5 }] })];
    assert.deepEqual(ids(ctx, 'unbalanced'), []);
    const finding = runDataChecks({ ...base(), transactions: [makeTransaction({ id: 'off', date: '2026-09-01', lines: [{ accountId: 'cash', amountCents: 1250 }, { accountId: 'rev', amountCents: -1000 }] })] })[0];
    assert.match(finding.description, /\$2\.50/);
  });

  test('suspense, uncategorized and clearing accounts that are not at zero (Z-11)', () => {
    const ctx = base();
    ctx.accounts.push(
      makeChartAccount({ id: 'susp', name: 'Suspense', type: 'asset' }),
      makeChartAccount({ id: 'uncat', name: 'Uncategorized Expense', type: 'expense' }),
      makeChartAccount({ id: 'clear', name: 'Payroll Clearing', type: 'liability' }),
    );
    ctx.transactions = [
      makeTransaction({ id: 'a', date: '2026-09-01', lines: [{ accountId: 'susp', amountCents: 4200 }, { accountId: 'cash', amountCents: -4200 }] }),
      makeTransaction({ id: 'b', date: '2026-09-02', lines: [{ accountId: 'clear', amountCents: -900 }, { accountId: 'cash', amountCents: 900 }] }),
      makeTransaction({ id: 'c', date: '2026-09-03', lines: [{ accountId: 'clear', amountCents: 900 }, { accountId: 'cash', amountCents: -900 }] }), // cleared again
      makeTransaction({ id: 'd', date: '2026-09-04', status: 'draft', lines: [{ accountId: 'uncat', amountCents: 300 }, { accountId: 'cash', amountCents: -300 }] }),
    ];
    const found = runDataChecks(ctx).filter(f => f.checkId === 'suspense-balance');
    assert.deepEqual(found.map(f => f.record), [{ type: 'account', id: 'susp' }]);
    assert.match(found[0].title, /Suspense holds \$42\.00/);
    assert.match(found[0].description, /1 line\(s\).*debit balance/);
  });

  test('bank lines waiting more than 30 days, one finding per bank account, linked to the oldest (Z-13)', () => {
    const ctx = base();
    ctx.accounts.push(makeChartAccount({ id: 'chk', name: 'Checking' }), makeChartAccount({ id: 'sav', name: 'Savings' }));
    const line = (id: string, accountId: string, date: string, status: 'pending' | 'matched' | 'ignored' = 'pending') =>
      ({ id, uid: 'u', workspaceId: 'w', accountId, date, description: `line ${id}`, amountCents: 100, status });
    ctx.bankLines = [
      line('old', 'chk', '2026-07-01'),
      line('older', 'chk', '2026-06-15'),
      line('recent', 'chk', '2026-09-20'),       // under 30 days
      line('edge', 'sav', '2026-08-29'),         // exactly 30 days: not yet
      line('done', 'sav', '2026-01-01', 'matched'),
      line('skip', 'sav', '2026-01-01', 'ignored'),
    ];
    const found = runDataChecks(ctx).filter(f => f.checkId === 'stale-unreconciled');
    assert.equal(found.length, 1);
    assert.deepEqual(found[0].record, { type: 'bankLine', id: 'older' });
    assert.match(found[0].title, /2 bank line\(s\) in Checking/);
    assert.equal(RECORD_TABS.bankLine, 'reconciliation');
  });
});
