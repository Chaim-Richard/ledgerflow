/**
 * EG-1 step 1 (docs/design/EG-1-repost-engine.md): the repost run for `stock-cost`. For each item marked in
 * `repostQueue` (the lf_repost_mark trigger on stockMoves), ONE database transaction reads the item's history,
 * replays it in date order (ties: the order written) with the same moving-average formula as the posting
 * (movingAverageCents), and works out what each live sale (invoice or delivery cost of goods) and each customer
 * return (credit-return-auto, which comes back at its sale's cost) should have been valued at. An entry whose value
 * differs from what is in the books for it (the entry plus every live earlier correction of it) gets ONE adjustment
 * entry for the remaining difference, on the entry's own accounts and labels (each line scaled by the difference,
 * with its dimensions), `metadata.type: 'repost-cogs-adjust'`, no quantity, so no units move. A zero-quantity
 * `cost-repost` stock move keeps the stock ledger equal to the Inventory account; the item's cost becomes the
 * replayed average; the queue row is set clean and the audit row written, all in that same transaction.
 *
 * - Ids are deterministic (`repost-stock-cost-{item}-{entry}-{n}`, n = earlier corrections of that entry).
 * - Dating (as `reversalDate`): the corrected entry's day when it is open (or inside a lock exception), else today.
 *   With `strictLock` the key is refused instead (`blocked`, `blockedBy` = the lock date) and nothing is posted.
 * - An item whose kept history does not start from nothing (stock from before the history was kept, so no known
 *   opening average) is not repaired: refused as "history incomplete", nothing posted.
 * - Sales below zero (no meaningful average) are not corrected; they are listed for a stock count. So are returns
 *   whose sale is not in the replay, and other returns (after a delivery).
 * - One audit row per key (before, after and every correction) and one summary row per run.
 * - `dryRun` computes the same answer in a transaction that writes nothing.
 * Open-question defaults of the design are used: run on request only; the entry's day; leave below-zero sales;
 * move to today unless strictLock; adjustment entries; owners and accountants.
 */
import type { Firestore, Transaction as DbTransaction } from '../db/firestore';
import { FieldValue } from '../db/firestore';
import { TransactionValidator } from '../../kernel/validation/TransactionValidator';
import { postingLock } from '../../lib/periodLock';
import { isPostable } from '../../lib/txFilters';
import { formatTzDate } from '../../lib/utils';
import { INVOICE_COGS_TYPE } from '../../services/invoiceCogs';
import { DELIVERY_COGS_TYPE } from '../../lib/deliveries';
import { SALES_RETURN_TYPE } from '../../lib/salesReturns';
import type { StockMove } from '../../lib/stockMoves';
import type { Transaction } from '../../types';
import { movingAverageCents } from './cogsStockService';
import { ledgerWrite } from './ledgerDoor';
import { stockMovesReady, writeStockMoves } from './stockMoveService';
import { writeServerAuditLog } from './auditLogService';
import { REPOST_QUEUE, STOCK_COST_KIND, repostQueueReady, type RepostQueueRow } from './repostMarker';

export const REPOST_COGS_TYPE = 'repost-cogs-adjust';
export const HISTORY_INCOMPLETE = 'history-incomplete';
const PURCHASE_KINDS = ['purchase', 'purchase-reversal', 'purchase-return', 'purchase-return-reversal'];
const round6 = (n: number) => Math.round(n * 1e6) / 1e6;

export class RepostError extends Error {
  constructor(readonly status: number, message: string) {
    super(message);
    this.name = 'RepostError';
  }
}

export const repostEntryId = (kind: string, key: string, correctsTxId: string, n: number) => `repost-${kind}-${key}-${correctsTxId}-${n}`;

export interface RepostCorrection {
  entryId: string;
  correctsTxId: string;
  /** what the corrected entry is: a sale's cost, or a customer return's */
  of: 'sale' | 'return';
  entryDate: string;
  date: string;
  movedToOpenDay: boolean;
  /** the cost of goods account (debit side of a sale's entry) */
  account: string;
  beforeCents: number;
  afterCents: number;
  deltaCents: number;
  /** the correction's lines: the corrected entry's lines (accounts and labels), each scaled by the difference */
  lines: Array<{ accountId: string; accountName?: string; amountCents: number; dimensions?: Record<string, string> }>;
}

export interface RepostState { unitCostCents: number; quantityAtHand: number; inventoryValueCents: number }

