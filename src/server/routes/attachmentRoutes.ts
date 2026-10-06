import express from 'express';
import { getDb } from '../db/firestore';
import { writeServerAuditLog } from '../services/auditLogService';
import { mayRemoveAttachment } from '../../lib/attachments';

/**
 * Remove a file kept with a record (K-07), mounted at /api/v1/workspaces/:workspaceId/attachments
 * (workspaceRoutes.ts, every member; who may remove is checked here). The database lets members
 * add their own files but never delete one, so removing goes through here: owners, accountants and
 * bookkeepers may remove any file of the workspace, others only the ones they added. The audit
 * trail keeps what was removed, from which record, and by whom.
 */
export const attachmentRouter = express.Router({ mergeParams: true });

type AuthedRequest = express.Request & { user: { uid: string; email?: string }; userRole?: string };

attachmentRouter.delete('/:attachmentId', async (req, res) => {
  const { workspaceId, attachmentId } = req.params as Record<string, string>;
  const { user, userRole } = req as unknown as AuthedRequest;
  try {
    const db = getDb();
    const ref = db.collection('documents').doc(attachmentId);
    const outcome = await db.runTransaction(async t => {
      const snap = await t.get(ref);
      const file = snap.exists ? snap.data() as { uid?: string; workspaceId?: string; name?: string; linkedCollection?: string; linkedId?: string; linkedLabel?: string } : undefined;
      if (!file || file.workspaceId !== workspaceId) return 'missing' as const;
      if (!mayRemoveAttachment(userRole, user.uid, { uid: String(file.uid || '') })) return 'forbidden' as const;
      t.delete(ref);
      await writeServerAuditLog({
        workspaceId, uid: user.uid, email: user.email, action: 'attachment.removed',
        entityType: file.linkedCollection || 'documents', entityId: file.linkedId || attachmentId,
        details: { description: `Removed the file "${file.name || attachmentId}"${file.linkedLabel ? ` from ${file.linkedLabel}` : ''}`, attachmentId, name: file.name || null },
      }, { db, tx: t });
      return 'removed' as const;
    });
    if (outcome === 'missing') return res.status(404).json({ status: 'error', message: 'That file is not in this workspace (already removed?)' });
    if (outcome === 'forbidden') return res.status(403).json({ status: 'error', message: 'Only the person who added it, or an owner, accountant or bookkeeper, can remove it' });
    res.json({ status: 'success' });
  } catch (err) {
    res.status(500).json({ status: 'error', message: 'The file could not be removed', details: err instanceof Error ? err.message : String(err) });
  }
});
