import assert from 'node:assert/strict';
import { test, describe, before, after, beforeEach } from 'node:test';
import { readFileSync } from 'node:fs';
import { initializeTestEnvironment, RulesTestEnvironment } from '@firebase/rules-unit-testing';

const rules = readFileSync('firestore.rules', 'utf8');

describe('Firestore Security Rules Unit Tests', () => {
  let testEnv: RulesTestEnvironment | null = null;

  before(async () => {
    testEnv = await initializeTestEnvironment({
      projectId: 'demo-ledgerflow',
      firestore: {
        rules,
        host: '127.0.0.1',
        port: 8080,
      },
    });
  });

  after(async () => {
    if (testEnv) {
      await testEnv.cleanup();
    }
  });

  beforeEach(async () => {
    if (testEnv) {
      try {
        await testEnv.clearFirestore();
      } catch (e) {
        // Ignore clearing error if emulator is not connected
      }
    }
  });

  function getFirestoreContext(auth: { uid: string; token?: Record<string, any> } | null) {
    if (!testEnv) return null;
    if (auth) {
      return testEnv.authenticatedContext(auth.uid, auth.token).firestore();
    }
    return testEnv.unauthenticatedContext().firestore();
  }

  test('Default Deny catch-all rule blocks unknown collections and unauthenticated access', async () => {
    if (!testEnv) return;
    const db = getFirestoreContext(null);
    if (!db) return;

    const randomDoc = db.doc('unspecified_collection/some-id');
    await assert.rejects(async () => {
      await randomDoc.get();
    }, /permission-denied/i);

    await assert.rejects(async () => {
      await randomDoc.set({ data: 'leak' });
    }, /permission-denied/i);
  });

  test('Non-members are denied access on workspaces', async () => {
    if (!testEnv) return;
    const aliceDb = getFirestoreContext({ uid: 'alice' });
    const bobDb = getFirestoreContext({ uid: 'bob' });
    if (!aliceDb || !bobDb) return;

    // Create a workspace for Alice
    const wsRef = aliceDb.doc('workspaces/ws-alice');
    await assert.doesNotReject(async () => {
      await wsRef.set({
        id: 'ws-alice',
        uid: 'alice',
        name: 'Alice Corp',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    });

    // Bob (non-member) tries to read Alice's workspace
    const wsBobRef = bobDb.doc('workspaces/ws-alice');
    await assert.rejects(async () => {
      await wsBobRef.get();
    }, /permission-denied/i);

    // Bob tries to delete/write Alice's workspace
    await assert.rejects(async () => {
      await wsBobRef.set({ name: 'Bob Hijack' });
    }, /permission-denied/i);
  });

  test('Non-members are denied access on scoped ledger resources (transactions, chartAccounts, projects)', async () => {
    if (!testEnv) return;
    const aliceDb = getFirestoreContext({ uid: 'alice' });
    const bobDb = getFirestoreContext({ uid: 'bob' });
    if (!aliceDb || !bobDb) return;

    // Alice creates her workspace
    await aliceDb.doc('workspaces/ws-alice').set({
      id: 'ws-alice',
      uid: 'alice',
      name: 'Alice Corp',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    // Bob tries to create transactions in Alice's workspace
    const txBobRef = bobDb.doc('transactions/tx-1');
    await assert.rejects(async () => {
      await txBobRef.set({
        id: 'tx-1',
        uid: 'bob',
        workspaceId: 'ws-alice',
        date: '2026-09-01',
        description: 'Unauthorised transaction',
        lines: [],
      });
    }, /permission-denied/i);

    // Bob tries to write to Chart Accounts in Alice's workspace
    const accBobRef = bobDb.doc('chartAccounts/acc-1');
    await assert.rejects(async () => {
      await accBobRef.set({
        id: 'acc-1',
        uid: 'bob',
        workspaceId: 'ws-alice',
        name: 'Unauthorised Cash',
        code: '1000',
        type: 'asset',
      });
    }, /permission-denied/i);

    // Bob tries to write to Projects in Alice's workspace
    const projBobRef = bobDb.doc('projects/proj-1');
    await assert.rejects(async () => {
      await projBobRef.set({
        id: 'proj-1',
        uid: 'bob',
        workspaceId: 'ws-alice',
        name: 'Unauthorised Project',
      });
    }, /permission-denied/i);
  });

  test('Role field on users collection cannot be changed by the client', async () => {
    if (!testEnv) return;
    const aliceDb = getFirestoreContext({ uid: 'alice' });
    if (!aliceDb) return;

    const userRef = aliceDb.doc('users/alice');
    
    // Create Alice's user profile with client role
    await assert.doesNotReject(async () => {
      await userRef.set({
        uid: 'alice',
        email: 'alice@example.com',
        role: 'client',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    });

    // Try to update role to admin (should fail due to isUnchanged("role"))
    await assert.rejects(async () => {
      await userRef.update({
        role: 'admin',
        updatedAt: new Date().toISOString(),
      });
    }, /permission-denied/i);
  });

  test('LockDate on workspaces cannot be changed by the client on update', async () => {
    if (!testEnv) return;
    const aliceDb = getFirestoreContext({ uid: 'alice' });
    if (!aliceDb) return;

    const wsRef = aliceDb.doc('workspaces/ws-alice');

    // Create workspace with lockDate
    await assert.doesNotReject(async () => {
      await wsRef.set({
        id: 'ws-alice',
        uid: 'alice',
        name: 'Alice Workspace',
        lockDate: '2026-01-01',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    });

    // Try to update lockDate (should fail due to isUnchanged("lockDate"))
    await assert.rejects(async () => {
      await wsRef.update({
        lockDate: '2026-06-01',
        updatedAt: new Date().toISOString(),
      });
    }, /permission-denied/i);
  });

  test('balanceCents and openingBalanceCents on chartAccounts cannot be changed by the client on update', async () => {
    if (!testEnv) return;
    const aliceDb = getFirestoreContext({ uid: 'alice' });
    if (!aliceDb) return;

    // Create Alice's workspace
    await aliceDb.doc('workspaces/ws-alice').set({
      id: 'ws-alice',
      uid: 'alice',
      name: 'Alice Workspace',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    const accRef = aliceDb.doc('chartAccounts/acc-1');

    // Create account
    await assert.doesNotReject(async () => {
      await accRef.set({
        id: 'acc-1',
        uid: 'alice',
        workspaceId: 'ws-alice',
        name: 'Office Supplies',
        code: '5000',
        type: 'expense',
        category: 'Operating Expenses',
        subtype: 'office_supplies',
        balanceCents: 0,
        openingBalanceCents: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    });

    // Try to update balanceCents (should fail due to isUnchanged("balanceCents"))
    await assert.rejects(async () => {
      await accRef.update({
        balanceCents: 15000,
        updatedAt: new Date().toISOString(),
      });
    }, /permission-denied/i);

    // Try to update openingBalanceCents (should fail due to isUnchanged("openingBalanceCents"))
    await assert.rejects(async () => {
      await accRef.update({
        openingBalanceCents: 10000,
        updatedAt: new Date().toISOString(),
      });
    }, /permission-denied/i);
  });

  test('Admins collection and external_api_cache are locked down completely for clients', async () => {
    if (!testEnv) return;
    const aliceDb = getFirestoreContext({ uid: 'alice' });
    if (!aliceDb) return;

    const cacheRef = aliceDb.doc('external_api_cache/some-key');
    const adminRef = aliceDb.doc('admins/some-id');

    // Alice (client) cannot write to external_api_cache
    await assert.rejects(async () => {
      await cacheRef.set({ value: 'cached_data' });
    }, /permission-denied/i);

    // Alice (client) cannot read external_api_cache
    await assert.rejects(async () => {
      await cacheRef.get();
    }, /permission-denied/i);

    // Alice (client) cannot write to admins
    await assert.rejects(async () => {
      await adminRef.set({ isAdmin: true });
    }, /permission-denied/i);

    // Alice (client) cannot read admins (requires admin token custom claim)
    await assert.rejects(async () => {
      await adminRef.get();
    }, /permission-denied/i);
  });
});
