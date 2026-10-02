import type { Firestore } from '../db/firestore';
import type { Query } from '../db/pgFirestore';
import { RETENTION_DEFAULTS, retentionFor, RetentionSettingsSchema, type RetentionSettings } from '../../lib/retention';
import { workspaceRole } from '../../lib/periodLock';
import { writeServerAuditLog } from './auditLogService';

/**
 * Retention (L-08, BJ-05): owners set how long each workspace's logs are kept, and can put the
 * workspace on legal hold. The daily job prunes what is past its time. Bounce and spam reports
 * are never pruned (they keep those addresses from being emailed again), the books and the
 * audit trail are never touched here.
 */

export class RetentionError extends Error {
  constructor(readonly status: number, message: string) {
    super(message);
    this.name = 'RetentionError';
  }
}

/** Email log entries that may expire (bounced/complaint stay: the suppression list). */
const PRUNABLE_EMAIL_EVENTS = ['sent', 'failed', 'delivered'];
const BATCH = 400;

export async function updateRetention(db: Firestore, input: { workspaceId: string; uid: string; email?: string; settings: unknown }): Promise<RetentionSettings> {
  const parsed = RetentionSettingsSchema.safeParse(input.settings);
  if (!parsed.success) throw new RetentionError(400, parsed.error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join('; '));
  const ref = db.collection('workspaces').doc(input.workspaceId);
  const workspace = (await ref.get()).data();
  if (!workspace) throw new RetentionError(404, 'Workspace not found');
  if (workspaceRole(workspace, input.uid) !== 'owner') throw new RetentionError(403, 'Only owners change retention');
  const before = retentionFor(workspace);
  const after = parsed.data;
  const update: Record<string, unknown> = { retention: after, updatedAt: new Date().toISOString() };
  // a pending deletion follows the new grace period (and a legal hold keeps it from running)
  if (workspace.status === 'pending_deletion' && typeof workspace.deletedAt === 'string' && after.deletionGraceDays !== before.deletionGraceDays) {
    update.scheduledPurgeAt = new Date(Date.parse(workspace.deletedAt) + after.deletionGraceDays * 86_400_000).toISOString();
  }
  await ref.update(update);
  const changes = (Object.keys(after) as Array<keyof RetentionSettings>).filter(k => after[k] !== before[k]).map(k => `${k}: ${before[k]} → ${after[k]}`);
  await writeServerAuditLog({
    workspaceId: input.workspaceId, uid: input.uid, email: input.email || '',
    action: after.legalHold !== before.legalHold ? (after.legalHold ? 'LEGAL_HOLD_ON' : 'LEGAL_HOLD_OFF') : 'RETENTION_CHANGED',
    entityType: 'workspace', entityId: input.workspaceId,
    details: { description: changes.length ? `Retention changed (${changes.join(', ')})` : 'Retention saved (no change)', before, after },
  }, { db });
  return after;
}

async function deleteAll(db: Firestore, query: Query): Promise<number> {
  let removed = 0;
  for (;;) {
    const snap = await query.limit(BATCH).get();
    if (snap.empty) break;
    const batch = db.batch();
    snap.docs.forEach(d => batch.delete(d.ref));
    await batch.commit();
    removed += snap.docs.length;
    if (snap.docs.length < BATCH) break;
  }
  return removed;
}

/** The daily pruning, workspace by workspace under its own settings. */
export async function applyRetention(db: Firestore, now = new Date()): Promise<{ emailEvents: number; errorLogs: number; held: number }> {
  const result = { emailEvents: 0, errorLogs: 0, held: 0 };
  const cutoff = (daysKept: number) => new Date(now.getTime() - daysKept * 86_400_000).toISOString();
  const workspaces = await db.collection('workspaces').get();
  for (const doc of workspaces.docs) {
    const settings = retentionFor(doc.data());
    if (settings.legalHold) { result.held++; continue; }
    if (settings.emailLogDays > 0) {
      result.emailEvents += await deleteAll(db, db.collection('emailEvents')
        .where('workspaceId', '==', doc.id).where('event', 'in', PRUNABLE_EMAIL_EVENTS).where('timestamp', '<', cutoff(settings.emailLogDays)));
    }
    result.errorLogs += await deleteAll(db, db.collection('errorLogs')
      .where('workspaceId', '==', doc.id).where('createdAt', '<', cutoff(settings.errorLogDays)));
  }
  // error reports from before sign-in belong to no workspace: the default period
  result.errorLogs += await deleteAll(db, db.collection('errorLogs')
    .where('workspaceId', '==', 'unauthenticated').where('createdAt', '<', cutoff(RETENTION_DEFAULTS.errorLogDays)));
  return result;
}

export async function runDailyRetention(): Promise<void> {
  const { getDb } = await import('../db/firestore');
  await applyRetention(getDb());
}
