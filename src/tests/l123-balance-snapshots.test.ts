/**
 * L-123 step 1: balances from a year-end snapshot plus the entries after it (src/server/services/balanceService.ts,
 * supabase/migrations/20261023000000_period_balances.sql), on a real database. Runs when LF_TEST_DATABASE_URL is set.
 *
 * Hand-worked case (cents). Accounts Cash (asset), Equity, Sales (income), Rent and Fees (expenses).
 *   2025-01-05  capital         Cash +1,000,000 / Equity −1,000,000
 *   2025-06-10  sale, project Alpha   Cash +250,000 / Sales −250,000
 *   2025-08-01  a void sale of 99,999 (not counted)
 *   2025-09-30  rent            Rent +120,000 / Cash −120,000
 *   2025-12-31T18:00Z  bank fee (a clock time: it counts on 31 December)  Fees +1,000 / Cash −1,000
 *   Snapshot at 2025-12-31: Cash 1,129,000 · Equity −1,000,000 · Sales −250,000 · Rent 120,000 · Fees 1,000;
 *     retained earnings 250,000 − 120,000 − 1,000 = 129,000; 4 entries
 *   2026-02-14  sale, project Beta    Cash +80,000 / Sales −80,000
 *   2026-03-31  rent            Rent +30,000 / Cash −30,000
 *   2026-04-02  sale 10,000 (after the date asked)
 *   Balance at 2026-03-31 = snapshot + the two entries after it:
 *     Cash 1,129,000 + 80,000 − 30,000 = 1,179,000 · Sales −330,000 · Rent 150,000 · Fees 1,000 · Equity −1,000,000
 *     retained earnings 129,000 + 80,000 − 30,000 = 179,000
 *     by project: Alpha Cash 250,000 / Sales −250,000; Beta Cash 80,000 / Sales −80,000;
 *                 Unassigned Cash 849,000 · Equity −1,000,000 · Rent 150,000 · Fees 1,000
 *
 * The gold ledgers YEAR-END (src/tests/year-end-gold.test.ts) and FX (src/tests/fx-gold.test.ts) are built again
 * through the same app code, and at every month end balancesAsOf equals a full recompute from every entry, without
 * a snapshot and with snapshots at several dates. Staleness: an edit, insert, delete or relabel dated in a closed
 * year marks the snapshot stale, a stale snapshot is never read (even a corrupted one), and the answer stays right.
 */
import './helpers/dom';
import '../services/ledgerPost/postingKit';
import test, { after, before, describe } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'crypto';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { postInvoiceLedger } from '../services/ledgerPost/invoicePosting';
import { postBillLedger } from '../services/ledgerPost/billPosting';
import type { LedgerPostContext } from '../services/ledgerPost/postingKit';
import { calculateNetIncome, isPostable, lineAmount, transactionDate } from '../lib/txFilters';
import { getLineDimension } from '../lib/dimensionUtils';
import type { ChartAccount, Transaction, Workspace } from '../types';
import type { Firestore } from '../server/db/pgFirestore';
import type * as BalanceService from '../server/services/balanceService';

const url = process.env.LF_TEST_DATABASE_URL;
const OWNER = 'owner-1';

type Cents = Record<string, number>;
const prune = (m: Cents) => Object.fromEntries(Object.entries(m).filter(([, v]) => v !== 0).sort(([a], [b]) => a.localeCompare(b)));

