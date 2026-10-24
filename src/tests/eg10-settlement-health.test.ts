/**
 * EG-10: Data Health compares each open invoice's and bill's amountPaidCents with the signed sum of its
 * paymentAllocations rows, and the A/R and A/P control balances with the open documents.
 *
 * Hand-worked figures (USD home currency, cents):
 *   INV-1  total 100000, paid 40000; rows payment 30000 + payment 10000 = 40000         -> agrees
 *   INV-2  total  50000, paid 20000; rows payment 25000 + reversal -5000 = 20000        -> agrees (signed sum)
 *   INV-3  total  80000, paid 30000; rows payment 20000 = 20000                         -> mismatch, 30000 - 20000 = 10000 ($100.00)
 *   INV-4  total  20000, paid  5000; no rows                                            -> "no ledger rows yet", not a mismatch
 *   INV-5  draft  99999, paid 0                                                         -> ignored (not issued)
 *   B-1    total  60000, paid 60000 (paid); rows payment 60000                          -> agrees
 *   B-2    EUR 10000 at 1.10, paid 0, no rows                                           -> nothing (no amount paid)
 *
 * A/R: debits 100000 + 50000 + 80000 + 20000 = 250000, credits 40000 + 20000 + 30000 + 5000 = 95000,
 *   balance 155000. Open dues 60000 + 30000 + 50000 + 15000 = 155000 -> agrees.
 *   With a hand entry of 1234 on A/R: 156234 vs 155000 -> difference $12.34.
 * A/P: credit 60000 (B-1) + debit 60000 (its payment) + credit 11000 (B-2, 10000 x 1.10)
 *   = -11000, shown as 11000; open dues 0 + round(10000 x 1.10) = 11000 -> agrees.
 * The database part runs when LF_TEST_DATABASE_URL is set.
 */
import test, { after, before, describe } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'crypto';
import type { Firestore } from '../server/db/pgFirestore';
import { DATA_CHECKS, type CheckContext } from '../lib/dataChecks';
import type { Bill, ChartAccount, Invoice, Transaction } from '../types';

const check = (id: string) => DATA_CHECKS.find(c => c.id === id)!;

const invoices = [
  { id: 'i1', number: 'INV-1', status: 'partially_paid', amountCents: 100000, amountPaidCents: 40000, currency: 'USD' },
  { id: 'i2', number: 'INV-2', status: 'partially_paid', amountCents: 50000, amountPaidCents: 20000, currency: 'USD' },
  { id: 'i3', number: 'INV-3', status: 'partially_paid', amountCents: 80000, amountPaidCents: 30000, currency: 'USD' },
  { id: 'i4', number: 'INV-4', status: 'partially_paid', amountCents: 20000, amountPaidCents: 5000, currency: 'USD' },
  { id: 'i5', number: 'INV-5', status: 'draft', amountCents: 99999, amountPaidCents: 0, currency: 'USD' },
] as unknown as Invoice[];
const bills = [
  { id: 'b1', number: 'B-1', status: 'paid', amountCents: 60000, amountPaidCents: 60000, currency: 'USD' },
  { id: 'b2', number: 'B-2', status: 'approved', amountCents: 10000, amountPaidCents: 0, currency: 'EUR', exchangeRate: 1.1 },
] as unknown as Bill[];
const allocations = [
  { id: 'a1', documentId: 'i1', kind: 'payment', amountCents: 30000 },
  { id: 'a2', documentId: 'i1', kind: 'payment', amountCents: 10000 },
  { id: 'a3', documentId: 'i2', kind: 'payment', amountCents: 25000 },
  { id: 'a4', documentId: 'i2', kind: 'reversal', amountCents: -5000 },
  { id: 'a5', documentId: 'i3', kind: 'payment', amountCents: 20000 },
  { id: 'a6', documentId: 'b1', kind: 'payment', amountCents: 60000 },
];
const accounts = [
  { id: 'ar', name: 'Accounts receivable', type: 'asset', category: 'Receivables', role: 'ar' },
  { id: 'ap', name: 'Accounts payable', type: 'liability', category: 'Payables', role: 'ap' },
  { id: 'bank', name: 'Bank', type: 'asset', role: 'cash' },
  { id: 'sales', name: 'Sales', type: 'income' },
] as unknown as ChartAccount[];
const entry = (id: string, accountId: string, cents: number, other = 'bank', rate?: number): Transaction => ({
  id, date: '2026-10-01', status: 'posted', currency: rate ? 'EUR' : 'USD', exchangeRate: rate,
  lines: [{ accountId, amountCents: cents }, { accountId: other, amountCents: -cents }],
} as unknown as Transaction);
const transactions = [
  entry('t1', 'ar', 250000, 'sales'), entry('t2', 'ar', -95000),
  entry('t3', 'ap', -60000, 'sales'), entry('t4', 'ap', 60000), entry('t5', 'ap', -10000, 'sales', 1.1),
];
const ctx = (over: Partial<CheckContext> = {}): CheckContext => ({
  invoices, bills, allocations, accounts, transactions, recurring: [], today: '2026-10-23', baseCurrency: 'USD', ...over,
});

