import { getDb } from '../../../db/firestore';
import { JobResult } from '../../types';

export async function bankSyncJob(): Promise<JobResult> {
  const db = getDb();
  let itemsProcessed = 0;

  try {
    const snap = await db.collection('bankLines')
      .where('status', '==', 'connected')
      .get();

    for (const doc of snap.docs) {
      const line = doc.data();
      // Sync bank feed timestamps
      await doc.ref.update({
        lastSyncedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
      itemsProcessed++;
    }

    return {
      jobName: 'bank/sync',
      status: 'success',
      itemsProcessed
    };
  } catch (err: any) {
    return {
      jobName: 'bank/sync',
      status: 'failed',
      itemsProcessed,
      error: err.message
    };
  }
}