export interface RepostKeyResult {
  kind: string;
  key: string;
  name: string;
  fromDate: string;
  status: 'clean' | 'blocked' | 'refused';
  reason?: string;
  lockDate: string | null;
  blockedBy: string | null;
  movedToOpenDay: boolean;
  corrections: RepostCorrection[];
  /** entries not corrected and why (a sale below zero, a return whose sale is not known): for a stock count */
  notCorrected: Array<{ transactionId: string; date: string; reason: string }>;
  state: { before: RepostState; after: RepostState };
  posted: number;
}

export interface RepostRunInput {
  workspaceId: string;
  user: { uid: string; email?: string; admin?: boolean };
  runId: string;
  dryRun?: boolean;
  strictLock?: boolean;
  keys?: string[];
  kinds?: string[];
}

export interface RepostRunResult {
  runId: string;
  dryRun: boolean;
  keys: RepostKeyResult[];
  posted: number;
  blocked: number;
  refused: number;
}

type Entry = Transaction & { id: string };
type Move = StockMove & { id: string };
const text = (v: unknown) => (typeof v === 'string' && v ? v : '');

/** The replay of one item's history: the average, and what each sale and customer return should have been valued at. */
function replay(moves: Move[], entries: Map<string, Entry>, fromDate: string) {
  const byDate = [...moves].sort((a, b) => String(a.date).localeCompare(String(b.date)) || String(a.seq).localeCompare(String(b.seq)));
  let qty = 0;
  let cost = 0;
  const saleUnit = new Map<string, number>();
  const valued: Array<{ entry: Entry; of: 'sale' | 'return'; date: string; cents: number }> = [];
  const notCorrected: RepostKeyResult['notCorrected'] = [];
  for (const m of byDate) {
    const q = Number(m.quantity) || 0;
    if (m.kind === 'cost-repost') continue;
    if (m.kind === 'revaluation') { cost = Math.round(Number(m.unitCostCents) || 0); continue; }
    const after = round6(qty + q);
    if (PURCHASE_KINDS.includes(m.kind) && after > 0) cost = movingAverageCents(qty, cost, Number(m.valueCents) || 0, after);
    const entry = m.transactionId ? entries.get(m.transactionId) : undefined;
    const day = String(m.date).slice(0, 10);
    const meta = (entry?.metadata || {}) as Record<string, unknown>;
    if (entry && m.kind === 'sale') {
      saleUnit.set(`${text(meta.invoiceId)}|${text(meta.cogsForLineId)}`, cost);
      if (day >= fromDate) {
        if (after < 0) notCorrected.push({ transactionId: entry.id, date: day, reason: 'sold below zero: count the stock' });
        else valued.push({ entry, of: 'sale', date: day, cents: Math.round(-q * cost) });
      }
    } else if (entry && m.kind === 'return' && day >= fromDate) {
      const unit = meta.type === SALES_RETURN_TYPE ? saleUnit.get(`${text(meta.invoiceId)}|${text(meta.returnForLineId)}`) : undefined;
      if (unit === undefined) notCorrected.push({ transactionId: entry.id, date: day, reason: 'a return whose sale is not in the replay' });
      else valued.push({ entry, of: 'return', date: day, cents: Math.round(q * unit) });
    }
    qty = after;
  }
  return { valued, notCorrected, cost, qty };
}

