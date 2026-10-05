/**
 * Acting on many invoices or bills at once (K-06): which ones can be sent or paid, and the
 * payments that settle them (one per customer or vendor, each document paid in full).
 */
import { calculateAmountDue } from './documentMath';

export type BulkSide = 'invoice' | 'bill';

export interface BulkDocument {
  id: string;
  number?: string;
  billNumber?: string;
  status?: string;
  customerId?: string;
  customerName?: string;
  vendorId?: string;
  vendorName?: string;
  amountCents?: number;
  amountPaidCents?: number;
  depositCents?: number;
  currency?: string;
  exchangeRate?: number;
}

export interface Skipped { id: string; label: string; reason: string }

export interface PlannedPayment {
  partyId: string;
  partyName: string;
  amountCents: number;
  allocations: Array<{ documentId: string; documentType: BulkSide; amountCents: number; label: string }>;
}

const NOT_ISSUED = new Set(['draft', 'void', 'cancelled', 'rejected']);

export function documentLabel(doc: BulkDocument, side: BulkSide): string {
  return (side === 'bill' ? doc.billNumber || doc.number : doc.number) || doc.id;
}

function notIssued(doc: BulkDocument, side: BulkSide): string | null {
  if (doc.status === 'draft') return `a draft ${side} isn't in the books yet`;
  if (NOT_ISSUED.has(String(doc.status))) return `the ${side} is ${doc.status}`;
  return null;
}

/**
 * The payments that settle the chosen documents in full: one per customer (invoices) or vendor
 * (bills), oldest first in the order given. Drafts, voided, fully paid and other-currency documents
 * are skipped with the reason (another currency needs its rate: record it from the document).
 */
export function paymentPlan(docs: BulkDocument[], side: BulkSide, workspaceCurrency: string): { payments: PlannedPayment[]; skipped: Skipped[] } {
  const skipped: Skipped[] = [];
  const byParty = new Map<string, PlannedPayment>();
  for (const doc of docs) {
    const label = documentLabel(doc, side);
    const due = calculateAmountDue(doc);
    const partyId = side === 'invoice' ? doc.customerId : doc.vendorId;
    const reason = notIssued(doc, side)
      ?? (due <= 0 ? 'nothing is due' : null)
      ?? (!partyId ? `no ${side === 'invoice' ? 'customer' : 'vendor'}` : null)
      ?? ((doc.currency && doc.currency !== workspaceCurrency) || (doc.exchangeRate ?? 1) !== 1 ? `it is in ${doc.currency || 'another currency'}: record it from the ${side}` : null);
    if (reason || !partyId) { skipped.push({ id: doc.id, label, reason: reason || 'no contact' }); continue; }
    const payment = byParty.get(partyId) ?? { partyId, partyName: (side === 'invoice' ? doc.customerName : doc.vendorName) || 'Contact', amountCents: 0, allocations: [] };
    payment.allocations.push({ documentId: doc.id, documentType: side, amountCents: due, label });
    payment.amountCents += due;
    byParty.set(partyId, payment);
  }
  return { payments: [...byParty.values()], skipped };
}

/** The invoices that can be emailed (issued ones); drafts and voided ones are skipped with the reason. */
export function sendPlan(docs: BulkDocument[]): { send: BulkDocument[]; skipped: Skipped[] } {
  const send: BulkDocument[] = [];
  const skipped: Skipped[] = [];
  for (const doc of docs) {
    const reason = notIssued(doc, 'invoice');
    if (reason) skipped.push({ id: doc.id, label: documentLabel(doc, 'invoice'), reason });
    else send.push(doc);
  }
  return { send, skipped };
}
