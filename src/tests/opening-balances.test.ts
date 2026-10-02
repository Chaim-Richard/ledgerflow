/**
 * Opening balances (L-19): one entry on the start date that balances by construction — the
 * difference goes to Opening Balance Equity — so a new workspace starts with a balanced trial
 * balance. Receivables/payables come from invoices and bills, not from here. The database part
 * runs when LF_TEST_DATABASE_URL is set.
 */
import test, { after, before, describe } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'crypto';
import { normalSign, openingBalanceAccounts, openingEntry } from '../lib/openingBalances';
import { makeChartAccount } from './fixtures';
import type { Transaction } from '../types';
import type { Firestore } from '../server/db/pgFirestore';

const cash = makeChartAccount({ id: 'cash', name: 'Checking', type: 'asset', category: 'Cash' });
const equipment = makeChartAccount({ id: 'eq', name: 'Equipment', type: 'asset', category: 'Fixed Assets' });
const depreciation = makeChartAccount({ id: 'dep', name: 'Accumulated Depreciation', type: 'asset', category: 'Fixed Assets', isContra: true } as never);
const loan = makeChartAccount({ id: 'loan', name: 'Bank Loan', type: 'liability', category: 'Long-term' });
const capital = makeChartAccount({ id: 'cap', name: "Owner's Equity", type: 'equity', category: 'Equity' });
const obe = makeChartAccount({ id: 'obe', name: 'Opening Balance Equity', type: 'equity', category: 'Equity' });
const ar = makeChartAccount({ id: 'ar', name: 'Accounts Receivable', type: 'asset', category: 'Receivables' });
const ap = makeChartAccount({ id: 'ap', name: 'Accounts Payable', type: 'liability', category: 'Payables' });
const sales = makeChartAccount({ id: 'rev', name: 'Sales', type: 'income', category: 'Revenue' });
const accounts = [cash, equipment, depreciation, loan, capital, obe, ar, ap, sales];

describe('Opening balance rules', () => {
  test('balance-sheet accounts only, without receivables, payables and Opening Balance Equity itself', () => {
    assert.deepEqual(openingBalanceAccounts(accounts).map(a => a.id), ['cash', 'eq', 'dep', 'loan', 'cap']);
  });

  test('each balance on its normal side; contra accounts the other way', () => {
    assert.equal(normalSign(cash), 1);
    assert.equal(normalSign(depreciation), -1);
    assert.equal(normalSign(loan), -1);
    assert.equal(normalSign(capital), -1);
  });

  test('the difference goes to Opening Balance Equity, so debits equal credits', () => {
    const entry = openingEntry(accounts, [
      { accountId: 'cash', amountCents: 1_000_000 },
      { accountId: 'eq', amountCents: 500_000 },
      { accountId: 'dep', amountCents: 100_000 },
      { accountId: 'loan', amountCents: 300_000 },
      { accountId: 'cap', amountCents: 0 },
    ], obe);
    const by = Object.fromEntries(entry.lines.map(l => [l.accountId, l.amountCents]));
    assert.deepEqual(by, { cash: 1_000_000, eq: 500_000, dep: -100_000, loan: -300_000, obe: -1_100_000 });
    assert.equal(entry.lines.reduce((s, l) => s + l.amountCents, 0), 0);
    assert.equal(entry.debitsCents, 1_500_000);
    assert.equal(entry.creditsCents, 1_500_000);
    assert.equal(entry.equityCents, 1_100_000, 'what the business is worth');
  });

  test('an overdrawn bank is a negative balance; already balanced needs no equity line', () => {
    const entry = openingEntry(accounts, [{ accountId: 'cash', amountCents: -20_000 }, { accountId: 'loan', amountCents: -20_000 }], obe);
    assert.deepEqual(entry.lines.map(l => [l.accountId, l.amountCents]), [['cash', -20_000], ['loan', 20_000]]);
  });

  test('refused: receivables, unknown or repeated accounts, fractions of a cent', () => {
    assert.throws(() => openingEntry(accounts, [{ accountId: 'ar', amountCents: 100 }], obe), /receivables and payables/);
    assert.throws(() => openingEntry(accounts, [{ accountId: 'nope', amountCents: 100 }], obe));
    assert.throws(() => openingEntry(accounts, [{ accountId: 'cash', amountCents: 1 }, { accountId: 'cash', amountCents: 2 }], obe), /one opening balance/);
    assert.throws(() => openingEntry(accounts, [{ accountId: 'cash', amountCents: 1.5 }], obe), /whole cents/);
  });
});

