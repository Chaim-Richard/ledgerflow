/** #97 / #98 against the real database: bulk time changes are all-or-nothing, and linking time to
 * an invoice again (a retry after a lost reply) is safe. Runs with LF_TEST_DATABASE_URL. */
import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import type { Firestore } from '../server/db/pgFirestore';
import { markInvoiced, moveTime } from '../server/services/timeService';
import { TIME_KIND } from '../lib/timeEntries';

const url = process.env.LF_TEST_DATABASE_URL;
describe('time changes are all-or-nothing', { skip: !url && 'LF_TEST_DATABASE_URL not set' }, () => {
  const ws = 'ws_time_' + crypto.randomBytes(5).toString('hex');
  const owner = { workspaceId: ws, uid: 'owner-1', email: 'o@example.test' };
  let db: Firestore;
  const entry = async (id: string, status: string, extra: Record<string, unknown> = {}) =>
    db.collection('documents').doc(`${ws}_${id}`).set({ kind: TIME_KIND, workspaceId: ws, person: 'owner-1', date: '2026-10-01', minutes: 60, description: id, status, billable: true, ...extra });
  const statusOf = async (id: string) => (await db.collection('documents').doc(`${ws}_${id}`).get()).data()?.status;

  before(async () => {
    process.env.DATABASE_URL = url;
    const { getDb } = await import('../server/db/firestore');
    db = getDb() as unknown as Firestore;
    await db.collection('workspaces').doc(ws).set({ uid: 'owner-1', members: ['owner-1'], roles: {}, currency: 'USD', name: 'Time tests' });
    await db.collection('invoices').doc(`${ws}_inv`).set({ workspaceId: ws, number: 'INV-1', status: 'draft', amountCents: 10000 });
  });
  after(async () => {
    if (!db) return;
    for (const table of ['documents', 'invoices', 'auditLogs', 'notifications', 'workspaces']) {
      await db.pool.query(`delete from public."${table}" where workspace_id = $1 or id = $1`, [ws]).catch(() => undefined);
    }
    await db.terminate();
  });

  test('#98: approving A and B when B cannot be approved changes neither', async () => {
    await entry('a', 'submitted');
    await entry('b', 'open');
    await assert.rejects(moveTime(db as never, { ...owner, entryIds: [`${ws}_a`, `${ws}_b`], to: 'approved' }), /cannot be made approved/);
    assert.equal(await statusOf('a'), 'submitted', 'A must not be approved when the batch was refused');
    assert.equal(await statusOf('b'), 'open');
  });

  test('#97: marking the same hours on the same invoice twice is a safe retry; another invoice is refused', async () => {
    await entry('c', 'approved');
    await entry('d', 'approved');
    const ids = [`${ws}_c`, `${ws}_d`];
    await markInvoiced(db as never, { ...owner, entryIds: ids, invoiceId: `${ws}_inv` });
    await markInvoiced(db as never, { ...owner, entryIds: ids, invoiceId: `${ws}_inv` });
    assert.equal(await statusOf('c'), 'invoiced');
    await db.collection('invoices').doc(`${ws}_inv2`).set({ workspaceId: ws, number: 'INV-2', status: 'draft', amountCents: 10000 });
    await assert.rejects(markInvoiced(db as never, { ...owner, entryIds: ids, invoiceId: `${ws}_inv2` }), /not approved billable time/);
  });
});
