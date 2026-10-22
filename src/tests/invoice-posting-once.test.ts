/**
 * INT-2 / BUG-03 (owner's integrity follow-up, 18 Oct): one live posting per invoice, decided on the
 * server against real Postgres. A retry from an out-of-date screen does not post twice; a changed save
 * from an out-of-date screen is refused; a proper edit (with its reversal) goes through; two tabs at once
 * leave exactly one live posting.
 */
import { after, before, describe, test } from 'node:test';
import { commitAsServer } from './helpers/serverCommit';
import assert from 'node:assert/strict';
import crypto from 'crypto';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';

const url = process.env.LF_TEST_DATABASE_URL;
describe('an invoice is posted once (database)', { skip: !url && 'LF_TEST_DATABASE_URL not set' }, () => {
  const ws = `ws_inv1_${crypto.randomBytes(4).toString('hex')}`;
  let server: Server;
  let base = '';
  let db: import('../server/db/pgFirestore').Firestore;
  const accrual = (invoiceId: string, cents: number, id = crypto.randomUUID()) => ({
    id, workspaceId: ws, date: '2026-06-01', description: `Invoice ${invoiceId}`, status: 'completed', type: 'actual', totalAmountCents: cents, currency: 'USD',
    metadata: { invoiceId, type: 'invoice-accrual' },
    lines: [{ accountId: `${ws}_ar`, amountCents: cents }, { accountId: `${ws}_sales`, amountCents: -cents }],
  });
  const reversal = (of: { id: string; lines: Array<{ accountId: string; amountCents: number }> }, invoiceId: string) => ({
    id: crypto.randomUUID(), workspaceId: ws, date: '2026-06-01', description: 'Reversal', status: 'completed', type: 'actual', totalAmountCents: Math.abs(of.lines[0].amountCents), currency: 'USD',
    metadata: { invoiceId, type: 'invoice-reversal', reversesTxId: of.id, isReversal: true },
    lines: of.lines.map(l => ({ accountId: l.accountId, amountCents: -l.amountCents })),
  });
  // L94-STEP2B: entries that name a document are the server's own (its posting builds them); sent to the shared commit as the server does
  const save = (txs: unknown[], invoiceId: string, cents: number) => commitAsServer(db, 'owner-1', { workspaceId: ws, transactions: txs as never, entityMutation: { collection: 'invoices', docId: `${ws}_${invoiceId}`, action: 'create',
    data: { customerId: 'c1', customerName: 'Acme', invoiceNumber: invoiceId, date: '2026-06-01', dueDate: '2026-07-01', status: 'sent', amountCents: cents, currency: 'USD' } } });
  const live = async (invoiceId: string) => {
    const { rows } = await db.pool.query(`select id, data from public."transactions" where workspace_id = $1 and data->'metadata'->>'invoiceId' = $2`, [ws, invoiceId]);
    const reversed = new Set(rows.filter(r => r.data.metadata?.isReversal).map(r => r.data.metadata.reversesTxId));
    return rows.filter(r => r.data.metadata?.type === 'invoice-accrual' && !reversed.has(r.id)).map(r => ({ id: r.id as string, cents: r.data.totalAmountCents as number }));
  };

  before(async () => {
    process.env.DATABASE_URL = url;
    const express = (await import('express')).default;
    const { transactionRouter } = await import('../server/routes/transactionRoutes');
    const { getDb } = await import('../server/db/firestore');
    db = getDb();
    await db.collection('workspaces').doc(ws).set({ uid: 'owner-1', name: 'Inv', currency: 'USD', members: ['owner-1'] });
    for (const [id, type] of [['ar', 'asset'], ['sales', 'income'], ['ap', 'liability'], ['rent', 'expense'], ['cash', 'asset']]) await db.collection('chartAccounts').doc(`${ws}_${id}`).set({ workspaceId: ws, name: id, code: id, type });
    const app = express();
    app.use(express.json());
    app.use((req, _res, next) => { (req as unknown as { user: { uid: string } }).user = { uid: String(req.header('x-test-uid')) }; next(); });
    app.use('/api/v1/transactions', transactionRouter);
    app.use('/api/v1/documents', (await import('../server/routes/documentPostRoutes')).documentPostRouter);
    server = app.listen(0);
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });
  after(async () => {
    server?.close();
    for (const table of ['transactions', 'invoices', 'chartAccounts', 'idempotencyKeys', 'workspaces']) await db.pool.query(`delete from public."${table}" where workspace_id = $1 or id = $1`, [ws]);
    await db.terminate();
  });

  test('first save posts; the same save retried from an out-of-date screen posts nothing more', async () => {
    const first = accrual('A', 10000);
    assert.equal((await save([first], 'A', 10000)).status, 200);
    const retry = await save([accrual('A', 10000)], 'A', 10000); // new id, no reversal: the screen did not know
    assert.equal(retry.status, 200, JSON.stringify(retry.body));
    assert.equal(retry.body.replayed, true);
    assert.deepEqual((await live('A')).map(x => x.id), [first.id]);
  });

  test('a changed save from an out-of-date screen is refused and writes nothing', async () => {
    const r = await save([accrual('A', 12000)], 'A', 12000);
    assert.equal(r.status, 409, JSON.stringify(r.body));
    assert.deepEqual((await live('A')).map(x => x.cents), [10000]);
  });

  test('a proper edit (reversing the live posting) goes through', async () => {
    const [current] = await live('A');
    const old = (await db.collection('transactions').doc(current.id).get()).data() as { lines: Array<{ accountId: string; amountCents: number }> };
    const next = accrual('A', 12000);
    const r = await save([reversal({ id: current.id, lines: old.lines }, 'A'), next], 'A', 12000);
    assert.equal(r.status, 200, JSON.stringify(r.body));
    assert.deepEqual((await live('A')).map(x => [x.id, x.cents]), [[next.id, 12000]]);
  });

  test('two tabs posting the same new invoice at once: exactly one live posting', async () => {
    const results = await Promise.all([save([accrual('B', 5000)], 'B', 5000), save([accrual('B', 6000)], 'B', 6000)]);
    assert.equal(results.filter(r => r.status === 200).length, 1, JSON.stringify(results.map(r => [r.status, r.body])));
    assert.equal((await live('B')).length, 1);
  });

  test('bills too: a stale retry posts nothing more, a stale changed save is refused', async () => {
    const bill = (cents: number) => ({ id: crypto.randomUUID(), workspaceId: ws, date: '2026-06-02', description: 'Bill B-1', status: 'completed', type: 'actual', totalAmountCents: cents, currency: 'USD',
      metadata: { billId: 'B-1', type: 'bill-accrual' }, lines: [{ accountId: `${ws}_rent`, amountCents: cents }, { accountId: `${ws}_ap`, amountCents: -cents }] });
    const post = (tx: unknown) => commitAsServer(db, 'owner-1', { workspaceId: ws, transactions: [tx] as never });
    assert.equal((await post(bill(3000))).status, 200);
    const retry = await post(bill(3000));
    assert.equal(retry.status, 200); assert.equal(retry.body.replayed, true);
    assert.equal((await post(bill(3500))).status, 409);
    const { rows } = await db.pool.query(`select count(*)::int as n from public."transactions" where workspace_id = $1 and data->'metadata'->>'billId' = 'B-1'`, [ws]);
    assert.equal(rows[0].n, 1);
  });

  test('the payment posted with a paid invoice (INT-2 payments): retry posts nothing; an old tab marking it paid is refused', async () => {
    const payment = (invoiceId: string, cents: number) => ({ id: crypto.randomUUID(), workspaceId: ws, date: '2026-06-05', description: `Payment ${invoiceId}`, status: 'completed', type: 'actual', totalAmountCents: cents, currency: 'USD',
      metadata: { invoiceId, type: 'invoice-payment' }, lines: [{ accountId: `${ws}_cash`, amountCents: cents }, { accountId: `${ws}_ar`, amountCents: -cents }] });
    const payments = async (invoiceId: string) => (await db.pool.query(`select count(*)::int as n from public."transactions" where workspace_id = $1 and data->'metadata'->>'invoiceId' = $2 and data->'metadata'->>'type' = 'invoice-payment'`, [ws, invoiceId])).rows[0].n as number;

    // paid on the first save: invoice + payment; the same save retried posts nothing more
    assert.equal((await save([accrual('P', 8000), payment('P', 8000)], 'P', 8000)).status, 200);
    const retry = await save([accrual('P', 8000), payment('P', 8000)], 'P', 8000);
    assert.equal(retry.status, 200, JSON.stringify(retry.body));
    assert.equal(retry.body.replayed, true);
    assert.equal(await payments('P'), 1);
    // a different payment from an out-of-date screen is refused
    assert.equal((await save([accrual('P', 8000), payment('P', 5000)], 'P', 8000)).status, 409);
    assert.equal(await payments('P'), 1);

    // sent first, then an old tab (that never saw the posting) marks it paid: refused, not half-applied
    assert.equal((await save([accrual('Q', 4000)], 'Q', 4000)).status, 200);
    const stale = await save([accrual('Q', 4000), payment('Q', 4000)], 'Q', 4000);
    assert.equal(stale.status, 409, JSON.stringify(stale.body));
    assert.equal(await payments('Q'), 0);
  });
});
