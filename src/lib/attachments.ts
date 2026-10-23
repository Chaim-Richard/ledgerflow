/**
 * Attachments (K-07): files kept with an invoice, a bill, a customer or a vendor — the signed
 * contract, the supplier's PDF, a receipt photo. They are stored like the Vault's files (the
 * `documents` table, the file inside the record as a data address, up to 700 KB each) with the
 * record they belong to, so they show on that record and in the Vault. Removing one goes through
 * the server (who may, and an audit line).
 */

/** The biggest file kept: the Vault's limit, so a record stays well under the database's row size. */
export const MAX_ATTACHMENT_BYTES = 700_000;
export const MAX_FILES_AT_ONCE = 10;

// supportTickets (BO-05): a screenshot kept with feedback or a support ticket
// chartAccounts (BD-04): a file kept with one account's workpaper for a month
// assets (A-8): a file kept with the existing fixed asset register's maintenance log
// inventory (A-78): a visual item reference, stored as a normal linked attachment
export type AttachmentCollection = 'invoices' | 'bills' | 'customers' | 'vendors' | 'creditNotes' | 'vendorCredits' | 'estimates' | 'purchaseOrders' | 'supportTickets' | 'chartAccounts' | 'assets' | 'inventory';

/** The record a file belongs to, and how it is named in lists ("Invoice INV-12"). */
export interface AttachmentTarget {
  collection: AttachmentCollection;
  id: string;
  label: string;
  /** Only the record's files whose name starts with this (e.g. "Workpaper 2026-09": one month of an account). */
  scope?: string;
}

/** A file as stored (one row of `documents`). */
export interface Attachment {
  id: string;
  uid: string;
  workspaceId: string;
  name: string;
  fileUrl: string;
  mimeType?: string;
  sizeBytes?: number;
  tags?: string[];
  createdAt: string;
  linkedCollection?: AttachmentCollection;
  linkedId?: string;
  linkedLabel?: string;
}

export type AttachmentPreviewKind = 'image' | 'pdf' | null;

/** Preview only known-safe embedded formats. Other files remain downloadable but are not embedded. */
export function attachmentPreviewKind(file: Pick<Attachment, 'mimeType' | 'fileUrl'>): AttachmentPreviewKind {
  const mime = String(file.mimeType || '').toLowerCase();
  const url = String(file.fileUrl || '');
  if (mime === 'application/pdf' && /^data:application\/pdf;base64,/i.test(url)) return 'pdf';
  if (['image/jpeg', 'image/png', 'image/webp'].includes(mime) && url.toLowerCase().startsWith(`data:${mime};base64,`)) return 'image';
  return null;
}

/** Why this file can't be kept, or null. */
export function attachmentProblem(file: { name: string; size: number }): string | null {
  if (!file.size) return `${file.name} is empty`;
  if (file.size > MAX_ATTACHMENT_BYTES) return `${file.name} is ${formatBytes(file.size)}; the most is ${formatBytes(MAX_ATTACHMENT_BYTES)} (a smaller scan or a PDF usually fits)`;
  return null;
}

/** The record to save for a file read as a data address. */
export function attachmentRecord(
  file: { name: string; size: number; type?: string },
  fileUrl: string,
  target: AttachmentTarget,
  who: { uid: string; workspaceId: string },
  now = new Date().toISOString(),
): Omit<Attachment, 'id'> {
  return {
    uid: who.uid,
    workspaceId: who.workspaceId,
    name: file.name.slice(0, 200),
    fileUrl,
    mimeType: file.type || 'application/octet-stream',
    sizeBytes: file.size,
    tags: ['Attachment'],
    createdAt: now,
    linkedCollection: target.collection,
    linkedId: target.id,
    linkedLabel: target.label.slice(0, 120),
  };
}

/** The files of one record, newest first. */
export function attachmentsOf(docs: Attachment[], target: Pick<AttachmentTarget, 'collection' | 'id' | 'scope'>): Attachment[] {
  return docs
    .filter(d => d.linkedCollection === target.collection && d.linkedId === target.id)
    .filter(d => !target.scope || String(d.linkedLabel || '').startsWith(target.scope))
    .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
}

export function formatBytes(bytes: number): string {
  if (bytes < 1000) return `${bytes} B`;
  if (bytes < 1_000_000) return `${Math.round(bytes / 1000)} KB`;
  return `${(bytes / 1_000_000).toFixed(1)} MB`;
}

/** Who may remove a file: owners, accountants and bookkeepers, or the person who added it. */
export function mayRemoveAttachment(role: string | undefined, uid: string | undefined, file: Pick<Attachment, 'uid'>): boolean {
  return role === 'owner' || role === 'accountant' || role === 'bookkeeper' || (Boolean(uid) && file.uid === uid);
}
