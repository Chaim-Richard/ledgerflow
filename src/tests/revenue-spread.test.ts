/**
 * Revenue recognition (K-16): an invoice's income moves to Deferred Revenue on the invoice's date and
 * is earned one share per month end (whole cents, the remainder last), in one database transaction;
 * spread once; undo voids the schedule unless a month is closed. Through the real workspace routes,
 * so a bookkeeper reaches it even though the bad-debt routes on the same path are owner/accountant.
 * The database part runs when LF_TEST_DATABASE_URL is set.
 */
import test, { after, before, describe } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'crypto';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import type { Firestore } from '../server/db/pgFirestore';
import { deferredRevenueAccount, documentLine, spreadProblem } from '../lib/prepaidSchedule';
import { makeChartAccount } from './fixtures';

describe('Deferred revenue, without the database', () => {
  const accounts = [
    makeChartAccount({ id: 'sales', name: 'Subscriptions', type: 'income', category: 'Revenue' }),
    makeChartAccount({ id: 'other', name: 'Consulting', type: 'income', category: 'Revenue' }),
    makeChartAccount({ id: 'dep', name: 'Customer Deposits', type: 'liability', category: 'Current Liabilities' }),
    makeChartAccount({ id: 'def', name: 'Deferred Revenue', type: 'liability', category: 'Current Liabilities' }),
  ];

  test('the Deferred Revenue account: the mapping, else a liability named deferred/unearned revenue', () => {
    assert.equal(deferredRevenueAccount(accounts)?.id, 'def');
    assert.equal(deferredRevenueAccount(accounts, { 'deferred revenue': 'dep' })?.id, 'dep');
    assert.equal(deferredRevenueAccount(accounts, { 'deferred revenue': 'sales' })?.id, 'def', 'an income account is not taken');
    assert.equal(deferredRevenueAccount(accounts.slice(0, 3)), undefined, 'Customer Deposits is not deferred revenue');
  });

  test('the biggest income line; lines without an account count for the default one', () => {
    const invoice = { amountCents: 13000, items: [{ accountId: 'other', amountCents: 3000 }, { accountId: '', amountCents: 6000 }, { accountId: 'sales', amountCents: 4000 }] };
    assert.deepEqual(documentLine(invoice, accounts, 'revenue', 'sales'), { accountId: 'sales', baseCents: 10000 });
    assert.deepEqual(documentLine(invoice, accounts, 'revenue'), { accountId: 'sales', baseCents: 4000 });
  });

  test('refusals name the invoice', () => {
    assert.equal(spreadProblem({ date: '2026-09-01', amountCents: 2, months: 2, startMonth: '2026-09' }, 1, 'invoice'), 'That is more than the invoice');
  });
});