/** Reads, replays and (unless a dry run or refused) writes one key, in the transaction `t`. */
async function repostStockCost(db: Firestore, t: DbTransaction, input: RepostRunInput, row: RepostQueueRow, queueId: string): Promise<RepostKeyResult> {
  const { workspaceId, user } = input;
  const itemId = row.key;
  const ws = (await t.get(db.collection('workspaces').doc(workspaceId))).data() || {};
  const itemSnap = await t.get(db.collection('inventory').doc(itemId));
  const item = itemSnap.exists ? itemSnap.data() || {} : null;
  const lockDate = typeof ws.lockDate === 'string' && ws.lockDate ? ws.lockDate : null;
  const quantity = Number(item?.quantityAtHand) || 0;
  const oldCost = Math.round(Number(item?.unitCostCents) || 0);
  const now: RepostState = { unitCostCents: oldCost, quantityAtHand: quantity, inventoryValueCents: Math.round(quantity * oldCost) };
  const result: RepostKeyResult = {
    kind: STOCK_COST_KIND, key: itemId, name: String(item?.name || itemId), fromDate: row.fromDate, status: 'clean', lockDate, blockedBy: null,
    movedToOpenDay: false, corrections: [], notCorrected: [], state: { before: now, after: now }, posted: 0,
  };
  const queueRef = db.collection(REPOST_QUEUE).doc(queueId);
  const stamp = () => ({ runId: input.runId, lastRunAt: new Date().toISOString() });
  if (!item || item.workspaceId !== workspaceId) {
    if (!input.dryRun) t.set(queueRef, { status: 'clean', blockedBy: null, ...stamp() }, { merge: true });
    return result;
  }

  const moves = (await t.get(db.collection('stockMoves').where('workspaceId', '==', workspaceId).where('itemId', '==', itemId))).docs
    .map(d => ({ ...d.data(), id: d.id }) as Move);
  // no opening basis: the first move kept starts from stock whose average is not in the history (finding 6)
  const first = [...moves].sort((a, b) => String(a.seq).localeCompare(String(b.seq)))[0];
  if (first && round6(Number(first.quantityBefore) || 0) !== 0) {
    result.status = 'refused';
    result.reason = `${result.name}: its stock history starts at ${first.quantityBefore} units already on hand, with no opening average, so the cost cannot be replayed (history incomplete). Count and revalue the stock instead.`;
    if (!input.dryRun) t.set(queueRef, { status: 'blocked', blockedBy: HISTORY_INCOMPLETE, ...stamp() }, { merge: true });
    return result;
  }
  const ids = [...new Set(moves.filter(m => (m.kind === 'sale' || m.kind === 'return') && m.transactionId).map(m => String(m.transactionId)))];
  const snaps = ids.length ? await t.getAll(...ids.map(id => db.collection('transactions').doc(id))) : [];
  const reversed = new Set<string>();
  for (let i = 0; i < ids.length; i += 100) {
    const snap = await t.get(db.collection('transactions').where('workspaceId', '==', workspaceId).where('metadata.reversesTxId', 'in', ids.slice(i, i + 100)));
    snap.docs.filter(d => isPostable(d.data() as Transaction)).forEach(d => reversed.add(String(d.data().metadata?.reversesTxId)));
  }
  const entries = new Map<string, Entry>();
  for (const s of snaps) {
    const e = s.exists ? ({ ...s.data(), id: s.id } as Entry) : null;
    const type = e?.metadata?.type;
    if (!e || e.workspaceId !== workspaceId || ![INVOICE_COGS_TYPE, DELIVERY_COGS_TYPE, SALES_RETURN_TYPE].includes(String(type))) continue;
    if (!isPostable(e) || e.reversalEventId || reversed.has(e.id)) continue;
    entries.set(e.id, e);
  }
  // the live corrections already posted for this item, per corrected entry (finding 3: post only what remains)
  const earlier = (await t.get(db.collection('transactions').where('workspaceId', '==', workspaceId).where('metadata.repostKey', '==', itemId))).docs
    .map(d => ({ ...d.data(), id: d.id }) as Entry).filter(e => e.metadata?.repostKind === STOCK_COST_KIND);
  const earlierReversed = new Set<string>();
  if (earlier.length) {
    const snap = await t.get(db.collection('transactions').where('workspaceId', '==', workspaceId).where('metadata.reversesTxId', 'in', earlier.slice(0, 100).map(e => e.id)));
    snap.docs.filter(d => isPostable(d.data() as Transaction)).forEach(d => earlierReversed.add(String(d.data().metadata?.reversesTxId)));
  }
  const correctedBy = new Map<string, { cents: number; count: number }>();
  for (const e of earlier) {
    const target = String(e.metadata?.correctsTxId || '');
    const was = correctedBy.get(target) || { cents: 0, count: 0 };
    const live = isPostable(e) && !e.reversalEventId && !earlierReversed.has(e.id);
    correctedBy.set(target, { cents: was.cents + (live ? Number(e.metadata?.deltaCents) || 0 : 0), count: was.count + 1 });
  }

  const replayed = replay(moves, entries, row.fromDate);
  result.notCorrected = replayed.notCorrected;
  result.state.after = { unitCostCents: replayed.cost, quantityAtHand: quantity, inventoryValueCents: Math.round(quantity * replayed.cost) };
  const today = formatTzDate(new Date(), text(ws.timezone) || 'UTC');
  for (const v of replayed.valued) {
    const prior = correctedBy.get(v.entry.id) || { cents: 0, count: 0 };
    const beforeCents = Math.abs(Number(v.entry.totalAmountCents) || 0) + prior.cents;
    const deltaCents = v.cents - beforeCents;
    if (deltaCents === 0) continue;
    const original = v.entry.lines || [];
    if (original.length !== 2 || !original.some(l => Number(l.amountCents) > 0) || !original.some(l => Number(l.amountCents) < 0)) {
      result.notCorrected.push({ transactionId: v.entry.id, date: v.date, reason: 'its entry is not one debit and one credit line' });
      continue;
    }
    // finding 8: the correction keeps the entry's accounts and labels
    const lines = original.map(l => ({
      accountId: l.accountId, ...(l.accountName ? { accountName: l.accountName } : {}),
      amountCents: Math.sign(Number(l.amountCents)) * deltaCents,
      ...(l.dimensions && Object.keys(l.dimensions).length ? { dimensions: { ...l.dimensions } } : {}),
    }));
    const lock = postingLock(v.date, ws as never, user.uid);
    result.corrections.push({
      entryId: repostEntryId(STOCK_COST_KIND, itemId, v.entry.id, prior.count), correctsTxId: v.entry.id, of: v.of, entryDate: v.date,
      date: lock ? today : v.date, movedToOpenDay: Boolean(lock),
      account: String(original.find(l => (v.of === 'sale' ? Number(l.amountCents) > 0 : Number(l.amountCents) < 0))?.accountId || ''),
      beforeCents, afterCents: v.cents, deltaCents, lines,
    });
  }
  result.movedToOpenDay = result.corrections.some(c => c.movedToOpenDay);
  if (input.strictLock && result.movedToOpenDay) {
    result.status = 'blocked';
    result.blockedBy = lockDate || today;
    if (!input.dryRun) t.set(queueRef, { status: 'blocked', blockedBy: result.blockedBy, ...stamp() }, { merge: true });
    return result;
  }
  if (input.dryRun) return result;

  // a retried chunk finds its entries already there
  const refs = result.corrections.map(c => db.collection('transactions').doc(c.entryId));
  const taken = new Set((refs.length ? await t.getAll(...refs) : []).filter(s => s.exists).map(s => s.id));
  const currency = String(ws.currency || 'USD');
  const prepared: Array<{ c: RepostCorrection; tx: Transaction; meta: Record<string, unknown> }> = [];
  for (const c of result.corrections.filter(x => !taken.has(x.entryId))) {
    const meta = (entries.get(c.correctsTxId)?.metadata || {}) as Record<string, unknown>;
    const keep = Object.fromEntries(['invoiceId', 'deliveryId', 'creditNoteId', 'customerId', 'locationId'].filter(k => text(meta[k])).map(k => [k, meta[k]]));
    const tx = await TransactionValidator.validateAndPrepare({
      id: c.entryId, workspaceId, uid: user.uid, date: c.date, currency, type: 'journal', status: 'completed',
      description: `Cost of goods corrected after a backdated change: ${result.name} (${c.beforeCents} → ${c.afterCents} cents)`,
      totalAmountCents: Math.abs(c.deltaCents), createdAt: new Date().toISOString(),
      metadata: {
        type: REPOST_COGS_TYPE, repostRunId: input.runId, repostKind: STOCK_COST_KIND, repostKey: itemId, correctsTxId: c.correctsTxId, correctsKind: c.of,
        beforeCents: c.beforeCents, afterCents: c.afterCents, deltaCents: c.deltaCents, entryDate: c.entryDate, movedToOpenDay: c.movedToOpenDay,
        itemId, itemName: result.name, ...keep,
      },
      lines: c.lines.map((l, i) => ({ id: `line-${i + 1}`, ...l, description: `${result.name}: cost of goods corrected` })),
    }, { workspaceId, user: { uid: user.uid, admin: user.admin }, wsData: ws as never }, undefined, t);
    prepared.push({ c, tx, meta });
  }
  // writes
  const writtenMoves = [];
  for (const { c, tx, meta } of prepared) {
    await ledgerWrite(t, db.collection('transactions').doc(c.entryId), { ...tx, createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() } as never);
    const doc = text(meta.creditNoteId) ? { documentType: 'credit-note' as const, documentId: text(meta.creditNoteId) }
      : text(meta.invoiceId) ? { documentType: 'invoice' as const, documentId: text(meta.invoiceId) }
        : text(meta.deliveryId) ? { documentType: 'delivery' as const, documentId: text(meta.deliveryId) } : {};
    writtenMoves.push({
      workspaceId, itemId, itemName: result.name, date: c.date, kind: 'cost-repost' as const, quantity: 0, quantityBefore: quantity, quantityAfter: quantity,
      unitCostCents: replayed.cost, valueCents: c.of === 'sale' ? -c.deltaCents : c.deltaCents, transactionId: c.entryId, correctsTxId: c.correctsTxId, ...doc, uid: user.uid,
    });
  }
  writeStockMoves(db, t, writtenMoves);
  result.posted = prepared.length;
  if (replayed.cost !== oldCost) t.update(db.collection('inventory').doc(itemId), { unitCostCents: replayed.cost, updatedAt: FieldValue.serverTimestamp() });
  t.set(queueRef, { status: 'clean', blockedBy: null, ...stamp() }, { merge: true });
  await writeServerAuditLog({
    workspaceId, uid: user.uid, email: user.email, action: 'repost', entityType: STOCK_COST_KIND, entityId: itemId,
    details: {
      description: `Repost of ${result.name} from ${row.fromDate}: ${prepared.length} cost of goods correction(s), cost ${oldCost} → ${replayed.cost} cents`,
      runId: input.runId, fromDate: row.fromDate, cause: row.cause || [], lockDate, movedToOpenDay: result.movedToOpenDay,
      corrections: result.corrections.map(c => ({ entryId: c.entryId, correctsTxId: c.correctsTxId, of: c.of, date: c.date, account: c.account, beforeCents: c.beforeCents, afterCents: c.afterCents, deltaCents: c.deltaCents })),
      notCorrected: result.notCorrected, state: result.state,
    },
  }, { db, tx: t });
  return result;
}

