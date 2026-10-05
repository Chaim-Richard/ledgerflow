import { useAuthStore } from '../stores/useAuthStore';
import { doc, getDoc, updateDoc } from './db/firestore';
import { db } from '../firebase';
import type { InlineRecordAdapter } from './inlineRecordFields';
export const inlineRecordAdapter: InlineRecordAdapter = {
  session: () => { const auth = useAuthStore.getState(), workspace = auth.getCurrentWorkspace(); if (!auth.user || !workspace || workspace.id !== auth.currentWorkspaceId) return null; const role = workspace.uid === auth.user.uid ? 'owner' : workspace.roles?.[auth.user.uid]; return { uid: auth.user.uid, workspaceId: workspace.id, writable: ['owner', 'accountant', 'bookkeeper'].includes(role || '') }; },
  read: async target => { const snap = await getDoc(doc(db, target.collection, target.id)); return snap.exists() ? snap.data() : undefined; },
  update: async (target, fields) => { await updateDoc(doc(db, target.collection, target.id), { ...fields, updatedAt: new Date().toISOString() }); },
};
