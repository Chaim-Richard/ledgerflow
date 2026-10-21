/**
 * DIM-2 phase 1 (GitHub #132): where an item's stock came from and where it went, read from what the books already
 * hold. Each stock move (src/lib/stockMoves.ts) is followed to its document and the party on it: a purchase to its
 * bill, the vendor and the purchase order the bill was made from; a sale to its invoice and the customer; a delivery
 * (or goods returned against one) to its sales order and the customer; returns to their credit. Nothing is written
 * and nothing is guessed: a move whose document or party cannot be found says which link is missing, and stock whose
 * origin was never recorded (opening stock, an import, what was on hand before the history began) is "origin not
 * recorded", never assigned to a vendor. Later phases record the source document line and the destination labels
 * with each move.
 */
import type { StockMove } from './stockMoves';

interface Named { id: string; name?: string }
interface Doc { id: string; number?: string; vendorId?: string; vendorName?: string; customerId?: string; customerName?: string; billId?: string; invoiceId?: string; metadata?: Record<string, unknown> }

/** The document lists the trail reads; each can be capped or still loading on its own. */
export type TrailList = 'bills' | 'invoices' | 'creditNotes' | 'vendorCredits' | 'orders' | 'purchaseOrders' | 'transactions';

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
  /** #260 review: the lists that are capped or still loading: a document not found in one of them may exist */
  partial?: Partial<Record<TrailList, boolean>>;
}

/**
 * known: document and party found · not-recorded: no origin was ever kept (opening stock, imports) · adjusted: added
 * or taken out by a stock adjustment, count or move, inside the business · missing: a link that should be there is
 * not · not-loaded: the document may exist but its list is capped or still loading
 */
export type TrailOrigin = 'known' | 'not-recorded' | 'internal' | 'missing' | 'not-loaded';

export interface TrailStep {
  move: StockMove;
  /** what the units did: came in, went out, or only their value changed */
  direction: 'in' | 'out' | 'none';
  document?: { type: 'bill' | 'invoice' | 'credit-note' | 'vendor-credit' | 'sales-order'; id: string; label: string };
  party?: { kind: 'vendor' | 'customer'; id: string; name: string };
  /** the purchase order a bill was made from, and its goods receipts */
  purchaseOrder?: { id: string; label: string; receipts: string[] };
  /** DIM-2 phase 2: the bill line the units came in on ("line 2"), or for units sent back, the bill and line */
  sourceLine?: string;
  origin: TrailOrigin;
  /** the links that should be there and are not (or are not loaded), in words */
  missing: string[];
}

export interface StockTrail {
  steps: TrailStep[];
  /** units on hand when the history began (the first move's quantity before): their origin is not recorded */
  beforeHistory: number;
  unitsIn: { known: number; notRecorded: number; adjusted: number; missingLink: number; notLoaded: number };
  unitsOut: { known: number; missingLink: number; notLoaded: number; internal: number };
}

const round6 = (n: number) => Math.round(n * 1e6) / 1e6;
const label = (prefix: string, d: Doc) => `${prefix} ${d.number || d.id}`;
const byId = <T extends { id: string }>(list: T[]) => new Map(list.map(x => [x.id, x]));

/** The lists indexed once, so a long history does not search every list for every move (#260 review). */
interface TrailIndex {
  bills: Map<string, Doc>; invoices: Map<string, Doc>; creditNotes: Map<string, Doc>; vendorCredits: Map<string, Doc>; orders: Map<string, Doc>;
  purchaseOrders: Map<string, StockTrailDocs['purchaseOrders'][number]>; purchaseOrderOfBill: Map<string, StockTrailDocs['purchaseOrders'][number]>;
  transactions: Map<string, { id: string; metadata?: Record<string, unknown> }>; vendors: Map<string, Named>; customers: Map<string, Named>;
  partial: Partial<Record<TrailList, boolean>>;
}

function indexDocs(docs: StockTrailDocs): TrailIndex {
  return {
    bills: byId(docs.bills), invoices: byId(docs.invoices), creditNotes: byId(docs.creditNotes), vendorCredits: byId(docs.vendorCredits), orders: byId(docs.orders),
    purchaseOrders: byId(docs.purchaseOrders),
    purchaseOrderOfBill: new Map(docs.purchaseOrders.filter(p => p.billId).map(p => [String(p.billId), p])),
    transactions: byId(docs.transactions), vendors: byId(docs.vendors), customers: byId(docs.customers),
    partial: docs.partial || {},
  };
}

