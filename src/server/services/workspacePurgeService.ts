import admin from 'firebase-admin';
import { WORKSPACE_SCOPED_COLLECTIONS } from '../../constants/collections';

export async function purgePendingWorkspaces(db: admin.firestore.Firestore): Promise<{ purgedWorkspaces: string[]; errors: string[] }> {
  const nowISO = new Date().toISOString();
  const purgedWorkspaces: string[] = [];
  const errors: string[] = [];

  try {
    const wsSnap = await db.collection('workspaces')
      .where('status', '==', 'pending_deletion')
      .where('scheduledPurgeAt', '<=', nowISO)
      .get();

    if (wsSnap.empty) {
      return { purgedWorkspaces, errors };
    }

    for (const wsDoc of wsSnap.docs) {
      const workspaceId = wsDoc.id;
      const jobRunRef = db.collection('jobRuns').doc(`purge_workspace_${workspaceId}`);

      try {
        const jobRunSnap = await jobRunRef.get();
        const jobRunData = jobRunSnap.exists ? jobRunSnap.data() || {} : {};

        let startIndex = 0;
        let lastCursorDocId: string | null = jobRunData.lastCursorDocId || null;

        if (jobRunData.lastUpdatedCollection) {
          const foundIdx = WORKSPACE_SCOPED_COLLECTIONS.indexOf(jobRunData.lastUpdatedCollection as any);
          if (foundIdx >= 0) {
            startIndex = foundIdx;
          }
        }

        // Initialize or update running job
        await jobRunRef.set({
          jobType: 'workspace_purge',
          workspaceId,
          startedAt: jobRunData.startedAt || nowISO,
          status: 'running',
          updatedAt: new Date().toISOString()
        }, { merge: true });

        // 1. Delete all workspace-scoped collections in batches <= 450
        for (let i = startIndex; i < WORKSPACE_SCOPED_COLLECTIONS.length; i++) {
          const collectionName = WORKSPACE_SCOPED_COLLECTIONS[i];

          let hasMore = true;
          while (hasMore) {
            let q = db.collection(collectionName)
              .where('workspaceId', '==', workspaceId)
              .orderBy('__name__')
              .limit(400);

            if (lastCursorDocId) {
              const cursorDoc = await db.collection(collectionName).doc(lastCursorDocId).get();
              if (cursorDoc.exists) {
                q = q.startAfter(cursorDoc);
              }
            }

            const docsSnap = await q.get();
            if (docsSnap.empty) {
              hasMore = false;
              lastCursorDocId = null;
              break;
            }

            const batch = db.batch();
            docsSnap.docs.forEach(doc => batch.delete(doc.ref));
            await batch.commit();

            const lastDoc = docsSnap.docs[docsSnap.docs.length - 1];
            lastCursorDocId = lastDoc.id;

            await jobRunRef.set({
              lastUpdatedCollection: collectionName,
              lastCursorDocId,
              updatedAt: new Date().toISOString()
            }, { merge: true });

            if (docsSnap.size < 400) {
              hasMore = false;
              lastCursorDocId = null;
            }
          }
        }

        // 2. Purge Storage files associated with this workspace
        try {
          const bucket = admin.storage().bucket();
          await bucket.deleteFiles({ prefix: `workspaces/${workspaceId}/` }).catch(() => {});
          await bucket.deleteFiles({ prefix: `${workspaceId}/` }).catch(() => {});
        } catch {
          // Ignore storage errors if storage bucket is not configured in local/test environment
        }

        // 3. Write permanent purge audit log before deleting workspace document
        const auditRef = db.collection('auditLogs').doc();
        await auditRef.set({
          id: auditRef.id,
          uid: 'system',
          email: 'system@ledgerflow.internal',
          workspaceId,
          action: 'WORKSPACE_PURGED',
          entityType: 'workspace',
          entityId: workspaceId,
          details: {
            description: `Workspace ${workspaceId} permanently purged following 30-day retention period.`,
            purgedAt: new Date().toISOString()
          },
          timestamp: new Date().toISOString()
        });

        // 4. Delete the workspace document LAST
        await wsDoc.ref.delete();

        // 5. Mark job run as completed
        await jobRunRef.set({
          status: 'completed',
          finishedAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }, { merge: true });

        purgedWorkspaces.push(workspaceId);
      } catch (err: any) {
        console.error(`[Workspace Purge] Failed purging workspace ${workspaceId}:`, err);
        errors.push(`Workspace ${workspaceId}: ${err.message}`);
        await jobRunRef.set({
          status: 'failed',
          lastError: err.message,
          updatedAt: new Date().toISOString()
        }, { merge: true });
      }
    }
  } catch (err: any) {
    console.error('[Workspace Purge] Failed querying pending workspaces:', err);
    errors.push(err.message);
  }

  return { purgedWorkspaces, errors };
}
