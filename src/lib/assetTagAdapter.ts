import { collection, getDocs, query, where } from './db/firestore';
import { db } from '../firebase';
import { inlineRecordAdapter } from './inlineRecordAdapter';
import type { InlineRecordAdapter } from './inlineRecordFields';
import { assetTagProblem } from './assetTags';

interface TaggedAsset { id: string; workspaceId?: string; assetTag?: string }
type LoadTags = (workspaceId: string) => Promise<TaggedAsset[]>;

/**
 * Check all workspace tags, not the capped browser cache, before a confirmed metadata write.
 * This observes conflicts but is NOT a replacement for a database unique constraint: another
 * browser can still write in the gap between the read and the update (AI #1 handoff for A-8).
 */
export function createAssetTagAdapter(base: InlineRecordAdapter, loadTags: LoadTags): InlineRecordAdapter {
  return {
    ...base,
    async update(target, fields) {
      if (target.collection === 'assets' && typeof fields.assetTag === 'string' && fields.assetTag) {
        const initial = base.session();
        const session = initial ? { ...initial } : null;
        if (!session?.writable) throw new Error('Your workspace role cannot edit this record.');
        const assets = await loadTags(session.workspaceId);
        const current = base.session();
        if (!current?.writable || current.uid !== session.uid || current.workspaceId !== session.workspaceId) {
          throw new Error('Workspace or permissions changed. Reopen this record.');
        }
        const problem = assetTagProblem(fields.assetTag, assets.filter(asset => asset.workspaceId === session.workspaceId), target.id);
        if (problem) throw new Error(problem);
      }
      await base.update(target, fields);
    },
  };
}

export const assetTagAdapter = createAssetTagAdapter(inlineRecordAdapter, async workspaceId => {
  const snapshot = await getDocs(query(collection(db, 'assets'), where('workspaceId', '==', workspaceId)));
  return snapshot.docs.map(document => ({
    id: document.id, workspaceId: document.data().workspaceId as string,
    assetTag: typeof document.data().assetTag === 'string' ? document.data().assetTag : undefined,
  }));
});
