import { FieldValue } from '../db/firestore';
import type { DocumentData, Firestore, Transaction as DbTransaction } from '../db/firestore';
import { INVOICE_COGS_TYPE } from '../../services/invoiceCogs';
import { SALES_RETURN_TYPE } from '../../lib/salesReturns';
import { DELIVERY_COGS_TYPE, goodsLeaveWith } from '../../lib/deliveries';
import { isPostable } from '../../lib/txFilters';
import type { Transaction } from '../../types';
import { stockMovesReady, writeStockMoves, type NewStockMove } from './stockMoveService';

/**
 * Stock follows the ledger: a cost-of-goods-sold entry for an invoice line (metadata.type
 * 'invoice-cogs-auto') lowers the item's quantity on hand, and reversing that entry raises it
 * back. The stock change is written in the same database transaction as the ledger entries,
 * so the two can't drift apart. A ledger entry can be reversed only once. Selling more than is on
 * hand is recorded with a warning, unless an owner turned on "Refuse sales beyond stock"
 * (`refuseNegativeStock` on the workspace, W-06: stockPolicyService.ts); then it is refused and
 * nothing is written. Putting stock back (a reversal) is never refused.
 *
 * BF-08 step 2: in a workspace where stock leaves with deliveries (`goodsLeaveWith: 'delivery'`), a
 * delivery's cost entry ('delivery-cogs-auto', deliveryService.ts) lowers stock the same way, and an
 * invoice's cost entry is refused: the goods leave once, with the delivery.
 */

export class LedgerPostingError extends Error {
  constructor(readonly status: number, message: string) {
    super(message);
    this.name = 'LedgerPostingError';
  }
}

interface LedgerEntry {
  id: string;
  date?: string;
  uid?: string;
  totalAmountCents?: number;
  metadata?: Record<string, unknown>;
}

/** One entry's effect on one item, in the order of the request (W-02 records each as a stock move). */
interface PendingMove {
  itemId: string;
  quantity: number;
  kind: 'sale' | 'sale-reversal' | 'return' | 'return-reversal';
  entry: LedgerEntry;
  valueCents: number;
  location?: string;
}

const round6 = (n: number) => Math.round(n * 1e6) / 1e6;

function cogsMove(tx: { metadata?: Record<string, unknown> }): { itemId: string; quantity: number } | null {
  const meta = tx.metadata;
  if (meta?.type !== INVOICE_COGS_TYPE && meta?.type !== DELIVERY_COGS_TYPE) return null;
  const itemId = meta.inventoryItemId;
  const quantity = Number(meta.quantity);
  if (typeof itemId !== 'string' || !itemId || !Number.isFinite(quantity) || quantity <= 0) {
    throw new LedgerPostingError(400, 'A cost of goods sold entry needs inventoryItemId and a positive quantity.');
  }
  return { itemId, quantity };
}

/** Goods a customer sent back (BF-06, src/lib/salesReturns.ts): the units come back into stock. */
function returnMove(tx: { metadata?: Record<string, unknown> }): { itemId: string; quantity: number; invoiceId: string; lineId: string } | null {
  const meta = tx.metadata;
  if (meta?.type !== SALES_RETURN_TYPE) return null;
  const quantity = Number(meta.quantity);
  if (typeof meta.inventoryItemId !== 'string' || !meta.inventoryItemId || typeof meta.invoiceId !== 'string' || typeof meta.returnForLineId !== 'string' || !Number.isFinite(quantity) || quantity <= 0) {
    throw new LedgerPostingError(400, 'A goods-returned entry needs the item, the invoice line and a positive quantity.');
  }
  return { itemId: meta.inventoryItemId, quantity, invoiceId: meta.invoiceId, lineId: meta.returnForLineId };
}

/** What an entry does to stock: a sale takes units out, a return brings them back. */
function stockEffect(tx: LedgerEntry): { itemId: string; quantity: number; kind: 'sale' | 'return' } | null {
  const sale = cogsMove(tx);
  if (sale) return { itemId: sale.itemId, quantity: -sale.quantity, kind: 'sale' };
  const back = returnMove(tx);
  return back ? { itemId: back.itemId, quantity: back.quantity, kind: 'return' } : null;
}

export interface PreparedStockMoves {
  /** Queue the stock writes on the transaction (call after all reads). */
  apply: () => void;
  /** Human-readable notes, e.g. stock below zero. */
  warnings: string[];
}

/**
 * Reads what the entries need and checks the reversal rules. Call inside the posting's
 * database transaction, before any write.
 */
/**
 * BF-06: a line of an invoice can't take back more than was sold on it. Counts the returns in force
 * after this request (stored ones, this request's new ones, less those this request reverses) against
 * the line's sale in force.
 */
