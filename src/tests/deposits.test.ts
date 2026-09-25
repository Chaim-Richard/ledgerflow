/**
 * Undeposited Funds and "Make deposit" (src/server/services/depositService.ts via
 * POST /api/v1/payments/deposits), with payments recorded by the real payment service.
 * Runs when LF_TEST_DATABASE_URL is set.
 */
import test, { after, before, describe } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'crypto';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import type { Firestore } from '../server/db/pgFirestore';
import { isUndepositedFundsAccount, resolveAccountRole } from '../lib/accountUtils';
import { makeChartAccount } from './fixtures';

describe('Undeposited Funds account', () => {
  test('recognised by subtype or name, and never counted as a bank account', () => {
    const byName = makeChartAccount({ name: 'Undeposited Funds', type: 'asset', category: 'Cash' });
    assert.equal(isUndepositedFundsAccount(byName), true);
    assert.equal(resolveAccountRole(byName), 'asset');
    assert.equal(isUndepositedFundsAccount(makeChartAccount({ name: 'Holding', type: 'asset', subtype: 'undeposited_funds' })), true);
    assert.equal(isUndepositedFundsAccount(makeChartAccount({ name: 'Checking', type: 'asset', category: 'Cash' })), false);
  });
});

const url = process.env.LF_TEST_DATABASE_URL;

describe('Make deposit', { skip: !url && 'LF_TEST_DATABASE_URL not set' }, () => {
  const suffix = crypto.randomBytes(4).toString('hex');
  const ws = `ws_dep_${suffix}`;
  const id = (name: string) => `${ws}_${name}`;
  let server: Server;
  let base = '';
  let db: Firestore;
  const paymentIds: string[] = [];

  const deposit = async (uid: string, body: Record<string, unknown>) => {
    const res = await fetch(`${base}/api/v1/payments/deposits`, {
      method: 'POST', headers: { 'content-type': 'application/json', 'x-test-uid': uid },
      body: JSON.stringify({ workspaceId: ws, bankAccountId: id('bank'), date: '2026-06-15', ...body }),
    });
    return { status: res.status, body: await res.json() as Record<string, unknown> };
  };

  before(async () => {
    process.env.DATABASE_URL = url;
    const express = (await import('express')).default;
    const { paymentRouter } = await import('../server/routes/paymentRoutes');
    const { getDb } = await import('../server/db/firestore');
    const { createPaymentAtomic } = await import('../server/services/paymentService');
    db = getDb();
    await db.collection('workspaces').doc(ws).set({ uid: 'owner-1', name: 'Deposits', currency: 'USD', members: ['owner-1', 'view-1'], roles: { 'view-1': 'viewer' } });
    const account = (name: string, fields: Record<string, unknown>) => db.collection('chartAccounts').doc(id(name)).set({ workspaceId: ws, ...fields });
    await account('bank', { name: 'Checking', type: 'asset', category: 'Cash', code: '1000' });
    await account('udf', { name: 'Undeposited Funds', type: 'asset', category: 'Current Assets', code: '1050' });
    await account('ar', { name: 'Accounts Receivable', type: 'asset', category: 'Receivables', code: '1100' });
    for (const [name, cents] of [['i1', 3000], ['i2', 4500], ['i3', 1000]] as const) {
      await db.collection('invoices').doc(id(name)).set({ workspaceId: ws, customerId: 'c1', amountCents: cents, status: 'sent', dueDate: '2026-07-01' });
      const pay = await createPaymentAtomic(db, {
        workspaceId: ws, uid: 'owner-1', paymentDate: '2026-06-10', amountCents: cents, customerId: 'c1', entityName: 'Acme',
        cashAccountId: name === 'i3' ? id('bank') : id('udf'),
        allocations: [{ documentId: id(name), documentType: 'invoice', amountCents: cents }],
      });
      paymentIds.push(pay.paymentId);
    }

    const app = express();
    app.use(express.json());
    app.use((req, _res, next) => { (req as unknown as { user: { uid: string } }).user = { uid: String(req.header('x-test-uid')) }; next(); });
    app.use('/api/v1/payments', paymentRouter);
    server = app.listen(0);
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });

  after(async () => {
    server?.close();
    for (const table of ['transactions', 'payments', 'invoices', 'chartAccounts', 'auditLogs', 'workspaces']) {
      await db.pool.query(`delete from public."${table}" where workspace_id = $1 or id = $1`, [ws]);
    }
    await db.terminate();
  });

  test('a viewer cannot make deposits', async () => {
    assert.equal((await deposit('view-1', { paymentIds: paymentIds.slice(0, 2) })).status, 403);
  });

  test('refused: a payment that went straight to the bank, a non-bank target', async () => {
    assert.equal((await deposit('owner-1', { paymentIds: [paymentIds[0], paymentIds[2]] })).status, 400);
    assert.equal((await deposit('owner-1', { paymentIds: paymentIds.slice(0, 2), bankAccountId: id('udf') })).status, 400);
  });

  test('two waiting payments become one deposit: DR bank 7500, CR Undeposited Funds 7500', async () => {
    const res = await deposit('owner-1', { paymentIds: paymentIds.slice(0, 2) });
    assert.equal(res.status, 200, JSON.stringify(res.body));
    const data = res.body.data as { transactionId: string; totalCents: number };
    assert.equal(data.totalCents, 7500);
    const tx = (await db.collection('transactions').doc(data.transactionId).get()).data();
    assert.deepEqual(tx?.lines.map((l: { accountId: string; amountCents: number }) => [l.accountId, l.amountCents]), [[id('bank'), 7500], [id('udf'), -7500]]);
    for (const pid of paymentIds.slice(0, 2)) {
      assert.equal((await db.collection('payments').doc(pid).get()).data()?.depositTransactionId, data.transactionId);
    }
  });

  test('a payment can be deposited only once', async () => {
    assert.equal((await deposit('owner-1', { paymentIds: [paymentIds[0]] })).status, 409);
  });
});
