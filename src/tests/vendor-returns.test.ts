/**
 * Purchase returns (BF-07): the bill's stock lines and what can still go back; the value of what goes
 * back (the line's cost per unit, the exact remainder when the rest goes); and, through the app's own
 * bill and vendor credit postings and the real server, the units leave stock at that value, come off
 * Inventory instead of the expense, are in the stock history, and come back when the credit is voided.
 */
import './helpers/dom';
import test, { after, before, describe } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'crypto';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { returnableBillLines, returnValue, vendorReturnLines, vendorReturnProblem } from '../lib/vendorReturns';
import { postBillLedger } from '../services/ledgerPost/billPosting';
import { postVendorCreditLedger } from '../services/ledgerPost/creditPosting';
import type { LedgerPostContext } from '../services/ledgerPost/postingKit';
import type { Bill, ChartAccount, Transaction, VendorCredit, Workspace } from '../types';
// the browser's posting host (stores + upload), as LedgerPostService registers it in the app (L-94)
import '../services/ledgerPost/postingKit';

const bill = { id: 'b1', splits: [
  { amountCents: 3000, accountId: 'x', description: 'Chairs', itemId: 'chair', quantity: 3 },
  { amountCents: 500, accountId: 'x', description: 'Freight', landedCost: true },
  { amountCents: 1000, accountId: 'x', description: 'Service' },
] } as unknown as Bill;

describe('What can go back', () => {
  test('the bill\'s stock lines less earlier credits; the value at the line\'s cost, the remainder last', () => {
    const credits = [
      { id: 'c1', billId: 'b1', status: 'open', returnedGoods: [{ billLine: 0, itemId: 'chair', quantity: 1, valueCents: 1000 }] },
      { id: 'c2', billId: 'b1', status: 'void', returnedGoods: [{ billLine: 0, itemId: 'chair', quantity: 2, valueCents: 2000 }] },
    ] as VendorCredit[];
    const lines = returnableBillLines(bill, credits);
    assert.deepEqual(lines.map(l => [l.billLine, l.itemId, l.quantity, l.amountCents, l.returned, l.returnedCents]), [[0, 'chair', 3, 3000, 1, 1000]], 'the void credit does not count');
    assert.equal(returnValue({ ...lines[0], amountCents: 1000, returned: 0, returnedCents: 0 }, 1), 333);
    assert.equal(returnValue({ ...lines[0], amountCents: 1000, returned: 1, returnedCents: 333 }, 2), 667, 'the rest takes what is left');
    const returns = vendorReturnLines(lines, { 0: 2 });
    assert.deepEqual(returns, [{ billLine: 0, itemId: 'chair', quantity: 2, valueCents: 2000 }]);
    assert.equal(vendorReturnProblem(lines, returns, 2000), null);
    assert.match(String(vendorReturnProblem(lines, vendorReturnLines(lines, { 0: 3 }), 5000)), /only 2 of 3/);
    assert.match(String(vendorReturnProblem(lines, returns, 2500, 600)), /worth more than the credit/);
  });
});

const url = process.env.LF_TEST_DATABASE_URL;