function party(kind: 'vendor' | 'customer', id: string | undefined, fallbackName: string | undefined, list: Map<string, Named>) {
  if (!id) return undefined;
  return { kind, id, name: list.get(id)?.name || fallbackName || id };
}

function step(move: StockMove, ix: TrailIndex): TrailStep {
  const direction: TrailStep['direction'] = move.quantity > 0 ? 'in' : move.quantity < 0 ? 'out' : 'none';
  const s: TrailStep = { move, direction, origin: 'known', missing: [] };
  let notLoaded = false;
  const absent = (what: string, id: string, list: TrailList) => {
    if (ix.partial[list]) { notLoaded = true; s.missing.push(`The ${what} it names (${id}) is not among the documents loaded.`); }
    else s.missing.push(`The ${what} it names (${id}) is not in the books.`);
  };
  const lookFor = (type: NonNullable<TrailStep['document']>['type'], list: TrailList & keyof TrailIndex, prefix: string, what: string) => {
    if (!move.documentId) { s.missing.push(`No ${what} is linked to this change.`); return undefined; }
    const doc = (ix[list] as Map<string, Doc>).get(move.documentId);
    if (!doc) { absent(what, move.documentId, list); return undefined; }
    s.document = { type, id: doc.id, label: label(prefix, doc) };
    return doc;
  };
  const viaOrder = () => {
    const entry = move.transactionId ? ix.transactions.get(move.transactionId) : undefined;
    const orderId = typeof entry?.metadata?.orderId === 'string' ? entry.metadata.orderId : undefined;
    if (!orderId) {
      if (!entry && move.transactionId && ix.partial.transactions) { notLoaded = true; s.missing.push('Its entry is not among the documents loaded, so its sales order is not shown.'); }
      else s.missing.push('No sales order is linked to this delivery.');
      return;
    }
    const order = ix.orders.get(orderId);
    if (!order) { absent('sales order', orderId, 'orders'); return; }
    s.document = { type: 'sales-order', id: order.id, label: label('Order', order) };
    s.party = party('customer', order.customerId, order.customerName, ix.customers);
    if (!s.party) s.missing.push(`${s.document.label} names no customer.`);
  };

  if ((move.kind === 'purchase' || move.kind === 'purchase-reversal') && move.documentType === 'adjustment') {
    // #260 review: stock received with Adjust stock (no bill): recorded, but inside the business, not a missing bill
    s.origin = 'internal';
  } else if (move.kind === 'purchase' || move.kind === 'purchase-reversal') {
    const bill = lookFor('bill', 'bills', 'Bill', 'bill');
    if (move.documentLine !== undefined) s.sourceLine = `line ${move.documentLine + 1}`;
    // phase 2: the vendor kept with the move names the source even when its bill is not found
    if (!bill && move.vendorId) s.party = party('vendor', move.vendorId, undefined, ix.vendors);
    if (bill) {
      s.party = party('vendor', bill.vendorId || move.vendorId, bill.vendorName, ix.vendors);
      if (!s.party) s.missing.push(`${s.document!.label} names no vendor.`);
      // #260 review: the order the bill names (metadata.poId) when the order does not name the bill
      const poId = typeof bill.metadata?.poId === 'string' ? bill.metadata.poId : undefined;
      const po = ix.purchaseOrderOfBill.get(bill.id) || (poId ? ix.purchaseOrders.get(poId) : undefined);
      if (po) s.purchaseOrder = { id: po.id, label: `Purchase order ${po.poNumber || po.id}`, receipts: (po.receipts || []).map(r => [r.receiptNumber, r.receivedDate].filter(Boolean).join(' · ')) };
    }
  } else if (move.kind === 'purchase-return' || move.kind === 'purchase-return-reversal') {
    const credit = lookFor('vendor-credit', 'vendorCredits', 'Vendor credit', 'vendor credit');
    if (!credit && move.vendorId) s.party = party('vendor', move.vendorId, undefined, ix.vendors);
    if (credit) {
      s.party = party('vendor', credit.vendorId || move.vendorId, credit.vendorName, ix.vendors);
      if (!s.party) s.missing.push(`${s.document!.label} names no vendor.`);
    }
    // phase 2: the bill (and line) the units go back from
    if (move.sourceBillId) {
      const from = ix.bills.get(move.sourceBillId);
      s.sourceLine = `from ${from ? label('Bill', from) : `bill ${move.sourceBillId}`}${move.documentLine !== undefined ? `, line ${move.documentLine + 1}` : ''}`;
    }
  } else if ((move.kind === 'sale' || move.kind === 'sale-reversal' || move.kind === 'return' || move.kind === 'return-reversal') && move.documentType === 'delivery') {
    // a delivery, or goods returned against one (#260 review): the delivery's entry names the sales order
    viaOrder();
  } else if (move.kind === 'sale' || move.kind === 'sale-reversal') {
    const invoice = lookFor('invoice', 'invoices', 'Invoice', 'invoice');
    if (invoice) {
      s.party = party('customer', invoice.customerId, invoice.customerName, ix.customers);
      if (!s.party) s.missing.push(`${s.document!.label} names no customer.`);
    }
  } else if (move.kind === 'return' || move.kind === 'return-reversal') {
    const credit = lookFor('credit-note', 'creditNotes', 'Credit note', 'credit note');
    if (credit) {
      s.party = party('customer', credit.customerId, credit.customerName, ix.customers);
      if (!s.party) s.missing.push(`${s.document!.label} names no customer.`);
    }
  } else if (move.kind === 'opening' || move.documentType === 'import') {
    s.origin = 'not-recorded';
  } else {
    // adjustments, counts, moves between locations and value changes: inside the business, no party
    s.origin = 'internal';
  }
  if (s.missing.length) s.origin = notLoaded ? 'not-loaded' : 'missing';
  return s;
}

