import { getDb } from '../db/firestore';
import { JobResult, JobRunRecord } from './types';
import { processRecurringJob } from './tasks/recurring/process';
import { checkOverdueInvoicesJob } from './tasks/invoice/checkOverdue';
import { sendInvoiceRemindersJob } from './tasks/invoice/sendReminders';
import { bankSyncJob } from './tasks/bank/sync';
import { backupVerifyJob } from './tasks/backup/verify';
import { telemetryDigestJob } from './tasks/telemetry/digest';
import { subscriptionReconcileJob } from './tasks/subscription/reconcile';
import { retentionPurgeJob } from './tasks/retention/purge';
import crypto from 'crypto';

const JOB_REGISTRY: Record<string, () => Promise<JobResult>> = {
  'recurring/process': processRecurringJob,
  'invoice/check-overdue': checkOverdueInvoicesJob,
  'invoice/send-reminders': sendInvoiceRemindersJob,
  'bank/sync': bankSyncJob,
  'backup/verify': backupVerifyJob,
  'telemetry/digest': telemetryDigestJob,
  'subscription/reconcile': subscriptionReconcileJob,
  'retention/purge': retentionPurgeJob,
};

export async function executeJob(jobName: string): Promise<JobRunRecord> {
  const handler = JOB_REGISTRY[jobName];
  if (!handler) {
    throw new Error(`Unknown job name: ${jobName}`);
  }

  const startedAt = new Date().toISOString();
  let result: JobResult;

  try {
    result = await handler();
  } catch (err: any) {
    result = {
      jobName,
      status: 'failed',
      itemsProcessed: 0,
      error: err.message || String(err)
    };
  }

  const finishedAt = new Date().toISOString();
  const db = getDb();
  const runId = crypto.randomUUID();

  const record: JobRunRecord = {
    id: runId,
    jobName,
    startedAt,
    finishedAt,
    status: result.status,
    itemsProcessed: result.itemsProcessed,
    error: result.error,
    details: result.details
  };

  try {
    await db.collection('jobRuns').doc(runId).set(record);
  } catch (logErr) {
    console.error(`[JobRunner] Failed to log jobRun for ${jobName}:`, logErr);
  }

  return record;
}

export async function executeAllJobs(): Promise<JobRunRecord[]> {
  const records: JobRunRecord[] = [];
  const jobNames = Object.keys(JOB_REGISTRY);

  for (const name of jobNames) {
    try {
      const record = await executeJob(name);
      records.push(record);
    } catch (err: any) {
      console.error(`[JobRunner] Error executing job ${name}:`, err);
    }
  }

  return records;
}

export function getAvailableJobNames(): string[] {
  return Object.keys(JOB_REGISTRY);
}
