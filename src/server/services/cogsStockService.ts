import { FieldValue } from '../db/firestore';
import type { DocumentData, Firestore, Transaction as DbTransaction } from '../db/firestore';
import { INVOICE_COGS_TYPE } from '../../services/invoiceCogs';
import { isPostable } from '../../lib/txFilters';
import type { Transaction } from '../../types';

/**
 * Stock follows the ledger: a cost-of-goods-sold entry for an invoice line (metadata.type
 * 'invoice-cogs-auto') lowers the item's quantity on hand, and reversing that entry raises it
 * back. The stock change is written in the same database transaction as the ledger entries,
 * so the two can't drift apart. A ledger entry can be reversed only once. Selling more than is on
 * hand is recorded with a warning, unless an owner turned on "Refuse sales beyond stock"
 * (`refuseNegativeStock` on the workspace, W-06: stockPolicyService.ts); then it is refused and
 * nothing is written. Putting stock back (a reversal) is never refused.
 */

export class LedgerPostingError extends Error {
  constructor(readonly status: number, message: string) {
    super(message);
    this.name = 'LedgerPostingError';
  }
}

interface LedgerEntry {
  id: string;
  metadata?: Record<string, unknown>;
}

const round6 = (n: number) => Math.round(n * 1e6) / 1e6;

function cogsMove(tx: { metadata?: Record<string, unknown> }): { itemId: string; quantity: number } | null {
  const meta = tx.metadata;
  if (meta?.type !== INVOICE_COGS_TYPE) return null;
  const itemId = meta.inventoryItemId;
  const quantity = Number(meta.quantity);
  if (typeof itemId !== 'string' || !itemId || !Number.isFinite(quantity) || quantity <= 0) {
    throw new LedgerPostingError(400, 'A cost of goods sold entry needs inventoryItemId and a positive quantity.');
  }
  return { itemId, quantity };
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
export async function prepareStockMoves(
  db: Firestore,
  t: DbTransaction,
  workspaceId: string,
  entries: LedgerEntry[]
): Promise<PreparedStockMoves> {
  const deltas = new Map<string, number>();
  const add = (itemId: string, delta: number) => deltas.set(itemId, round6((deltas.get(itemId) || 0) + delta));

  for (const tx of entries) {
    const move = cogsMove(tx);
    if (move) add(move.itemId, -move.quantity);
  }

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
    for (const target of targets.filter(id => inRequest.has(id))) {
      const move = cogsMove(inRequest.get(target)!);
      if (move) add(move.itemId, move.quantity);
    }
    const stored = targets.filter(id => !inRequest.has(id));
    const originals = stored.length ? await t.getAll(...stored.map(id => db.collection('transactions').doc(id))) : [];
    for (const snap of originals) {
      const data = snap.data();
      if (!snap.exists || !data) throw new LedgerPostingError(400, `Transaction ${snap.id} to reverse does not exist.`);
      if (data.workspaceId !== workspaceId) throw new LedgerPostingError(403, 'Forbidden: the transaction to reverse belongs to another workspace.');
      if (data.reversalEventId) throw new LedgerPostingError(409, `Transaction ${snap.id} was already reversed.`);
      const move = cogsMove(data);
      if (move) add(move.itemId, move.quantity);
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
  // W-06: selling below zero is allowed with a warning, unless an owner chose to refuse it
  const refuseBelowZero = itemIds.some(id => (deltas.get(id) || 0) < 0)
    && (await t.get(db.collection('workspaces').doc(workspaceId))).data()?.refuseNegativeStock === true;
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
    }
  }

  return {
    warnings,
    apply: () => {
      for (const w of writes) {
        t.update(db.collection('inventory').doc(w.id), { quantityAtHand: w.quantityAtHand, updatedAt: FieldValue.serverTimestamp() });
      }
    },
  };
}
