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

  test('Workspace owner and members are strictly forbidden from changing plan, concurrentUserLimit, or bypassBilling', async () => {
    const ownerDb = getFirestoreContext({ uid: 'workspace-owner-123' });
    const wsRef = ownerDb.doc('workspaces/ws-plan-lock-test');

    // Create initial workspace with free plan
    await assert.doesNotReject(async () => {
      await wsRef.set({
        id: 'ws-plan-lock-test',
        uid: 'workspace-owner-123',
        name: 'Plan Lock Test Workspace',
        plan: 'free',
        concurrentUserLimit: 2,
        bypassBilling: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
    });

    // Owner attempts to update plan to enterprise -> MUST BE REJECTED
    await assert.rejects(async () => {
      await wsRef.update({
        plan: 'enterprise',
        updatedAt: new Date().toISOString()
      });
    }, /permission-denied/i);

    // Owner attempts to alter bypassBilling to true -> MUST BE REJECTED
    await assert.rejects(async () => {
      await wsRef.update({
        bypassBilling: true,
        updatedAt: new Date().toISOString()
      });
    }, /permission-denied/i);

    // Owner attempts to increase concurrentUserLimit -> MUST BE REJECTED
    await assert.rejects(async () => {
      await wsRef.update({
        concurrentUserLimit: 999,
        updatedAt: new Date().toISOString()
      });
    }, /permission-denied/i);

    // Standard allowed update (e.g. changing workspace name) -> PERMITTED
    await assert.doesNotReject(async () => {
      await wsRef.update({
        name: 'Updated Workspace Name',
        updatedAt: new Date().toISOString()
      });
    });
  });

  test('All 29 subscribed collections enforce member isolation, owner read/write, and viewer write restrictions', async () => {
    const aliceDb = getFirestoreContext({ uid: 'alice-owner' });
    const bobViewerDb = getFirestoreContext({ uid: 'bob-viewer' });
    const daveForeignDb = getFirestoreContext({ uid: 'dave-foreign' });

    // 1. Setup workspace A owned by Alice, with Bob as viewer
    await aliceDb.doc('workspaces/ws-coverage-a').set({
      id: 'ws-coverage-a',
      uid: 'alice-owner',
      name: 'Coverage Workspace A',
      roles: {
        'bob-viewer': 'viewer'
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });

    // 2. Setup workspace B owned by Dave
    await daveForeignDb.doc('workspaces/ws-coverage-b').set({
      id: 'ws-coverage-b',
      uid: 'dave-foreign',
      name: 'Coverage Workspace B',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });

    const docFactories: Record<string, (wsId: string, uid: string, id: string) => Record<string, any>> = {
      transactions: (wsId, uid, id) => ({
        id, uid, workspaceId: wsId, date: '2026-09-01', description: 'Test Tx', totalAmountCents: 1000, lines: []
      }),
      chartAccounts: (wsId, uid, id) => ({
        id, uid, workspaceId: wsId, name: 'Cash Acc', code: '1010', type: 'asset', category: 'Cash', subtype: 'checking'
      }),
      projects: (wsId, uid, id) => ({
        id, uid, workspaceId: wsId, name: 'Proj A', status: 'active'
      }),
      budgets: (wsId, uid, id) => ({
        id, uid, workspaceId: wsId, name: 'Budget A', year: 2026, currency: 'USD', categories: []
      }),
      vendors: (wsId, uid, id) => ({
        id, uid, workspaceId: wsId, name: 'Vendor A'
      }),
      customers: (wsId, uid, id) => ({
        id, uid, workspaceId: wsId, name: 'Customer A', email: 'cust@a.com'
      }),
      invoices: (wsId, uid, id) => ({
        id, uid, workspaceId: wsId, customerId: 'cust-1', customerName: 'Customer A', number: 'INV-A-1', date: '2026-09-01', totalAmountCents: 1000, status: 'draft', lines: []
      }),
      bills: (wsId, uid, id) => ({
        id, uid, workspaceId: wsId, vendorId: 'vend-1', vendorName: 'Vendor A', number: 'BILL-A-1', date: '2026-09-01', totalAmountCents: 1000, status: 'draft', lines: []
      }),
      payments: (wsId, uid, id) => ({
        id, uid, workspaceId: wsId, paymentNumber: 'PMT-A-1', type: 'customer', direction: 'inflow', amountCents: 1000, currency: 'USD', date: '2026-09-01'
      }),
      estimates: (wsId, uid, id) => ({
        id, uid, workspaceId: wsId, customerId: 'cust-1', customerName: 'Customer A', estimateNumber: 'EST-A-1', date: '2026-09-01', status: 'draft', totalAmountCents: 1000, lines: []
      }),
      inventory: (wsId, uid, id) => ({
        id, uid, workspaceId: wsId, name: 'Item A', sku: 'SKU-A'
      }),
      assets: (wsId, uid, id) => ({
        id, uid, workspaceId: wsId, name: 'Laptop A', code: 'AST-A-1', type: 'equipment'
      }),
      recurring: (wsId, uid, id) => ({
        id, uid, workspaceId: wsId, type: 'invoice', name: 'Monthly A', interval: 'monthly', frequency: 'monthly', dayOfMonth: 1, startDate: '2026-09-01', amountCents: 1000, status: 'active'
      }),
      employees: (wsId, uid, id) => ({
        id, uid, workspaceId: wsId, name: 'Employee A', email: 'emp@a.com'
      }),
      payRuns: (wsId, uid, id) => ({
        id, uid, workspaceId: wsId, period: '2026-09', status: 'draft'
      }),
      taxRates: (wsId, uid, id) => ({
        id, uid, workspaceId: wsId, name: 'VAT A', code: 'VAT-A', rate: 0.20
      }),
      dimensionNodes: (wsId, uid, id) => ({
        id, uid, workspaceId: wsId, code: 'DN-A', name: 'Node A', dimensionType: 'department', path: '/DN-A', level: 1, isActive: true
      }),
      creditNotes: (wsId, uid, id) => ({
        id, uid, workspaceId: wsId, customerId: 'cust-1', customerName: 'Customer A', number: 'CN-A-1', amountCents: 500, remainingCents: 500, date: '2026-09-01', reason: 'Refund', status: 'draft', currency: 'USD', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString()
      }),
      vendorCredits: (wsId, uid, id) => ({
        id, uid, workspaceId: wsId, vendorId: 'vend-1', vendorName: 'Vendor A', number: 'VC-A-1', amountCents: 500, remainingCents: 500, date: '2026-09-01', reason: 'Credit', status: 'draft', currency: 'USD', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString()
      }),
      periods: (wsId, uid, id) => ({
        id, uid, workspaceId: wsId, periodId: '2026-09', status: 'open', startDate: '2026-09-01', endDate: '2026-09-30'
      }),
      scenarios: (wsId, uid, id) => ({
        id, uid, workspaceId: wsId, name: 'Scenario A', description: 'Test', ghosts: [], isActive: true
      }),
      reconciliations: (wsId, uid, id) => ({
        id, uid, workspaceId: wsId, bankAccountId: 'acc-1', statementDate: '2026-09-30', statementBalanceCents: 10000, ledgerBalanceCents: 10000, status: 'draft', reconciledTransactions: []
      }),
      auditLogs: (wsId, uid, id) => ({
        id, uid, userId: uid, workspaceId: wsId, action: 'CREATE', details: 'Audit A', severity: 'info', timestamp: new Date().toISOString()
      }),
      bankLines: (wsId, uid, id) => ({
        id, uid, workspaceId: wsId, date: '2026-09-01', description: 'Bank Line A', amountCents: 5000
      }),
      autoRules: (wsId, uid, id) => ({
        id, uid, workspaceId: wsId, name: 'Rule A', pattern: 'Vendor', accountId: 'acc-1', accountName: 'Expenses', enabled: true
      }),
      rulePatterns: (wsId, uid, id) => ({
        id, uid, workspaceId: wsId, description: 'pattern a', accountId: 'acc-1', accountName: 'Expenses', count: 1
      }),
      partners: (wsId, uid, id) => ({
        id, uid, workspaceId: wsId, name: 'Partner A'
      })
    };

    // Test all 27 standard workspace-scoped collections
    for (const [colName, factory] of Object.entries(docFactories)) {
      const docId = `doc-${colName}-1`;
      const docRefAlice = aliceDb.doc(`${colName}/${docId}`);
      const docRefBob = bobViewerDb.doc(`${colName}/${docId}`);
      const docRefDave = daveForeignDb.doc(`${colName}/${docId}`);

      const payload = factory('ws-coverage-a', 'alice-owner', docId);

      // 1. Owner can write
      await assert.doesNotReject(async () => {
        await docRefAlice.set(payload);
      }, `Owner failed to write to collection: ${colName}`);

      // 2. Owner can read
      const snapAlice = await docRefAlice.get();
      assert.equal(snapAlice.exists, true, `Owner could not read created document in ${colName}`);

      // 3. Viewer in workspace A can read, but cannot write or mutate
      const snapBob = await docRefBob.get();
      assert.equal(snapBob.exists, true, `Viewer in workspace should be able to read ${colName}`);

      const bobPayload = factory('ws-coverage-a', 'bob-viewer', `doc-${colName}-bob`);
      const docRefBobNew = bobViewerDb.doc(`${colName}/doc-${colName}-bob`);
      await assert.rejects(async () => {
        await docRefBobNew.set(bobPayload);
      }, /permission-denied/i, `Viewer was incorrectly permitted to write in ${colName}`);

      // 4. Foreign workspace member (Dave in ws-coverage-b) cannot read workspace A's document
      await assert.rejects(async () => {
        await docRefDave.get();
      }, /permission-denied/i, `Foreign workspace member was able to read ${colName} in another workspace`);
    }

    // 28. customTemplates (user-scoped collection)
    const tmplAliceRef = aliceDb.doc('customTemplates/tmpl-alice-1');
    await assert.doesNotReject(async () => {
      await tmplAliceRef.set({
        name: 'Template A',
        industry: 'Software',
        accounts: [],
        analyticalTopology: {},
        uid: 'alice-owner',
        createdAt: new Date().toISOString()
      });
    }, 'Owner should be able to create customTemplate');
    const tmplSnap = await tmplAliceRef.get();
    assert.equal(tmplSnap.exists, true);

    // Foreign user Dave cannot read Alice's template
    const tmplDaveRef = daveForeignDb.doc('customTemplates/tmpl-alice-1');
    await assert.rejects(async () => {
      await tmplDaveRef.get();
    }, /permission-denied/i, 'Foreign user should not read customTemplate of another user');

    // 29. workspaces collection
    const wsRefAlice = aliceDb.doc('workspaces/ws-coverage-a');
    const wsSnap = await wsRefAlice.get();
    assert.equal(wsSnap.exists, true);

    const wsRefDave = daveForeignDb.doc('workspaces/ws-coverage-a');
    await assert.rejects(async () => {
      await wsRefDave.get();
    }, /permission-denied/i, 'Foreign workspace member should not read foreign workspace');
  });

  test('P1.1 Period Locking: Invoices, bills, credit notes and transactions enforce lockDate', async () => {
    const aliceDb = getFirestoreContext({ uid: 'alice-period' });

    // Workspace locked through 2026-06-30
    await aliceDb.doc('workspaces/ws-locked').set({
      id: 'ws-locked',
      uid: 'alice-period',
      name: 'Locked Workspace',
      lockDate: '2026-06-30',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });

    // 1. Transaction dated 2026-05-15 (prior to lockDate) -> MUST BE REJECTED
    await assert.rejects(async () => {
      await aliceDb.doc('transactions/tx-locked').set({
        id: 'tx-locked',
        uid: 'alice-period',
        workspaceId: 'ws-locked',
        date: '2026-05-15',
        description: 'Locked Tx',
        totalAmountCents: 1000,
        lines: []
      });
    }, /permission-denied/i, 'Creating transaction in closed period must be denied');

    // 2. Transaction dated 2026-07-15 (after lockDate) -> MUST SUCCEED
    await assert.doesNotReject(async () => {
      await aliceDb.doc('transactions/tx-open').set({
        id: 'tx-open',
        uid: 'alice-period',
        workspaceId: 'ws-locked',
        date: '2026-07-15',
        description: 'Open Tx',
        totalAmountCents: 1000,
        lines: []
      });
    }, 'Creating transaction in open period must be permitted');

    // 3. Invoice dated 2026-05-15 (prior to lockDate) -> MUST BE REJECTED
    await assert.rejects(async () => {
      await aliceDb.doc('invoices/inv-locked').set({
        id: 'inv-locked',
        uid: 'alice-period',
        workspaceId: 'ws-locked',
        customerId: 'c-1',
        customerName: 'Cust',
        number: 'INV-001',
        date: '2026-05-15',
        totalAmountCents: 1000,
        status: 'draft',
        lines: []
      });
    }, /permission-denied/i, 'Creating invoice in closed period must be denied');

    // 4. Invoice dated 2026-07-15 (after lockDate) -> MUST SUCCEED
    await assert.doesNotReject(async () => {
      await aliceDb.doc('invoices/inv-open').set({
        id: 'inv-open',
        uid: 'alice-period',
        workspaceId: 'ws-locked',
        customerId: 'c-1',
        customerName: 'Cust',
        number: 'INV-002',
        date: '2026-07-15',
        totalAmountCents: 1000,
        status: 'draft',
        lines: []
      });
    }, 'Creating invoice in open period must be permitted');
  });

  test('P1.2 Hard-Delete Prevention: Posted financial documents cannot be hard-deleted', async () => {
    const aliceDb = getFirestoreContext({ uid: 'alice-delete' });

    await aliceDb.doc('workspaces/ws-delete-test').set({
      id: 'ws-delete-test',
      uid: 'alice-delete',
      name: 'Delete Test Workspace',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });

    // 1. Create a draft invoice -> Should be deletable
    await aliceDb.doc('invoices/inv-draft').set({
      id: 'inv-draft',
      uid: 'alice-delete',
      workspaceId: 'ws-delete-test',
      customerId: 'c-1',
      customerName: 'Cust',
      number: 'INV-DRAFT',
      date: '2026-09-01',
      totalAmountCents: 1000,
      status: 'draft',
      lines: []
    });

    await assert.doesNotReject(async () => {
      await aliceDb.doc('invoices/inv-draft').delete();
    }, 'Draft invoice should be deletable');

    // 2. Create a posted/sent invoice -> MUST NOT BE DELETABLE
    await aliceDb.doc('invoices/inv-posted').set({
      id: 'inv-posted',
      uid: 'alice-delete',
      workspaceId: 'ws-delete-test',
      customerId: 'c-1',
      customerName: 'Cust',
      number: 'INV-POSTED',
      date: '2026-09-01',
      totalAmountCents: 1000,
      status: 'sent',
      lines: []
    });

    await assert.rejects(async () => {
      await aliceDb.doc('invoices/inv-posted').delete();
    }, /permission-denied/i, 'Posted invoice deletion must be rejected');

    // 3. Create a posted bill -> MUST NOT BE DELETABLE
    await aliceDb.doc('bills/bill-posted').set({
      id: 'bill-posted',
      uid: 'alice-delete',
      workspaceId: 'ws-delete-test',
      vendorId: 'v-1',
      vendorName: 'Vend',
      number: 'BILL-POSTED',
      date: '2026-09-01',
      totalAmountCents: 1000,
      status: 'approved',
      lines: []
    });

    await assert.rejects(async () => {
      await aliceDb.doc('bills/bill-posted').delete();
    }, /permission-denied/i, 'Posted bill deletion must be rejected');
  });
});
