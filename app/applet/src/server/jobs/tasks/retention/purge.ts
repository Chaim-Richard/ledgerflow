import { getDb } from '../../../db/firestore';
import { JobResult } from '../../types';

export async function retentionPurgeJob(): Promise<JobResult> {
  const db = getDb();
  let itemsProcessed = 0;

  try {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - 90); // 90-day retention
    const cutoffISO = cutoffDate.toISOString();

    // 1. Purge expired audit logs
    const oldAuditSnap = await db.collection('auditLogs')
      .where('createdAt', '<', cutoffISO)
      .limit(100)
      .get();

    for (const doc of oldAuditSnap.docs) {
      await doc.ref.delete();
      itemsProcessed++;
    }

    // 2. Backup retention: Purge expired backup verify and other job runs older than 90 days
    const oldJobRunsSnap = await db.collection('jobRuns')
      .where('finishedAt', '<', cutoffISO)
      .limit(100)
      .get();

    for (const doc of oldJobRunsSnap.docs) {
      await doc.ref.delete();
      itemsProcessed++;
    }

    // 3. Cap strategicAdvice array on all workspaces to maximum 15 items to prevent database bloat
    const workspacesSnap = await db.collection('workspaces').get();
    for (const doc of workspacesSnap.docs) {
      const data = doc.data() || {};
      if (Array.isArray(data.strategicAdvice) && data.strategicAdvice.length > 15) {
        const cappedAdvice = data.strategicAdvice.slice(-15); // Retain the most recent 15 elements
        await doc.ref.update({ strategicAdvice: cappedAdvice });
        itemsProcessed++;
      }
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
