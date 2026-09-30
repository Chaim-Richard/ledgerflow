import { useEffect, useRef } from 'react';
import { useUIStore } from '../stores/useUIStore';
import type { RecordType } from '../lib/recordLinks';

/** The DOM id of a record's row, so a record link (Z-32) can scroll to it. */
export const recordElementId = (type: RecordType, id: string) => `record-${type}-${id}`;

/**
 * The record of this type that a link (`#sales/invoice/<id>`) points to, or null. `onFocus` runs
 * once per link (e.g. switch to the right sub-tab, clear the search); once `ready` is true the row
 * scrolls into view.
 */
export function useRecordFocus(type: RecordType, options: { ready?: boolean; onFocus?: (id: string) => void } = {}): string | null {
  const focusRecord = useUIStore(s => s.focusRecord);
  const id = focusRecord?.type === type ? focusRecord.id : null;
  const onFocus = useRef(options.onFocus);
  useEffect(() => {
    onFocus.current = options.onFocus;
  });
  const ready = options.ready !== false;

  useEffect(() => {
    if (id) onFocus.current?.(id);
  }, [id]);

  useEffect(() => {
    if (!id || !ready) return;
    const timer = window.setTimeout(() => {
      document.getElementById(recordElementId(type, id))?.scrollIntoView({ block: 'center', behavior: 'smooth' });
    }, 50);
    return () => window.clearTimeout(timer);
  }, [id, ready, type]);

  return id;
}
