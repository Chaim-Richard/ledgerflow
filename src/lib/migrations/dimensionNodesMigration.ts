import { doc, getDoc, updateDoc, writeBatch, deleteField, type Firestore } from 'firebase/firestore';
import { DimensionNode } from '../../types';

export interface MigrationResult {
  migratedCount: number;
  workspaceId: string;
  success: boolean;
  error?: string;
}

/**
 * One-off migration that moves legacy workspace.dimensionNodes into the top-level
 * `dimensionNodes` collection (preventing workspace document bloat toward the 1MB Firestore limit)
 * and deletes the field from the workspace document.
 */
export async function migrateWorkspaceDimensionNodesToCollection(
  db: Firestore,
  workspaceId: string
): Promise<MigrationResult> {
  if (!db || !workspaceId) {
    return { migratedCount: 0, workspaceId, success: false, error: 'Invalid db or workspaceId' };
  }

  try {
    const wsRef = doc(db, 'workspaces', workspaceId);
    const wsSnap = await getDoc(wsRef);
    if (!wsSnap.exists()) {
      return { migratedCount: 0, workspaceId, success: false, error: 'Workspace does not exist' };
    }

    const data = wsSnap.data();
    const legacyNodes: DimensionNode[] = Array.isArray(data.dimensionNodes) ? data.dimensionNodes : [];

    if (legacyNodes.length === 0) {
      // If the field still exists as an empty array or undefined, ensure it's deleted if present
      if ('dimensionNodes' in data) {
        await updateDoc(wsRef, {
          dimensionNodes: deleteField()
        });
      }
      return { migratedCount: 0, workspaceId, success: true };
    }

    // Write nodes in batches of 450
    const chunkSize = 450;
    for (let i = 0; i < legacyNodes.length; i += chunkSize) {
      const chunk = legacyNodes.slice(i, i + chunkSize);
      const batch = writeBatch(db);
      for (const node of chunk) {
        const docId = `${workspaceId}_${node.dimensionId}_${node.id}`;
        const nodeRef = doc(db, 'dimensionNodes', docId);
        batch.set(nodeRef, {
          ...node,
          workspaceId
        });
      }
      await batch.commit();
    }

    // Delete the field from the workspace document
    await updateDoc(wsRef, {
      dimensionNodes: deleteField()
    });

    return {
      migratedCount: legacyNodes.length,
      workspaceId,
      success: true
    };
  } catch (err: any) {
    console.error(`[DimensionNodesMigration] Failed for workspace ${workspaceId}:`, err);
    return {
      migratedCount: 0,
      workspaceId,
      success: false,
      error: err?.message || String(err)
    };
  }
}
