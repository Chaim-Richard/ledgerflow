/**
 * ISS-143 (GitHub #143): return authorizations through the server, on the real database
 * (returnAuthorizationService.ts via /api/v1/workspaces/:ws/return-authorizations). The issue's own cases:
 *   invoice INV-1 sold 5 Blue Widgets on line l1
 *   - two RMAs at the same moment for 3 each → one is made, the other is refused: 3 + 3 = 6 > 5
 *   - the same request key again → the first RMA back, nothing written twice
 *   - a bookkeeper cannot decide; the person who requested cannot decide (an owner either); a viewer and an outsider
 *     cannot request; another owner or the accountant can
 *   - approved / received / closed keep their 3 units: 2 left; declined gives its units back
 *   - two approvers at once (each expecting "requested") → one decides, the other is told it changed
 *   - closing links only a credit note of the same invoice, customer and workspace
 *   - a browser write straight into the customer's RMAs is refused by the database (supabase/tests/rls.test.sql)
 */
import test, { after, before, describe } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'crypto';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';

const url = process.env.LF_TEST_DATABASE_URL;

describe('ISS-143 RMAs through the server', { skip: !url && 'LF_TEST_DATABASE_URL not set' }, () => {
  const ws = `ws_rma_${crypto.randomBytes(4).toString('hex')}`;
  const id = (n: string) => `${ws}_${n}`;
  let db: import('../server/db/pgFirestore').Firestore;
  let server: Server;
  let base = '';
  const key = () => `k-${crypto.randomBytes(8).toString('hex')}`;
  const call = async (uid: string, path: string, body: Record<string, unknown>) => {
    const res = await fetch(`${base}/api/v1/workspaces/${ws}/return-authorizations${path}`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-test-uid': uid }, body: JSON.stringify(body) });
    return { status: res.status, body: await res.json() as Record<string, any> }; // eslint-disable-line @typescript-eslint/no-explicit-any
  };
  const request = (uid: string, quantity: number, requestKey = key()) =>
    call(uid, '', { customerId: id('c1'), invoiceId: id('inv1'), reason: 'Wrong size', lines: [{ invoiceLineId: 'l1', quantity }], requestKey });
  const move = (uid: string, rmaId: string, action: string, expectedStatus: string, extra: Record<string, unknown> = {}) =>
    call(uid, `/${rmaId}`, { customerId: id('c1'), action, expectedStatus, requestKey: key(), ...extra });

  before(async () => {
    process.env.DATABASE_URL = url;
    const { getDb } = await import('../server/db/firestore');
    db = getDb();
    await db.collection('workspaces').doc(ws).set({
      uid: 'u-owner', name: 'Returns Co', currency: 'USD', timezone: 'UTC',
      members: ['u-owner', 'u-owner2', 'u-acct', 'u-book', 'u-view'], roles: { 'u-owner2': 'owner', 'u-acct': 'accountant', 'u-book': 'bookkeeper', 'u-view': 'viewer' },
    });
    await db.collection('customers').doc(id('c1')).set({ workspaceId: ws, name: 'Acme Co' });
    await db.collection('invoices').doc(id('inv1')).set({
      workspaceId: ws, customerId: id('c1'), number: 'INV-1', status: 'sent', date: '2026-10-01', amountCents: 2_500,
      items: [{ id: 'l1', itemId: 'widget', description: 'Blue Widget', quantity: 5, rateCents: 500, amountCents: 2_500 }],
    });
    await db.collection('creditNotes').doc(id('cn-other')).set({ workspaceId: ws, customerId: id('c1'), invoiceId: 'another-invoice', number: 'CN-9', status: 'issued' });
    await db.collection('creditNotes').doc(id('cn1')).set({ workspaceId: ws, customerId: id('c1'), invoiceId: id('inv1'), number: 'CN-1', status: 'issued' });
    const express = (await import('express')).default;
    const { workspaceRouter } = await import('../server/routes/workspaceRoutes');
    const app = express();
    app.use(express.json());
    app.use((req, _res, next) => { (req as unknown as { user: { uid: string } }).user = { uid: String(req.header('x-test-uid')) }; next(); });
    app.use('/api/v1/workspaces', workspaceRouter);
    server = app.listen(0);
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });

  after(async () => {
    server?.close();
    for (const table of ['customers', 'invoices', 'creditNotes', 'idempotencyKeys', 'auditLogs', 'workspaces']) await db.pool.query(`delete from public."${table}" where workspace_id = $1 or id = $1`, [ws]).catch(() => {});
    await db.terminate();
  });

  let first = '';

  test('two RMAs for 3 of the 5 sold at the same moment: one is made, the other refused', async () => {
    const [a, b] = await Promise.all([request('u-book', 3), request('u-acct', 3)]);
    const statuses = [a.status, b.status].sort();
    assert.deepEqual(statuses, [200, 409], JSON.stringify([a.body, b.body]));
    const made = a.status === 200 ? a : b;
    const refused = a.status === 200 ? b : a;
    assert.match(String(refused.body.message), /3\.00 already requested or returned; only 2\.00 of 5 sold remain/);
    first = made.body.record.id;
    assert.match(made.body.record.number, /^RMA-2026-[A-HJ-NP-Z2-9]{12}$/);
    assert.deepEqual(made.body.record.lines, [{ invoiceLineId: 'l1', itemId: 'widget', description: 'Blue Widget', quantity: 3 }], 'the line as the invoice says it');
    const saved = (await db.collection('customers').doc(id('c1')).get()).data()!.metadata.returnAuthorizationsById;
    assert.equal(Object.keys(saved).length, 1);
  });

  test('the same request key again: the first answer, nothing written twice', async () => {
    const k = key();
    const once = await request('u-book', 1, k);
    const twice = await request('u-book', 1, k);
    assert.deepEqual([once.status, twice.status, twice.body.replayed], [200, 200, true]);
    assert.equal(twice.body.record.id, once.body.record.id);
    const saved = (await db.collection('customers').doc(id('c1')).get()).data()!.metadata.returnAuthorizationsById;
    assert.equal(Object.keys(saved).length, 2, '3 + 1 = 4 of 5 now held');
    // decline it: its unit comes back
    const requester = once.body.record.requestedByUid;
    const decider = requester === 'u-acct' ? 'u-owner' : 'u-acct';
    assert.equal((await move(decider, once.body.record.id, 'decline', 'requested', { note: 'Not ours' })).status, 200);
  });

  test('who may decide: not a bookkeeper, not the requester, not a viewer or an outsider', async () => {
    const made = (await db.collection('customers').doc(id('c1')).get()).data()!.metadata.returnAuthorizationsById;
    const record = Object.values(made as Record<string, { id: string; requestedByUid: string; status: string }>).find(r => r.id === first)!;
    assert.equal((await move('u-book', first, 'approve', 'requested')).status, 403);
    assert.equal((await move(record.requestedByUid, first, 'approve', 'requested')).status, 403, 'the requester cannot decide');
    assert.equal((await request('u-view', 1)).status, 403, 'a viewer cannot request');
    assert.equal((await request('u-out', 1)).status, 403, 'an outsider cannot request');
  });

  test('two approvers at once: one decides, the other is told it changed', async () => {
    const [a, b] = await Promise.all([move('u-owner2', first, 'approve', 'requested'), move('u-owner', first, 'approve', 'requested')]);
    assert.deepEqual([a.status, b.status].sort(), [200, 409], JSON.stringify([a.body, b.body]));
    const lost = a.status === 409 ? a : b;
    assert.match(String(lost.body.message), /approved now, not requested/);
  });

  test('approved, received and closed keep their 3 units (2 left; the declined one came back); closing needs this invoice\'s credit note', async () => {
    assert.equal((await request('u-book', 3)).status, 409, '3 held + 3 > 5');
    assert.equal((await move('u-book', first, 'receive', 'approved')).status, 200);
    assert.equal((await move('u-book', first, 'link-credit-note', 'received', { creditNoteId: id('cn-other') })).status, 409, 'a credit note of another invoice');
    const closed = await move('u-book', first, 'link-credit-note', 'received', { creditNoteId: id('cn1') });
    assert.equal(closed.status, 200, JSON.stringify(closed.body));
    assert.deepEqual([closed.body.record.status, closed.body.record.linkedCreditNoteNumber], ['closed', 'CN-1']);
    assert.equal((await request('u-book', 3)).status, 409, 'closed still holds its 3');
    assert.equal((await request('u-book', 2)).status, 200, 'the 2 left (the declined 1 came back)');
    const audit = (await db.collection('auditLogs').where('workspaceId', '==', ws).get()).docs.map(d => d.data().action);
    for (const action of ['RMA_REQUESTED', 'RMA_APPROVED', 'RMA_DECLINED', 'RMA_RECEIVED', 'RMA_CLOSED']) assert.ok(audit.includes(action), action);
  });
});
