/**
 * What was deleted, kept in the audit trail (CA-10): a deleted entry or document leaves a copy of its
 * main fields (who, when, what, how much, its lines) and a sentence saying what it was, so the audit
 * trail answers "what was this, and who removed it?" and the record could be typed in again.
 * Attachments and file contents are not copied.
 */
const KEEP = ['number', 'date', 'description', 'reference', 'status', 'type', 'customerId', 'customerName', 'vendorId', 'vendorName',
  'amountCents', 'totalAmountCents', 'currency', 'exchangeRate', 'dueDate', 'items', 'lines', 'splits', 'metadata', 'tags'];

const MAX_LINES = 100;

/** The deleted record's main fields (lines capped at 100). */
export function deletionSnapshot(data: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const key of KEEP) {
    if (data[key] === undefined) continue;
    out[key] = Array.isArray(data[key]) ? (data[key] as unknown[]).slice(0, MAX_LINES) : data[key];
  }
  return out;
}

const KIND: Record<string, string> = {
  transactions: 'entry', invoices: 'invoice', bills: 'bill', creditNotes: 'credit note', vendorCredits: 'vendor credit',
  projects: 'project', orders: 'order',
};

/** "Deleted the invoice INV-12 of 2026-10-01 (Acme, 120.00)". */
export function deletionSentence(collection: string, id: string, data: Record<string, unknown>): string {
  const kind = KIND[collection] || 'record';
  const name = String(data.number || data.description || data.reference || id).slice(0, 80);
  const who = String(data.customerName || data.vendorName || '').slice(0, 80);
  const cents = typeof data.amountCents === 'number' ? data.amountCents : typeof data.totalAmountCents === 'number' ? data.totalAmountCents : null;
  const facts = [who, cents === null ? '' : `${String(data.currency || '').toUpperCase()} ${(Math.abs(cents) / 100).toFixed(2)}`.trim()].filter(Boolean).join(', ');
  return `Deleted the ${kind} ${name}${data.date ? ` of ${String(data.date).slice(0, 10)}` : ''}${facts ? ` (${facts})` : ''}`;
}