/** The full recompute: every postable entry dated on or before `date`, summed afresh, independent of the service. */
function recompute(entries: Transaction[], accounts: ChartAccount[], date: string, kinds: string[]) {
  const mine = entries.filter(e => isPostable(e) && transactionDate(e) !== '' && transactionDate(e) <= date);
  const sums: Cents = {};
  const byLabel: Record<string, Record<string, Cents>> = {};
  for (const tx of mine) for (const line of tx.lines || []) {
    sums[line.accountId] = (sums[line.accountId] || 0) + lineAmount(line, tx);
    for (const kind of kinds) {
      const into = ((byLabel[kind] ||= {})[getLineDimension(line, tx, kind) || 'Unassigned'] ||= {});
      into[line.accountId] = (into[line.accountId] || 0) + lineAmount(line, tx);
    }
  }
  const labels = Object.fromEntries(Object.entries(byLabel).map(([k, vs]) => [k, Object.fromEntries(Object.entries(vs).map(([v, c]) => [v, prune(c)]).filter(([, c]) => Object.keys(c).length))]));
  return { accounts: prune(sums), retainedEarnings: calculateNetIncome(mine, accounts, '1970-01-01', date).netIncome, byLabel: labels };
}

function monthEnds(from: string, to: string): string[] {
  const out: string[] = [];
  for (let y = Number(from.slice(0, 4)), m = Number(from.slice(5, 7)); `${y}-${String(m).padStart(2, '0')}` <= to.slice(0, 7); m === 12 ? (y++, m = 1) : m++) {
    out.push(new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10));
  }
  return out;
}

let svc: typeof BalanceService;
let db: Firestore;
const entriesOf = async (ws: string) => (await db.collection('transactions').where('workspaceId', '==', ws).get()).docs.map(d => ({ ...d.data(), id: d.id }) as Transaction);
const accountsOf = async (ws: string) => (await db.collection('chartAccounts').where('workspaceId', '==', ws).get()).docs.map(d => ({ ...d.data(), id: d.id }) as ChartAccount);
const snapshotOf = async (ws: string, asOf: string) => (await db.collection('periodBalances').doc(`${ws}_${asOf}`).get()).data() as BalanceService.PeriodBalances | undefined;

/** At each month end, with whatever snapshots exist: the service equals the recompute; returns the snapshot dates read. */
async function assertEqualsRecompute(ws: string, dates: string[]) {
  const [entries, accounts] = [await entriesOf(ws), await accountsOf(ws)];
  const used: Array<string | null> = [];
  for (const date of dates) {
    const got = await svc.balancesAsOf(db, ws, date, { byLabel: true });
    const want = recompute(entries, accounts, date, Object.keys(got.byLabel || {}));
    assert.deepEqual(prune(got.accounts), want.accounts, `accounts at ${date}`);
    assert.equal(got.retainedEarnings, want.retainedEarnings, `retained earnings at ${date}`);
    for (const kind of Object.keys(got.byLabel || {})) {
      const gotKind = Object.fromEntries(Object.entries(got.byLabel?.[kind] || {}).map(([v, c]) => [v, prune(c)]));
      assert.deepEqual(gotKind, want.byLabel[kind] || {}, `label ${kind} at ${date}`);
    }
    used.push(got.snapshot?.asOf ?? null);
  }
  return used;
}

/** The equality without a snapshot, then with snapshots at the given dates (built and removed again). */
async function equalityWithAndWithout(ws: string, dates: string[], snapshotDates: string[]) {
  const keep = (await db.collection('periodBalances').where('workspaceId', '==', ws).get()).docs.map(d => d.id);
  await db.pool.query(`update public."periodBalances" set data = data || '{"stale":true}' where workspace_id = $1`, [ws]);
  assert.deepEqual(await assertEqualsRecompute(ws, dates), dates.map(() => null), 'no fresh snapshot: every entry summed');
  for (const asOf of snapshotDates) await svc.buildSnapshot(db, ws, asOf, 'test');
  const used = await assertEqualsRecompute(ws, dates);
  assert.deepEqual(used, dates.map(d => [...snapshotDates].sort().reverse().find(s => s <= d) ?? null), 'the newest snapshot on or before each date is read');
  await db.pool.query(`delete from public."periodBalances" where workspace_id = $1 and not (id = any($2))`, [ws, keep]);
  for (const id of keep) await svc.buildSnapshot(db, ws, id.slice(ws.length + 1), 'test');
}

