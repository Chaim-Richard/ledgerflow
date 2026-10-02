/**
 * Deleting an account (L-09): shared books are never deleted or left without an owner; a
 * workspace only the person uses is scheduled for deletion; they leave the others; personal data
 * goes. The database part runs when LF_TEST_DATABASE_URL is set.
 */
import test, { before, describe } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'crypto';
import type { Firestore } from '../server/db/pgFirestore';
import { AccountDeletionBlocked, deleteAccount, planAccountDeletion, withoutMember } from '../server/services/accountDeletionService';

const url = process.env.LF_TEST_DATABASE_URL;

describe('Account deletion plan', () => {
  test('alone: delete; co-owned or a member: leave; sole owner with others: blocked', () => {
    const plan = planAccountDeletion('me', [
      { id: 'solo', data: { uid: 'me', name: 'Solo', members: [] } },
      { id: 'coowned', data: { uid: 'me', name: 'Co', members: ['ann'], roles: { ann: 'owner' } } },
      { id: 'staff', data: { uid: 'boss', name: 'Staff', members: ['me'], roles: { me: 'bookkeeper' } } },
      { id: 'shared', data: { uid: 'me', name: 'Shared books', members: ['bob'], roles: { bob: 'accountant' } } },
      { id: 'other', data: { uid: 'zed', name: 'Not mine', members: ['amy'] } },
      { id: 'going', data: { uid: 'me', name: 'Already going', status: 'pending_deletion' } },
    ]);
    assert.deepEqual(plan.scheduleDeletion.map(w => w.id), ['solo']);
    assert.deepEqual(plan.leave.map(w => w.id), ['coowned', 'staff']);
    assert.deepEqual(plan.blocked, [{ id: 'shared', name: 'Shared books', otherMembers: 1 }]);
  });

  test('leaving hands the workspace to another owner', () => {
    assert.deepEqual(withoutMember('me', { uid: 'me', members: ['ann', 'me'], roles: { ann: 'owner', me: 'owner' } }), { roles: { ann: 'owner' }, members: ['ann'], uid: 'ann' });
    assert.deepEqual(withoutMember('me', { uid: 'boss', members: ['me'], roles: { me: 'viewer' } }), { roles: {}, members: [] });
  });
});

describe('Account deletion (database)', { skip: !url && 'LF_TEST_DATABASE_URL not set' }, () => {
  const s = crypto.randomBytes(4).toString('hex');
  const me = `user_${s}`;
  let db: Firestore;
  before(async () => {
    process.env.DATABASE_URL = url;
    const { getDb } = await import('../server/db/firestore');
    db = getDb();
    await db.collection('workspaces').doc(`solo_${s}`).set({ uid: me, name: 'Solo', members: [] });
    await db.collection('workspaces').doc(`staff_${s}`).set({ uid: `boss_${s}`, name: 'Staff', members: [me], roles: { [me]: 'bookkeeper' } });
    await db.collection('users').doc(me).set({ uid: me, email: 'me@x.test' });
    await db.collection('notifications').doc(`n_${s}`).set({ workspaceId: `staff_${s}`, uid: me, title: 'Hi' });
  });

  test('blocked while sole owner of shared books; then deletes cleanly', async () => {
    await db.collection('workspaces').doc(`shared_${s}`).set({ uid: me, name: 'Shared', members: [`bob_${s}`], roles: { [`bob_${s}`]: 'accountant' } });
    const deleted: string[] = [];
    const deleteSignIn = async (uid: string) => { deleted.push(uid); };
    await assert.rejects(deleteAccount(db, { uid: me }, deleteSignIn), (e: unknown) => e instanceof AccountDeletionBlocked && /Shared/.test((e as Error).message));
    assert.deepEqual(deleted, [], 'nothing deleted when blocked');
    // make Bob an owner, then delete
    await db.collection('workspaces').doc(`shared_${s}`).update({ roles: { [`bob_${s}`]: 'owner' } });
    const result = await deleteAccount(db, { uid: me }, deleteSignIn);
    assert.deepEqual(result.scheduledForDeletion, [`solo_${s}`]);
    assert.deepEqual(result.left.sort(), [`shared_${s}`, `staff_${s}`].sort());
    assert.deepEqual(deleted, [me]);
    const solo = (await db.collection('workspaces').doc(`solo_${s}`).get()).data() || {};
    assert.equal(solo.status, 'pending_deletion');
    const shared = (await db.collection('workspaces').doc(`shared_${s}`).get()).data() || {};
    assert.equal(shared.uid, `bob_${s}`, 'Bob owns the shared books now');
    const staff = (await db.collection('workspaces').doc(`staff_${s}`).get()).data() || {};
    assert.deepEqual(staff.members, []);
    assert.equal((await db.collection('users').doc(me).get()).exists, false);
    assert.equal((await db.collection('notifications').doc(`n_${s}`).get()).exists, false);
  });
});
