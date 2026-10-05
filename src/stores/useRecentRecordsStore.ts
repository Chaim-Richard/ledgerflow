import { create } from 'zustand';
import { useAuthStore } from './useAuthStore';
import { useUIStore } from './useUIStore';
import { RECORD_TABS } from '../lib/recordLinks';
import type { RecordRef } from '../lib/recordLinks';

const storageKey = () => { const auth = useAuthStore.getState(); return `lf_recent_records:${auth.user?.uid || 'guest'}:${auth.currentWorkspaceId || 'none'}`; };
function readRecords(key: string): RecordRef[] {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(key) || '[]');
    if (!Array.isArray(value)) return [];
    const records: RecordRef[] = [], seen = new Set<string>();
    for (const raw of value) {
      if (!raw || typeof raw !== 'object' || !('type' in raw) || !('id' in raw) || typeof raw.type !== 'string' || !Object.hasOwn(RECORD_TABS, raw.type) || typeof raw.id !== 'string' || !raw.id || raw.id.length > 500) continue;
      const id = `${raw.type}:${raw.id}`;
      if (seen.has(id)) continue;
      seen.add(id); records.push({ type: raw.type as RecordRef['type'], id: raw.id });
      if (records.length === 10) break;
    }
    return records;
  } catch { return []; }
}
export const useRecentRecordsStore = create<{ key: string; records: RecordRef[] }>(() => { const key = storageKey(); return { key, records: readRecords(key) }; });
function remember(record: RecordRef) {
  const key = storageKey(), state = useRecentRecordsStore.getState();
  const old = state.key === key ? state.records : readRecords(key);
  const records = [record, ...old.filter(item => item.type !== record.type || item.id !== record.id)].slice(0, 10);
  useRecentRecordsStore.setState({ key, records });
  try { localStorage.setItem(key, JSON.stringify(records)); } catch { /* Readable for this visit when storage is blocked. */ }
}
let owners = 0;
let stop: (() => void) | undefined;
/** Subscribe without replacing or changing openRecord, which is owned by Claude. */
export function startRecentRecordTracking(): () => void {
  if (owners++ === 0) {
    const refresh = () => { const key = storageKey(); if (key !== useRecentRecordsStore.getState().key) useRecentRecordsStore.setState({ key, records: readRecords(key) }); };
    refresh();
    const stopAuth = useAuthStore.subscribe(refresh);
    const stopUI = useUIStore.subscribe((next, previous) => { if (next.focusRecord && next.focusRecord !== previous.focusRecord) remember(next.focusRecord); });
    if (useUIStore.getState().focusRecord) remember(useUIStore.getState().focusRecord!);
    stop = () => { stopAuth(); stopUI(); };
  }
  let active = true;
  return () => { if (!active) return; active = false; if (--owners === 0) { stop?.(); stop = undefined; } };
}