async function checkReturns(db: Firestore, t: DbTransaction, workspaceId: string, entries: LedgerEntry[]): Promise<void> {
  const invoices = new Set(entries.map(e => returnMove(e)?.invoiceId).filter((x): x is string => Boolean(x)));
  for (const invoiceId of invoices) {
    const stored = (await t.get(db.collection('transactions').where('workspaceId', '==', workspaceId).where('metadata.invoiceId', '==', invoiceId))).docs
      .map(d => ({ ...d.data(), id: d.id }) as Transaction);
    // the reversals of those entries need not name the invoice (a voided credit note's names only the note)
    const storedIds = stored.map(e => e.id);
    const reversals: Transaction[] = [];
    for (let i = 0; i < storedIds.length; i += 200) {
      const snap = await t.get(db.collection('transactions').where('workspaceId', '==', workspaceId).where('metadata.reversesTxId', 'in', storedIds.slice(i, i + 200)));
      reversals.push(...snap.docs.map(d => ({ ...d.data(), id: d.id }) as Transaction));
    }
    const all = [...stored, ...entries.filter(e => e.metadata?.invoiceId === invoiceId) as unknown as Transaction[]];
    const reversed = new Set([...all, ...reversals, ...entries as unknown as Transaction[]].map(e => e.metadata?.reversesTxId).filter(Boolean));
    const live = all.filter(e => isPostable(e) && !e.metadata?.isReversal && !e.reversalEventId && !reversed.has(e.id));
    const lines = new Set(live.map(e => (e.metadata?.type === SALES_RETURN_TYPE ? String(e.metadata.returnForLineId) : '')).filter(Boolean));
    for (const lineId of lines) {
      const sold = live.filter(e => e.metadata?.type === INVOICE_COGS_TYPE && e.metadata?.cogsForLineId === lineId).reduce((s, e) => s + (Number(e.metadata?.quantity) || 0), 0);
      const back = live.filter(e => e.metadata?.type === SALES_RETURN_TYPE && e.metadata?.returnForLineId === lineId).reduce((s, e) => s + (Number(e.metadata?.quantity) || 0), 0);
      if (round6(back) > round6(sold)) {
        throw new LedgerPostingError(409, `Only ${sold} of that item were sold on this invoice line, and ${back} would have come back. Return at most what was sold.`);
      }
    }
  }
}

