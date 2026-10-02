/**
 * Retention (L-08) and legal hold (BJ-05): per-workspace periods for the email log and browser
 * error reports, the recovery window of a deleted workspace, and a hold that stops pruning and
 * purging. Bounce/spam reports are never pruned. The database part runs when
 * LF_TEST_DATABASE_URL is set.
 */
import test, { after, before, describe } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'crypto';
import { RETENTION_DEFAULTS, retentionFor, RetentionSettingsSchema, scheduledPurgeAt } from '../lib/retention';
import type { Firestore } from '../server/db/pgFirestore';

describe('Retention settings', () => {
  test('defaults, and saved values clamped to the allowed range', () => {
    assert.deepEqual(retentionFor(undefined), RETENTION_DEFAULTS);
    assert.deepEqual(retentionFor({ retention: { deletionGraceDays: 5, emailLogDays: 0, errorLogDays: 9999, legalHold: true } }),
      { deletionGraceDays: 30, emailLogDays: 0, errorLogDays: 365, legalHold: true });
  });

  test('the form is checked: whole days in range; 0 keeps the email log forever', () => {
    const ok = { deletionGraceDays: 60, emailLogDays: 0, errorLogDays: 30, legalHold: false };
    assert.equal(RetentionSettingsSchema.safeParse(ok).success, true);
    assert.equal(RetentionSettingsSchema.safeParse({ ...ok, deletionGraceDays: 7 }).success, false, 'under 30 days');
    assert.equal(RetentionSettingsSchema.safeParse({ ...ok, emailLogDays: 10 }).success, false);
    assert.equal(RetentionSettingsSchema.safeParse({ ...ok, errorLogDays: 30.5 }).success, false);
    assert.equal(RetentionSettingsSchema.safeParse({ ...ok, extra: 1 }).success, false);
  });

  test('the purge date follows the recovery window', () => {
    const deleted = new Date('2026-10-01T00:00:00Z');
    assert.equal(scheduledPurgeAt({}, deleted), '2026-10-31T00:00:00.000Z');
    assert.equal(scheduledPurgeAt({ retention: { deletionGraceDays: 90 } }, deleted), '2026-12-30T00:00:00.000Z');
  });
});

const url = process.env.LF_TEST_DATABASE_URL;