describe('Sending stock back', { skip: !url && 'LF_TEST_DATABASE_URL not set' }, () => {
  const ws = `ws_vreturn_${crypto.randomBytes(4).toString('hex')}`;
  const OWNER = 'owner-1';
  const billId = `${ws}_bill1`;
  const creditId = `${ws}_vc1`;
  const itemId = `${ws}_chair`;
  let server: Server;
  let db: import('../server/db/pgFirestore').Firestore;
  const realFetch = globalThis.fetch;
  const accounts: ChartAccount[] = [];
  const context = async (): Promise<LedgerPostContext> => ({
    accounts, lockDate: null, uid: OWNER, inventory: [],
    transactions: (await db.collection('transactions').where('workspaceId', '==', ws).get()).docs.map(d => ({ ...d.data(), id: d.id }) as Transaction),
    workspaces: [{ id: ws, uid: OWNER, name: 'Shop', currency: 'USD' } as Workspace],
  });
  const item = async () => (await db.collection('inventory').doc(itemId).get()).data()!;
  const balance = async (accountId: string) => (await db.collection('transactions').where('workspaceId', '==', ws).get()).docs
    .map(d => d.data() as Transaction).filter(t => t.status === 'completed').flatMap(t => t.lines || []).filter(l => l.accountId === accountId).reduce((s, l) => s + l.amountCents, 0);
  const credit = (status: VendorCredit['status'], returnedGoods: VendorCredit['returnedGoods']): Partial<VendorCredit> => ({
    id: creditId, workspaceId: ws, vendorId: 'v1', vendorName: 'Furniture Co', number: 'VC-1', billId, amountCents: 2500, remainingCents: 2500, date: '2026-04-10', status, currency: 'USD', returnedGoods,
  });
  const postCredit = async (data: Partial<VendorCredit>) => postVendorCreditLedger(creditId, data, ws, OWNER, { collection: 'vendorCredits', docId: creditId, action: 'update', data }, await context());

  before(async () => {
    process.env.DATABASE_URL = url;
    const express = (await import('express')).default;
    const { transactionRouter } = await import('../server/routes/transactionRoutes');
    const { getDb } = await import('../server/db/firestore');
    db = getDb();
    await db.collection('workspaces').doc(ws).set({ uid: OWNER, name: 'Shop', currency: 'USD', timezone: 'UTC', members: [OWNER] });
    for (const [id, name, type, code] of [['ap', 'Accounts Payable', 'liability', '2000'], ['inv', 'Inventory', 'asset', '1300'], ['office', 'Office expenses', 'expense', '6000'], ['cash', 'Checking', 'asset', '1000']]) {
      const data = { workspaceId: ws, name, type, code, ...(id === 'ap' ? { category: 'Payables' } : {}), ...(id === 'inv' ? { category: 'Inventory', role: 'inventory' } : {}), ...(id === 'cash' ? { category: 'Cash', role: 'cash' } : {}) };
      await db.collection('chartAccounts').doc(`${ws}_${id}`).set(data);
      accounts.push({ ...data, id: `${ws}_${id}` } as unknown as ChartAccount);
    }
    await db.collection('inventory').doc(itemId).set({ workspaceId: ws, name: 'Chair', sku: 'CH', quantityAtHand: 0, unitCostCents: 0, uid: OWNER });
    await db.collection('bills').doc(billId).set({ workspaceId: ws, number: 'B-1', status: 'draft', amountCents: 0, uid: OWNER });
    await db.collection('vendorCredits').doc(creditId).set({ workspaceId: ws, number: 'VC-1', status: 'draft', amountCents: 2500, vendorId: 'v1', uid: OWNER });
    const app = express();
    app.use(express.json());
    app.use((req, _res, next) => { (req as unknown as { user: { uid: string; email: string } }).user = { uid: String(req.header('x-test-uid')), email: 'owner@shop.test' }; next(); });
    app.use('/api/v1/transactions', transactionRouter);
    server = app.listen(0);
    const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const target = String(input);
      if (!target.startsWith('/')) return realFetch(input, init);
      return realFetch(`${base}${target}`, { ...init, headers: { ...(init?.headers as Record<string, string> || {}), 'x-test-uid': OWNER } });
    }) as typeof fetch;
    // 4 chairs at 10.00 come in on the bill
    const data: Partial<Bill> = { id: billId, workspaceId: ws, number: 'B-1', vendorName: 'Furniture Co', date: '2026-04-01', dueDate: '2026-05-01', status: 'pending', currency: 'USD', amountCents: 4000,
      splits: [{ amountCents: 4000, accountId: `${ws}_office`, description: 'Chairs', itemId, quantity: 4 }] };
    await postBillLedger(billId, data, ws, OWNER, { collection: 'bills', docId: billId, action: 'update', data }, await context());
  });

  after(async () => {
    globalThis.fetch = realFetch;
    server?.close();
    for (const table of ['transactions', 'bills', 'vendorCredits', 'inventory', 'stockMoves', 'chartAccounts', 'auditLogs', 'idempotencyKeys', 'workspaces']) {
      await db.pool.query(`delete from public."${table}" where workspace_id = $1 or id = $1`, [ws]);
    }
    const { getSupabase } = await import('../lib/db/client');
    getSupabase().realtime.disconnect();
    await getSupabase().auth.dispose();
    await db.terminate();
  });

  test('2 chairs go back on a 25.00 credit: 20.00 off Inventory, 5.00 off the expense, the units leave stock', async () => {
    assert.deepEqual([(await item()).quantityAtHand, (await item()).unitCostCents], [4, 1000]);
    await postCredit(credit('open', [{ billLine: 0, itemId, quantity: 2, valueCents: 2000 }]));
    const chair = await item();
    assert.deepEqual([chair.quantityAtHand, chair.unitCostCents], [2, 1000], '(40.00 − 20.00) / 2 stays 10.00');
    assert.deepEqual([await balance(`${ws}_inv`), await balance(`${ws}_office`), await balance(`${ws}_ap`)], [2000, -500, -1500]);
    const moves = (await db.collection('stockMoves').where('workspaceId', '==', ws).get()).docs.map(d => d.data()).sort((a, b) => String(a.seq).localeCompare(String(b.seq)));
    assert.deepEqual(moves.map(m => [m.kind, m.quantity, m.quantityAfter, m.valueCents, m.documentType]), [['purchase', 4, 4, 4000, 'bill'], ['purchase-return', -2, 2, -2000, 'vendor-credit']]);
  });

  test('voiding the credit brings the units back; goods worth more than the credit are refused', async () => {
    await postCredit(credit('void', [{ billLine: 0, itemId, quantity: 2, valueCents: 2000 }]));
    assert.deepEqual([(await item()).quantityAtHand, await balance(`${ws}_inv`)], [4, 4000]);
    const kinds = (await db.collection('stockMoves').where('workspaceId', '==', ws).get()).docs.map(d => d.data()).sort((a, b) => String(a.seq).localeCompare(String(b.seq))).map(m => m.kind);
    assert.deepEqual(kinds, ['purchase', 'purchase-return', 'purchase-return-reversal']);
    await assert.rejects(postCredit({ ...credit('open', [{ billLine: 0, itemId, quantity: 3, valueCents: 3000 }]), amountCents: 2500 }), /worth more than the credit/);
  });
});
