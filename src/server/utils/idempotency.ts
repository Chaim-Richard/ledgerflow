import { getFirestore, Timestamp } from 'firebase-admin/firestore';

export interface IdempotencyRecord {
  id: string;
  actor: string;
  workspaceId: string;
  operationType: string;
  createdAt: string;
  status: 'pending' | 'success' | 'failed';
  result?: any;
  error?: string;
  expiresAt: Timestamp;
}

/**
 * Ensures an operation is executed exactly once using a deterministic ID.
 * @param operationId The unique ID for this operation (e.g., "recurring:templateId:2024-01-01")
 * @param metadata Contextual info about the operation
 * @param action The function to execute if the operation hasn't succeeded yet
 */
export async function executeIdempotent<T>(
  operationId: string,
  metadata: {
    actor: string;
    workspaceId: string;
    operationType: string;
  },
  action: () => Promise<T>
): Promise<T> {
  const db = getFirestore();
  const keyRef = db.collection('idempotencyKeys').doc(operationId);

  return await db.runTransaction(async (transaction) => {
    const doc = await transaction.get(keyRef);

    if (doc.exists) {
      const data = doc.data() as IdempotencyRecord;
      if (data.status === 'success') {
        console.log(`[Idempotency] Operation ${operationId} already succeeded. Returning cached result.`);
        return data.result as T;
      }
      if (data.status === 'pending') {
        // If it's been pending for more than 5 minutes, we might want to allow a retry
        const createdAt = new Date(data.createdAt).getTime();
        const now = Date.now();
        if (now - createdAt < 5 * 60 * 1000) {
          throw new Error(`Operation ${operationId} is currently in progress.`);
        }
        console.warn(`[Idempotency] Operation ${operationId} was stuck in pending. Retrying...`);
      }
    }

    // Mark as pending
    const record: IdempotencyRecord = {
      id: operationId,
      actor: metadata.actor,
      workspaceId: metadata.workspaceId,
      operationType: metadata.operationType,
      createdAt: new Date().toISOString(),
      status: 'pending',
      // Expire in 30 days
      expiresAt: Timestamp.fromMillis(Date.now() + 30 * 24 * 60 * 60 * 1000)
    };

    transaction.set(keyRef, record);

    try {
      const result = await action();
      transaction.update(keyRef, {
        status: 'success',
        result,
        updatedAt: new Date().toISOString()
      });
      return result;
    } catch (error: any) {
      transaction.update(keyRef, {
        status: 'failed',
        error: error.message || 'Unknown error',
        updatedAt: new Date().toISOString()
      });
      throw error;
    }
  });
}
