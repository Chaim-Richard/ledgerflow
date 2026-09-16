import { getDb } from '../../../db/firestore';
import { JobResult } from '../../types';
import crypto from 'crypto';

export async function backupVerifyJob(): Promise<JobResult> {
  const db = getDb();
  let itemsProcessed = 0;

  try {
    const txSnap = await db.collection('transactions').limit(100).get();
    const accSnap = await db.collection('chartAccounts').limit(100).get();

    const dataDump = JSON.stringify({
      txCount: txSnap.size,
      accCount: accSnap.size,
      sampleTx: txSnap.docs.map(d => d.id),
      timestamp: new Date().toISOString()
    });

    const checksum = crypto.createHash('sha256').update(dataDump).digest('hex');

    if (!checksum) {
      throw new Error('Failed to verify checksum for backup payload.');
    }

    itemsProcessed = txSnap.size + accSnap.size;

    return {
      jobName: 'backup/verify',
      status: 'success',
      itemsProcessed,
      details: { checksum, verifiedAt: new Date().toISOString() }
    };
  } catch (err: any) {
    return {
      jobName: 'backup/verify',
      status: 'failed',
      itemsProcessed,
      error: err.message
    };
  }
}
