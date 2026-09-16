import { getDb } from '../../../db/firestore';
import { JobResult } from '../../types';

export async function telemetryDigestJob(): Promise<JobResult> {
  const db = getDb();
  let itemsProcessed = 0;

  try {
    const errorSnap = await db.collection('auditLogs')
      .where('status', '==', 'error')
      .limit(200)
      .get();

    itemsProcessed = errorSnap.size;

    return {
      jobName: 'telemetry/digest',
      status: 'success',
      itemsProcessed,
      details: { errorCount: itemsProcessed, generatedAt: new Date().toISOString() }
    };
  } catch (err: any) {
    return {
      jobName: 'telemetry/digest',
      status: 'failed',
      itemsProcessed,
      error: err.message
    };
  }
}
