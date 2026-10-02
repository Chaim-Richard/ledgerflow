/** "Download my data" (L-10): a person's own data, and nobody else's. Runs with LF_TEST_DATABASE_URL. */
import test, { before, describe } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'crypto';
import type { Firestore } from '../server/db/pgFirestore';
import { collectPersonalData } from '../server/services/personalDataService';

const url = process.env.LF_TEST_DATABASE_URL;

describe('Personal data export (database)', { skip: !url && 'LF_TEST_DATABASE_URL not set' }, () => {
  const s = crypto.randomBytes(4).toString('hex');
  const me = `me_${s}`;
  let db: Firestore;
  before(async () => {
    process.env.DATABASE_URL = url;
    const { getDb } = await import('../server/db/firestore');
    db = getDb();
    await db.collection('users').doc(me).set({ uid: me, email: 'me@x.test', displayName: 'Me' });
    await db.collection('workspaces').doc(`own_${s}`).set({ uid: me, name: 'Mine' });
    await db.collection('workspaces').doc(`job_${s}`).set({ uid: `boss_${s}`, name: 'Job', members: [me], roles: { [me]: 'accountant' } });
    await db.collection('notifications').doc(`n1_${s}`).set({ workspaceId: `job_${s}`, uid: me, title: 'For me' });
    await db.collection('notifications').doc(`n2_${s}`).set({ workspaceId: `job_${s}`, uid: `boss_${s}`, title: 'For the boss' });
    await db.collection('auditLogs').doc(`a1_${s}`).set({ workspaceId: `job_${s}`, uid: me, action: 'X', timestamp: '2026-09-01T00:00:00Z' });
  });

  test('profile, workspaces with roles, own notifications and activity only', async () => {
    const data = await collectPersonalData(db, { uid: me, email: 'me@x.test' });
    assert.equal((data.person as { profile: { displayName: string } }).profile.displayName, 'Me');
    assert.deepEqual((data.workspaces as { name: string; role: string }[]).map(w => [w.name, w.role]).sort(), [['Job', 'accountant'], ['Mine', 'owner']]);
    assert.deepEqual((data.notifications as { title: string }[]).map(n => n.title), ['For me']);
    assert.equal((data.activity as unknown[]).length, 1);
  });
});
