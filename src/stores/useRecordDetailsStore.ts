import { create } from 'zustand';
import { useAuthStore } from './useAuthStore';
import type { DetailTarget } from '../lib/recordDetails';
export const detailScope = () => { const state = useAuthStore.getState(); return `${state.user?.uid || 'guest'}:${state.currentWorkspaceId || 'none'}`; };
export const useRecordDetailsStore = create<{ open: boolean; scope: string; target?: DetailTarget; show: (target?: DetailTarget) => void; close: () => void }>(set => ({
  open: false, scope: detailScope(), target: undefined,
  show: target => set({ open: true, scope: detailScope(), target }),
  close: () => set({ open: false, target: undefined }),
}));
