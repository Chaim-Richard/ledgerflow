import { create } from 'zustand';
import type { LedgerKey } from '../lib/ledgerCollections';

/**
 * Which on-demand collections screens have asked for (src/lib/ledgerCollections.ts), and which
 * have arrived for the open workspace. useLedgerData subscribes to every key asked for and keeps it
 * live; the list only grows during a session.
 */
interface DataNeedsState {
  asked: LedgerKey[];
  loaded: Partial<Record<LedgerKey, boolean>>;
  ask: (keys: readonly LedgerKey[]) => void;
  markLoaded: (key: LedgerKey) => void;
  /** a new workspace: everything loads again */
  resetLoaded: () => void;
}

export const useDataNeedsStore = create<DataNeedsState>((set) => ({
  asked: [],
  loaded: {},
  ask: (keys) => set((state) => {
    const missing = keys.filter(k => !state.asked.includes(k));
    return missing.length ? { asked: [...state.asked, ...missing].sort() } : state;
  }),
  markLoaded: (key) => set((state) => (state.loaded[key] ? state : { loaded: { ...state.loaded, [key]: true } })),
  resetLoaded: () => set({ loaded: {} }),
}));
