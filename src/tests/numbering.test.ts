import assert from 'node:assert/strict';
import { test, describe } from 'node:test';
import { allocateNextNumber } from '../server/routes/workspaceRoutes';

class MockTransactionalDb {
  private data: Map<string, any> = new Map();
  private transactionQueue: Promise<any> = Promise.resolve();

  collection(collName: string) {
    return {
      doc: (docId: string) => {
        const key = `${collName}/${docId}`;
        return {
          id: docId,
          key,
          db: this
        };
      }
    };
  }

  async runTransaction<T>(updateFunction: (tx: any) => Promise<T>): Promise<T> {
    const resultPromise = this.transactionQueue.then(async () => {
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
      
      for (const [k, v] of snapshotMap.entries()) {
        this.data.set(k, v);
      }
      return res;
    });

    this.transactionQueue = resultPromise.catch(() => {});
    return resultPromise;
  }
}

describe('Atomic Gapless Numbering Series Test Suite (Task 3)', () => {
  test('Creating 50 invoices concurrently yields 50 unique, strictly sequential numbers with no gaps (INV-2026-0001 through INV-2026-0050)', async () => {
    const mockDb = new MockTransactionalDb();
    const workspaceId = 'ws-concurrent-test';

    const promises = Array.from({ length: 50 }, () => 
      allocateNextNumber(mockDb, workspaceId, 'invoice')
    );

    const allocatedNumbers = await Promise.all(promises);

    assert.equal(allocatedNumbers.length, 50, 'Must return 50 allocated numbers');

    const uniqueNumbers = new Set(allocatedNumbers);
    assert.equal(uniqueNumbers.size, 50, 'All 50 allocated numbers must be strictly unique with no duplicates');

    const sorted = [...allocatedNumbers].sort();
    const expected = Array.from({ length: 50 }, (_, i) => 
      `INV-2026-${String(i + 1).padStart(4, '0')}`
    );

    assert.deepEqual(sorted, expected, 'Allocated numbers must be strictly sequential (INV-2026-0001 through INV-2026-0050) with no gaps');
  });
});
