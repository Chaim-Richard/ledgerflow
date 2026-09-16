import { getDb } from '../../../db/firestore';
import { JobResult } from '../../types';

export async function subscriptionReconcileJob(): Promise<JobResult> {
  const db = getDb();
  let itemsProcessed = 0;

  try {
    const wsSnap = await db.collection('workspaces').get();

    for (const doc of wsSnap.docs) {
      const ws = doc.data();
      if (ws.subscriptionId) {
        // Reconcile status timestamp
        await doc.ref.update({
          subscriptionReconciledAt: new Date().toISOString()
        });
        itemsProcessed++;
      }
    }

    return {
      jobName: 'subscription/reconcile',
      status: 'success',
      itemsProcessed
    };
  } catch (err: any) {
    return {
      jobName: 'subscription/reconcile',
      status: 'failed',
      itemsProcessed,
      error: err.message
    };
  }
}
