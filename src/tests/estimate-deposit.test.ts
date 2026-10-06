/**
 * Deposits from estimates (BE-05): a deposit for an estimate is a payment from the estimate's customer,
 * linked to it and applied to nothing, so it waits in Customer Deposits; once the estimate's invoice is
 * issued it is applied there (deposits → receivables), never counted as income twice. The database
 * part runs when LF_TEST_DATABASE_URL is set.
 */
import test, { after, before, describe } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'crypto';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import type { Firestore } from '../server/db/pgFirestore';
import { depositApplication, estimateDeposits } from '../lib/advancePayments';

describe('Deposits of an estimate, without the database', () => {
  const pay = (id: string, over: Record<string, unknown>) => ({ id, direction: 'received' as const, status: 'posted', estimateId: 'e1', amountCents: 3000, unappliedCents: 3000, date: '2026-09-01', ...over });

  test('taken, and still waiting; void ones and other estimates are not counted', () => {
    const payments = [pay('a', { date: '2026-09-05' }), pay('b', { unappliedCents: 1000 }), pay('c', { unappliedCents: 0 }), pay('v', { status: 'void' }), pay('x', { estimateId: 'e2' })];
    const d = estimateDeposits(payments, 'e1');
    assert.deepEqual([d.receivedCents, d.unappliedCents, d.waiting.map(p => p.id)], [9000, 4000, ['b', 'a']]);
    assert.deepEqual(estimateDeposits(payments, undefined), { receivedCents: 0, unappliedCents: 0, waiting: [] });
  });

  test('applied oldest first, never more than is due', () => {
    assert.deepEqual(depositApplication([{ id: 'b', unappliedCents: 1000 }, { id: 'a', unappliedCents: 3000 }], 2500), [{ paymentId: 'b', amountCents: 1000 }, { paymentId: 'a', amountCents: 1500 }]);
    assert.deepEqual(depositApplication([{ id: 'a', unappliedCents: 3000 }], 0), []);
  });
});

const url = process.env.LF_TEST_DATABASE_URL;
describe('A deposit for an estimate (database)', { skip: !url && 'LF_TEST_DATABASE_URL not set' }, () => {
  const ws = `ws_estdep_${crypto.randomBytes(4).toString('hex')}`;
  const id = (name: string) => `${ws}_${name}`;
  let server: Server;
  let base = '';
  let db: Firestore;
  const call = async (path: string, body: Record<string, unknown>) => {
    const res = await fetch(`${base}/api/v1/payments${path}`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-test-uid': 'owner-1' }, body: JSON.stringify(body) });
    return { status: res.status, body: await res.json() as Record<string, unknown> };
  };
  const data = async (coll: string, docId: string) => (await db.collection(coll).doc(docId).get()).data() || {};
  const deposit = (over: Record<string, unknown> = {}) => ({ workspaceId: ws, amountCents: 30000, paymentDate: '2026-09-02', customerId: 'c1', cashAccountId: id('bank'), estimateId: id('est'), allocations: [], ...over });

  before(async () => {
    process.env.DATABASE_URL = url;
    const express = (await import('express')).default;
    const { paymentRouter } = await import('../server/routes/paymentRoutes');
    const { getDb } = await import('../server/db/firestore');
    db = getDb();
    await db.collection('workspaces').doc(ws).set({ uid: 'owner-1', name: 'Est', currency: 'USD', members: ['owner-1'] });
    const account = (name: string, fields: Record<string, unknown>) => db.collection('chartAccounts').doc(id(name)).set({ workspaceId: ws, ...fields });
    await account('bank', { name: 'Checking', type: 'asset', category: 'Cash', code: '1000' });
    await account('ar', { name: 'Accounts Receivable', type: 'asset', category: 'Receivables', code: '1100' });
    await account('dep', { name: 'Customer Deposits', type: 'liability', category: 'Current Liabilities', code: '2300' });
    await db.collection('estimates').doc(id('est')).set({ workspaceId: ws, customerId: 'c1', customerName: 'Acme', number: 'E-1', amountCents: 100000, status: 'accepted', date: '2026-09-01' });
    await db.collection('estimates').doc(id('done')).set({ workspaceId: ws, customerId: 'c1', number: 'E-2', amountCents: 5000, status: 'converted', date: '2026-09-01' });
    const app = express();
    app.use(express.json());
    app.use((req, _res, next) => { (req as unknown as { user: { uid: string } }).user = { uid: String(req.header('x-test-uid')) }; next(); });
    app.use('/api/v1/payments', paymentRouter);
    server = app.listen(0);
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });

  after(async () => {
    server?.close();
    for (const table of ['transactions', 'payments', 'invoices', 'estimates', 'chartAccounts', 'auditLogs', 'numberingSeries', 'workspaces']) {
      await db.pool.query(`delete from public."${table}" where workspace_id = $1 or id = $1`, [ws]);
    }
    await db.terminate();
  });

  test('refused for another customer, a converted estimate, or with documents to apply to', async () => {
    assert.match(String((await call('', deposit({ customerId: 'c2' }))).body.message), /estimate's customer/);
    assert.match(String((await call('', deposit({ estimateId: id('done') }))).body.message), /converted/);
    assert.match(String((await call('', deposit({ allocations: [{ documentId: 'x', documentType: 'invoice', amountCents: 1 }] }))).body.message), /not applied/);
  });

  let paymentId = '';
  test('the deposit waits in Customer Deposits, linked to the estimate', async () => {
    const res = await call('', deposit());
    assert.equal(res.status, 200, JSON.stringify(res.body));
    paymentId = String((res.body.data as { paymentId: string }).paymentId);
    const payment = await data('payments', paymentId);
    assert.deepEqual([payment.estimateId, payment.unappliedCents, payment.advanceAccountId], [id('est'), 30000, id('dep')]);
    const entries = (await db.collection('transactions').where('workspaceId', '==', ws).get()).docs.map(d => d.data());
    const byAccount = Object.fromEntries(entries.flatMap(e => e.lines as { accountId: string; amountCents: number }[]).map(l => [l.accountId, l.amountCents]));
    assert.deepEqual([byAccount[id('bank')], byAccount[id('dep')], byAccount[id('ar')] ?? 0], [30000, -30000, 0], 'no income and nothing owed yet');
  });

  test('applied to the issued invoice: it is part paid, and the money moves from deposits to receivables', async () => {
    await db.collection('invoices').doc(id('inv')).set({ workspaceId: ws, customerId: 'c1', number: 'INV-1', amountCents: 100000, status: 'sent', date: '2026-09-20', metadata: { convertedFromEstimateId: id('est') } });
    const res = await call(`/${paymentId}/apply`, { workspaceId: ws, date: '2026-09-20', allocations: [{ documentId: id('inv'), documentType: 'invoice', amountCents: 30000 }] });
    assert.equal(res.status, 200, JSON.stringify(res.body));
    const invoice = await data('invoices', id('inv'));
    assert.deepEqual([invoice.amountPaidCents, invoice.status], [30000, 'partially_paid']);
    assert.equal((await data('payments', paymentId)).unappliedCents, 0);
    const moved = (await db.collection('transactions').where('workspaceId', '==', ws).get()).docs.map(d => d.data()).find(e => e.metadata?.type === 'payment-application');
    assert.deepEqual((moved?.lines as { accountId: string; amountCents: number }[]).map(l => [l.accountId, l.amountCents]), [[id('dep'), 30000], [id('ar'), -30000]]);
  });
});
