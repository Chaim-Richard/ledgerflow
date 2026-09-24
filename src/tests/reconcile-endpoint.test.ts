import assert from 'node:assert/strict';
import { test, describe } from 'node:test';
import type express from 'express';
import type { Firestore } from '../server/db/firestore';
import { handleReconcile } from '../server/routes/transactionRoutes';

class MockDb {
  public data: Map<string, any> = new Map();

  collection(collName: string) {
    return {
      doc: (docId?: string) => {
        const id = docId || `id_${Math.random().toString(36).substring(2, 9)}`;
        const key = `${collName}/${id}`;
        return {
          id,
          key,
          get: async () => {
            const val = this.data.get(key);
            return {
              exists: val !== undefined,
              id,
              data: () => val ? JSON.parse(JSON.stringify(val)) : undefined
            };
          }
        };
      }
    };
  }

  async runTransaction<T>(updateFunction: (tx: any) => Promise<T>): Promise<T> {
    const snapshotMap = new Map<string, any>();
    for (const [k, v] of this.data.entries()) {
      snapshotMap.set(k, JSON.parse(JSON.stringify(v)));
    }

    const tx = {
      get: async (docRef: any) => {
        const val = snapshotMap.get(docRef.key);
        return {
          exists: val !== undefined,
          id: docRef.id,
          data: () => val ? JSON.parse(JSON.stringify(val)) : undefined
        };
      },
      update: (docRef: any, updates: any) => {
        const current = snapshotMap.get(docRef.key) || {};
        const updated = { ...current, ...updates };
        snapshotMap.set(docRef.key, updated);
      },
      create: (docRef: any, newData: any) => {
        snapshotMap.set(docRef.key, newData);
      },
      set: (docRef: any, newData: any) => {
        snapshotMap.set(docRef.key, newData);
      },
      getAll: async (...docRefs: any[]) => {
        return docRefs.map(ref => {
          const val = snapshotMap.get(ref.key);
          return {
            exists: val !== undefined,
            id: ref.id,
            data: () => val ? JSON.parse(JSON.stringify(val)) : undefined
          };
        });
      }
    };

    const res = await updateFunction(tx);
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

describe('Reconcile Endpoint Test Suite (Part 2d)', () => {
  test('Viewer role receives 403', async () => {
    const db = new MockDb();
    db.data.set('workspaces/ws-1', {
      id: 'ws-1',
      members: ['user-viewer'],
      roles: { 'user-viewer': 'viewer' }
    });

    let statusCode = 200;
    let jsonBody: Record<string, any> | null = null;

    const req = {
      user: { uid: 'user-viewer' },
      body: {
        workspaceId: 'ws-1',
        operations: [{ id: 'line-1', type: 'updateBankLine', data: { status: 'matched' } }]
      }
    } as unknown as express.Request;

    const res: any = {
      status: (code: number) => {
        statusCode = code;
        return res;
      },
      json: (data: any) => {
        jsonBody = data;
        return res;
      }
    };

    await handleReconcile(req, res, db as unknown as Firestore);
    assert.equal(statusCode, 403);
    assert.ok((jsonBody as any)?.error?.includes('Forbidden'));
  });

  test('Bank line dated on or before lockDate returns 400 and writes nothing', async () => {
    const db = new MockDb();
    db.data.set('workspaces/ws-1', {
      id: 'ws-1',
      lockDate: '2026-08-31',
      roles: { 'user-owner': 'owner' }
    });
    db.data.set('bankLines/line-locked', {
      id: 'line-locked',
      workspaceId: 'ws-1',
      date: '2026-08-15',
      status: 'pending'
    });

    let statusCode = 200;
    let jsonBody: Record<string, any> | null = null;

    const req = {
      user: { uid: 'user-owner' },
      body: {
        workspaceId: 'ws-1',
        operations: [{ id: 'line-locked', type: 'updateBankLine', data: { status: 'matched' } }]
      }
    } as unknown as express.Request;

    const res: any = {
      status: (code: number) => {
        statusCode = code;
        return res;
      },
      json: (data: any) => {
        jsonBody = data;
        return res;
      }
    };

    await handleReconcile(req, res, db as unknown as Firestore);
    assert.equal(statusCode, 400);
    assert.ok((jsonBody as any)?.error?.includes('Period Locked'));

    const line = db.getDocData('bankLines', 'line-locked');
    assert.equal(line.status, 'pending', 'Bank line status must remain unchanged after aborted reconciliation');
  });

  test('Undo sets bank line back to pending and transaction back to completed with audit log', async () => {
    const db = new MockDb();
    db.data.set('workspaces/ws-1', {
      id: 'ws-1',
      roles: { 'user-owner': 'owner' }
    });
    db.data.set('chartAccounts/acc-1', { id: 'acc-1', workspaceId: 'ws-1', name: 'Cash', type: 'asset' });
    db.data.set('chartAccounts/acc-2', { id: 'acc-2', workspaceId: 'ws-1', name: 'Revenue', type: 'revenue' });

    db.data.set('bankLines/line-matched', {
      id: 'line-matched',
      workspaceId: 'ws-1',
      date: '2026-09-15',
      status: 'matched',
      matchedTransactionId: 'tx-matched'
    });

    db.data.set('transactions/tx-matched', {
      id: 'tx-matched',
      workspaceId: 'ws-1',
      uid: 'user-owner',
      date: '2026-09-15',
      description: 'Matched sale',
      totalAmountCents: 10000,
      currency: 'USD',
      type: 'actual',
      status: 'reconciled',
      lines: [
        { accountId: 'acc-1', amountCents: 10000 },
        { accountId: 'acc-2', amountCents: -10000 }
      ]
    });

    let statusCode = 200;
    let jsonBody: Record<string, any> | null = null;

    const req = {
      user: { uid: 'user-owner', email: 'owner@example.com' },
      body: {
        workspaceId: 'ws-1',
        operations: [
          { id: 'line-matched', type: 'updateBankLine', data: { status: 'pending', matchedTransactionId: null } },
          { id: 'tx-matched', type: 'updateTransaction', data: { status: 'completed' } }
        ]
      }
    } as unknown as express.Request;

    const res: any = {
      status: (code: number) => {
        statusCode = code;
        return res;
      },
      json: (data: any) => {
        jsonBody = data;
        return res;
      }
    };

    await handleReconcile(req, res, db as unknown as Firestore);
    assert.equal(statusCode, 200);
    assert.equal((jsonBody as any)?.status, 'ok');

    const line = db.getDocData('bankLines', 'line-matched');
    assert.equal(line.status, 'pending');
    assert.equal(line.matchedTransactionId, null);

    const tx = db.getDocData('transactions', 'tx-matched');
    assert.equal(tx.status, 'completed');

    const auditLogs = db.getCollectionDocs('auditLogs');
    assert.equal(auditLogs.length, 1);
    assert.equal(auditLogs[0].action, 'reconcile');
    assert.ok(auditLogs[0].details?.description?.includes('executed reconciliation batch'));
    assert.ok(!isNaN(new Date(auditLogs[0].timestamp).getTime()));
  });
});