/** The rows of a workspace's queue (all members may read it: the banner). */
export async function repostQueueOf(db: Firestore, workspaceId: string): Promise<Array<RepostQueueRow & { id: string }>> {
  if (!(await repostQueueReady(db))) return [];
  return (await db.collection(REPOST_QUEUE).where('workspaceId', '==', workspaceId).get()).docs.map(d => ({ ...(d.data() as RepostQueueRow), id: d.id }));
}

/** POST /api/v1/repost: every open row (or the chosen keys), one database transaction per key. */
export async function runRepost(db: Firestore, input: RepostRunInput): Promise<RepostRunResult> {
  if (!/^[A-Za-z0-9_-]{8,80}$/.test(input.runId)) throw new RepostError(400, 'A repost run needs a run id (8–80 letters, digits, - or _)');
  if (input.kinds && input.kinds.some(k => k !== STOCK_COST_KIND)) throw new RepostError(400, `Only ${STOCK_COST_KIND} can be reposted so far`);
  if (!(await repostQueueReady(db))) throw new RepostError(503, 'The repost queue is not set up on this database yet (migration 20261023010000_repost_queue.sql)');
  await stockMovesReady(db);
  const rows = (await repostQueueOf(db, input.workspaceId))
    .filter(r => r.kind === STOCK_COST_KIND && (!input.keys?.length || input.keys.includes(r.key)))
    .filter(r => r.status !== 'clean')
    .sort((a, b) => a.id.localeCompare(b.id));
  const keys: RepostKeyResult[] = [];
  for (const r of rows) {
    const one = await db.runTransaction(async t => {
      // per attempt: everything is read again (SERIALIZABLE retries)
      const snap = await t.get(db.collection(REPOST_QUEUE).doc(r.id));
      const row = snap.exists ? (snap.data() as RepostQueueRow) : null;
      if (!row || row.workspaceId !== input.workspaceId || row.status === 'clean') return null;
      return repostStockCost(db, t, input, row, r.id);
    });
    if (one) keys.push(one);
  }
  const posted = keys.reduce((s, k) => s + k.posted, 0);
  const blocked = keys.filter(k => k.status === 'blocked').length;
  const refused = keys.filter(k => k.status === 'refused').length;
  if (!input.dryRun && keys.length > 0) {
    const moved: Record<string, number> = {};
    for (const c of keys.filter(k => k.status === 'clean').flatMap(k => k.corrections)) {
      for (const l of c.lines) moved[l.accountId] = (moved[l.accountId] || 0) + l.amountCents;
    }
    await writeServerAuditLog({
      workspaceId: input.workspaceId, uid: input.user.uid, email: input.user.email, action: 'repost', entityType: 'repostRun', entityId: input.runId,
      details: { description: `Repost run: ${keys.length} key(s), ${posted} entr${posted === 1 ? 'y' : 'ies'} posted, ${blocked} refused for a locked period, ${refused} not repairable`, keys: keys.map(k => `${k.kind}/${k.key}`), posted, blocked, refused, movedByAccount: moved },
    }, { db });
  }
  return { runId: input.runId, dryRun: Boolean(input.dryRun), keys, posted, blocked, refused };
}
