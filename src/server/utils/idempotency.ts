import { getDb } from '../db/firestore';
import type { Transaction as FirestoreTransaction } from '../db/firestore';

export interface IdempotencyRecord {
  id: string;
  actor: string;
  workspaceId: string;
  operationType: string;
  createdAt: string;
  updatedAt?: string;
  status: 'pending' | 'success' | 'failed';
  result?: any;
  error?: string;
  expiresAt: string;
}

/**
 * Derives the canonical scoped operation key: workspace:operationType:operationId
 */
export function deriveScopedOperationKey(workspaceId: string, operationType: string, operationId: string): string {
  const sanitizedWs = workspaceId || 'system';
  return `${sanitizedWs}:${operationType}:${operationId}`;
}

/**
 * Extracts a canonical operation ID from request headers or body.
 * Sources in priority order:
 * 1. 'x-operation-id' header
 * 2. 'idempotency-key' header
 * 3. req.body.operationId
 * 4. req.query.operationId
 */
export function extractCanonicalOperationId(req: any): string | undefined {
  if (!req) return undefined;
  const headerOpId = req.headers?.['x-operation-id'] || req.headers?.['idempotency-key'];
  if (typeof headerOpId === 'string' && headerOpId.trim()) return headerOpId.trim();
  if (req.body && typeof req.body.operationId === 'string' && req.body.operationId.trim()) return req.body.operationId.trim();
  if (req.query && typeof req.query.operationId === 'string' && req.query.operationId.trim()) return req.query.operationId.trim();
  return undefined;
}

/**
 * Ensures an operation is executed exactly once using ONE atomic Firestore transaction.
 *
 * Canonical Architecture:
 * Command -> Idempotency record -> ONE Firestore transaction:
 *   ├─ read idempotency key
 *   ├─ read/validate relevant documents (via transactionHandler)
 *   ├─ write ledger mutation / audit writes (via transactionHandler)
 *   └─ write idempotency success record
 *
 * @param scopedOperationId The canonical scoped key (e.g., "workspace1:TRANSACTION_CREATE:op123")
 * @param metadata Contextual info about the operation
 * @param transactionHandler Callback receiving the active Firestore transaction
 */
export async function executeIdempotent<T>(
  scopedOperationId: string,
  metadata: {
    actor: string;
    workspaceId: string;
    operationType: string;
  },
  transactionHandler: (t: FirestoreTransaction) => Promise<T>
): Promise<T> {
  const db = getDb();
  const keyRef = db.collection('idempotencyKeys').doc(scopedOperationId);

  return await db.runTransaction(async (t) => {
    // 1. Read idempotency record (must happen before any writes)
    const doc = await t.get(keyRef);

    if (doc.exists) {
      const data = doc.data() as IdempotencyRecord;
      if (data.status === 'success') {
        return data.result as T;
      }
      if (data.status === 'pending') {
        const createdAt = new Date(data.createdAt).getTime();
        const now = Date.now();
        // Allow retry if stuck in pending for > 5 minutes
        if (now - createdAt < 5 * 60 * 1000) {
          const err = new Error(`Operation ${scopedOperationId} is currently in progress.`);
          (err as any).status = 409;
          throw err;
        }
      }
    }

    // 2. Execute transactionHandler within the same transaction context
    const result = await transactionHandler(t);

    // 3. Write idempotency success record inside the same transaction
    const record: IdempotencyRecord = {
      id: scopedOperationId,
      actor: metadata.actor,
      workspaceId: metadata.workspaceId,
      operationType: metadata.operationType,
      createdAt: doc.exists ? (doc.data()?.createdAt || new Date().toISOString()) : new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      status: 'success',
      result: result !== undefined ? result : null,
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
    };

    t.set(keyRef, record, { merge: true });

    return result;
  });
}
