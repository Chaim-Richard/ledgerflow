import assert from 'node:assert/strict';
import { test, describe } from 'node:test';
import { createPaymentAtomic } from '../server/services/paymentService';

class MockTransactionalDb {
  public data: Map<string, any> = new Map();

  collection(collName: string) {
    return {
      doc: (docId?: string) => {
        const id = docId || `id_${Math.random().toString(36).substring(2, 9)}`;
        const key = `${collName}/${id}`;
        return {
          id,
          key,
          db: this
        };
      }
    };
  }

  async runTransaction<T>(updateFunction: (tx: any) => Promise<T>): Promise<T> {
    // Snapshot current state
    const snapshotMap = new Map<string, any>();
    for (const [k, v] of this.data.entries()) {
      snapshotMap.set(k, JSON.parse(JSON.stringify(v)));
    }

    const tx = {
      get: async (docRef: any) => {
        const val = snapshotMap.get(docRef.key);
        return {
          exists: val !== undefined,
          data: () => val ? JSON.parse(JSON.stringify(val)) : undefined
        };
      },
      update: (docRef: any, updates: any) => {
        const current = snapshotMap.get(docRef.key) || {};
        const updated = { ...current, ...updates };
        snapshotMap.set(docRef.key, updated);
      },
      set: (docRef: any, newData: any) => {
        snapshotMap.set(docRef.key, newData);
      }
    };

    const res = await updateFunction(tx);
    // If transaction succeeded, commit state to DB
    for (const [k, v] of snapshotMap.entries()) {
      this.data.set(k, v);
    }
    return res;
  }

  getDocData(collName: string, docId: string) {
    const val = this.data.get(`${collName}/${docId}`);
    return val ? JSON.parse(JSON.stringify(val)) : undefined;
  }

  getCollectionDocs(collName: string) {
    const docs: any[] = [];
    const prefix = `${collName}/`;
    for (const [k, v] of this.data.entries()) {
      if (k.startsWith(prefix)) {
        docs.push(JSON.parse(JSON.stringify(v)));
      }
    }
    return docs;
  }
}

