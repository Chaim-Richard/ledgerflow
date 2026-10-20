/**
 * DIM-2 phase 1 (GitHub #132): where an item's stock came from and where it went, read from what the books already
 * hold. Each stock move (src/lib/stockMoves.ts) is followed to its document and the party on it: a purchase to its
 * bill, the vendor and the purchase order the bill was made from; a sale to its invoice and the customer; a delivery
 * to its sales order and the customer; returns to their credit. Nothing is written and nothing is guessed: a move
 * whose document or party cannot be found says which link is missing, and stock whose origin was never recorded
 * (opening stock, an import, what was on hand before the history began) is "origin not recorded", never assigned to
 * a vendor. Later phases record the source document line and the destination labels with each move.
 */
import type { StockMove } from './stockMoves';

interface Named { id: string; name?: string }
interface Doc { id: string; number?: string; vendorId?: string; vendorName?: string; customerId?: string; customerName?: string; billId?: string; invoiceId?: string }

export interface StockTrailDocs {
  bills: Doc[];
  invoices: Doc[];
  creditNotes: Doc[];
  vendorCredits: Doc[];
  /** sales orders (estimates) */
  orders: Doc[];
  purchaseOrders: Array<{ id: string; poNumber?: string; vendorId?: string; billId?: string; receipts?: Array<{ receiptNumber?: string; receivedDate?: string }> }>;
  /** entries, for a delivery's sales order (metadata.orderId) */
  transactions: Array<{ id: string; metadata?: Record<string, unknown> }>;
  vendors: Named[];
  customers: Named[];
  /** a document list was capped or is still loading: a document not found may exist, so it is not called missing from the books */
  partial?: boolean;
}

export type TrailOrigin = 'known' | 'not-recorded' | 'internal' | 'missing';

export interface TrailStep {
  move: StockMove;
  /** what the units did: came in, went out, or only their value changed */
  direction: 'in' | 'out' | 'none';
  document?: { type: 'bill' | 'invoice' | 'credit-note' | 'vendor-credit' | 'sales-order'; id: string; label: string };
  party?: { kind: 'vendor' | 'customer'; id: string; name: string };
  /** the purchase order a bill was made from, and its goods receipts */
  purchaseOrder?: { id: string; label: string; receipts: string[] };
  origin: TrailOrigin;
  /** the links that should be there and are not, in words */
  missing: string[];
}

export interface StockTrail {
  steps: TrailStep[];
  /** units on hand when the history began (the first move's quantity before): their origin is not recorded */
  beforeHistory: number;
  unitsIn: { known: number; notRecorded: number; missingLink: number };
  unitsOut: { known: number; missingLink: number; internal: number };
}

const round6 = (n: number) => Math.round(n * 1e6) / 1e6;
const label = (prefix: string, d: Doc) => `${prefix} ${d.number || d.id}`;

const NOT_RECORDED_KINDS = new Set(['opening']);

function party(kind: 'vendor' | 'customer', id: string | undefined, fallbackName: string | undefined, list: Named[]) {
  if (!id) return undefined;
  const found = list.find(p => p.id === id);
  return { kind, id, name: found?.name || fallbackName || id };
}

