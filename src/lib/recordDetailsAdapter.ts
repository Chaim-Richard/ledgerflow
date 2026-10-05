import { useAuthStore } from '../stores/useAuthStore';
import { useLedgerStore } from '../stores/useLedgerStore';
import { useDataNeedsStore } from '../stores/useDataNeedsStore';
import { assertProjectRenameSafe } from './projectRenameGuard';
import { doc, getDoc, updateDoc } from './db/firestore';
import { db } from '../firebase';
import type { DetailAdapter } from './recordDetails';
export const recordDetailsAdapter: DetailAdapter = {
  session: () => { const auth = useAuthStore.getState(), workspace = auth.getCurrentWorkspace(); if (!auth.user || !workspace || workspace.id !== auth.currentWorkspaceId) return null; const role = workspace.uid === auth.user.uid ? 'owner' : workspace.roles?.[auth.user.uid]; return { uid: auth.user.uid, workspaceId: workspace.id, writable: ['owner', 'accountant', 'bookkeeper'].includes(role || '') }; },
  guardProjectRename: (_target, oldName) => { const state = useLedgerStore.getState(); assertProjectRenameSafe(oldName, state.transactions, !!state.truncatedCollections.transactions || !useDataNeedsStore.getState().loaded.transactions || !!useDataNeedsStore.getState().failed.transactions); },
  read: async target => { const snap = await getDoc(doc(db, target.kind, target.id)); return snap.exists() ? snap.data() : undefined; },
  update: async (target, changes) => { const session = recordDetailsAdapter.session();
    await updateDoc(doc(db, target.kind, target.id), { ...changes, updatedAt: new Date().toISOString() });
    const current = recordDetailsAdapter.session();
    if (current && current.uid === session?.uid && current.workspaceId === session.workspaceId) useLedgerStore.setState(state => ({ [target.kind]: state[target.kind].map(record => record.id === target.id ? { ...record, ...changes } : record) })); },
};