const url = process.env.LF_TEST_DATABASE_URL;
describe('Spreading an invoice (database)', { skip: !url && 'LF_TEST_DATABASE_URL not set' }, () => {
  const ws = `ws_rev_${crypto.randomBytes(4).toString('hex')}`;
  const id = (name: string) => `${ws}_${name}`;
  let server: Server;
  let base = '';
  let db: Firestore;
  const call = async (uid: string, path: string, body: Record<string, unknown> = {}) => {
    const res = await fetch(`${base}/api/v1/workspaces/${ws}/invoices${path}`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-test-uid': uid }, body: JSON.stringify(body) });
    return { status: res.status, body: await res.json() as Record<string, unknown> };
  };
  const data = async (coll: string, docId: string) => (await db.collection(coll).doc(docId).get()).data() || {};
  const entriesOf = async (scheduleId: string) => (await db.collection('transactions').where('workspaceId', '==', ws).get()).docs
    .map(d => d.data()).filter(t => t.metadata?.prepaidScheduleId === scheduleId).sort((a, b) => String(a.date).localeCompare(String(b.date)));
  const lines = (e: Record<string, unknown>) => (e.lines as { accountId: string; amountCents: number }[]).map(l => [l.accountId, l.amountCents]);

  before(async () => {
    process.env.DATABASE_URL = url;
    const express = (await import('express')).default;
    const { workspaceRouter } = await import('../server/routes/workspaceRoutes');
    const { getDb } = await import('../server/db/firestore');
    db = getDb();
    await db.collection('workspaces').doc(ws).set({ uid: 'owner-1', name: 'Rev', currency: 'USD', members: ['owner-1', 'view-1', 'book-1'], roles: { 'view-1': 'viewer', 'book-1': 'bookkeeper' } });
    const account = (name: string, fields: Record<string, unknown>) => db.collection('chartAccounts').doc(id(name)).set({ workspaceId: ws, ...fields });
    await account('sales', { name: 'Subscriptions', type: 'income', category: 'Revenue', code: '4000' });
    await account('def', { name: 'Deferred Revenue', type: 'liability', category: 'Current Liabilities', code: '2400' });
    await account('ar', { name: 'Accounts Receivable', type: 'asset', category: 'Receivables', code: '1100' });
    await db.collection('invoices').doc(id('inv')).set({ workspaceId: ws, customerId: 'c1', customerName: 'Acme', number: 'INV-9', amountCents: 120011, status: 'sent', date: '2026-09-15', dueDate: '2026-10-15' });
    const app = express();
    app.use(express.json());
    app.use((req, _res, next) => { (req as unknown as { user: { uid: string } }).user = { uid: String(req.header('x-test-uid')) }; next(); });
    app.use('/api/v1/workspaces', workspaceRouter);
    server = app.listen(0);
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });

  after(async () => {
    server?.close();
    for (const table of ['transactions', 'invoices', 'chartAccounts', 'auditLogs', 'workspaces']) {
      await db.pool.query(`delete from public."${table}" where workspace_id = $1 or id = $1`, [ws]);
    }
    await db.terminate();
  });

  const spread = { revenueAccountId: id('sales'), amountCents: 120011, months: 12 };
  let scheduleId = '';

  test('a viewer cannot; a non-income account is refused', async () => {
    assert.equal((await call('view-1', `/${id('inv')}/spread`, spread)).status, 403);
    const wrong = await call('owner-1', `/${id('inv')}/spread`, { ...spread, revenueAccountId: id('ar') });
    assert.deepEqual([wrong.status, wrong.body.message], [400, 'Choose the income account to spread']);
  });

  test('a bookkeeper spreads it: to Deferred Revenue on the invoice date, earned one share each month end', async () => {
    const res = await call('book-1', `/${id('inv')}/spread`, spread);
    assert.equal(res.status, 200, JSON.stringify(res.body));
    const invoice = await data('invoices', id('inv'));
    scheduleId = String(invoice.revenueSchedule?.id);
    assert.deepEqual([invoice.revenueSchedule.months, invoice.revenueSchedule.deferredAccountId, invoice.revenueSchedule.revenueAccountId], [12, id('def'), id('sales')]);
    const entries = await entriesOf(scheduleId);
    assert.equal(entries.length, 13);
    assert.deepEqual([entries[0].date, entries[0].metadata.type, lines(entries[0])], ['2026-09-15', 'deferred-revenue', [[id('sales'), 120011], [id('def'), -120011]]]);
    assert.deepEqual(lines(entries[1]), [[id('def'), 10000], [id('sales'), -10000]]);
    assert.deepEqual([entries[12].date, lines(entries[12])], ['2027-08-31', [[id('def'), 10011], [id('sales'), -10011]]]);
    assert.deepEqual([...new Set(entries.map(e => `${e.metadata.spreadOfInvoiceId}|${e.metadata.invoiceId ?? ''}`))], [`${id('inv')}|`], 'not tagged invoiceId');
    const deferred = entries.flatMap(e => e.lines as { accountId: string; amountCents: number }[]).filter(l => l.accountId === id('def')).reduce((s, l) => s + l.amountCents, 0);
    assert.equal(deferred, 0, 'all of it earned by the last month');
  });

  test('spread once; undo is refused while a month of it is closed, then voids it', async () => {
    assert.equal((await call('owner-1', `/${id('inv')}/spread`, spread)).status, 409);
    await db.collection('workspaces').doc(ws).update({ lockDate: '2026-09-30' });
    assert.equal((await call('owner-1', `/${id('inv')}/spread/undo`)).status, 409);
    await db.collection('workspaces').doc(ws).update({ lockDate: null });
    assert.equal((await call('book-1', `/${id('inv')}/spread/undo`)).status, 200);
    assert.deepEqual([...new Set((await entriesOf(scheduleId)).map(e => e.status))], ['void']);
    assert.equal((await data('invoices', id('inv'))).revenueSchedule, undefined);
  });

  test('the bad-debt routes on the same path still need an owner or accountant', async () => {
    assert.equal((await call('book-1', `/${id('inv')}/write-off`, {})).status, 403);
  });
});
