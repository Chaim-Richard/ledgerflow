/**
 * L-94 step 2: POST /api/v1/documents/:type/:id/post saves an invoice or bill and builds its entries on the server
 * (documentPostService.ts) — on the local test database, through the HTTP route. Figures by hand:
 *   INV-1  2 × 150.00 = 300.00 + 10% tax 30.00 = 330.00 → A/R +330.00, Sales −300.00, VAT −30.00
 *   edit   3 × 150.00 = 450.00 + 45.00 = 495.00 → the first entry reversed (A/R −330.00, Sales +300.00, VAT +30.00)
 *          and the new one (A/R +495.00, Sales −450.00, VAT −45.00): A/R nets to 495.00
 *   BILL-1 1,000.00 of supplies + 18% tax 180.00 = 1,180.00 → A/P −1,180.00, the other side +1,180.00
 * Every entry the route writes is the one the browser's builder makes from the same books (the same dates, accounts,
 * amounts and labels). And: a body carrying entries is refused (nothing written); the same key again answers as before
 * and writes nothing; two edits at once are saved one after the other or the later refused (409, INT-2), never both
 * counted; a viewer cannot post; a document dated in a closed month is refused.
 */
import test, { after, before, describe } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'crypto';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { postInvoiceLedger } from '../services/ledgerPost/invoicePosting';
import { postBillLedger } from '../services/ledgerPost/billPosting';
import type { EntityMutation, LedgerPostContext, PostableTransaction } from '../services/ledgerPost/postingCore';
import { postingFingerprint } from '../server/services/postingShadowCheck';
import type { Bill, ChartAccount, Invoice, Transaction, Workspace } from '../types';

const url = process.env.LF_TEST_DATABASE_URL;

