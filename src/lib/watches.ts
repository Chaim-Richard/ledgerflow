/**
 * Watching a record (BG-04): someone in the workspace watches an invoice, bill, entry, account or
 * item, and is told once a day when it changed (edited, paid, voided…) or was deleted. Kept with
 * the workspace's documents (kind "watch", no `uid`), written by the server only
 * (src/server/services/watchService.ts); the nightly job compares each record's last change with
 * what the watcher was last told about.
 */
import type { RecordRef, RecordType } from './recordLinks';

export const WATCH_KIND = 'watch';
export const MAX_WATCHES_PER_PERSON = 200;

/** Where each kind of record is kept. */
export const WATCH_TABLES: Partial<Record<RecordType, string>> = {
  invoice: 'invoices', bill: 'bills', transaction: 'transactions', account: 'chartAccounts', item: 'inventory',
};

export interface Watch {
  id: string;
  kind: typeof WATCH_KIND;
  workspaceId: string;
  watcher: string;
  record: RecordRef & { label: string };
  createdAt: string;
  /** the record's last change the watcher has been told about (or that existed when they started) */
  seenAt: string;
}

/** The notice's `recordId` for a change: "<type>/<id>", so the bell can open the record itself. */
export const watchNoticeRecordId = (record: RecordRef) => `${record.type}/${record.id}`;
export function recordFromNotice(kind: string, recordId: string | undefined): RecordRef | null {
  if (kind !== 'record.changed' || !recordId) return null;
  const at = recordId.indexOf('/');
  const type = recordId.slice(0, at) as RecordType;
  return at > 0 && WATCH_TABLES[type] ? { type, id: recordId.slice(at + 1) } : null;
}
