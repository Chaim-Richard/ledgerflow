/**
 * EG-1 step 1 (docs/design/EG-1-repost-engine.md): stock cost after a backdated purchase, end to end against a real
 * database. Bills and the invoice are posted by the app's own posting code through the real routes
 * (commitLedgerBulk), the repost runs through POST /api/v1/repost. Needs LF_TEST_DATABASE_URL.
 *
 * Worked figures (cents), one item, all periods open:
 *   Bill A  01-05  10 @ 1,000                   → 10 on hand, average 1,000, Inventory 10,000
 *   Invoice 01-10  5 sold at 1,000              → COGS 5,000, 5 on hand, Inventory 5,000
 *   Bill B  01-03  10 @ 2,000 (posted last)     → average today (5 × 1,000 + 20,000) / 15 = 1,667, Inventory 25,000
 *   the queue row is marked from 01-03 (a later stock move exists)
 *   replay in date order: 01-03 10 @ 2,000 → 01-05 20 units, (20,000 + 10,000) / 20 = 1,500 → 01-10 5 × 1,500 = 7,500
 *   repost: DR COGS 2,500 / CR Inventory 2,500 dated 01-10 → COGS 7,500, Inventory 22,500 = 15 × 1,500, cost 1,500
 *   a second run posts nothing. As of 01-07 the stock history shows 20 units (Bill B counts on its own date).
 *   Bill C  01-04  10 @ 1,800 (posted after the run) → replay: 01-04 (20,000 + 18,000) / 20 = 1,900 → 01-05
 *     (38,000 + 10,000) / 30 = 1,600 → sale 5 × 1,600 = 8,000; already in the books 5,000 + 2,500 = 7,500 → posts +500
 *     (not +3,000) → COGS 8,000, Inventory 40,000 = 25 × 1,600.
 * Locked through 01-10 (a second item, same figures, the sale labelled project P-7): the correction is dated today
 * (the reversalDate rule) with the sale's accounts and labels; with strictLock the run is refused (409, blocked by
 * 2026-01-10) and posts nothing.
 * A backdated sale (bolts): Bill 01-05 10 @ 1,000, Bill 01-20 10 @ 2,000 (average 1,500), then an invoice dated 01-10
 *   for 5, priced today at 1,500 = 7,500 → marked from 01-10 → replay 5 × 1,000 = 5,000: −2,500; cost (5 × 1,000 +
 *   20,000) / 15 = 1,667.
 * A customer return (sprockets): the worked figures plus 2 returned on 01-12 at the sale's cost 1,000 = 2,000 → replay
 *   values it at 2 × 1,500 = 3,000: +1,000 to Inventory → COGS 7,500 − 3,000 = 4,500, Inventory 25,500 = 17 × 1,500.
 * No opening basis (gizmos): 5 already on hand before the history was kept → refused, "history incomplete".
 */
import './helpers/dom';
import test, { after, before, describe } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'crypto';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { postBillLedger } from '../services/ledgerPost/billPosting';
import { postInvoiceLedger } from '../services/ledgerPost/invoicePosting';
import type { LedgerPostContext } from '../services/ledgerPost/postingKit';
import type { ChartAccount, InventoryItem, Transaction, Workspace } from '../types';
import type { StockMove } from '../lib/stockMoves';
import { planReturnEntries } from '../lib/salesReturns';
import { commitAsServer } from './helpers/serverCommit';
// the browser's posting host (stores + upload), as LedgerPostService registers it in the app (L-94)
import '../services/ledgerPost/postingKit';

const url = process.env.LF_TEST_DATABASE_URL;

type Json = Record<string, unknown> & { keys?: Array<Record<string, unknown> & { corrections: Array<Record<string, number | string | boolean>> }> };