describe('L-94 step 2: invoices and bills posted by the server', { skip: !url && 'LF_TEST_DATABASE_URL not set' }, () => {
  const ws = `ws_l94s2_${crypto.randomBytes(4).toString('hex')}`;
  const OWNER = 'owner-l94s2';
  const VIEWER = 'viewer-l94s2';
  let db: import('../server/db/pgFirestore').Firestore;
  let server: Server;
  let base = '';
  const accounts = [
    { id: `${ws}_ar`, name: 'Accounts Receivable', type: 'asset', category: 'Receivables', code: '1100' },
    { id: `${ws}_bank`, name: 'Bank', type: 'asset', category: 'Cash', code: '1000' },
    { id: `${ws}_vatin`, name: 'VAT Receivable', type: 'asset', category: 'Tax', code: '1300' },
    { id: `${ws}_ap`, name: 'Accounts Payable', type: 'liability', category: 'Payables', code: '2000' },
    { id: `${ws}_vat`, name: 'VAT Payable', type: 'liability', category: 'Tax', code: '2200' },
    { id: `${ws}_sales`, name: 'Sales', type: 'income', code: '4000' },
    { id: `${ws}_supplies`, name: 'Office Supplies', type: 'expense', code: '6000' },
  ].map(a => ({ ...a, workspaceId: ws })) as unknown as ChartAccount[];
  const workspace = { id: ws, uid: OWNER, name: 'L-94 step 2', currency: 'USD', timezone: 'UTC', defaultAccountMappings: { ar: `${ws}_ar`, ap: `${ws}_ap`, revenue: `${ws}_sales`, tax: `${ws}_vat` } } as unknown as Workspace;
  const invoice = (qty: number, id: string, date = '2026-10-21') => ({
    id, workspaceId: ws, number: `INV-${id.slice(-1)}`, customerName: 'Acme', customerId: 'c1', date, dueDate: '2026-11-20', status: 'sent', currency: 'USD',
    amountCents: qty * 16_500, taxAmountCents: qty * 1_500, taxRate: 10,
    items: [{ id: 'l1', description: 'Hours', quantity: qty, rateCents: 15_000, amountCents: qty * 15_000 }],
  }) as unknown as Invoice;
  const bill = (id: string) => ({
    id, workspaceId: ws, number: 'BILL-1', vendorName: 'Paper Co', vendorId: 'v1', date: '2026-10-21', dueDate: '2026-11-20', status: 'pending', currency: 'USD',
    amountCents: 118_000, taxAmountCents: 18_000, taxRate: 18,
    items: [{ id: 'b1', description: 'Paper', quantity: 1, rateCents: 100_000, amountCents: 100_000, accountId: `${ws}_supplies` }],
  }) as unknown as Bill;
  const entriesOf = async (key: 'invoiceId' | 'billId', docId: string) => (await db.collection('transactions').where('workspaceId', '==', ws).where(`metadata.${key}`, '==', docId).get()).docs.map(d => ({ ...d.data(), id: d.id }) as Transaction);
  /** what the browser's builder makes for this save from the books as they are now */
  const browserBuild = async (type: 'invoices' | 'bills', data: Invoice | Bill, action: 'create' | 'update'): Promise<PostableTransaction[]> => {
    const key = type === 'invoices' ? 'invoiceId' : 'billId';
    const context: LedgerPostContext = { accounts, workspaces: [workspace], transactions: await entriesOf(key, data.id!), inventory: [], lockDate: null, uid: OWNER, today: '2026-10-21', capture: [] };
    const mutation: EntityMutation = { collection: type, docId: data.id!, action, data: data as unknown as Record<string, unknown> };
    if (type === 'invoices') await postInvoiceLedger(data.id!, data as Invoice, ws, OWNER, mutation, context);
    else await postBillLedger(data.id!, data as Bill, ws, OWNER, mutation, context);
    return context.capture!.flatMap(c => c.txs);
  };
  const post = async (uid: string, type: string, id: string, body: Record<string, unknown>, key = crypto.randomUUID()) => {
    const res = await fetch(`${base}/api/v1/documents/${type}/${id}/post`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-test-uid': uid, 'idempotency-key': key }, body: JSON.stringify(body) });
    return { status: res.status, body: await res.json() as Record<string, any> }; // eslint-disable-line @typescript-eslint/no-explicit-any
  };
  const rows = (txs: Array<Pick<Transaction, 'date' | 'lines'>>, account: string) => postingFingerprint(txs).filter(r => r.includes(`|${ws}_${account}|`)).map(r => Number(r.split('|')[2])).sort((a, b) => a - b);

  before(async () => {
    process.env.DATABASE_URL = url;
    db = (await import('../server/db/firestore')).getDb() as unknown as typeof db;
    await db.collection('workspaces').doc(ws).set({ ...workspace, members: [OWNER, VIEWER], roles: { [OWNER]: 'owner', [VIEWER]: 'viewer' } } as unknown as Record<string, unknown>);
    for (const a of accounts) await db.collection('chartAccounts').doc(a.id).set(a as unknown as Record<string, unknown>);
    const express = (await import('express')).default;
    const { documentRouter } = await import('../server/routes/documentRoutes');
    const app = express();
    app.use(express.json());
    app.use((req, _res, next) => { (req as unknown as { user: { uid: string } }).user = { uid: String(req.header('x-test-uid')) }; next(); });
    app.use('/api/v1/documents', documentRouter);
    server = app.listen(0);
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });

  after(async () => {
    server?.close();
    for (const table of ['transactions', 'invoices', 'bills', 'chartAccounts', 'idempotencyKeys', 'auditLogs', 'workspaces']) {
      await db.pool.query(`delete from public."${table}" where workspace_id = $1 or id = $1`, [ws]).catch(() => {});
    }
    await db.terminate();
  });

  const inv1 = `${ws}_inv1`;

  test('INV-1 330.00: the server writes A/R +330.00, Sales −300.00, VAT −30.00 — the browser builder\'s very entry', async () => {
    const data = invoice(2, inv1);
    const expected = postingFingerprint(await browserBuild('invoices', data, 'create'));
    const res = await post(OWNER, 'invoices', inv1, { workspaceId: ws, action: 'create', data });
    assert.equal(res.status, 200, JSON.stringify(res.body));
    const written = await entriesOf('invoiceId', inv1);
    assert.deepEqual(postingFingerprint(written), expected);
    assert.deepEqual([rows(written, 'ar'), rows(written, 'sales'), rows(written, 'vat')], [[33_000], [-30_000], [-3_000]]);
    assert.deepEqual(postingFingerprint(res.body.transactions), expected, 'the answer carries the entries as written');
    assert.equal((await db.collection('invoices').doc(inv1).get()).data()?.amountCents, 33_000);
  });

  test('the edit to 3 hours (495.00): the first entry reversed and the new one posted, as the browser builds it', async () => {
    const edited = invoice(3, inv1);
    const expected = postingFingerprint(await browserBuild('invoices', edited, 'update'));
    const { amountCents, taxAmountCents, items } = edited;
    const res = await post(OWNER, 'invoices', inv1, { workspaceId: ws, action: 'update', data: { amountCents, taxAmountCents, items } });
    assert.equal(res.status, 200, JSON.stringify(res.body));
    assert.deepEqual(postingFingerprint(res.body.transactions), expected);
    const all = await entriesOf('invoiceId', inv1);
    assert.deepEqual(rows(all, 'ar'), [-33_000, 33_000, 49_500]);
    assert.deepEqual(rows(all, 'sales'), [-45_000, -30_000, 30_000]);
    assert.equal(rows(all, 'ar').reduce((s, n) => s + n, 0), 49_500, 'A/R nets to 495.00');
  });

  test('BILL-1 1,180.00: A/P −1,180.00 against 1,180.00 of supplies and tax, the browser builder\'s entry', async () => {
    const data = bill(`${ws}_bill1`);
    const expected = postingFingerprint(await browserBuild('bills', data, 'create'));
    const res = await post(OWNER, 'bills', data.id!, { workspaceId: ws, action: 'create', data });
    assert.equal(res.status, 200, JSON.stringify(res.body));
    const written = await entriesOf('billId', data.id!);
    assert.deepEqual(postingFingerprint(written), expected);
    assert.deepEqual(rows(written, 'ap'), [-118_000]);
    assert.equal(written.flatMap(tx => tx.lines).filter(l => l.accountId !== `${ws}_ap`).reduce((s, l) => s + l.amountCents, 0), 118_000);
  });

  test('a body that carries entries is refused and nothing is written', async () => {
    const data = invoice(1, `${ws}_inv2`);
    const forged = [{ date: '2026-10-21', lines: [{ accountId: `${ws}_ar`, amountCents: 100 }, { accountId: `${ws}_sales`, amountCents: -100 }] }];
    const res = await post(OWNER, 'invoices', data.id!, { workspaceId: ws, action: 'create', data, transactions: forged });
    assert.equal(res.status, 400);
    assert.equal((await db.collection('invoices').doc(data.id!).get()).exists, false);
    assert.deepEqual(await entriesOf('invoiceId', data.id!), []);
    assert.equal((await post(OWNER, 'payments', 'p1', { workspaceId: ws, action: 'create', data: {} })).status, 400, 'only invoices and bills');
  });

  test('the same key again: the first answer, nothing written twice', async () => {
    const data = invoice(1, `${ws}_inv3`);
    const key = crypto.randomUUID();
    const once = await post(OWNER, 'invoices', data.id!, { workspaceId: ws, action: 'create', data }, key);
    const twice = await post(OWNER, 'invoices', data.id!, { workspaceId: ws, action: 'create', data }, key);
    assert.deepEqual([once.status, twice.status], [200, 200], JSON.stringify(twice.body));
    assert.equal((await entriesOf('invoiceId', data.id!)).length, 1);
    assert.deepEqual(twice.body.transactions, []);
    const other = await post(OWNER, 'invoices', data.id!, { workspaceId: ws, action: 'create', data: { ...data, amountCents: 1 } }, key);
    assert.equal(other.status, 409, 'another request under the same key');
  });

  test('two edits at once: each is saved against the books as they are, or refused — the invoice is never counted twice', async () => {
    const results = await Promise.all([4, 5].map(qty => {
      const { amountCents, taxAmountCents, items } = invoice(qty, inv1);
      return post(OWNER, 'invoices', inv1, { workspaceId: ws, action: 'update', data: { amountCents, taxAmountCents, items } });
    }));
    // one after the other (the second reverses the first) or at the same moment (the second is refused, INT-2)
    assert.ok(results.every(r => r.status === 200 || r.status === 409) && results.some(r => r.status === 200), JSON.stringify(results.map(r => r.body)));
    const all = await entriesOf('invoiceId', inv1);
    const saved = Number((await db.collection('invoices').doc(inv1).get()).data()?.amountCents);
    assert.ok(saved === 4 * 16_500 || saved === 5 * 16_500);
    assert.equal(rows(all, 'ar').reduce((s, n) => s + n, 0), saved, 'A/R is the saved invoice, once');
    const reversed = new Set(all.map(tx => tx.metadata?.reversesTxId).filter(Boolean));
    assert.equal(all.filter(tx => tx.metadata?.type === 'invoice-accrual' && !reversed.has(tx.id)).length, 1, 'one live entry');
  });

  test('a viewer cannot post; a document dated in a closed month is refused', async () => {
    const data = invoice(1, `${ws}_inv4`);
    assert.equal((await post(VIEWER, 'invoices', data.id!, { workspaceId: ws, action: 'create', data })).status, 403);
    await db.collection('workspaces').doc(ws).update({ lockDate: '2026-09-30' });
    const closed = invoice(1, `${ws}_inv5`, '2026-09-15');
    const res = await post(OWNER, 'invoices', closed.id!, { workspaceId: ws, action: 'create', data: closed });
    assert.equal(res.status, 409, JSON.stringify(res.body));
    assert.equal((await db.collection('invoices').doc(closed.id!).get()).exists, false);
    await db.collection('workspaces').doc(ws).update({ lockDate: null });
  });
});