const cleanup = async (ws: string) => {
  for (const table of ['transactions', 'invoices', 'bills', 'payments', 'assets', 'periods', 'customers', 'vendors', 'chartAccounts', 'auditLogs', 'idempotencyKeys', 'documentSeries', 'periodBalances', 'workspaces']) {
    await db.pool.query(`delete from public."${table}" where workspace_id = $1 or id = $1`, [ws]).catch(() => {});
  }
};

describe('L-123 balance snapshots', { skip: !url && 'LF_TEST_DATABASE_URL not set' }, () => {
  let server: Server;
  let base = '';
  const realFetch = globalThis.fetch;
  const send = async (method: string, path: string, body?: unknown) => {
    const res = await realFetch(`${base}${path}`, { method, headers: { 'content-type': 'application/json', 'x-test-uid': OWNER }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
    return { status: res.status, body: await res.json().catch(() => ({})) as Record<string, unknown> & { data?: { transactionId?: string } } };
  };
  const workspaces: string[] = [];
  const newWorkspace = async (prefix: string, name: string) => {
    const ws = `ws_${prefix}_${crypto.randomBytes(4).toString('hex')}`;
    workspaces.push(ws);
    await db.collection('workspaces').doc(ws).set({ uid: OWNER, name, currency: 'USD', timezone: 'UTC', members: [OWNER] });
    return ws;
  };
  const importAccounts = async (ws: string, rows: Array<{ name: string; code: string; type: string }>) => {
    const r = await send('POST', `/api/v1/workspaces/${ws}/import-records`, { kind: 'accounts', rows });
    assert.equal(r.status, 200, JSON.stringify(r.body));
    return Object.fromEntries((await accountsOf(ws)).map(a => [String(a.code), a]));
  };
  const context = async (ws: string, acct: Record<string, ChartAccount>): Promise<LedgerPostContext> => ({
    accounts: Object.values(acct), lockDate: null, uid: OWNER, inventory: [], transactions: await entriesOf(ws),
    workspaces: [{ id: ws, uid: OWNER, name: 'L-123', currency: 'USD' } as Workspace],
  });
  const party = async (ws: string, kind: 'customers' | 'vendors', name: string, currency?: string) => {
    assert.equal((await send('POST', `/api/v1/workspaces/${ws}/import-records`, { kind, rows: [{ name, ...(currency ? { currency } : {}) }] })).status, 200);
    return (await db.collection(kind).where('workspaceId', '==', ws).get()).docs[0].id;
  };

  before(async () => {
    process.env.DATABASE_URL = url;
    const express = (await import('express')).default;
    const { getDb } = await import('../server/db/firestore');
    svc = await import('../server/services/balanceService');
    db = getDb();
    const app = express();
    app.use(express.json());
    app.use((req, _res, next) => { (req as unknown as { user: { uid: string; email: string } }).user = { uid: String(req.header('x-test-uid')), email: 'owner@l123.test' }; next(); });
    app.use('/api/v1/workspaces', (await import('../server/routes/workspaceRoutes')).workspaceRouter);
    app.use('/api/v1/transactions', (await import('../server/routes/transactionRoutes')).transactionRouter);
    app.use('/api/v1/documents', (await import('../server/routes/documentPostRoutes')).documentPostRouter);
    app.use('/api/v1/payments', (await import('../server/routes/paymentRoutes')).paymentRouter);
    server = app.listen(0);
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const target = String(input);
      if (!target.startsWith('/')) return realFetch(input, init);
      return realFetch(`${base}${target}`, { ...init, headers: { ...(init?.headers as Record<string, string> || {}), 'x-test-uid': OWNER } });
    }) as typeof fetch;
  });

  after(async () => {
    globalThis.fetch = realFetch;
    server?.close();
    for (const ws of workspaces) await cleanup(ws);
    const { getSupabase } = await import('../lib/db/client');
    getSupabase().realtime.disconnect();
    await getSupabase().auth.dispose();
    await db.terminate();
  });

  describe('the hand-worked case', () => {
    let ws = '';
    const id = (s: string) => `${ws}_${s}`;
    const entry = (key: string, date: string, lines: Array<[string, number, string?]>, extra: Partial<Transaction> = {}) => db.collection('transactions').doc(id(key)).set({
      id: id(key), workspaceId: ws, uid: OWNER, date, description: key, status: 'completed', type: 'journal', currency: 'USD',
      totalAmountCents: Math.abs(lines[0][1]), lines: lines.map(([acc, cents, project]) => ({ accountId: id(acc), amountCents: cents, ...(project ? { dimensions: { project } } : {}) })), ...extra,
    });
    const at = (date: string) => svc.balancesAsOf(db, ws, date, { byLabel: true });

    before(async () => {
      ws = await newWorkspace('l123h', 'Hand case');
      for (const [key, type] of [['cash', 'asset'], ['equity', 'equity'], ['sales', 'income'], ['rent', 'expense'], ['fees', 'expense']]) {
        await db.collection('chartAccounts').doc(id(key)).set({ id: id(key), workspaceId: ws, name: key, code: key, type });
      }
      await entry('capital', '2025-01-05', [['cash', 1_000_000], ['equity', -1_000_000]]);
      await entry('alpha', '2025-06-10', [['cash', 250_000, 'Alpha'], ['sales', -250_000, 'Alpha']]);
      await entry('void', '2025-08-01', [['cash', 99_999], ['sales', -99_999]], { status: 'void' });
      await entry('rent25', '2025-09-30', [['rent', 120_000], ['cash', -120_000]]);
      await entry('fee', '2025-12-31T18:00:00.000Z', [['fees', 1_000], ['cash', -1_000]]);
      await entry('beta', '2026-02-14', [['cash', 80_000, 'Beta'], ['sales', -80_000, 'Beta']]);
      await entry('rent26', '2026-03-31', [['rent', 30_000], ['cash', -30_000]]);
      await entry('late', '2026-04-02', [['cash', 10_000], ['sales', -10_000]]);
    });

    test('the snapshot at 2025-12-31 holds the worked figures', async () => {
      const s = await svc.buildSnapshot(db, ws, '2025-12-31', OWNER);
      assert.deepEqual(prune(s.accounts), prune({ [id('cash')]: 1_129_000, [id('equity')]: -1_000_000, [id('sales')]: -250_000, [id('rent')]: 120_000, [id('fees')]: 1_000 }));
      assert.deepEqual([s.retainedEarnings, s.entryCount, s.stale, (await snapshotOf(ws, '2025-12-31'))?.checksum], [129_000, 4, false, s.checksum]);
    });

    test('balance at 2026-03-31 = the snapshot + the two entries after it', async () => {
      const b = await at('2026-03-31');
      assert.deepEqual([b.snapshot?.asOf, b.entriesRead], ['2025-12-31', 2]);
      assert.deepEqual(prune(b.accounts), prune({ [id('cash')]: 1_179_000, [id('equity')]: -1_000_000, [id('sales')]: -330_000, [id('rent')]: 150_000, [id('fees')]: 1_000 }));
      assert.equal(b.retainedEarnings, 179_000);
      assert.deepEqual(b.byLabel?.project, {
        Alpha: { [id('cash')]: 250_000, [id('sales')]: -250_000 },
        Beta: { [id('cash')]: 80_000, [id('sales')]: -80_000 },
        Unassigned: { [id('cash')]: 849_000, [id('equity')]: -1_000_000, [id('rent')]: 150_000, [id('fees')]: 1_000 },
      });
      assert.deepEqual(await assertEqualsRecompute(ws, monthEnds('2025-01-01', '2026-05-31')), [...Array(11).fill(null), ...Array(6).fill('2025-12-31')]);
    });

    const staleThenRight = async (change: () => Promise<unknown>, label: string) => {
      await svc.buildSnapshot(db, ws, '2025-06-30', 'test');
      await svc.buildSnapshot(db, ws, '2025-12-31', 'test');
      await change();
      const [mid, end] = [await snapshotOf(ws, '2025-06-30'), await snapshotOf(ws, '2025-12-31')];
      assert.deepEqual([mid?.stale, end?.stale], [false, true], `${label}: dated 2025-09, so only the 31 December snapshot is stale`);
      // a stale snapshot is never read, even one whose figures are wrong
      await db.pool.query(`update public."periodBalances" set data = jsonb_set(data, '{accounts}', '{"x":1}') where id = $1`, [id('2025-12-31')]);
      assert.deepEqual(await assertEqualsRecompute(ws, ['2025-12-31', '2026-03-31']), ['2025-06-30', '2025-06-30'], `${label}: the fresh one before it is read`);
      const rebuilt = await svc.rebuildSnapshots(db, ws, 'test');
      assert.deepEqual([rebuilt.built, (await snapshotOf(ws, '2025-12-31'))?.stale], [['2025-12-31'], false]);
      assert.deepEqual(await assertEqualsRecompute(ws, ['2026-03-31']), ['2025-12-31']);
    };

    test('an entry edited in the closed year marks the snapshot stale; the answer stays right', () =>
      staleThenRight(() => db.collection('transactions').doc(id('rent25')).update({ lines: [{ accountId: id('rent'), amountCents: 125_000 }, { accountId: id('cash'), amountCents: -125_000 }] }), 'edit'));
    test('an entry inserted in the closed year', () =>
      staleThenRight(() => entry('rent25b', '2025-09-15', [['rent', 5_000], ['cash', -5_000]]), 'insert'));
    test('an entry deleted in the closed year', () =>
      staleThenRight(() => db.collection('transactions').doc(id('rent25b')).delete(), 'delete'));
    test('a relabel in the closed year (only the label changes)', async () => {
      await staleThenRight(() => db.collection('transactions').doc(id('rent25')).update({ lines: [{ accountId: id('rent'), amountCents: 125_000, dimensions: { project: 'Alpha' } }, { accountId: id('cash'), amountCents: -125_000, dimensions: { project: 'Alpha' } }] }), 'relabel');
      assert.equal((await at('2026-03-31')).byLabel?.project.Alpha[id('rent')], 125_000);
    });
    test('an entry moved from an open year into the closed one, and one after every snapshot', async () => {
      await staleThenRight(() => db.collection('transactions').doc(id('late')).update({ date: '2025-09-01' }), 'moved in');
      await db.collection('transactions').doc(id('late')).update({ date: '2026-04-02' });
      await svc.rebuildSnapshots(db, ws, 'test');
      await entry('open', '2026-05-01', [['cash', 1], ['sales', -1]]);
      assert.equal((await snapshotOf(ws, '2025-12-31'))?.stale, false, 'an open-year entry leaves the snapshots alone');
    });
  });

  describe('YEAR-END gold ledger (year-end-gold.test.ts), through close-year', () => {
    let ws = '';
    let acct: Record<string, ChartAccount> = {};
    before(async () => {
      ws = await newWorkspace('l123ye', 'Harbor Tools');
      acct = await importAccounts(ws, [
        { name: 'Checking', code: '1000', type: 'Bank' }, { name: 'Accounts Receivable', code: '1100', type: 'Accounts receivable' },
        { name: 'Equipment', code: '1500', type: 'Fixed asset' }, { name: 'Accumulated Depreciation', code: '1510', type: 'Fixed asset' },
        { name: 'Accounts Payable', code: '2000', type: 'Accounts payable' }, { name: 'Opening Balance Equity', code: '3000', type: 'Equity' },
        { name: 'Retained Earnings', code: '3100', type: 'Equity' }, { name: 'Sales', code: '4000', type: 'Income' },
        { name: 'Supplies', code: '6000', type: 'Expense' }, { name: 'Depreciation', code: '6500', type: 'Expense' },
      ]);
    });

    test('the year is posted, closed and locked: the close writes the snapshot (profit 348,000)', async () => {
      const customerId = await party(ws, 'customers', 'Delta Builders');
      const vendorId = await party(ws, 'vendors', 'Iron Supply');
      const invoice = async (n: string, date: string, cents: number) => {
        const data = { id: `${ws}_${n}`, workspaceId: ws, uid: OWNER, number: n, customerId, customerName: 'Delta Builders', date, dueDate: date, status: 'sent' as const,
          amountCents: cents, amountPaidCents: 0, currency: 'USD', taxVersion: 2, taxAmountCents: 0,
          items: [{ id: 'l1', description: 'Tools', quantity: 1, rateCents: cents, amountCents: cents, accountId: acct['4000'].id }] };
        await postInvoiceLedger(data.id, data as never, ws, OWNER, { collection: 'invoices', docId: data.id, action: 'create', data }, await context(ws, acct));
        return data.id;
      };
      const bill = async (n: string, date: string, cents: number) => {
        const data = { id: `${ws}_${n}`, workspaceId: ws, uid: OWNER, number: n, billNumber: n, vendorId, vendorName: 'Iron Supply', date, dueDate: date, status: 'approved' as const,
          amountCents: cents, amountPaidCents: 0, currency: 'USD', splits: [{ accountId: acct['6000'].id, amountCents: cents, description: 'Supplies' }] };
        await postBillLedger(data.id, data as never, ws, OWNER, { collection: 'bills', docId: data.id, action: 'create', data }, await context(ws, acct));
        return data.id;
      };
      const pay = (side: 'invoice' | 'bill', documentId: string, date: string, cents: number) => send('POST', '/api/v1/payments', {
        workspaceId: ws, amountCents: cents, paymentDate: date, cashAccountId: acct['1000'].id, paymentMethod: 'bank_transfer',
        ...(side === 'invoice' ? { customerId } : { vendorId }), allocations: [{ documentId, documentType: side, amountCents: cents }],
      });
      assert.equal((await send('POST', `/api/v1/workspaces/${ws}/opening-balances`, { date: '2025-01-01', balances: [{ accountId: acct['1000'].id, amountCents: 1_000_000 }] })).status, 200);
      assert.equal((await send('POST', '/api/v1/transactions/bulk', { workspaceId: ws, transactions: [{
        id: `${ws}_equipment`, uid: OWNER, workspaceId: ws, date: '2025-01-15', description: 'Table saw', totalAmountCents: 120_000, currency: 'USD', status: 'completed', type: 'journal',
        lines: [{ accountId: acct['1500'].id, amountCents: 120_000 }, { accountId: acct['1000'].id, amountCents: -120_000 }],
      }] })).status, 200);
      await db.collection('assets').doc(`${ws}_saw`).set({
        workspaceId: ws, name: 'Table saw', purchaseDate: '2025-01-15', purchasePriceCents: 120_000, salvageValueCents: 0, usefulLifeYears: 5, depreciationMethod: 'straight-line',
        accumulatedDepreciationCents: 0, status: 'active', expenseAccountId: acct['6500'].id, accumulatedAccountId: acct['1510'].id, assetAccountId: acct['1500'].id,
      });
      const inv1 = await invoice('INV-1', '2025-03-10', 300_000);
      const b1 = await bill('B-1', '2025-04-05', 80_000);
      assert.equal((await pay('invoice', inv1, '2025-04-20', 300_000)).status, 200);
      assert.equal((await pay('bill', b1, '2025-05-01', 80_000)).status, 200);
      await invoice('INV-2', '2025-11-20', 200_000);
      await bill('B-2', '2025-12-10', 50_000);
      assert.equal((await send('POST', `/api/v1/workspaces/${ws}/periods/2025-12/depreciation`, {})).body.totalCents, 22_000);

      const close = await send('POST', '/api/v1/transactions/close-year', { workspaceId: ws, closingDate: '2025-12-31', lockPeriod: true });
      assert.equal(close.status, 200, JSON.stringify(close.body));
      assert.equal(close.body.netIncomeCents, 348_000);
      const s = await snapshotOf(ws, '2025-12-31');
      assert.deepEqual([s?.retainedEarnings, s?.stale, s?.builtBy, s?.accounts[acct['1000'].id], s?.accounts[acct['1510'].id]], [348_000, false, OWNER, 1_100_000, -22_000]);
      assert.equal((await send('POST', '/api/v1/transactions/close-year', { workspaceId: ws, closingDate: '2025-12-31', lockPeriod: true })).status, 400, 'not twice');
    });

    test('balancesAsOf equals a full recompute at every month end, with and without snapshots', async () => {
      await send('POST', '/api/v1/transactions/bulk', { workspaceId: ws, transactions: [{
        id: `${ws}_jan26`, uid: OWNER, workspaceId: ws, date: '2026-01-20', description: 'January sale', totalAmountCents: 40_000, currency: 'USD', status: 'completed', type: 'journal',
        lines: [{ accountId: acct['1000'].id, amountCents: 40_000 }, { accountId: acct['4000'].id, amountCents: -40_000 }],
      }] });
      const dates = monthEnds('2025-01-01', '2026-03-31');
      assert.deepEqual(await assertEqualsRecompute(ws, dates), dates.map(d => (d >= '2025-12-31' ? '2025-12-31' : null)));
      await equalityWithAndWithout(ws, dates, ['2025-03-31', '2025-08-31', '2025-12-31']);
    });

    test('a reopened range: an entry posted in it marks the snapshot stale; closing the range rebuilds it', async () => {
      const unlock = await send('POST', `/api/v1/workspaces/${ws}/periods/unlock`, { fromDate: '2025-12-01', toDate: '2025-12-31', reason: 'Late supplier invoice' });
      assert.equal(unlock.status, 200, JSON.stringify(unlock.body));
      const late = await send('POST', '/api/v1/transactions/bulk', { workspaceId: ws, transactions: [{
        id: `${ws}_late`, uid: OWNER, workspaceId: ws, date: '2025-12-20', description: 'Late fee', totalAmountCents: 1_000, currency: 'USD', status: 'completed', type: 'journal',
        lines: [{ accountId: acct['6000'].id, amountCents: 1_000 }, { accountId: acct['1000'].id, amountCents: -1_000 }],
      }] });
      assert.equal(late.status, 200, JSON.stringify(late.body));
      assert.equal((await snapshotOf(ws, '2025-12-31'))?.stale, true);
      assert.deepEqual(await assertEqualsRecompute(ws, ['2025-12-31', '2026-02-28']), [null, null], 'the stale snapshot is not read');
      assert.equal((await send('POST', `/api/v1/workspaces/${ws}/periods/relock`, {})).status, 200);
      const s = await snapshotOf(ws, '2025-12-31');
      assert.deepEqual([s?.stale, s?.retainedEarnings], [false, 347_000]);
      assert.deepEqual(await assertEqualsRecompute(ws, ['2025-12-31', '2026-02-28']), ['2025-12-31', '2025-12-31']);
    });

    test('the rebuild path: a year closed before L-123 (no snapshot) gets one; owners only', async () => {
      await db.collection('periodBalances').doc(`${ws}_2025-12-31`).delete();
      assert.equal((await send('POST', '/api/v1/transactions/period-balances/rebuild', { workspaceId: ws })).body.built?.toString(), '2025-12-31');
      assert.equal((await snapshotOf(ws, '2025-12-31'))?.retainedEarnings, 347_000);
      const other = await realFetch(`${base}/api/v1/transactions/period-balances/rebuild`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-test-uid': 'someone-else' }, body: JSON.stringify({ workspaceId: ws }) });
      assert.equal(other.status, 403);
    });
  });

  describe('FX gold ledger (fx-gold.test.ts)', () => {
    test('balancesAsOf equals a full recompute at every month end, with and without snapshots', async () => {
      const ws = await newWorkspace('l123fx', 'Atlas Imports');
      const acct = await importAccounts(ws, [
        { name: 'Checking', code: '1000', type: 'Bank' }, { name: 'Accounts Receivable', code: '1100', type: 'Accounts receivable' },
        { name: 'Accounts Payable', code: '2000', type: 'Accounts payable' }, { name: 'Sales', code: '4000', type: 'Income' },
        { name: 'Unrealized currency revaluation', code: '4900', type: 'Income' }, { name: 'Realized exchange differences', code: '4910', type: 'Income' },
        { name: 'Supplies', code: '6000', type: 'Expense' },
      ]);
      const customerId = await party(ws, 'customers', 'Lyon Café', 'EUR');
      const vendorId = await party(ws, 'vendors', 'Porto Paper', 'EUR');
      const inv = { id: `${ws}_INV-E1`, workspaceId: ws, uid: OWNER, number: 'INV-E1', customerId, customerName: 'Lyon Café', date: '2025-03-10', dueDate: '2025-04-30', status: 'sent' as const,
        amountCents: 100_000, amountPaidCents: 0, currency: 'EUR', exchangeRate: 1.1, taxVersion: 2, taxAmountCents: 0,
        items: [{ id: 'l1', description: 'Espresso machines', quantity: 1, rateCents: 100_000, amountCents: 100_000, accountId: acct['4000'].id }] };
      await postInvoiceLedger(inv.id, inv as never, ws, OWNER, { collection: 'invoices', docId: inv.id, action: 'create', data: inv }, await context(ws, acct));
      const bill = { id: `${ws}_B-E1`, workspaceId: ws, uid: OWNER, number: 'B-E1', billNumber: 'B-E1', vendorId, vendorName: 'Porto Paper', date: '2025-03-20', dueDate: '2025-04-30', status: 'approved' as const,
        amountCents: 50_000, amountPaidCents: 0, currency: 'EUR', exchangeRate: 1.1, splits: [{ accountId: acct['6000'].id, amountCents: 50_000, description: 'Paper' }] };
      await postBillLedger(bill.id, bill as never, ws, OWNER, { collection: 'bills', docId: bill.id, action: 'create', data: bill }, await context(ws, acct));
      assert.equal((await send('POST', '/api/v1/transactions/revaluation/run', { workspaceId: ws, date: '2025-03-31', rates: { EUR: 1.15 } })).status, 200);
      const pay = (side: 'invoice' | 'bill', documentId: string, date: string, cents: number, rate: number) => send('POST', '/api/v1/payments', {
        workspaceId: ws, amountCents: cents, paymentDate: date, cashAccountId: acct['1000'].id, paymentMethod: 'bank_transfer', paymentExchangeRate: rate,
        ...(side === 'invoice' ? { customerId } : { vendorId }), allocations: [{ documentId, documentType: side, amountCents: cents }],
      });
      assert.equal((await pay('invoice', inv.id, '2025-04-15', 100_000, 1.12)).status, 200);
      assert.equal((await pay('bill', bill.id, '2025-04-20', 50_000, 1.08)).status, 200);

      const dates = [...monthEnds('2025-02-01', '2025-06-30'), '2025-04-01'].sort();
      await equalityWithAndWithout(ws, dates, ['2025-03-31', '2025-04-01', '2025-04-15']);
      const april = await svc.balancesAsOf(db, ws, '2025-04-30');
      assert.deepEqual([april.accounts[acct['1000'].id], april.retainedEarnings, april.accounts[acct['1100'].id] || 0], [58_000, 58_000, 0], 'the gold figures: Checking 58,000 = profit 58,000');
    });
  });
});
