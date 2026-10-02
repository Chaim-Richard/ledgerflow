/**
 * Workspace restore (src/server/services/workspaceRestoreService.ts) against a real database.
 * Runs when LF_TEST_DATABASE_URL is set; skipped otherwise.
 */
import test, { after, before, describe } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'crypto';
import { Firestore } from '../server/db/pgFirestore';
import { RestoreError, restoreWorkspaceBackup } from '../server/services/workspaceRestoreService';

const url = process.env.LF_TEST_DATABASE_URL;
const suffix = crypto.randomBytes(4).toString('hex');
const ws = `ws_restore_${suffix}`;
const other = `ws_other_${suffix}`;

describe('Workspace restore', { skip: !url && 'LF_TEST_DATABASE_URL not set' }, () => {
  let db: Firestore;

  before(async () => {
    db = new Firestore({ connectionString: url, max: 4 });
    await db.collection('workspaces').doc(ws).set({ uid: 'owner-1', name: 'Mine', plan: 'starter', roles: { 'v-1': 'viewer' } });
    await db.collection('workspaces').doc(other).set({ uid: 'owner-2', name: 'Theirs' });
    await db.collection('customers').doc(`${ws}_old`).set({ workspaceId: ws, name: 'Old customer' });
    await db.collection('customers').doc(`${other}_c1`).set({ workspaceId: other, name: 'Their customer' });
  });

  after(async () => {
    for (const table of ['customers', 'invoices', 'transactions', 'chartAccounts', 'workspaces']) {
      await db.pool.query(`delete from public."${table}" where workspace_id in ($1, $2) or id in ($1, $2)`, [ws, other]);
    }
    await db.terminate();
  });

  test('replaces the workspace records and keeps them in this workspace', async () => {
    const result = await restoreWorkspaceBackup(db, ws, {
      schemaVersion: 1,
      workspace: { id: ws, name: 'Restored name' },
      customers: [{ id: `${ws}_c1`, name: 'Acme', workspaceId: 'someone-else' }],
      accounts: [{ id: `${ws}_cash`, name: 'Cash', type: 'asset' }],
      transactions: [],
    });
    assert.deepEqual(result.counts, { customers: 1, chartAccounts: 1 });
    assert.equal((await db.collection('customers').doc(`${ws}_old`).get()).exists, false);
    const restored = (await db.collection('customers').doc(`${ws}_c1`).get()).data();
    assert.equal(restored?.workspaceId, ws);
    assert.equal((await db.collection('workspaces').doc(ws).get()).data()?.name, 'Restored name');
  });

  test('refuses a record id that belongs to another workspace, and changes nothing', async () => {
    await assert.rejects(restoreWorkspaceBackup(db, ws, {
      workspace: { id: ws, name: 'Hijack' },
      customers: [{ id: `${ws}_c2`, name: 'Fine' }, { id: `${other}_c1`, name: 'Taken over' }],
    }), (err: unknown) => err instanceof RestoreError && err.status === 409);
    assert.equal((await db.collection('customers').doc(`${other}_c1`).get()).data()?.name, 'Their customer');
    assert.equal((await db.collection('customers').doc(`${other}_c1`).get()).data()?.workspaceId, other);
    assert.equal((await db.collection('customers').doc(`${ws}_c1`).get()).exists, true);
    assert.equal((await db.collection('customers').doc(`${ws}_c2`).get()).exists, false);
    assert.equal((await db.collection('workspaces').doc(ws).get()).data()?.name, 'Restored name');
  });

  test('never restores ownership, roles or billing fields', async () => {
    await restoreWorkspaceBackup(db, ws, {
      workspace: {
        id: ws, uid: 'attacker', name: 'Renamed', plan: 'enterprise', bypassBilling: true,
        computeCreditBalance: 999999, roles: { attacker: 'owner' }, members: ['attacker'],
      },
    });
    const data = (await db.collection('workspaces').doc(ws).get()).data();
    assert.equal(data?.name, 'Renamed');
    assert.equal(data?.uid, 'owner-1');
    assert.equal(data?.plan, 'starter');
    assert.equal(data?.bypassBilling, undefined);
    assert.equal(data?.computeCreditBalance, undefined);
    assert.deepEqual(data?.roles, { 'v-1': 'viewer' });
    assert.equal(data?.members, undefined);
  });

  test('rejects malformed backups', async () => {
    for (const bad of [null, 'text', { workspace: { id: other } }, { schemaVersion: 2 },
      { customers: 'not-a-list' }, { customers: [42] }, { customers: [{ id: 'a/b' }] }]) {
      await assert.rejects(restoreWorkspaceBackup(db, ws, bad), (err: unknown) => err instanceof RestoreError && err.status === 400);
    }
  });
});

test('the restore endpoint is owner-only', async () => {
  const { serverSource } = await import('./helpers/serverSource');
  const server = serverSource();
  assert.match(server, /app\.post\("\/api\/v1\/workspaces\/:workspaceId\/restore", apiAuthenticate, requireWorkspaceRole\(\['owner'\]\)/);
});