describe('Retention in the database', { skip: !url && 'LF_TEST_DATABASE_URL not set' }, () => {
  const suffix = crypto.randomBytes(4).toString('hex');
  const wsA = `ws_ret_a_${suffix}`;
  const wsB = `ws_ret_b_${suffix}`;
  const now = new Date('2026-10-02T12:00:00Z');
  const daysAgo = (n: number) => new Date(now.getTime() - n * 86_400_000).toISOString();
  let db: Firestore;
  let svc: typeof import('../server/services/retentionService');

  before(async () => {
    process.env.DATABASE_URL = url;
    const { getDb } = await import('../server/db/firestore');
    svc = await import('../server/services/retentionService');
    db = getDb();
    await db.collection('workspaces').doc(wsA).set({ uid: 'owner-1', name: 'A', members: ['owner-1', 'acct-1'], roles: { 'acct-1': 'accountant' }, retention: { deletionGraceDays: 30, emailLogDays: 90, errorLogDays: 30, legalHold: false } });
    await db.collection('workspaces').doc(wsB).set({ uid: 'owner-1', name: 'B', members: ['owner-1'], retention: { legalHold: true } });
    const email = (id: string, ws: string, event: string, at: string) => db.collection('emailEvents').doc(`${id}_${suffix}`).set({ workspaceId: ws, event, recipient: `${id}@example.com`, timestamp: at });
    await email('a-old-sent', wsA, 'sent', daysAgo(120));
    await email('a-old-delivered', wsA, 'delivered', daysAgo(120));
    await email('a-old-bounce', wsA, 'bounced', daysAgo(400));
    await email('a-new-sent', wsA, 'sent', daysAgo(10));
    await email('b-old-sent', wsB, 'sent', daysAgo(900));
    const error = (id: string, ws: string, at: string) => db.collection('errorLogs').doc(`${id}_${suffix}`).set({ workspaceId: ws, message: 'x', createdAt: at });
    await error('a-old', wsA, daysAgo(40));
    await error('a-new', wsA, daysAgo(5));
    await error('b-old', wsB, daysAgo(400));
    await error('anon-old', 'unauthenticated', daysAgo(100));
  });

  after(async () => {
    for (const table of ['emailEvents', 'errorLogs']) await db.pool.query(`delete from public."${table}" where id like $1`, [`%_${suffix}`]);
    for (const table of ['auditLogs', 'workspaces', 'jobRuns']) await db.pool.query(`delete from public."${table}" where workspace_id = any($1) or id = any($1)`, [[wsA, wsB]]);
    await db.terminate();
  });

  const exists = async (collection: string, id: string) => (await db.collection(collection).doc(`${id}_${suffix}`).get()).exists;

  test('the daily run prunes past their time, keeps bounces, and touches nothing on legal hold', async () => {
    await svc.applyRetention(db, now);
    assert.equal(await exists('emailEvents', 'a-old-sent'), false);
    assert.equal(await exists('emailEvents', 'a-old-delivered'), false);
    assert.equal(await exists('emailEvents', 'a-old-bounce'), true, 'bounces keep the address from being emailed again');
    assert.equal(await exists('emailEvents', 'a-new-sent'), true);
    assert.equal(await exists('errorLogs', 'a-old'), false);
    assert.equal(await exists('errorLogs', 'a-new'), true);
    assert.equal(await exists('emailEvents', 'b-old-sent'), true, 'legal hold');
    assert.equal(await exists('errorLogs', 'b-old'), true, 'legal hold');
    assert.equal(await exists('errorLogs', 'anon-old'), false, 'reports from before sign-in: the default 90 days');
  });

  test('only owners change it; a pending deletion follows the new window; changes are audited', async () => {
    const settings = { deletionGraceDays: 90, emailLogDays: 365, errorLogDays: 60, legalHold: true };
    await assert.rejects(svc.updateRetention(db, { workspaceId: wsA, uid: 'acct-1', settings }), /Only owners/);
    await assert.rejects(svc.updateRetention(db, { workspaceId: wsA, uid: 'owner-1', settings: { ...settings, errorLogDays: 1 } }), /errorLogDays/);

    await db.collection('workspaces').doc(wsA).update({ status: 'pending_deletion', deletedAt: '2026-10-01T00:00:00.000Z', scheduledPurgeAt: '2026-10-31T00:00:00.000Z' });
    await svc.updateRetention(db, { workspaceId: wsA, uid: 'owner-1', settings });
    const ws = (await db.collection('workspaces').doc(wsA).get()).data()!;
    assert.deepEqual(ws.retention, settings);
    assert.equal(ws.scheduledPurgeAt, '2026-12-30T00:00:00.000Z');
    const audit = (await db.collection('auditLogs').where('workspaceId', '==', wsA).get()).docs.map(d => d.data());
    assert.ok(audit.some(a => a.action === 'LEGAL_HOLD_ON'));
  });

  test('a deleted workspace on legal hold is not purged', async () => {
    const { purgePendingWorkspaces } = await import('../server/services/workspacePurgeService');
    await db.collection('workspaces').doc(wsB).update({ status: 'pending_deletion', deletedAt: '2026-01-01T00:00:00.000Z', scheduledPurgeAt: '2026-02-01T00:00:00.000Z' });
    const result = await purgePendingWorkspaces(db, [wsB]);
    assert.ok(!result.purgedWorkspaces.includes(wsB));
    assert.equal(await exists('errorLogs', 'b-old'), true);
    assert.equal((await db.collection('workspaces').doc(wsB).get()).exists, true);
  });
});
