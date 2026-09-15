import assert from 'node:assert/strict';
import { test, describe, before, after, beforeEach } from 'node:test';
import { readFileSync } from 'node:fs';
import { initializeTestEnvironment, RulesTestEnvironment } from '@firebase/rules-unit-testing';

const rules = readFileSync('firestore.rules', 'utf8');

describe('Firestore Security Rules Unit Tests', () => {
  let testEnv: RulesTestEnvironment;

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
      await testEnv.clearFirestore();
    }
  });

  function getFirestoreContext(auth: { uid: string; token?: Record<string, any> } | null) {
    if (!testEnv) {
      throw new Error('Rules test environment is not initialized');
    }
    if (auth) {
      return testEnv.authenticatedContext(auth.uid, auth.token).firestore();
    }
    return testEnv.unauthenticatedContext().firestore();
  }

  test('Default Deny catch-all rule blocks unknown collections and unauthenticated access', async () => {
    const db = getFirestoreContext(null);

    const randomDoc = db.doc('unspecified_collection/some-id');
    await assert.rejects(async () => {
      await randomDoc.get();
    }, /permission-denied/i);

    await assert.rejects(async () => {
      await randomDoc.set({ data: 'leak' });
    }, /permission-denied/i);
  });

  test('Non-members are denied access on workspaces', async () => {
    const aliceDb = getFirestoreContext({ uid: 'alice' });
    const bobDb = getFirestoreContext({ uid: 'bob' });

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
    const aliceDb = getFirestoreContext({ uid: 'alice' });
    const bobDb = getFirestoreContext({ uid: 'bob' });

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
    const aliceDb = getFirestoreContext({ uid: 'alice', token: { email: 'alice@example.com' } });

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

  test('User profile creation denies email mismatch with auth token', async () => {
    const aliceDb = getFirestoreContext({ uid: 'alice', token: { email: 'alice@example.com' } });
    const userRef = aliceDb.doc('users/alice');

    // Mismatched email attempt
    await assert.rejects(async () => {
      await userRef.set({
        uid: 'alice',
        email: 'attacker@example.com',
        role: 'client',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    }, /permission-denied/i);
  });

  test('LockDate on workspaces cannot be changed by the client on update', async () => {
    const aliceDb = getFirestoreContext({ uid: 'alice' });

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
    const aliceDb = getFirestoreContext({ uid: 'alice' });

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
    const aliceDb = getFirestoreContext({ uid: 'alice' });

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

  test('Support tickets and messages respect workspace boundaries and role constraints', async () => {
    const aliceDb = getFirestoreContext({ uid: 'alice' });
    const bobDb = getFirestoreContext({ uid: 'bob' });
    const adminDb = getFirestoreContext({ uid: 'admin', token: { admin: true } });

    // Alice creates her workspace
    await aliceDb.doc('workspaces/ws-alice').set({
      id: 'ws-alice',
      uid: 'alice',
      name: 'Alice Corp',
      createdAt: new Date().toISOString(),
    });

    // Alice creates a ticket
    const ticketId = 'ticket-1';
    await assert.doesNotReject(async () => {
      await aliceDb.doc(`supportTickets/${ticketId}`).set({
        id: ticketId,
        workspaceId: 'ws-alice',
        uid: 'alice',
        subject: 'Help me',
        status: 'open',
        priority: 'normal',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        lastMessageAt: new Date().toISOString(),
        lastMessageBy: 'alice',
        unreadForUser: false,
        unreadForAdmin: true
      });
    });

    // Bob tries to read Alice's ticket
    await assert.rejects(async () => {
      await bobDb.doc(`supportTickets/${ticketId}`).get();
    }, /permission-denied/i);

    // Admin can read Alice's ticket
    await assert.doesNotReject(async () => {
      await adminDb.doc(`supportTickets/${ticketId}`).get();
    });

    // Alice creates a message
    const msgId = 'msg-1';
    await assert.doesNotReject(async () => {
      await aliceDb.doc(`supportMessages/${msgId}`).set({
        id: msgId,
        ticketId,
        workspaceId: 'ws-alice',
        authorUid: 'alice',
        authorRole: 'user',
        body: 'Hello',
        createdAt: new Date().toISOString()
      });
    });

    // Bob tries to read Alice's message
    await assert.rejects(async () => {
      await bobDb.doc(`supportMessages/${msgId}`).get();
    }, /permission-denied/i);

    // Alice tries to create a message as admin (spoofing)
    await assert.rejects(async () => {
      await aliceDb.doc('supportMessages/msg-2').set({
        id: 'msg-2',
        ticketId,
        workspaceId: 'ws-alice',
        authorUid: 'alice',
        authorRole: 'admin',
        body: 'I am admin',
        createdAt: new Date().toISOString()
      });
    }, /permission-denied/i);

    // Admin creates a message
    await assert.doesNotReject(async () => {
      await adminDb.doc('supportMessages/msg-admin').set({
        id: 'msg-admin',
        ticketId,
        workspaceId: 'ws-alice',
        authorUid: 'admin',
        authorRole: 'admin',
        body: 'I am the real admin',
        createdAt: new Date().toISOString()
      });
    });

    // Nobody can delete a ticket
    await assert.rejects(async () => {
      await adminDb.doc(`supportTickets/${ticketId}`).delete();
    }, /permission-denied/i);

    // Nobody can edit a message
    await assert.rejects(async () => {
      await adminDb.doc(`supportMessages/${msgId}`).update({ body: 'hacked' });
    }, /permission-denied/i);
  });

  test('Workspace role enforcement: viewer cannot write transaction, bookkeeper can write transaction but cannot change lockDate, accountant can change lockDate', async () => {
    // 1. Setup workspace with roles
    const ownerDb = getFirestoreContext({ uid: 'owner-uid' });
    const viewerDb = getFirestoreContext({ uid: 'viewer-uid' });
    const bookkeeperDb = getFirestoreContext({ uid: 'bookkeeper-uid' });
    const accountantDb = getFirestoreContext({ uid: 'accountant-uid' });

    const wsRef = ownerDb.doc('workspaces/ws-roles-test');
    await assert.doesNotReject(async () => {
      await wsRef.set({
        id: 'ws-roles-test',
        uid: 'owner-uid',
        name: 'Role Test Workspace',
        roles: {
          'viewer-uid': 'viewer',
          'bookkeeper-uid': 'bookkeeper',
          'accountant-uid': 'accountant',
          'owner-uid': 'owner'
        },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
    });

    // 2. Viewer attempts transaction write -> MUST BE REJECTED
    const viewerTxRef = viewerDb.doc('transactions/tx-viewer-1');
    await assert.rejects(async () => {
      await viewerTxRef.set({
        id: 'tx-viewer-1',
        uid: 'viewer-uid',
        workspaceId: 'ws-roles-test',
        date: '2026-09-10',
        description: 'Unauthorized viewer transaction',
        totalAmountCents: 5000
      });
    }, /permission-denied/i);

    // 3. Bookkeeper attempts transaction write -> PERMITTED
    const bkTxRef = bookkeeperDb.doc('transactions/tx-bk-1');
    await assert.doesNotReject(async () => {
      await bkTxRef.set({
        id: 'tx-bk-1',
        uid: 'bookkeeper-uid',
        workspaceId: 'ws-roles-test',
        date: '2026-09-10',
        description: 'Authorized bookkeeper transaction',
        totalAmountCents: 5000
      });
    });

    // 4. Bookkeeper attempts lockDate change -> MUST BE REJECTED
    const bkWsRef = bookkeeperDb.doc('workspaces/ws-roles-test');
    await assert.rejects(async () => {
      await bkWsRef.update({
        lockDate: '2026-08-31',
        updatedAt: new Date().toISOString()
      });
    }, /permission-denied/i);

    // 5. Accountant attempts lockDate change -> PERMITTED
    const accWsRef = accountantDb.doc('workspaces/ws-roles-test');
    await assert.doesNotReject(async () => {
      await accWsRef.update({
        lockDate: '2026-08-31',
        updatedAt: new Date().toISOString()
      });
    });
  });

  test('Privilege Escalation Regression: signed-in user with specific email but no admin claim is denied admin reads', async () => {
    // User signed in with email claim shmuelbiller@gmail.com but NO admin: true or role: 'admin' claim
    const unprivilegedAdminEmailDb = getFirestoreContext({
      uid: 'unprivileged-user-123',
      token: { email: 'shmuelbiller@gmail.com' }
    });

    const adminRef = unprivilegedAdminEmailDb.doc('admins/confidential-admin-doc');

    // Must be denied reading protected admin documents
    await assert.rejects(async () => {
      await adminRef.get();
    }, /permission-denied/i);

    // Must be denied reading other users' support tickets
    const foreignTicketRef = unprivilegedAdminEmailDb.doc('supportTickets/ticket-foreign-workspace');
    await assert.rejects(async () => {
      await foreignTicketRef.get();
    }, /permission-denied/i);
  });
});