describe('Payment Creation & Ledger Posting Atomicity Test Suite (Task 4)', () => {
  test('If payment is attempted in closed period (locked date), transaction aborts: invoice amountPaidCents remains 0 and no payment record is created', async () => {
    const db = new MockTransactionalDb();

    // Setup Workspace with lockDate = '2026-08-31'
    db.data.set('workspaces/ws-1', {
      id: 'ws-1',
      lockDate: '2026-08-31'
    });

    // Setup Accounts
    db.data.set('chartAccounts/acc-cash', { id: 'acc-cash', name: 'Cash' });
    db.data.set('chartAccounts/acc-ar', { id: 'acc-ar', name: 'AR' });

    // Setup Invoice with total 10000 cents, 0 paid
    db.data.set('invoices/inv-100', {
      id: 'inv-100',
      totalCents: 10000,
      amountPaidCents: 0,
      status: 'pending'
    });

    // Attempt payment on 2026-08-15 (inside closed period!)
    await assert.rejects(async () => {
      await createPaymentAtomic(db, {
        workspaceId: 'ws-1',
        uid: 'user-1',
        paymentDate: '2026-08-15',
        amountCents: 10000,
        cashAccountId: 'acc-cash',
        offsetAccountId: 'acc-ar',
        allocations: [{ documentId: 'inv-100', documentType: 'invoice', amountCents: 10000 }]
      });
    }, /locked/i);

    // Assert: Invoice amountPaidCents MUST be unchanged (0)
    const inv = db.getDocData('invoices', 'inv-100');
    assert.equal(inv.amountPaidCents, 0, 'Invoice amountPaidCents must remain 0 after aborted payment');
    assert.equal(inv.status, 'pending', 'Invoice status must remain unchanged after aborted payment');

    // Assert: payments collection MUST contain 0 records
    const payments = db.getCollectionDocs('payments');
    assert.equal(payments.length, 0, 'Payments collection must contain no records after aborted payment');

    // Assert: transactions collection MUST contain 0 records
    const transactions = db.getCollectionDocs('transactions');
    assert.equal(transactions.length, 0, 'Transactions collection must contain no records after aborted payment');
  });

  test('If ledger posting fails due to invalid cash account ID, transaction aborts: invoice amountPaidCents remains 0 and no payment record is created', async () => {
    const db = new MockTransactionalDb();

    // Setup Workspace
    db.data.set('workspaces/ws-1', { id: 'ws-1' });

    // Setup Invoice with total 5000 cents, 0 paid
    db.data.set('invoices/inv-200', {
      id: 'inv-200',
      totalCents: 5000,
      amountPaidCents: 0,
      status: 'pending'
    });

    // Attempt payment with non-existent cash account ID 'non-existent-cash'
    await assert.rejects(async () => {
      await createPaymentAtomic(db, {
        workspaceId: 'ws-1',
        uid: 'user-1',
        paymentDate: '2026-09-15',
        amountCents: 5000,
        cashAccountId: 'non-existent-cash',
        allocations: [{ documentId: 'inv-200', documentType: 'invoice', amountCents: 5000 }]
      });
    }, /invalid cash account/i);

    // Assert: Invoice amountPaidCents MUST be unchanged (0)
    const inv = db.getDocData('invoices', 'inv-200');
    assert.equal(inv.amountPaidCents, 0, 'Invoice amountPaidCents must remain 0 after aborted payment');

    // Assert: payments collection MUST contain 0 records
    const payments = db.getCollectionDocs('payments');
    assert.equal(payments.length, 0, 'Payments collection must contain no records after aborted payment');
  });

  test('Valid payment atomically updates invoice amountPaidCents, creates payment document, and posts balanced general ledger transaction', async () => {
    const db = new MockTransactionalDb();

    db.data.set('workspaces/ws-1', { id: 'ws-1' });
    db.data.set('chartAccounts/acc-cash', { id: 'acc-cash', name: 'Cash' });
    db.data.set('chartAccounts/acc-ar', { id: 'acc-ar', name: 'AR' });

    db.data.set('invoices/inv-300', {
      id: 'inv-300',
      totalCents: 10000,
      amountPaidCents: 0,
      status: 'pending'
    });

    const result = await createPaymentAtomic(db, {
      workspaceId: 'ws-1',
      uid: 'user-1',
      paymentDate: '2026-09-15',
      amountCents: 10000,
      cashAccountId: 'acc-cash',
      offsetAccountId: 'acc-ar',
      allocations: [{ documentId: 'inv-300', documentType: 'invoice', amountCents: 10000 }]
    });

    // Assert: Invoice updated atomically
    const inv = db.getDocData('invoices', 'inv-300');
    assert.equal(inv.amountPaidCents, 10000);
    assert.equal(inv.status, 'paid');

    // Assert: Payment created
    const payment = db.getDocData('payments', result.paymentId);
    assert.ok(payment);
    assert.equal(payment.amountCents, 10000);

    // Assert: Ledger transaction created with balanced debit/credit
    const txDoc = db.getDocData('transactions', result.transactionId);
    assert.ok(txDoc);
    assert.equal(txDoc.totalAmountCents, 10000);
    assert.equal(txDoc.lines.length, 2);

    const debitLine = txDoc.lines.find((l: any) => l.accountId === 'acc-cash');
    const creditLine = txDoc.lines.find((l: any) => l.accountId === 'acc-ar');

    assert.equal(debitLine.amountCents, 10000, 'Cash account must be debited 10,000 cents');
    assert.equal(creditLine.amountCents, -10000, 'A/R account must be credited -10,000 cents');
  });

  test('Cross-workspace isolation: rejects payment if target invoice belongs to another workspace', async () => {
    const db = new MockTransactionalDb();

    db.data.set('workspaces/ws-victim', { id: 'ws-victim' });
    db.data.set('workspaces/ws-attacker', { id: 'ws-attacker' });
    db.data.set('chartAccounts/acc-cash', { id: 'acc-cash', workspaceId: 'ws-attacker' });
    db.data.set('chartAccounts/acc-ar', { id: 'acc-ar', workspaceId: 'ws-attacker' });

    db.data.set('invoices/inv-victim-1', {
      id: 'inv-victim-1',
      workspaceId: 'ws-victim',
      totalCents: 10000,
      amountPaidCents: 0,
      status: 'pending'
    });

    await assert.rejects(async () => {
      await createPaymentAtomic(db, {
        workspaceId: 'ws-attacker',
        uid: 'attacker-1',
        paymentDate: '2026-09-15',
        amountCents: 10000,
        cashAccountId: 'acc-cash',
        offsetAccountId: 'acc-ar',
        allocations: [{ documentId: 'inv-victim-1', documentType: 'invoice', amountCents: 10000 }]
      });
    }, /belongs to another workspace/i);

    const inv = db.getDocData('invoices', 'inv-victim-1');
    assert.equal(inv.amountPaidCents, 0, 'Victim invoice must remain untouched');
  });

  test('Overpayment prevention: rejects allocation exceeding remaining document balance', async () => {
    const db = new MockTransactionalDb();

    db.data.set('workspaces/ws-1', { id: 'ws-1' });
    db.data.set('chartAccounts/acc-cash', { id: 'acc-cash', workspaceId: 'ws-1' });
    db.data.set('chartAccounts/acc-ar', { id: 'acc-ar', workspaceId: 'ws-1' });

    db.data.set('invoices/inv-partial', {
      id: 'inv-partial',
      workspaceId: 'ws-1',
      totalCents: 10000,
      amountPaidCents: 6000,
      status: 'partially_paid'
    });

    await assert.rejects(async () => {
      await createPaymentAtomic(db, {
        workspaceId: 'ws-1',
        uid: 'user-1',
        paymentDate: '2026-09-15',
        amountCents: 5000,
        cashAccountId: 'acc-cash',
        offsetAccountId: 'acc-ar',
        allocations: [{ documentId: 'inv-partial', documentType: 'invoice', amountCents: 5000 }]
      });
    }, /overpayment not allowed/i);
  });
});