export function stockTrailStep(move: StockMove, docs: StockTrailDocs): TrailStep {
  return step(move, indexDocs(docs));
}

/** The trail of one item's moves (given oldest first, as `orderedMoves` sorts them). */
export function stockTrail(moves: StockMove[], docs: StockTrailDocs): StockTrail {
  const ix = indexDocs(docs);
  const steps = moves.map(m => step(m, ix));
  const beforeHistory = moves.length ? round6(Math.max(0, Number(moves[0].quantityBefore) || 0)) : 0;
  const unitsIn = { known: 0, notRecorded: beforeHistory, adjusted: 0, missingLink: 0, notLoaded: 0 };
  const unitsOut = { known: 0, missingLink: 0, notLoaded: 0, internal: 0 };
  for (const s of steps) {
    const q = Math.abs(s.move.quantity);
    if (s.direction === 'in') {
      const key = s.origin === 'known' ? 'known' : s.origin === 'missing' ? 'missingLink' : s.origin === 'not-loaded' ? 'notLoaded' : s.origin === 'not-recorded' ? 'notRecorded' : 'adjusted';
      unitsIn[key] = round6(unitsIn[key] + q);
    } else if (s.direction === 'out') {
      const key = s.origin === 'known' ? 'known' : s.origin === 'missing' ? 'missingLink' : s.origin === 'not-loaded' ? 'notLoaded' : 'internal';
      unitsOut[key] = round6(unitsOut[key] + q);
    }
  }
  return { steps, beforeHistory, unitsIn, unitsOut };
}

/** One line for the top of the history: how much of what came in has a recorded source. */
export function stockTrailSummary(trail: StockTrail): string {
  const { known, notRecorded, adjusted, missingLink, notLoaded } = trail.unitsIn;
  const parts = [`${known} came in on a document with its vendor or customer`];
  if (adjusted) parts.push(`${adjusted} by a stock adjustment (no bill)`);
  if (notRecorded) parts.push(`${notRecorded} with no recorded origin (opening stock, an import${trail.beforeHistory ? ', or on hand before the history began' : ''})`);
  if (missingLink) parts.push(`${missingLink} whose document is missing`);
  if (notLoaded) parts.push(`${notLoaded} whose document is not loaded`);
  return `${parts.join('; ')}.`;
}