describe('EG-1 step 1: stock cost after a backdated purchase', { skip: !url && 'LF_TEST_DATABASE_URL not set' }, () => {
  const ws = `ws_eg1_${crypto.randomBytes(4).toString('hex')}`;
  const OWNER = 'owner-1';
  const widget = `${ws}_widget`;
  const gadget = `${ws}_gadget`;
  const bolt = `${ws}_bolt`;
  const sprocket = `${ws}_sprocket`;
  const gizmo = `${ws}_gizmo`;
  const ITEMS: Array<[string, string, number]> = [[widget, 'Widget', 0], [gadget, 'Gadget', 0], [bolt, 'Bolt', 0], [sprocket, 'Sprocket', 0], [gizmo, 'Gizmo', 5]];
  let server: Server;
  let base = '';
  let db: import('../server/db/pgFirestore').Firestore;
  const realFetch = globalThis.fetch;
  const acct: Record<string, ChartAccount> = {};
  const send = async (method: string, path: string, body?: unknown, uid = OWNER) => {
    const res = await realFetch(`${base}${path}`, { method, headers: { 'content-type': 'application/json', 'x-test-uid': uid }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
    return { status: res.status, body: await res.json().catch(() => ({})) as Json };
  };
  const repost = (body: Record<string, unknown>, uid = OWNER) => send('POST', '/api/v1/repost', { workspaceId: ws, ...body }, uid);
  const all = async <T>(collection: string) => (await db.collection(collection).where('workspaceId', '==', ws).get()).docs.map(d => ({ ...d.data(), id: d.id }) as T);
  const item = async (id: string) => ({ ...(await db.collection('inventory').doc(id).get()).data(), id }) as InventoryItem;
  const context = async (): Promise<LedgerPostContext> => ({
    accounts: Object.values(acct), lockDate: null, uid: OWNER, inventory: await Promise.all(ITEMS.map(([id]) => item(id))),
    transactions: await all<Transaction>('transactions'),
    workspaces: [{ id: ws, uid: OWNER, name: 'Widget Shop', currency: 'USD' } as Workspace],
  });
  const balance = async (code: string, itemId?: string) => (await all<Transaction>('transactions'))
    .filter(t => ['completed', 'approved', 'posted'].includes(String(t.status)))
    .filter(t => !itemId || [t.metadata?.itemId, t.metadata?.inventoryItemId, ...((t.metadata?.stockIn as Array<{ itemId: string }> | undefined) || []).map(l => l.itemId)].includes(itemId))
    .flatMap(t => t.lines || []).filter(l => l.accountId === acct[code].id).reduce((s, l) => s + l.amountCents, 0);
  const bill = async (id: string, itemId: string, date: string, quantity: number, unitCents: number) => {
    const data = {
      id, workspaceId: ws, uid: OWNER, number: id.slice(-3), vendorId: 'v', vendorName: 'Supplier', date, dueDate: date, status: 'pending' as const, currency: 'USD',
      amountCents: quantity * unitCents, splits: [{ amountCents: quantity * unitCents, accountId: acct['1300'].id, description: 'Stock', itemId, quantity }],
    };
    await postBillLedger(id, data as never, ws, OWNER, { collection: 'bills', docId: id, action: 'update', data }, await context());
  };
  const invoice = async (id: string, itemId: string, date: string, quantity: number, dimensions?: Record<string, string>) => {
    const data = {
      id, workspaceId: ws, uid: OWNER, number: id.slice(-4), customerId: 'acme', customerName: 'Acme', date, dueDate: date, status: 'sent' as const,
      amountCents: quantity * 3_000, amountPaidCents: 0, currency: 'USD', taxVersion: 2, taxAmountCents: 0,
      items: [{ id: 'l1', itemId, description: 'Stock', quantity, rateCents: 3_000, amountCents: quantity * 3_000, accountId: acct['4000'].id, ...(dimensions ? { dimensions } : {}) }],
    };
    await postInvoiceLedger(id, data as never, ws, OWNER, { collection: 'invoices', docId: id, action: 'create', data }, await context());
  };
  const queueRow = async (itemId: string) => (await db.collection('repostQueue').doc(`${ws}_stock-cost_${itemId}`).get()).data();
  /** the three postings of the worked figures, Bill B last */
  const scenario = async (itemId: string, tag: string, dimensions?: Record<string, string>) => {
    await bill(`${ws}_${tag}_bA`, itemId, '2026-01-05', 10, 1_000);
    await invoice(`${ws}_${tag}_inv`, itemId, '2026-01-10', 5, dimensions);
    assert.equal(await queueRow(itemId), undefined, 'nothing backdated yet: nothing marked');
    await bill(`${ws}_${tag}_bB`, itemId, '2026-01-03', 10, 2_000);
  };

  before(async () => {
    process.env.DATABASE_URL = url;
    const express = (await import('express')).default;
    const { workspaceRouter } = await import('../server/routes/workspaceRoutes');
    const { transactionRouter } = await import('../server/routes/transactionRoutes');
    const { repostRouter } = await import('../server/routes/repostRoutes');
    const { getDb } = await import('../server/db/firestore');
    db = getDb();
    await db.collection('workspaces').doc(ws).set({ uid: OWNER, name: 'Widget Shop', currency: 'USD', timezone: 'UTC', members: [OWNER, 'acct', 'book', 'view'], roles: { acct: 'accountant', book: 'bookkeeper', view: 'viewer' } });
    const app = express();
    app.use(express.json());
    app.use((req, _res, next) => { (req as unknown as { user: { uid: string; email: string } }).user = { uid: String(req.header('x-test-uid')), email: 'owner@widgets.test' }; next(); });
    app.use('/api/v1/workspaces', workspaceRouter);
    app.use('/api/v1/transactions', transactionRouter);
    app.use('/api/v1/documents', (await import('../server/routes/documentPostRoutes')).documentPostRouter);
    app.use('/api/v1/repost', repostRouter);
    server = app.listen(0);
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const target = String(input);
      if (!target.startsWith('/')) return realFetch(input, init);
      return realFetch(`${base}${target}`, { ...init, headers: { ...(init?.headers as Record<string, string> || {}), 'x-test-uid': OWNER } });
    }) as typeof fetch;
    const accounts = await send('POST', `/api/v1/workspaces/${ws}/import-records`, { kind: 'accounts', rows: [
      { name: 'Checking', code: '1000', type: 'Bank' },
      { name: 'Accounts Receivable', code: '1100', type: 'Accounts receivable' },
      { name: 'Inventory', code: '1300', type: 'Inventory' },
      { name: 'Accounts Payable', code: '2000', type: 'Accounts payable' },
      { name: 'Sales', code: '4000', type: 'Income' },
      { name: 'Cost of goods sold', code: '5000', type: 'Cost of goods sold' },
      { name: 'Office expenses', code: '6000', type: 'Expense' },
    ] });
    assert.equal(accounts.status, 200, JSON.stringify(accounts.body));
    for (const a of await all<ChartAccount>('chartAccounts')) acct[String(a.code)] = a;
    for (const [id, name, onHand] of ITEMS) {
      await db.collection('inventory').doc(id).set({ workspaceId: ws, name, sku: name.toUpperCase(), itemType: 'stock', quantityAtHand: onHand, unitCostCents: onHand ? 1_000 : 0, unitPriceCents: 3_000, reorderPoint: 0, uid: OWNER });
    }
  });

  after(async () => {
    globalThis.fetch = realFetch;
    server?.close();
    for (const table of ['transactions', 'bills', 'invoices', 'inventory', 'stockMoves', 'repostQueue', 'chartAccounts', 'auditLogs', 'idempotencyKeys', 'workspaces']) {
      await db.pool.query(`delete from public."${table}" where workspace_id = $1 or id = $1`, [ws]).catch(() => {});
    }
    const { getSupabase } = await import('../lib/db/client');
    getSupabase().realtime.disconnect();
    await getSupabase().auth.dispose();
    await db.terminate();
  });

  test('the worked figures: marked from 01-03, a dry run shows +25.00, the run posts it on 01-10, a second run posts nothing', async () => {
    await scenario(widget, 'w');
    assert.equal(await balance('5000', widget), 5_000, 'COGS 50.00 at the average of the day it was posted');
    assert.deepEqual([(await item(widget)).quantityAtHand, (await item(widget)).unitCostCents], [15, 1_667], '(5 × 10.00 + 200.00) / 15');
    assert.equal(await balance('1300', widget), 25_000);
    const row = await queueRow(widget);
    assert.deepEqual([row?.status, row?.fromDate, row?.kind, row?.key], ['dirty', '2026-01-03', 'stock-cost', widget]);
    assert.ok((row?.cause as string[]).length >= 1, 'the cause names Bill B\'s entry');

    for (const uid of ['view', 'book']) assert.equal((await repost({ runId: `refused-${uid}-run` }, uid)).status, 403, `${uid} may not repost`);

    const before = (await all<Transaction>('transactions')).length;
    const dry = await repost({ runId: 'dry-run-0001', dryRun: true, keys: [widget] }, 'acct');
    assert.equal(dry.status, 200, JSON.stringify(dry.body));
    assert.deepEqual(dry.body.keys![0].corrections.map(c => [c.date, c.beforeCents, c.afterCents, c.deltaCents, c.movedToOpenDay]), [['2026-01-10', 5_000, 7_500, 2_500, false]]);
    assert.equal((await all<Transaction>('transactions')).length, before, 'a dry run posts nothing');
    assert.equal((await queueRow(widget))?.status, 'dirty');

    const run = await repost({ runId: 'run-widget-0001', keys: [widget] });
    assert.equal(run.status, 200, JSON.stringify(run.body));
    assert.equal(run.body.posted, 1);
    const fixes = (await all<Transaction>('transactions')).filter(t => t.metadata?.type === 'repost-cogs-adjust' && t.metadata?.itemId === widget);
    const sale = (await all<Transaction>('transactions')).find(t => t.metadata?.type === 'invoice-cogs-auto' && t.metadata?.inventoryItemId === widget)!;
    assert.equal(fixes.length, 1);
    assert.deepEqual([fixes[0].id, fixes[0].date, fixes[0].metadata?.correctsTxId], [`repost-stock-cost-${widget}-${sale.id}-0`, '2026-01-10', sale.id]);
    assert.deepEqual(fixes[0].lines.map(l => [l.accountId, l.amountCents]), [[acct['5000'].id, 2_500], [acct['1300'].id, -2_500]]);
    assert.equal(await balance('5000', widget), 7_500);
    assert.equal(await balance('1300', widget), 22_500, '15 × 15.00');
    assert.deepEqual([(await item(widget)).quantityAtHand, (await item(widget)).unitCostCents], [15, 1_500]);
    const moves = (await all<Record<string, unknown>>('stockMoves')).filter(m => m.itemId === widget);
    const fix = moves.find(m => m.kind === 'cost-repost');
    assert.deepEqual(fix && [fix.quantity, fix.valueCents, fix.transactionId, fix.correctsTxId], [0, -2_500, fixes[0].id, sale.id]);
    assert.equal(moves.reduce((s, m) => s + Number(m.valueCents), 0), 22_500, 'the stock ledger equals the Inventory account');
    assert.deepEqual([(await queueRow(widget))?.status, (await queueRow(widget))?.runId], ['clean', 'run-widget-0001']);

    // the audit row: before, after and the difference
    const audits = (await all<Record<string, unknown> & { details: Record<string, unknown> }>('auditLogs')).filter(a => a.action === 'repost');
    const keyAudit = audits.find(a => a.entityType === 'stock-cost' && a.entityId === widget)!;
    assert.deepEqual((keyAudit.details.corrections as Array<Record<string, unknown>>).map(c => [c.correctsTxId, c.beforeCents, c.afterCents, c.deltaCents]), [[sale.id, 5_000, 7_500, 2_500]]);
    assert.deepEqual(keyAudit.details.state, {
      before: { unitCostCents: 1_667, quantityAtHand: 15, inventoryValueCents: 25_005 },
      after: { unitCostCents: 1_500, quantityAtHand: 15, inventoryValueCents: 22_500 },
    });
    assert.ok(audits.some(a => a.entityType === 'repostRun' && a.entityId === 'run-widget-0001'), 'one summary row per run');

    const count = (await all<Transaction>('transactions')).length;
    const again = await repost({ runId: 'run-widget-0002', keys: [widget] });
    assert.deepEqual([again.status, again.body.posted], [200, 0]);
    const retry = await repost({ runId: 'run-widget-0001', keys: [widget] });
    assert.deepEqual([retry.status, retry.body.posted], [200, 0]);
    assert.equal((await all<Transaction>('transactions')).length, count, 'running again posts nothing');

    // finding 7: the stock history as of 01-07 counts Bill B on its own date
    const { itemDetails } = await import('../lib/stockMoves');
    const history = (await all<StockMove>('stockMoves')).filter(m => m.itemId === widget);
    assert.equal(itemDetails(history, '2026-01-01', '2026-01-07')[0].closing.quantity, 20, 'as of 01-07: 10 (01-03) + 10 (01-05)');
    assert.deepEqual(itemDetails(history, '2026-01-01', '2026-01-31')[0].moves.map(m => [m.date, m.kind, m.quantityAfter]),
      [['2026-01-03', 'purchase', 10], ['2026-01-05', 'purchase', 20], ['2026-01-10', 'sale', 15], ['2026-01-10', 'cost-repost', 15]]);

    // finding 3: another backdated bill; only what remains after the first correction is posted
    await bill(`${ws}_w_bC`, widget, '2026-01-04', 10, 1_800);
    assert.deepEqual([(await queueRow(widget))?.status, (await queueRow(widget))?.fromDate], ['dirty', '2026-01-04'], 'a clean row dirtied again starts from the new cause');
    const third = await repost({ runId: 'run-widget-0003', keys: [widget] });
    assert.equal(third.status, 200, JSON.stringify(third.body));
    assert.deepEqual(third.body.keys![0].corrections.map(c => [c.entryId, c.beforeCents, c.afterCents, c.deltaCents]), [[`repost-stock-cost-${widget}-${sale.id}-1`, 7_500, 8_000, 500]]);
    assert.equal(await balance('5000', widget), 8_000);
    assert.equal(await balance('1300', widget), 40_000, '25 × 16.00');
    assert.deepEqual([(await item(widget)).quantityAtHand, (await item(widget)).unitCostCents], [25, 1_600]);
  });

  test('01-10 locked: strictLock refuses and posts nothing; without it the correction is dated today, with the sale\'s labels', async () => {
    await scenario(gadget, 'g', { project: 'P-7' });
    const today = new Date().toISOString().slice(0, 10);
    await db.collection('workspaces').doc(ws).update({ lockDate: '2026-01-10' });
    try {
      const count = (await all<Transaction>('transactions')).length;
      const strict = await repost({ runId: 'run-gadget-strict', keys: [gadget], strictLock: true });
      assert.equal(strict.status, 409, JSON.stringify(strict.body));
      assert.equal((await all<Transaction>('transactions')).length, count, 'refused: nothing posted');
      assert.deepEqual([(await queueRow(gadget))?.status, (await queueRow(gadget))?.blockedBy], ['blocked', '2026-01-10']);
      assert.equal((await item(gadget)).unitCostCents, 1_667, 'refused: the cost is as it was');

      const run = await repost({ runId: 'run-gadget-0001', keys: [gadget] }, 'acct');
      assert.equal(run.status, 200, JSON.stringify(run.body));
      assert.deepEqual(run.body.keys![0].corrections.map(c => [c.entryDate, c.date, c.deltaCents, c.movedToOpenDay]), [['2026-01-10', today, 2_500, true]]);
      const fix = (await all<Transaction>('transactions')).find(t => t.metadata?.type === 'repost-cogs-adjust' && t.metadata?.itemId === gadget)!;
      assert.equal(fix.date, today, 'the locked day falls back to today, as reversalDate does');
      // finding 8: the sale's accounts and labels
      const sale = (await all<Transaction>('transactions')).find(t => t.metadata?.type === 'invoice-cogs-auto' && t.metadata?.inventoryItemId === gadget)!;
      assert.deepEqual(sale.lines.map(l => l.dimensions?.project), ['P-7', undefined], 'the sale\'s cost line carries the project');
      assert.deepEqual(fix.lines.map(l => [l.accountId, l.amountCents, l.dimensions?.project]), sale.lines.map(l => [l.accountId, Math.sign(l.amountCents) * 2_500, l.dimensions?.project]));
      assert.equal(await balance('5000', gadget), 7_500);
      assert.equal((await item(gadget)).unitCostCents, 1_500);
      assert.equal((await queueRow(gadget))?.status, 'clean');
    } finally {
      await db.collection('workspaces').doc(ws).update({ lockDate: null });
    }
  });

  test('finding 1: a backdated sale marks the item too, and is repriced at the average of its own date', async () => {
    await bill(`${ws}_b_b1`, bolt, '2026-01-05', 10, 1_000);
    await bill(`${ws}_b_b2`, bolt, '2026-01-20', 10, 2_000);
    await invoice(`${ws}_b_inv`, bolt, '2026-01-10', 5);
    assert.equal(await balance('5000', bolt), 7_500, 'priced at today\'s 15.00');
    assert.deepEqual([(await queueRow(bolt))?.status, (await queueRow(bolt))?.fromDate], ['dirty', '2026-01-10']);
    const run = await repost({ runId: 'run-bolt-0001', keys: [bolt] });
    assert.equal(run.status, 200, JSON.stringify(run.body));
    assert.deepEqual(run.body.keys![0].corrections.map(c => [c.date, c.deltaCents]), [['2026-01-10', -2_500]]);
    assert.equal(await balance('5000', bolt), 5_000);
    assert.equal((await item(bolt)).unitCostCents, 1_667, '(5 × 10.00 + 200.00) / 15');
  });

  test('finding 9: a customer return at the sale\'s cost is revalued with the sale; Inventory ends at quantity × average', async () => {
    await bill(`${ws}_s_bA`, sprocket, '2026-01-05', 10, 1_000);
    await invoice(`${ws}_s_inv`, sprocket, '2026-01-10', 5);
    const [entry] = planReturnEntries({
      creditNote: { id: `${ws}_s_cn`, number: 'CN-1', invoiceId: `${ws}_s_inv`, date: '2026-01-12', returnedGoods: [{ invoiceLineId: 'l1', itemId: sprocket, quantity: 2 }] },
      lines: [{ invoiceLineId: 'l1', itemId: sprocket, description: 'Sprocket', sold: 5, returned: 0, returnable: 5, unitCostCents: 1_000, unitPriceCents: 3_000 }],
      uid: OWNER, workspaceId: ws, baseCurrency: 'USD', inventoryAccount: { id: acct['1300'].id, name: 'Inventory' }, cogsAccount: { id: acct['5000'].id, name: 'Cost of goods sold' },
    });
    const posted = await commitAsServer(db, OWNER, { workspaceId: ws, transactions: [{ ...entry, id: `${ws}_s_ret` } as never] });
    assert.equal(posted.status, 200, JSON.stringify(posted.body));
    await bill(`${ws}_s_bB`, sprocket, '2026-01-03', 10, 2_000);
    const run = await repost({ runId: 'run-sprocket-01', keys: [sprocket] });
    assert.equal(run.status, 200, JSON.stringify(run.body));
    assert.deepEqual(run.body.keys![0].corrections.map(c => [c.of, c.date, c.beforeCents, c.afterCents, c.deltaCents]),
      [['sale', '2026-01-10', 5_000, 7_500, 2_500], ['return', '2026-01-12', 2_000, 3_000, 1_000]]);
    assert.equal(await balance('5000', sprocket), 4_500, 'cost of goods 7,500 less the return 3,000');
    const inventory = await balance('1300', sprocket);
    assert.deepEqual([(await item(sprocket)).quantityAtHand, (await item(sprocket)).unitCostCents, inventory], [17, 1_500, 25_500], '17 × 15.00');
  });

  test('finding 6: no opening basis (stock from before the history) is refused as history incomplete, nothing posted', async () => {
    await scenario(gizmo, 'z');
    const count = (await all<Transaction>('transactions')).length;
    const run = await repost({ runId: 'run-gizmo-0001', keys: [gizmo] });
    assert.equal(run.status, 409, JSON.stringify(run.body));
    assert.match(String(run.body.error), /history incomplete/);
    assert.equal((await all<Transaction>('transactions')).length, count);
    assert.deepEqual([(await queueRow(gizmo))?.status, (await queueRow(gizmo))?.blockedBy], ['blocked', 'history-incomplete']);
  });

  test('the queue can be read by any member; GET needs a workspace', async () => {
    const q = await send('GET', `/api/v1/repost/queue?workspaceId=${ws}`, undefined, 'view');
    assert.equal(q.status, 200);
    assert.ok((q.body.rows as unknown[]).length >= 2);
    assert.equal((await send('GET', '/api/v1/repost/queue', undefined, 'view')).status, 400);
    assert.equal((await send('GET', `/api/v1/repost/queue?workspaceId=${ws}`, undefined, 'stranger')).status, 403);
  });
});