export async function prepareStockMoves(
  db: Firestore,
  t: DbTransaction,
  workspaceId: string,
  entries: LedgerEntry[]
): Promise<PreparedStockMoves> {
  await stockMovesReady(db);
  const deltas = new Map<string, number>();
  const add = (itemId: string, delta: number) => deltas.set(itemId, round6((deltas.get(itemId) || 0) + delta));
  const pending: PendingMove[] = [];
  // the reversal entry of each target in this request (its stock move belongs to it)
  const reversalOf = new Map(entries.filter(e => typeof e.metadata?.reversesTxId === 'string').map(e => [String(e.metadata!.reversesTxId), e]));
  // invoices whose earlier cost entry this request reverses (an edit keeps how that invoice ships)
  const reshipped = new Set<string>();
  const putBack = (target: string, original: LedgerEntry) => {
    if (original.metadata?.type === INVOICE_COGS_TYPE) reshipped.add(String(original.metadata.invoiceId));
    const effect = stockEffect(original);
    if (!effect) return;
    const sign = effect.quantity > 0 ? -1 : 1;
    add(effect.itemId, -effect.quantity);
    pending.push({ itemId: effect.itemId, quantity: -effect.quantity, kind: effect.kind === 'sale' ? 'sale-reversal' : 'return-reversal', entry: reversalOf.get(target) || original, valueCents: sign * Math.abs(Number(original.totalAmountCents) || 0), location: original.metadata?.locationId as string | undefined });
  };

  for (const tx of entries) {
    const effect = stockEffect(tx);
    if (!effect) continue;
    add(effect.itemId, effect.quantity);
    pending.push({ itemId: effect.itemId, quantity: effect.quantity, kind: effect.kind, entry: tx, valueCents: Math.sign(effect.quantity) * Math.abs(Number(tx.totalAmountCents) || 0), location: tx.metadata?.locationId as string | undefined });
  }
  await checkReturns(db, t, workspaceId, entries);

  // Reversals: each target once, in this workspace, not reversed before.
  const targets: string[] = [];
  for (const tx of entries) {
    const target = tx.metadata?.reversesTxId;
    if (target === undefined || target === null) continue;
    if (typeof target !== 'string' || !target) throw new LedgerPostingError(400, 'reversesTxId must be a transaction id.');
    if (targets.includes(target)) throw new LedgerPostingError(409, `Transaction ${target} is reversed twice in this request.`);
    targets.push(target);
  }
  if (targets.length > 0) {
    // an entry posted together with its own reversal (R-05: an accrual reversing next month) is in this
    // request, not in the database yet; its stock move comes back the same way
    const inRequest = new Map(entries.filter(e => e.id).map(e => [String(e.id), e]));
    for (const target of targets.filter(id => inRequest.has(id))) putBack(target, inRequest.get(target)!);
    const stored = targets.filter(id => !inRequest.has(id));
    const originals = stored.length ? await t.getAll(...stored.map(id => db.collection('transactions').doc(id))) : [];
    for (const snap of originals) {
      const data = snap.data();
      if (!snap.exists || !data) throw new LedgerPostingError(400, `Transaction ${snap.id} to reverse does not exist.`);
      if (data.workspaceId !== workspaceId) throw new LedgerPostingError(403, 'Forbidden: the transaction to reverse belongs to another workspace.');
      if (data.reversalEventId) throw new LedgerPostingError(409, `Transaction ${snap.id} was already reversed.`);
      putBack(snap.id, { ...data, id: snap.id } as LedgerEntry);
    }
    for (let i = 0; i < targets.length; i += 100) {
      const earlier = await t.get(db.collection('transactions')
        .where('workspaceId', '==', workspaceId)
        .where('metadata.reversesTxId', 'in', targets.slice(i, i + 100)));
      const live = earlier.docs.find(d => isPostable(d.data() as Transaction));
      if (live) throw new LedgerPostingError(409, `Transaction ${live.data().metadata?.reversesTxId} was already reversed.`);
    }
  }

  const itemIds = Array.from(deltas.keys()).filter(id => deltas.get(id) !== 0);
  const warnings: string[] = [];
  const writes: { id: string; quantityAtHand: number }[] = [];
  const moves: NewStockMove[] = [];
  const invoiceSale = entries.some(e => e.metadata?.type === INVOICE_COGS_TYPE && !reshipped.has(String(e.metadata?.invoiceId)));
  const workspace = invoiceSale || itemIds.some(id => (deltas.get(id) || 0) < 0)
    ? (await t.get(db.collection('workspaces').doc(workspaceId))).data()
    : undefined;
  // BF-08 step 2: where deliveries ship the goods, a new invoice moves no stock (an invoice that
  // already shipped its goods, before the switch, keeps doing so when it is edited)
  if (invoiceSale && goodsLeaveWith(workspace) === 'delivery') {
    throw new LedgerPostingError(409, 'In this workspace stock leaves with deliveries, so an invoice books no cost of goods: save the invoice again (refresh first), and deliver the goods from the order.');
  }
  // W-06: selling below zero is allowed with a warning, unless an owner chose to refuse it
  const refuseBelowZero = itemIds.some(id => (deltas.get(id) || 0) < 0) && workspace?.refuseNegativeStock === true;
  if (itemIds.length > 0) {
    const items = await t.getAll(...itemIds.map(id => db.collection('inventory').doc(id)));
    for (const snap of items) {
      const item: DocumentData | undefined = snap.data();
      if (!snap.exists || !item) {
        warnings.push(`Inventory item ${snap.id} no longer exists; its stock was not changed.`);
        continue;
      }
      if (item.workspaceId !== workspaceId) throw new LedgerPostingError(403, 'Forbidden: inventory item belongs to another workspace.');
      const current = typeof item.quantityAtHand === 'number' ? item.quantityAtHand : 0;
      const delta = deltas.get(snap.id) || 0;
      const quantityAtHand = round6(current + delta);
      if (quantityAtHand < 0 && delta < 0 && refuseBelowZero) {
        throw new LedgerPostingError(409, `Only ${Math.max(0, current)} of ${item.name || snap.id} in stock, and this needs ${-delta}. Record the stock received first (Inventory → Adjust stock); an owner can allow selling below zero on Inventory.`);
      }
      if (quantityAtHand < 0) warnings.push(`Stock of ${item.name || snap.id} is now ${quantityAtHand} (below zero).`);
      writes.push({ id: snap.id, quantityAtHand });
      // W-02: each entry's change, in order, from the quantity before
      let before = current;
      for (const p of pending.filter(x => x.itemId === snap.id)) {
        const after = round6(before + p.quantity);
        const invoiceId = typeof p.entry.metadata?.invoiceId === 'string' ? p.entry.metadata.invoiceId : undefined;
        const creditNoteId = typeof p.entry.metadata?.creditNoteId === 'string' ? p.entry.metadata.creditNoteId : undefined;
        const deliveryId = typeof p.entry.metadata?.deliveryId === 'string' ? p.entry.metadata.deliveryId : undefined;
        const document = creditNoteId ? { documentType: 'credit-note' as const, documentId: creditNoteId }
          : invoiceId ? { documentType: 'invoice' as const, documentId: invoiceId }
            : deliveryId ? { documentType: 'delivery' as const, documentId: deliveryId } : {};
        moves.push({
          workspaceId, itemId: snap.id, itemName: String(item.name || ''), date: String(p.entry.date || '').slice(0, 10), kind: p.kind,
          quantity: p.quantity, quantityBefore: before, quantityAfter: after,
          unitCostCents: Math.round(Math.abs(p.valueCents) / Math.abs(p.quantity)), valueCents: p.valueCents,
          transactionId: p.entry.id, ...document,
          // W-01: where the units left from or came back to (a reversal is where its original was)
          ...(typeof p.location === 'string' && p.location ? { locationId: p.location } : {}),
          uid: String(p.entry.uid || ''),
        });
        before = after;
      }
    }
  }

  return {
    warnings,
    apply: () => {
      for (const w of writes) {
        t.update(db.collection('inventory').doc(w.id), { quantityAtHand: w.quantityAtHand, updatedAt: FieldValue.serverTimestamp() });
      }
      writeStockMoves(db, t, moves);
    },
  };
}
