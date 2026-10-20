import { ledgerWrite } from './ledgerDoor';
import { FieldValue } from '../db/firestore';
import type { Firestore } from '../db/firestore';
import { assertPeriodOpen, validateWorkspaceAccounts } from '../db/firestore';
import { TransactionValidator } from '../../kernel/validation/TransactionValidator';
import type { ValidationContext } from '../../kernel/validation/TransactionValidator';
import { stockMovesReady, writeStockMoves } from './stockMoveService';
import { revaluationValueCents } from '../../lib/inventoryAccounts';

type WorkspaceData = ValidationContext['wsData'] & { currency?: string };

/**
 * ISS-130 (GitHub #130): changing the unit cost of stock on hand is a revaluation. The stock's value moves from
 * quantity × old cost to quantity × new cost, and that difference is posted to the Inventory account against an
 * offset account (a revaluation gain or loss, or cost of goods sold) in the same database transaction that changes
 * the cost, so the stock list and the books cannot drift apart. The open-period check, the workspace's own
 * accounts, the item's own workspace and a request id (a retry finds the entry already made and changes nothing)
 * are all checked here. A browser can no longer change the cost of stock on hand directly (migration
 * 20261020120000_inventory_cost_server_only.sql); with nothing on hand the cost is only a template and stays
 * editable. Earlier sales keep the cost they were posted at: nothing posted before is touched. To undo a
 * revaluation, revalue back to the earlier cost (the trail keeps both entries).
 */

export class StockRevaluationError extends Error {
  constructor(readonly status: number, message: string) {
    super(message);
    this.name = 'StockRevaluationError';
  }
}

export interface StockRevaluationInput {
  workspaceId: string;
  user: { uid: string; admin?: boolean };
  wsData: WorkspaceData;
  date: string;
  itemId: string;
  newUnitCostCents: number;
  inventoryAccountId: string;
  offsetAccountId: string;
  reason: string;
  /** chosen by the caller once per revaluation; a retry with the same id returns the first result */
  requestId: string;
}

export interface StockRevaluationResult {
  transactionId: string | null;
  itemId: string;
  name: string;
  quantity: number;
  oldUnitCostCents: number;
  newUnitCostCents: number;
  /** the change in the Inventory account (positive: the stock is worth more) */
  valueCents: number;
  /** true when this request had already been applied: nothing was changed again */
  replayed: boolean;
}

/** The entry id for a request: the same request always names the same entry. */
export const revaluationEntryId = (requestId: string) => `stock-revaluation-${requestId}`;

export async function revalueStock(db: Firestore, input: StockRevaluationInput): Promise<StockRevaluationResult> {
  const { workspaceId, date } = input;
  if (!/^[A-Za-z0-9_-]{8,80}$/.test(input.requestId)) throw new StockRevaluationError(400, 'A revaluation needs a request id (8–80 letters, digits, - or _)');
  if (!Number.isInteger(input.newUnitCostCents) || input.newUnitCostCents < 0) throw new StockRevaluationError(400, 'The new cost must be whole cents, zero or more');
  if (!input.reason.trim()) throw new StockRevaluationError(400, 'Say why the cost changes');
  if (input.inventoryAccountId === input.offsetAccountId) throw new StockRevaluationError(400, 'Choose an offset account other than the Inventory account');
  await assertPeriodOpen(db, workspaceId, date, input.user.uid);
  const accounts = await validateWorkspaceAccounts(db, workspaceId, [input.inventoryAccountId, input.offsetAccountId]);
  const inventoryAcc = accounts.get(input.inventoryAccountId);
  const offsetAcc = accounts.get(input.offsetAccountId);
  if (!inventoryAcc || !offsetAcc) throw new StockRevaluationError(400, 'Choose accounts from this workspace');
  const currency = String(input.wsData?.currency || 'USD');
  await stockMovesReady(db);
  const entryRef = db.collection('transactions').doc(revaluationEntryId(input.requestId));
  const itemRef = db.collection('inventory').doc(input.itemId);

  return db.runTransaction(async t => {
    // a retry: the entry exists already, so report it and change nothing
    const earlier = await t.get(entryRef);
    if (earlier.exists) {
      const tx = earlier.data() || {};
      if (tx.workspaceId !== workspaceId) throw new StockRevaluationError(409, 'This request id was used elsewhere; send a new one');
      const m = (tx.metadata || {}) as Record<string, unknown>;
      return {
        transactionId: entryRef.id, itemId: String(m.itemId || input.itemId), name: String(m.itemName || ''), quantity: Number(m.quantity) || 0,
        oldUnitCostCents: Number(m.oldUnitCostCents) || 0, newUnitCostCents: Number(m.newUnitCostCents) || 0, valueCents: Number(m.valueCents) || 0, replayed: true,
      };
    }
    const snap = await t.get(itemRef);
    const item = snap.exists ? snap.data() || {} : null;
    // another workspace's item answers like a missing one
    if (!item || item.workspaceId !== workspaceId) throw new StockRevaluationError(404, `Item ${input.itemId} not found`);
    const name = String(item.name || input.itemId);
    const quantity = Number(item.quantityAtHand) || 0;
    if (quantity <= 0) throw new StockRevaluationError(400, `${name} has no stock on hand: change its cost on the item itself, nothing is revalued`);
    const oldUnitCostCents = Math.round(Number(item.unitCostCents) || 0);
    if (oldUnitCostCents === input.newUnitCostCents) throw new StockRevaluationError(400, `${name} already costs that`);
    const valueCents = revaluationValueCents(quantity, oldUnitCostCents, input.newUnitCostCents);

    let transactionId: string | null = null;
    if (valueCents !== 0) {
      const lines = [
        { id: 'line-1', accountId: inventoryAcc.id, accountName: inventoryAcc.name, amountCents: valueCents, description: `${name}: ${quantity} at ${oldUnitCostCents} → ${input.newUnitCostCents} cents` },
        { id: 'line-2', accountId: offsetAcc.id, accountName: offsetAcc.name, amountCents: -valueCents, description: `Stock revaluation: ${input.reason.trim()}` },
      ];
      const tx = await TransactionValidator.validateAndPrepare({
        id: entryRef.id,
        workspaceId,
        uid: input.user.uid,
        date,
        description: `Stock revaluation: ${name}`,
        totalAmountCents: Math.abs(valueCents),
        currency,
        type: 'journal',
        status: 'approved',
        createdAt: new Date().toISOString(),
        metadata: {
          type: 'stock-revaluation', reason: input.reason.trim(), requestId: input.requestId,
          itemId: input.itemId, itemName: name, quantity, oldUnitCostCents, newUnitCostCents: input.newUnitCostCents, valueCents,
        },
        lines,
      }, { workspaceId, user: input.user, wsData: input.wsData }, undefined, t);
      transactionId = tx.id;
      await ledgerWrite(t, entryRef, { ...tx, createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() });
    }
    t.update(itemRef, { unitCostCents: input.newUnitCostCents, updatedAt: FieldValue.serverTimestamp() });
    // W-02: the history keeps the change of value (no units move), so a past valuation includes it on its date
    writeStockMoves(db, t, [{
      workspaceId, itemId: input.itemId, itemName: name, date, kind: 'revaluation',
      quantity: 0, quantityBefore: quantity, quantityAfter: quantity,
      unitCostCents: input.newUnitCostCents, valueCents, transactionId, documentType: 'adjustment' as const, uid: input.user.uid,
    }]);
    return { transactionId, itemId: input.itemId, name, quantity, oldUnitCostCents, newUnitCostCents: input.newUnitCostCents, valueCents, replayed: false };
  });
}
