/**
 * Customer portal (K-27): writers make, replace and turn off a customer's link; the link shows only
 * that customer's issued invoices (no drafts, voids, or invoices still waiting for approval; paid ones
 * from the last 12 months), what is still due, and a pay page for each open one; an old or turned-off
 * link shows nothing. The database part runs when LF_TEST_DATABASE_URL is set.
 */
import test, { after, before, describe } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'crypto';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import type { Firestore } from '../server/db/pgFirestore';

const url = process.env.LF_TEST_DATABASE_URL;
describe('Customer portal (database)', { skip: !url && 'LF_TEST_DATABASE_URL not set' }, () => {
  const ws = `ws_portal_${crypto.randomBytes(4).toString('hex')}`;
  const id = (name: string) => `${ws}_${name}`;
  let db: Firestore;
  let server: Server;
  let base = '';
  const link = (uid: string, method: string, customer = id('acme')) =>
    fetch(`${base}/api/v1/workspaces/${ws}/customers/${customer}/portal-link`, { method, headers: { 'x-test-uid': uid } });
  const view = async (token: string) => {
    const res = await fetch(`${base}/api/v1/invoices/public/portal/${token}`);
    return { status: res.status, body: await res.json() as { business?: string; customer?: string; owedCents?: number; invoices?: Array<{ number: string; dueCents: number; status: string; payPath: string }> } };
  };
  const invoice = (name: string, data: Record<string, unknown>) => db.collection('invoices').doc(id(name)).set({ workspaceId: ws, customerId: id('acme'), customerName: 'Acme', currency: 'USD', ...data });

  before(async () => {
    process.env.DATABASE_URL = url;
    const { getDb } = await import('../server/db/firestore');
    db = getDb();
    await db.collection('workspaces').doc(ws).set({ uid: 'owner-1', name: 'Portal Co', currency: 'USD', members: ['owner-1', 'book-1', 'view-1'], roles: { 'book-1': 'bookkeeper', 'view-1': 'viewer' }, invoiceApproval: { enabled: true, thresholdCents: 1000000 } });
    await db.collection('customers').doc(id('acme')).set({ workspaceId: ws, name: 'Acme' });
    await db.collection('customers').doc(id('beta')).set({ workspaceId: ws, name: 'Beta' });
    await invoice('open', { number: 'INV-1', date: '2026-09-01', dueDate: '2026-09-30', status: 'sent', amountCents: 50000, amountPaidCents: 10000 });
    await invoice('later', { number: 'INV-2', date: '2026-10-01', dueDate: '2099-10-31', status: 'sent', amountCents: 20000 });
    await invoice('paid', { number: 'INV-0', date: '2026-08-01', dueDate: '2026-08-31', status: 'paid', amountCents: 7000, amountPaidCents: 7000 });
    await invoice('oldpaid', { number: 'INV-OLD', date: '2024-01-01', status: 'paid', amountCents: 100, amountPaidCents: 100 });
    await invoice('draft', { number: 'DRAFT', date: '2026-10-02', status: 'draft', amountCents: 999 });
    await invoice('void', { number: 'VOID', date: '2026-10-02', status: 'void', amountCents: 999 });
    await invoice('big', { number: 'BIG', date: '2026-10-02', status: 'sent', amountCents: 5000000, approval: { state: 'awaiting' } });
    await db.collection('invoices').doc(id('theirs')).set({ workspaceId: ws, customerId: id('beta'), number: 'BETA-1', status: 'sent', amountCents: 300, date: '2026-10-01' });
    const express = (await import('express')).default;
    const { workspaceRouter } = await import('../server/routes/workspaceRoutes');
    const { publicInvoiceRouter } = await import('../server/routes/publicInvoiceRoutes');
    const app = express();
    app.use(express.json());
    app.use('/api/v1/invoices/public', publicInvoiceRouter);
    app.use((req, _res, next) => { (req as unknown as { user: { uid: string } }).user = { uid: String(req.header('x-test-uid')) }; next(); });
    app.use('/api/v1/workspaces', workspaceRouter);
    server = app.listen(0);
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });

  after(async () => {
    server?.close();
    for (const table of ['invoices', 'customers', 'auditLogs', 'workspaces']) await db.pool.query(`delete from public."${table}" where workspace_id = $1 or id = $1`, [ws]);
    await db.terminate();
  });

  let token = '';
  test('writers make a link; a viewer may not', async () => {
    assert.equal((await link('view-1', 'POST')).status, 403);
    const res = await link('book-1', 'POST');
    assert.equal(res.status, 200);
    token = ((await res.json()) as { token: string }).token;
    assert.match(token, /^cp_[a-f0-9]{48}$/);
  });

  test('the link shows only this customer\'s issued invoices, what is due, and a pay page for the open ones', async () => {
    const { status, body } = await view(token);
    assert.equal(status, 200);
    assert.deepEqual([body.business, body.customer, body.owedCents], ['Portal Co', 'Acme', 60000]);
    assert.deepEqual(body.invoices?.map(i => [i.number, i.dueCents, i.status]), [['INV-1', 40000, 'overdue'], ['INV-2', 20000, 'open'], ['INV-0', 0, 'paid']],
      'no draft, void, invoice waiting for approval, other customer, or paid invoice older than a year');
    assert.match(body.invoices![0].payPath, /^\/i\/pay_[a-f0-9]{64}$/);
    const stored = (await db.collection('invoices').doc(id('open')).get()).data();
    assert.equal(`/i/${stored?.paymentToken}`, body.invoices![0].payPath, 'the pay page token is kept on the invoice');
  });

  test('a new link replaces the old one; turning it off ends it; a malformed token shows nothing', async () => {
    const fresh = ((await (await link('owner-1', 'POST')).json()) as { token: string }).token;
    assert.equal((await view(token)).status, 404);
    assert.equal((await view(fresh)).status, 200);
    assert.equal((await link('book-1', 'DELETE')).status, 200);
    assert.equal((await view(fresh)).status, 404);
    assert.equal((await view('cp_nothex')).status, 404);
    const audit = (await db.collection('auditLogs').where('workspaceId', '==', ws).get()).docs.map(d => d.data().action);
    assert.deepEqual(audit.filter(a => String(a).startsWith('CUSTOMER_PORTAL')).sort(), ['CUSTOMER_PORTAL_LINK', 'CUSTOMER_PORTAL_LINK', 'CUSTOMER_PORTAL_LINK_OFF']);
  });
});
