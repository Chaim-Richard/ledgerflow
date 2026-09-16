import { getDb } from '../../../db/firestore';
import { JobResult } from '../../types';

export async function retentionPurgeJob(): Promise<JobResult> {
  const db = getDb();
  let itemsProcessed = 0;

  try {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - 90); // 90-day retention
    const cutoffISO = cutoffDate.toISOString();

    const oldAuditSnap = await db.collection('auditLogs')
      .where('createdAt', '<', cutoffISO)
      .limit(100)
      .get();

    for (const doc of oldAuditSnap.docs) {
      await doc.ref.delete();
      itemsProcessed++;
    }

    return {
      jobName: 'retention/purge',
      status: 'success',
      itemsProcessed
    };
  } catch (err: any) {
    return {
      jobName: 'retention/purge',
      status: 'failed',
      itemsProcessed,
      error: err.message
    };
  }
}