describe('EG-10 settlement ledger check', () => {
  test('flags only INV-3, and lists INV-4 as having no rows without counting it', () => {
    const found = check('settlement-ledger').run(ctx());
    assert.deepEqual(found.map(f => [f.id, f.severity]), [
      ['settlement-ledger-invoice-i3', 'medium'],
      ['settlement-ledger-no-rows-invoice', 'low'],
    ]);
    assert.match(found[0].description, /100\.00/);
    assert.match(found[1].title, /^1 open invoice\(s\) .*no ledger rows yet, migration may not be applied$/);
    assert.match(found[1].description, /Not counted as a mismatch: INV-4\./);
  });

  test('says nothing when the rows are not loaded (the browser)', () => {
    assert.deepEqual(check('settlement-ledger').run(ctx({ allocations: undefined })), []);
  });

  test('an empty ledger (migration not applied) gives the no-rows notes only', () => {
    const found = check('settlement-ledger').run(ctx({ allocations: [] }));
    assert.deepEqual(found.map(f => f.id), ['settlement-ledger-no-rows-invoice', 'settlement-ledger-no-rows-bill']);
    assert.match(found[0].title, /^4 open invoice/);
  });
});

describe('EG-10 control balance check', () => {
  test('A/R 155000 and A/P 11000 agree with the open documents', () => {
    assert.deepEqual(check('control-balance').run(ctx()), []);
  });

  test('a hand entry of 1234 on A/R is a difference of $12.34', () => {
    const found = check('control-balance').run(ctx({ transactions: [...transactions, entry('t6', 'ar', 1234)] }));
    assert.equal(found.length, 1);
    assert.equal(found[0].id, 'control-balance-ar');
    assert.match(found[0].title, /1,562\.34.*1,550\.00/);
    assert.match(found[0].description, /12\.34 over 4 open invoice/);
  });

  test('no control account, no finding', () => {
    assert.deepEqual(check('control-balance').run(ctx({ accounts: accounts.filter(a => a.id === 'bank') })), []);
  });
});

const url = process.env.LF_TEST_DATABASE_URL;
describe('EG-10 in the nightly check (database)', { skip: !url && 'LF_TEST_DATABASE_URL not set' }, () => {
  const ws = `ws_eg10_${crypto.randomBytes(4).toString('hex')}`;
  let db: Firestore;

  before(async () => {
    process.env.DATABASE_URL = url;
    const { getDb } = await import('../server/db/firestore');
    db = getDb();
    await db.collection('workspaces').doc(ws).set({ uid: 'owner-1', name: 'EG-10 Co', currency: 'USD', members: ['owner-1'] });
    await db.collection('invoices').doc(`${ws}_i3`).set({ workspaceId: ws, number: 'INV-3', status: 'partially_paid', amountCents: 80000, amountPaidCents: 30000, currency: 'USD' });
    await db.collection('paymentAllocations').doc(`payment-p1-p1-${ws}_i3`).set({ workspaceId: ws, documentId: `${ws}_i3`, documentType: 'invoice', kind: 'payment', amountCents: 20000 });
  });

  after(async () => {
    for (const table of ['paymentAllocations', 'invoices', 'notifications']) await db.pool.query(`delete from public."${table}" where workspace_id = $1`, [ws]);
    await db.collection('workspaces').doc(ws).delete();
  });

  test('the nightly check reads the payment ledger and finds INV-3', async () => {
    const { checkLedgerHealth } = await import('../server/services/ledgerHealthService');
    await checkLedgerHealth(db, ws, new Date('2026-10-23T02:00:00Z'));
    const health = (await db.collection('workspaces').doc(ws).get()).data()?.ledgerHealth as { counts: Record<string, number> };
    // INV-3's mismatch is the only medium finding (no accounts: no control-balance finding)
    assert.equal(health.counts.medium, 1);
  });
});