const url = process.env.LF_TEST_DATABASE_URL;

describe('Opening balances in the database', { skip: !url && 'LF_TEST_DATABASE_URL not set' }, () => {
  const ws = `ws_open_${crypto.randomBytes(4).toString('hex')}`;
  const id = (name: string) => `${ws}_${name}`;
  let db: Firestore;
  let svc: typeof import('../server/services/openingBalanceService');

  before(async () => {
    process.env.DATABASE_URL = url;
    const { getDb } = await import('../server/db/firestore');
    svc = await import('../server/services/openingBalanceService');
    db = getDb();
    await db.collection('workspaces').doc(ws).set({ uid: 'owner-1', name: 'Open', currency: 'USD', members: ['owner-1', 'book-1'], roles: { 'book-1': 'bookkeeper' } });
    for (const a of [cash, loan, ar]) await db.collection('chartAccounts').doc(id(a.id)).set({ ...a, id: id(a.id), workspaceId: ws });
  });

  after(async () => {
    for (const table of ['transactions', 'chartAccounts', 'auditLogs', 'workspaces']) {
      await db.pool.query(`delete from public."${table}" where workspace_id = $1 or id = $1`, [ws]);
    }
    await db.terminate();
  });

  const input = { workspaceId: ws, uid: 'owner-1', date: '2026-01-01', balances: [{ accountId: id('cash'), amountCents: 250_000 }, { accountId: id('loan'), amountCents: 50_000 }] };

  test('needs an Opening Balance Equity account; bookkeepers may not', async () => {
    await assert.rejects(svc.recordOpeningBalances(db, input), /Opening Balance Equity/);
    await db.collection('chartAccounts').doc(id('obe')).set({ ...obe, id: id('obe'), workspaceId: ws });
    await assert.rejects(svc.recordOpeningBalances(db, { ...input, uid: 'book-1' }), /owners and accountants/);
  });

  test('receivables are refused; so is a closed period', async () => {
    await assert.rejects(svc.recordOpeningBalances(db, { ...input, balances: [{ accountId: id('ar'), amountCents: 100 }] }), /receivables and payables/);
    await db.collection('workspaces').doc(ws).update({ lockDate: '2026-06-30' });
    await assert.rejects(svc.recordOpeningBalances(db, input), /lock|closed/i);
    await db.collection('workspaces').doc(ws).update({ lockDate: null });
    const posted = (await db.collection('transactions').where('workspaceId', '==', ws).get()).docs.length;
    assert.equal(posted, 0, 'nothing written');
  });

  test('posts one balanced entry, marks setup done, and only once', async () => {
    const result = await svc.recordOpeningBalances(db, input);
    assert.equal(result.debitsCents, 250_000);
    assert.equal(result.creditsCents, 250_000);
    const tx = (await db.collection('transactions').doc(result.transactionId!).get()).data() as Transaction;
    assert.equal(tx.date, '2026-01-01');
    assert.equal(tx.lines.reduce((s, l) => s + l.amountCents, 0), 0);
    assert.equal(tx.lines.find(l => l.accountId === id('obe'))?.amountCents, -200_000);
    const workspace = (await db.collection('workspaces').doc(ws).get()).data()!;
    assert.ok(workspace.setupCompletedAt);
    assert.equal(workspace.openingBalanceDate, '2026-01-01');
    await assert.rejects(svc.recordOpeningBalances(db, input), /already recorded/);
  });

  test('"start from zero" marks setup done for owners and accountants only', async () => {
    const other = `${ws}_b`;
    await db.collection('workspaces').doc(other).set({ uid: 'owner-1', name: 'B', members: ['owner-1', 'view-1'], roles: { 'view-1': 'viewer' } });
    await assert.rejects(svc.completeSetup(db, { workspaceId: other, uid: 'view-1' }), /owners and accountants/);
    await svc.completeSetup(db, { workspaceId: other, uid: 'owner-1' });
    assert.ok((await db.collection('workspaces').doc(other).get()).data()!.setupCompletedAt);
    await db.pool.query('delete from public."workspaces" where id = $1', [other]);
  });
});