export function stockTrailStep(move: StockMove, docs: StockTrailDocs): TrailStep {
  const direction: TrailStep['direction'] = move.quantity > 0 ? 'in' : move.quantity < 0 ? 'out' : 'none';
  const step: TrailStep = { move, direction, origin: 'known', missing: [] };
  const lookFor = (type: NonNullable<TrailStep['document']>['type'], list: Doc[], prefix: string, what: string) => {
    if (!move.documentId) { step.missing.push(`No ${what} is linked to this change.`); return undefined; }
    const doc = list.find(d => d.id === move.documentId);
    if (!doc) { step.missing.push(`The ${what} it names (${move.documentId}) is ${docs.partial ? 'not among the documents loaded' : 'not in the books'}.`); return undefined; }
    step.document = { type, id: doc.id, label: label(prefix, doc) };
    return doc;
  };

  if (move.kind === 'purchase' || move.kind === 'purchase-reversal') {
    const bill = lookFor('bill', docs.bills, 'Bill', 'bill');
    if (bill) {
      step.party = party('vendor', bill.vendorId, bill.vendorName, docs.vendors);
      if (!step.party) step.missing.push(`${step.document!.label} names no vendor.`);
      const po = docs.purchaseOrders.find(p => p.billId === bill.id);
      if (po) step.purchaseOrder = { id: po.id, label: `Purchase order ${po.poNumber || po.id}`, receipts: (po.receipts || []).map(r => [r.receiptNumber, r.receivedDate].filter(Boolean).join(' · ')) };
    }
  } else if (move.kind === 'purchase-return' || move.kind === 'purchase-return-reversal') {
    const credit = lookFor('vendor-credit', docs.vendorCredits, 'Vendor credit', 'vendor credit');
    if (credit) {
      step.party = party('vendor', credit.vendorId, credit.vendorName, docs.vendors);
      if (!step.party) step.missing.push(`${step.document!.label} names no vendor.`);
    }
  } else if (move.kind === 'sale' || move.kind === 'sale-reversal') {
    if (move.documentType === 'delivery') {
      const entry = docs.transactions.find(t => t.id === move.transactionId);
      const orderId = typeof entry?.metadata?.orderId === 'string' ? entry.metadata.orderId : undefined;
      const order = orderId ? docs.orders.find(o => o.id === orderId) : undefined;
      if (!order) step.missing.push(orderId ? `The sales order it was delivered on (${orderId}) is ${docs.partial ? 'not among the documents loaded' : 'not in the books'}.` : 'No sales order is linked to this delivery.');
      else {
        step.document = { type: 'sales-order', id: order.id, label: label('Order', order) };
        step.party = party('customer', order.customerId, order.customerName, docs.customers);
        if (!step.party) step.missing.push(`${step.document.label} names no customer.`);
      }
    } else {
      const invoice = lookFor('invoice', docs.invoices, 'Invoice', 'invoice');
      if (invoice) {
        step.party = party('customer', invoice.customerId, invoice.customerName, docs.customers);
        if (!step.party) step.missing.push(`${step.document!.label} names no customer.`);
      }
    }
  } else if (move.kind === 'return' || move.kind === 'return-reversal') {
    const credit = lookFor('credit-note', docs.creditNotes, 'Credit note', 'credit note');
    if (credit) {
      step.party = party('customer', credit.customerId, credit.customerName, docs.customers);
      if (!step.party) step.missing.push(`${step.document!.label} names no customer.`);
    }
  } else if (NOT_RECORDED_KINDS.has(move.kind) || move.documentType === 'import') {
    step.origin = 'not-recorded';
  } else {
    // adjustments, counts, moves between locations and value changes: inside the business, no party
    step.origin = 'internal';
  }
  if (step.missing.length) step.origin = 'missing';
  return step;
}

/** The trail of one item's moves (given oldest first, as `orderedMoves` sorts them). */
export function stockTrail(moves: StockMove[], docs: StockTrailDocs): StockTrail {
  const steps = moves.map(m => stockTrailStep(m, docs));
  const beforeHistory = moves.length ? round6(Math.max(0, Number(moves[0].quantityBefore) || 0)) : 0;
  const unitsIn = { known: 0, notRecorded: beforeHistory, missingLink: 0 };
  const unitsOut = { known: 0, missingLink: 0, internal: 0 };
  for (const s of steps) {
    const q = Math.abs(s.move.quantity);
    if (s.direction === 'in') {
      if (s.origin === 'known') unitsIn.known = round6(unitsIn.known + q);
      else if (s.origin === 'missing') unitsIn.missingLink = round6(unitsIn.missingLink + q);
      else if (s.origin === 'not-recorded') unitsIn.notRecorded = round6(unitsIn.notRecorded + q);
    } else if (s.direction === 'out') {
      if (s.origin === 'known') unitsOut.known = round6(unitsOut.known + q);
      else if (s.origin === 'missing') unitsOut.missingLink = round6(unitsOut.missingLink + q);
      else unitsOut.internal = round6(unitsOut.internal + q);
    }
  }
  return { steps, beforeHistory, unitsIn, unitsOut };
}

/** One line for the top of the history: how much of what came in has a recorded source. */
export function stockTrailSummary(trail: StockTrail): string {
  const { known, notRecorded, missingLink } = trail.unitsIn;
  const parts = [`${known} came in on a recorded document (a bill, or a customer's return)`];
  if (notRecorded) parts.push(`${notRecorded} with no recorded origin (opening stock, an import${trail.beforeHistory ? ', or on hand before the history began' : ''})`);
  if (missingLink) parts.push(`${missingLink} whose document is missing`);
  return `${parts.join('; ')}.`;
}
