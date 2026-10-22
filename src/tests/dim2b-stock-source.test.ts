/**
 * DIM-2 phase 2 (GitHub #132): where stock came from is kept with the move when it is received. A bill's units keep
 * the bill line they came in on and the vendor; units sent back to the vendor keep the bill (and line) they go back
 * from; a reversal keeps its original's. Through the app's own bill and vendor credit postings and the real server.
 *
 * Worked units: bill B-1 from Furniture Co has a service line (line 1, no stock) and 4 chairs at 10.00 (line 2).
 * The chairs' move keeps line index 1 ("line 2") and vendor v1. Vendor credit VC-1 sends 2 back from that line:
 * its move keeps line index 1, bill B-1 and vendor v1; voiding the credit brings them back with the same source.
 * The database part runs when LF_TEST_DATABASE_URL is set.
 */
import './helpers/dom';
import test, { after, before, describe } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'crypto';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { postBillLedger } from '../services/ledgerPost/billPosting';
import { postVendorCreditLedger } from '../services/ledgerPost/creditPosting';
import type { LedgerPostContext } from '../services/ledgerPost/postingKit';
import { stockTrail, type StockTrailDocs } from '../lib/stockTrail';
import type { StockMove } from '../lib/stockMoves';
import type { Bill, ChartAccount, Transaction, VendorCredit, Workspace } from '../types';
// the browser's posting host (stores + upload), as LedgerPostService registers it in the app (L-94)
import '../services/ledgerPost/postingKit';

const move = (over: Partial<StockMove>): StockMove => ({
  workspaceId: 'w', itemId: 'chair', date: '2026-04-01', kind: 'purchase', quantity: 4, quantityBefore: 0, quantityAfter: 4,
  unitCostCents: 1000, valueCents: 4000, seq: '1', uid: 'u', createdAt: '', ...over,
});
const docs: StockTrailDocs = {
  bills: [{ id: 'b1', number: 'B-1', vendorId: 'v1' }], invoices: [], creditNotes: [], vendorCredits: [{ id: 'vc1', number: 'VC-1', vendorId: 'v1' }],
  orders: [], purchaseOrders: [], transactions: [], vendors: [{ id: 'v1', name: 'Furniture Co' }], customers: [],
};

test('the trail names the bill line, the bill a return went back from, and the vendor kept with the move', () => {
  const [bought, back] = stockTrail([
    move({ documentType: 'bill', documentId: 'b1', documentLine: 1, vendorId: 'v1' }),
    move({ kind: 'purchase-return', quantity: -2, quantityBefore: 4, quantityAfter: 2, valueCents: -2000, documentType: 'vendor-credit', documentId: 'vc1', documentLine: 1, vendorId: 'v1', sourceBillId: 'b1', seq: '2' }),
  ], docs).steps;
  assert.deepEqual([bought.party?.name, bought.document?.label, bought.sourceLine], ['Furniture Co', 'Bill B-1', 'line 2']);
  assert.deepEqual([back.party?.name, back.document?.label, back.sourceLine], ['Furniture Co', 'Vendor credit VC-1', 'from Bill B-1, line 2']);
  // the bill is gone: the link is still missing, but the vendor kept with the move still names the source
  const lost = stockTrail([move({ documentType: 'bill', documentId: 'b9', vendorId: 'v1' })], docs).steps[0];
  assert.deepEqual([lost.origin, lost.party?.name, lost.missing], ['missing', 'Furniture Co', ['The bill it names (b9) is not in the books.']]);
});

const url = process.env.LF_TEST_DATABASE_URL;

describe('Where stock came from, kept when it is received', { skip: !url && 'LF_TEST_DATABASE_URL not set' }, () => {
  const ws = `ws_dim2b_${crypto.randomBytes(4).toString('hex')}`;
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
  const moves = async () => (await db.collection('stockMoves').where('workspaceId', '==', ws).get()).docs.map(d => d.data() as StockMove).sort((a, b) => String(a.seq).localeCompare(String(b.seq)));
  const credit = (status: VendorCredit['status']): Partial<VendorCredit> => ({
    id: creditId, workspaceId: ws, vendorId: 'v1', vendorName: 'Furniture Co', number: 'VC-1', billId, amountCents: 2000, remainingCents: 2000, date: '2026-04-10', status, currency: 'USD',
    returnedGoods: [{ billLine: 1, itemId, quantity: 2, valueCents: 2000 }],
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
    await db.collection('vendorCredits').doc(creditId).set({ workspaceId: ws, number: 'VC-1', status: 'draft', amountCents: 2000, vendorId: 'v1', uid: OWNER });
    const app = express();
    app.use(express.json());
    app.use((req, _res, next) => { (req as unknown as { user: { uid: string; email: string } }).user = { uid: String(req.header('x-test-uid')), email: 'owner@shop.test' }; next(); });
    app.use('/api/v1/transactions', transactionRouter);
    app.use('/api/v1/documents', (await import('../server/routes/documentPostRoutes')).documentPostRouter);
    server = app.listen(0);
    const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const target = String(input);
      if (!target.startsWith('/')) return realFetch(input, init);
      return realFetch(`${base}${target}`, { ...init, headers: { ...(init?.headers as Record<string, string> || {}), 'x-test-uid': OWNER } });
    }) as typeof fetch;
    // line 1: a service (no stock); line 2: 4 chairs at 10.00
    const data: Partial<Bill> = { id: billId, workspaceId: ws, number: 'B-1', vendorId: 'v1', vendorName: 'Furniture Co', date: '2026-04-01', dueDate: '2026-05-01', status: 'pending', currency: 'USD', amountCents: 4500,
      splits: [{ amountCents: 500, accountId: `${ws}_office`, description: 'Assembly' }, { amountCents: 4000, accountId: `${ws}_office`, description: 'Chairs', itemId, quantity: 4 }] };
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

  test('the chairs keep bill B-1\'s line 2 and the vendor', async () => {
    const [bought] = await moves();
    assert.deepEqual([bought.kind, bought.quantity, bought.documentType, bought.documentId, bought.documentLine, bought.vendorId], ['purchase', 4, 'bill', billId, 1, 'v1']);
  });

  test('2 sent back keep the bill and line they go back from; voiding the credit brings them back with the same source', async () => {
    await postCredit(credit('open'));
    const back = (await moves()).find(m => m.kind === 'purchase-return')!;
    assert.deepEqual([back.quantity, back.documentType, back.documentLine, back.sourceBillId, back.vendorId], [-2, 'vendor-credit', 1, billId, 'v1']);
    // the vendor credit's entry names the bill under its own key, never as metadata.billId (that is the bill's own entry)
    const entry = (await db.collection('transactions').where('workspaceId', '==', ws).where('metadata.vendorCreditId', '==', creditId).get()).docs[0].data();
    assert.deepEqual([entry.metadata.billId, entry.metadata.returnsFromBillId], [undefined, billId]);
    await postCredit(credit('void'));
    const undone = (await moves()).find(m => m.kind === 'purchase-return-reversal')!;
    assert.deepEqual([undone.quantity, undone.documentLine, undone.sourceBillId, undone.vendorId], [2, 1, billId, 'v1']);
  });
});
