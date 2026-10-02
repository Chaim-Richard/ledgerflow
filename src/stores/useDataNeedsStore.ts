import { create } from 'zustand';
import type { LedgerKey } from '../lib/ledgerCollections';

/**
 * Which on-demand collections screens have asked for (src/lib/ledgerCollections.ts), which have
 * arrived for the open workspace, and which failed to load. useLedgerData subscribes to every key
 * asked for and keeps it live; the list only grows during a session. The data status bar shows
 * what is loading or failed, with "Try again".
 */
interface DataNeedsState {
  asked: LedgerKey[];
  loaded: Partial<Record<LedgerKey, boolean>>;
  /** why a collection couldn't be loaded */
  failed: Partial<Record<LedgerKey, string>>;
  ask: (keys: readonly LedgerKey[]) => void;
  markLoaded: (key: LedgerKey) => void;
  markFailed: (key: LedgerKey, message: string) => void;
  /** clear a failure; useLedgerData subscribes again */
  retry: (key: LedgerKey) => void;
  /** a new workspace: everything loads again */
  resetLoaded: () => void;
}

export const useDataNeedsStore = create<DataNeedsState>((set) => ({
  asked: [],
  loaded: {},
  failed: {},
  ask: (keys) => set((state) => {
    const missing = keys.filter(k => !state.asked.includes(k));
    return missing.length ? { asked: [...state.asked, ...missing].sort() } : state;
  }),
  markLoaded: (key) => set((state) => {
    if (state.loaded[key] && !state.failed[key]) return state;
    const { [key]: _gone, ...failed } = state.failed;
    return { loaded: { ...state.loaded, [key]: true }, failed };
  }),
  markFailed: (key, message) => set((state) => ({ failed: { ...state.failed, [key]: message } })),
  retry: (key) => set((state) => {
    const { [key]: _gone, ...failed } = state.failed;
    return { failed };
  }),
  resetLoaded: () => set({ loaded: {}, failed: {} }),
}));
