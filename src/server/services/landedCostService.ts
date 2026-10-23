/**
 * EG-6 (BF-04): posting landed cost. Freight, duty or another charge (a line of a posted bill, or a manual amount
 * against an offset account) is spread over the items received on one or more bills, by value, quantity or weight
 * (the A-63 spread, src/lib/landedCostPreview.ts), and posted in ONE database transaction:
 *   - Inventory +X for each received line, with the line's labels (dimensions);
 *   - the charge account −X (the bill line's account and labels, or the manual offset account);
 *   - a value-only `landed-cost` stock move per line (quantity 0) that raises the item's average cost.
 *
 * Units already sold (decided here, not left to the repost queue): the share of a line that belongs to units of the
 * item no longer on hand goes to cost of goods sold, with the line's labels, and only the share of the units still
 * on hand goes to Inventory and the average. Why: the posting is dated on or after the item's last stock move (a
 * landed cost dated before a later move is refused), so the lf_repost_mark trigger never marks it, and a repost
 * replay only revalues sales dated after a backdated change; the sold units would never be corrected. Putting their
 * share to COGS now keeps Inventory = units on hand × average, in the same entry, with nothing left pending.
 * Which units are "sold": for each item, the units received on the chosen lines less the units on hand now (never
 * below zero, never more than received); e.g. 10 received, 6 on hand → 4/10 of the line's share is COGS.
 *
 * - Idempotent: the entry id is fixed by the allocation (`landed-cost-bill-{bill}-{line}-{n}` for a bill's charge
 *   line, `landed-cost-manual-{allocationId}-{n}` for a manual amount; n counts earlier undone postings). A retry
 *   finds the live entry and posts nothing (`replayed: true`). A charge line can be landed once (until undone).
 * - Dating (as `reversalDate`): the requested day (default today) when open, else today.
 * - Undo (`undoLandedCost`): reverses the entry and its stock moves together, refused once any of the items has moved
 *   since. The generic edit, void, delete and reverse paths refuse both entries (revaluationEntryLock).
 * - Home currency only: the charge (a bill in another currency is refused) and the stock values are in it.
 */
import type { Firestore, Transaction as DbTransaction } from '../db/firestore';
import { FieldValue } from '../db/firestore';
import { TransactionValidator } from '../../kernel/validation/TransactionValidator';
import { postingLock } from '../../lib/periodLock';
import { isPostable } from '../../lib/txFilters';
import { resolveAccountRole } from '../../lib/accountUtils';
import { formatTzDate } from '../../lib/utils';
import { spreadCents, type SpreadBasis } from '../../lib/landedCostPreview';
import type { ChartAccount } from '../../types';
import { movingAverageCents } from './cogsStockService';
import { ledgerWrite } from './ledgerDoor';
import { stockMovesReady, writeStockMoves } from './stockMoveService';
import { writeServerAuditLog } from './auditLogService';

export const LANDED_COST_TYPE = 'landed-cost';
export const LANDED_COST_UNDO_TYPE = 'landed-cost-undo';
const DEAD_BILL = ['draft', 'void', 'cancelled', 'rejected'];
const round6 = (n: number) => Math.round(n * 1e6) / 1e6;
const text = (v: unknown) => (typeof v === 'string' && v ? v : '');
const safe = (s: string) => s.replace(/[^A-Za-z0-9_-]/g, '_').slice(0, 120);

export class LandedCostError extends Error {
  constructor(readonly status: number, message: string) {
    super(message);
    this.name = 'LandedCostError';
  }
}

export type LandedCharge =
  | { kind: 'bill'; billId: string; line: number }
  | { kind: 'manual'; amountCents: number; accountId: string; allocationId: string; description?: string };

export interface LandedCostInput {
  workspaceId: string;
  user: { uid: string; email?: string; admin?: boolean };
  charge: LandedCharge;
  receiptBillIds: string[];
  basis: SpreadBasis;
  /** for a spread by weight: each line's weight, by `{billId}:{line}` */
  weights?: Record<string, number>;
  date?: string;
  inventoryAccountId?: string;
  dryRun?: boolean;
}

export interface LandedCostLinePlan {
  key: string;
  billId: string;
  line: number;
  itemId: string;
  itemName: string;
  quantity: number;
  goodsCents: number;
  allocatedCents: number;
  inventoryCents: number;
  cogsCents: number;
  unitCostBeforeCents: number;
  unitCostAfterCents: number;
  dimensions?: Record<string, string>;
}

export interface LandedCostResult {
  entryId: string;
  date: string;
  movedToOpenDay: boolean;
  chargeCents: number;
  chargeAccountId: string;
  inventoryAccountId: string;
  cogsAccountId: string | null;
  lines: LandedCostLinePlan[];
  entryLines: Array<{ accountId: string; accountName?: string; amountCents: number; description: string; dimensions?: Record<string, string> }>;
  posted: boolean;
  replayed: boolean;
  dryRun: boolean;
}

type Doc = Record<string, unknown>;
type Split = { amountCents?: number; accountId?: string; description?: string; itemId?: string; quantity?: number; landedCost?: boolean; dimensions?: Record<string, string> };

export const landedCostBaseId = (charge: LandedCharge) =>
  charge.kind === 'bill' ? `landed-cost-bill-${safe(charge.billId)}-${charge.line}` : `landed-cost-manual-${safe(charge.allocationId)}`;
export const landedCostUndoId = (entryId: string) => `${entryId}-undo`;

/** The allocation's entry id for this attempt: the live one (a retry), or the next free one. */
async function allocationEntryId(db: Firestore, t: DbTransaction, base: string): Promise<{ id: string; live: Doc | null }> {
  for (let n = 0; n < 50; n++) {
    const id = `${base}-${n}`;
    const [entry, undo] = await t.getAll(db.collection('transactions').doc(id), db.collection('transactions').doc(landedCostUndoId(id)));
    if (!entry.exists) return { id, live: null };
    if (!undo.exists) return { id, live: entry.data() || {} };
  }
  throw new LandedCostError(409, 'This charge has been landed and undone too many times; enter it as a manual amount');
}

async function accountsOf(db: Firestore, t: DbTransaction, workspaceId: string): Promise<ChartAccount[]> {
  return (await t.get(db.collection('chartAccounts').where('workspaceId', '==', workspaceId))).docs
    .map(d => ({ ...d.data(), id: d.id }) as ChartAccount).filter(a => !a.isArchived);
}
const byCode = (a: ChartAccount, b: ChartAccount) => String(a.code || '').localeCompare(String(b.code || '')) || a.id.localeCompare(b.id);

/** What the charge is: its amount, account and labels. */
async function readCharge(db: Firestore, t: DbTransaction, input: LandedCostInput, accounts: ChartAccount[], currency: string) {
  const c = input.charge;
  if (c.kind === 'manual') {
    if (!Number.isSafeInteger(c.amountCents) || c.amountCents <= 0) throw new LandedCostError(400, 'The amount to land is whole cents above zero');
    const acc = accounts.find(a => a.id === c.accountId);
    if (!acc) throw new LandedCostError(400, 'Choose the offset account from this workspace');
    return { cents: c.amountCents, account: acc, dimensions: undefined, label: text(c.description) || 'Landed cost' };
  }
  const snap = await t.get(db.collection('bills').doc(c.billId));
  const bill = snap.exists ? snap.data() || {} : null;
  if (!bill || bill.workspaceId !== input.workspaceId) throw new LandedCostError(404, `Bill ${c.billId} not found`);
  if (DEAD_BILL.includes(String(bill.status))) throw new LandedCostError(400, `Bill ${text(bill.number) || c.billId} is ${bill.status}: only a posted bill's charge can be landed`);
  if (String(bill.currency || currency).toUpperCase() !== currency.toUpperCase()) throw new LandedCostError(400, `Bill ${text(bill.number) || c.billId} is in ${bill.currency}: land a charge in ${currency} (enter it as a manual amount in ${currency})`);
  const split = ((bill.splits as Split[] | undefined) || [])[c.line];
  if (!split) throw new LandedCostError(400, `Bill ${text(bill.number) || c.billId} has no line ${c.line + 1}`);
  if (split.itemId || split.landedCost) throw new LandedCostError(400, `Line ${c.line + 1} of bill ${text(bill.number) || c.billId} is ${split.itemId ? 'an item line' : 'already spread over that bill\'s items'}: choose a freight, duty or other charge line`);
  const cents = Math.round(Number(split.amountCents) || 0);
  if (cents <= 0) throw new LandedCostError(400, 'The charge line has no amount to land');
  const posted = (await t.get(db.collection('transactions').where('workspaceId', '==', input.workspaceId).where('metadata.billId', '==', c.billId))).docs
    .some(d => isPostable(d.data() as never) && !d.data().metadata?.reversesTxId);
  if (!posted) throw new LandedCostError(400, `Bill ${text(bill.number) || c.billId} is not in the books yet: post it first`);
  const acc = accounts.find(a => a.id === split.accountId);
  if (!acc) throw new LandedCostError(400, 'The charge line\'s account is not in this workspace');
  return { cents, account: acc, dimensions: split.dimensions, label: `${text(split.description) || 'Charge'} (bill ${text(bill.number) || c.billId})` };
}

/** Works out (and unless a dry run, writes) one allocation in the transaction `t`. Every read is made again per attempt. */
async function landInTransaction(db: Firestore, t: DbTransaction, input: LandedCostInput): Promise<LandedCostResult> {
  const { workspaceId, user } = input;
  const ws = (await t.get(db.collection('workspaces').doc(workspaceId))).data() || {};
  const currency = String(ws.currency || 'USD');
  const today = formatTzDate(new Date(), text(ws.timezone) || 'UTC');
  const { id: entryId, live } = await allocationEntryId(db, t, landedCostBaseId(input.charge));
  if (live) {
    if (live.workspaceId !== workspaceId) throw new LandedCostError(409, 'This allocation id was used elsewhere; send a new one');
    const m = (live.metadata || {}) as Doc;
    return {
      entryId, date: String(live.date), movedToOpenDay: Boolean(m.movedToOpenDay), chargeCents: Number(m.chargeCents) || 0, chargeAccountId: text(m.chargeAccountId),
      inventoryAccountId: text(m.inventoryAccountId), cogsAccountId: text(m.cogsAccountId) || null, lines: (m.allocation as LandedCostLinePlan[]) || [],
      entryLines: ((live.lines as LandedCostResult['entryLines']) || []), posted: false, replayed: true, dryRun: Boolean(input.dryRun),
    };
  }
  const accounts = await accountsOf(db, t, workspaceId);
  const charge = await readCharge(db, t, input, accounts, currency);
  if (resolveAccountRole(charge.account) === 'inventory') throw new LandedCostError(400, 'The charge cannot come from an Inventory account');
  const inventoryAcc = input.inventoryAccountId ? accounts.find(a => a.id === input.inventoryAccountId) : accounts.filter(a => resolveAccountRole(a) === 'inventory').sort(byCode)[0];
  if (!inventoryAcc || resolveAccountRole(inventoryAcc) !== 'inventory') throw new LandedCostError(400, 'Add (or choose) an Inventory account in this workspace');

  // the received lines: each item line of the chosen bills, at what its stock moves brought in (net of reversals)
  const recv: Array<Omit<LandedCostLinePlan, 'allocatedCents' | 'inventoryCents' | 'cogsCents' | 'unitCostBeforeCents' | 'unitCostAfterCents' | 'itemName'> & { weight: number }> = [];
  for (const billId of [...new Set(input.receiptBillIds)]) {
    const snap = await t.get(db.collection('bills').doc(billId));
    const bill = snap.exists ? snap.data() || {} : null;
    if (!bill || bill.workspaceId !== workspaceId) throw new LandedCostError(404, `Bill ${billId} not found`);
    if (DEAD_BILL.includes(String(bill.status))) throw new LandedCostError(400, `Bill ${text(bill.number) || billId} is ${bill.status}: its goods are not in stock`);
    const moves = (await t.get(db.collection('stockMoves').where('workspaceId', '==', workspaceId).where('documentId', '==', billId))).docs.map(d => d.data());
    const splits = (bill.splits as Split[] | undefined) || [];
    splits.forEach((s, line) => {
      if (!s.itemId || s.landedCost || !(Number(s.quantity) > 0)) return;
      const mine = moves.filter(m => m.documentType === 'bill' && m.itemId === s.itemId && Number(m.documentLine) === line && ['purchase', 'purchase-reversal'].includes(String(m.kind)));
      const quantity = round6(mine.reduce((sum, m) => sum + (Number(m.quantity) || 0), 0));
      if (quantity <= 0) throw new LandedCostError(400, `Line ${line + 1} of bill ${text(bill.number) || billId} has not brought its goods into stock: post the bill first`);
      const key = `${billId}:${line}`;
      const weight = Number(input.weights?.[key]);
      if (input.basis === 'weight' && !(weight >= 0 && Number.isFinite(weight))) throw new LandedCostError(400, `Give the weight of line ${line + 1} of bill ${text(bill.number) || billId}`);
      recv.push({ key, billId, line, itemId: s.itemId, quantity, goodsCents: mine.reduce((sum, m) => sum + (Number(m.valueCents) || 0), 0), weight: weight || 0, ...(s.dimensions && Object.keys(s.dimensions).length ? { dimensions: { ...s.dimensions } } : {}) });
    });
  }
  if (!recv.length) throw new LandedCostError(400, 'Choose at least one bill whose items were received');
  const weights = recv.map(r => (input.basis === 'value' ? r.goodsCents : Math.round((input.basis === 'weight' ? r.weight : r.quantity) * 1e6)));
  if (!(weights.reduce((s, w) => s + w, 0) > 0)) throw new LandedCostError(400, `The goods have no ${input.basis} to spread by; choose another basis`);
  const allocated = spreadCents(charge.cents, weights);

  // the items, their stock now, and the day of their last move
  const itemIds = [...new Set(recv.map(r => r.itemId))];
  const items = new Map<string, Doc>();
  let lastMove = '';
  for (const itemId of itemIds) {
    const snap = await t.get(db.collection('inventory').doc(itemId));
    if (!snap.exists || snap.data()?.workspaceId !== workspaceId) throw new LandedCostError(404, `Item ${itemId} not found`);
    items.set(itemId, snap.data() || {});
    for (const d of (await t.get(db.collection('stockMoves').where('workspaceId', '==', workspaceId).where('itemId', '==', itemId))).docs) {
      const day = String(d.data().date || '').slice(0, 10);
      if (day > lastMove) lastMove = day;
    }
  }
  let date = (input.date || today).slice(0, 10);
  if (date > today) throw new LandedCostError(400, `A landed cost cannot be dated after today (${today}): it changes the cost of stock on hand now`);
  const lock = postingLock(date, ws as never, user.uid);
  if (lock) date = today;
  if (lastMove > date) throw new LandedCostError(400, `The stock of these items changed on ${lastMove}, after ${date}: date the landed cost on or after that day`);

  const lines: LandedCostLinePlan[] = [];
  for (const itemId of itemIds) {
    const item = items.get(itemId) || {};
    const onHand = Number(item.quantityAtHand) || 0;
    const received = round6(recv.filter(r => r.itemId === itemId).reduce((s, r) => s + r.quantity, 0));
    const before = Math.round(Number(item.unitCostCents) || 0);
    const mine = recv.map((r, i) => ({ r, cents: allocated[i] })).filter(x => x.r.itemId === itemId);
    const plans = mine.map(({ r, cents }): LandedCostLinePlan => {
      const inventoryCents = onHand <= 0 ? 0 : onHand >= received ? cents : Math.round(cents * onHand / received);
      return { key: r.key, billId: r.billId, line: r.line, itemId, quantity: r.quantity, goodsCents: r.goodsCents, ...(r.dimensions ? { dimensions: r.dimensions } : {}), itemName: String(item.name || itemId), allocatedCents: cents, inventoryCents, cogsCents: cents - inventoryCents, unitCostBeforeCents: before, unitCostAfterCents: before };
    });
    const into = plans.reduce((s, p) => s + p.inventoryCents, 0);
    const after = onHand > 0 ? movingAverageCents(onHand, before, into, onHand) : before;
    for (const p of plans) lines.push({ ...p, unitCostAfterCents: after });
  }
  lines.sort((a, b) => recv.findIndex(r => r.key === a.key) - recv.findIndex(r => r.key === b.key));
  const cogsAcc = lines.some(l => l.cogsCents !== 0) ? accounts.filter(a => resolveAccountRole(a) === 'cogs').sort(byCode)[0] : undefined;
  if (lines.some(l => l.cogsCents !== 0) && !cogsAcc) throw new LandedCostError(400, 'Some of these goods are sold already: add a Cost of Goods Sold account for their share');

  const entryLines: LandedCostResult['entryLines'] = [];
  for (const l of lines) {
    const dims = l.dimensions ? { dimensions: { ...l.dimensions } } : {};
    if (l.inventoryCents) entryLines.push({ accountId: inventoryAcc.id, accountName: inventoryAcc.name, amountCents: l.inventoryCents, description: `${l.itemName}: landed cost`, ...dims });
    if (l.cogsCents && cogsAcc) entryLines.push({ accountId: cogsAcc.id, accountName: cogsAcc.name, amountCents: l.cogsCents, description: `${l.itemName}: landed cost of units already sold`, ...dims });
  }
  entryLines.push({ accountId: charge.account.id, accountName: charge.account.name, amountCents: -charge.cents, description: charge.label, ...(charge.dimensions && Object.keys(charge.dimensions).length ? { dimensions: { ...charge.dimensions } } : {}) });
  const result: LandedCostResult = {
    entryId, date, movedToOpenDay: Boolean(lock), chargeCents: charge.cents, chargeAccountId: charge.account.id, inventoryAccountId: inventoryAcc.id,
    cogsAccountId: cogsAcc?.id || null, lines, entryLines, posted: false, replayed: false, dryRun: Boolean(input.dryRun),
  };
  if (input.dryRun) return result;

  const ref = db.collection('transactions').doc(entryId);
  const tx = await TransactionValidator.validateAndPrepare({
    id: entryId, workspaceId, uid: user.uid, date, currency, exchangeRate: 1, type: 'journal', status: 'completed',
    description: `Landed cost: ${charge.label}`, totalAmountCents: charge.cents, createdAt: new Date().toISOString(),
    metadata: {
      type: LANDED_COST_TYPE, charge: input.charge, ...(input.charge.kind === 'bill' ? { chargeBillId: input.charge.billId } : {}),
      receiptBillIds: [...new Set(input.receiptBillIds)], basis: input.basis, chargeCents: charge.cents, chargeAccountId: charge.account.id,
      inventoryAccountId: inventoryAcc.id, cogsAccountId: cogsAcc?.id || null, movedToOpenDay: Boolean(lock), requestedDate: input.date || null,
      itemIds, allocation: lines,
    },
    lines: entryLines.map((l, i) => ({ id: `line-${i + 1}`, ...l })),
  }, { workspaceId, user: { uid: user.uid, admin: user.admin }, wsData: ws as never }, undefined, t);
  // not metadata.billId: that names a bill's own posting (billPosting.ts), which this entry is not
  await ledgerWrite(t, ref, { ...tx, createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() } as never);
  writeStockMoves(db, t, lines.filter(l => l.inventoryCents !== 0).map(l => {
    const onHand = Number(items.get(l.itemId)?.quantityAtHand) || 0;
    return {
      workspaceId, itemId: l.itemId, itemName: l.itemName, date, kind: 'landed-cost' as const, quantity: 0, quantityBefore: onHand, quantityAfter: onHand,
      unitCostCents: l.unitCostAfterCents, valueCents: l.inventoryCents, transactionId: entryId, documentType: 'bill' as const, documentId: l.billId, documentLine: l.line,
      ...(l.dimensions ? { labels: { ...l.dimensions } } : {}), uid: user.uid,
    };
  }));
  for (const itemId of itemIds) {
    const after = lines.find(l => l.itemId === itemId)?.unitCostAfterCents;
    if (after !== undefined && after !== Math.round(Number(items.get(itemId)?.unitCostCents) || 0)) t.update(db.collection('inventory').doc(itemId), { unitCostCents: after, updatedAt: FieldValue.serverTimestamp() });
  }
  await writeServerAuditLog({
    workspaceId, uid: user.uid, email: user.email, action: 'landed-cost', entityType: 'transaction', entityId: entryId,
    details: { description: `Landed cost ${charge.cents} cents (${charge.label}) by ${input.basis} over ${lines.length} line(s)`, date, movedToOpenDay: Boolean(lock), lines: lines.map(l => ({ key: l.key, itemId: l.itemId, allocatedCents: l.allocatedCents, inventoryCents: l.inventoryCents, cogsCents: l.cogsCents, unitCostBeforeCents: l.unitCostBeforeCents, unitCostAfterCents: l.unitCostAfterCents })) },
  }, { db, tx: t });
  return { ...result, posted: true };
}

/** POST /api/v1/inventory/landed-cost: the allocation's plan (dryRun) or its posting, in one transaction. */
export async function postLandedCost(db: Firestore, input: LandedCostInput): Promise<LandedCostResult> {
  if (!['value', 'quantity', 'weight'].includes(input.basis)) throw new LandedCostError(400, 'Spread the costs by value, by quantity or by weight');
  if (input.charge.kind === 'manual' && !/^[A-Za-z0-9_-]{8,80}$/.test(input.charge.allocationId)) throw new LandedCostError(400, 'A manual landed cost needs an allocation id (8–80 letters, digits, - or _)');
  await stockMovesReady(db);
  return db.runTransaction(t => landInTransaction(db, t, input));
}

export interface LandedCostUndoResult { entryId: string; undoEntryId: string; date: string; movedToOpenDay: boolean; replayed: boolean }

/** POST /api/v1/inventory/landed-cost/:entryId/undo: reverses the entry and its stock moves together. */
export async function undoLandedCost(db: Firestore, input: { workspaceId: string; user: LandedCostInput['user']; entryId: string }): Promise<LandedCostUndoResult> {
  const { workspaceId, user, entryId } = input;
  await stockMovesReady(db);
  return db.runTransaction(async t => {
    const ref = db.collection('transactions').doc(entryId);
    const undoRef = db.collection('transactions').doc(landedCostUndoId(entryId));
    const [snap, undoSnap] = await t.getAll(ref, undoRef);
    const entry = snap.exists ? snap.data() || {} : null;
    if (!entry || entry.workspaceId !== workspaceId || entry.metadata?.type !== LANDED_COST_TYPE) throw new LandedCostError(404, 'Landed cost entry not found');
    const ws = (await t.get(db.collection('workspaces').doc(workspaceId))).data() || {};
    const today = formatTzDate(new Date(), text(ws.timezone) || 'UTC');
    if (undoSnap.exists) return { entryId, undoEntryId: undoRef.id, date: String(undoSnap.data()?.date), movedToOpenDay: Boolean(undoSnap.data()?.metadata?.movedToOpenDay), replayed: true };
    const meta = entry.metadata as Doc;
    const itemIds = (meta.itemIds as string[]) || [];
    const own: Doc[] = [];
    const items = new Map<string, Doc>();
    for (const itemId of itemIds) {
      const moves = (await t.get(db.collection('stockMoves').where('workspaceId', '==', workspaceId).where('itemId', '==', itemId))).docs.map(d => d.data());
      const mine = moves.filter(m => m.transactionId === entryId);
      own.push(...mine);
      const lastOwn = mine.map(m => String(m.seq || '')).sort().pop() || '';
      const later = moves.filter(m => m.transactionId !== entryId && String(m.seq || '') > lastOwn);
      const name = String(mine[0]?.itemName || itemId);
      if (later.length) throw new LandedCostError(409, `${name} has moved since the landed cost was posted (${String(later[0].kind)} on ${String(later[0].date).slice(0, 10)}): it can no longer be undone as a whole; post a correcting landed cost instead`);
      const itemSnap = await t.get(db.collection('inventory').doc(itemId));
      items.set(itemId, itemSnap.data() || {});
    }
    const original = String(entry.date || today).slice(0, 10);
    const lock = postingLock(original, ws as never, user.uid);
    const date = lock ? today : original;
    const lines = ((entry.lines as Array<Doc>) || []).map((l, i) => ({
      id: `line-${i + 1}`, accountId: String(l.accountId), ...(l.accountName ? { accountName: String(l.accountName) } : {}), amountCents: -Number(l.amountCents),
      description: `Undo: ${String(l.description || '')}`, ...(l.dimensions ? { dimensions: l.dimensions as Record<string, string> } : {}),
    }));
    const tx = await TransactionValidator.validateAndPrepare({
      id: undoRef.id, workspaceId, uid: user.uid, date, currency: String(entry.currency || ws.currency || 'USD'), exchangeRate: 1, type: 'journal', status: 'completed',
      description: `Undo of ${String(entry.description || 'landed cost')}`, totalAmountCents: Number(entry.totalAmountCents) || 0, createdAt: new Date().toISOString(),
      metadata: { type: LANDED_COST_UNDO_TYPE, reversesTxId: entryId, undoesLandedCost: entryId, entryDate: original, movedToOpenDay: Boolean(lock), itemIds },
      lines,
    }, { workspaceId, user: { uid: user.uid, admin: user.admin }, wsData: ws as never }, undefined, t);
    await ledgerWrite(t, undoRef, { ...tx, createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() } as never);
    const back = new Map<string, number>();
    writeStockMoves(db, t, own.map(m => {
      const itemId = String(m.itemId);
      const item = items.get(itemId) || {};
      const onHand = Number(item.quantityAtHand) || 0;
      back.set(itemId, (back.get(itemId) || 0) + (Number(m.valueCents) || 0));
      return {
        workspaceId, itemId, itemName: String(m.itemName || ''), date, kind: 'landed-cost' as const, quantity: 0, quantityBefore: onHand, quantityAfter: onHand,
        unitCostCents: Math.round(Number(item.unitCostCents) || 0), valueCents: -(Number(m.valueCents) || 0), transactionId: undoRef.id,
        documentType: 'bill' as const, ...(m.documentId ? { documentId: String(m.documentId) } : {}), ...(m.documentLine !== undefined ? { documentLine: Number(m.documentLine) } : {}),
        ...(m.labels ? { labels: m.labels as Record<string, string> } : {}), correctsTxId: entryId, uid: user.uid,
      };
    }));
    for (const [itemId, value] of back) {
      const item = items.get(itemId) || {};
      const onHand = Number(item.quantityAtHand) || 0;
      if (onHand > 0) t.update(db.collection('inventory').doc(itemId), { unitCostCents: movingAverageCents(onHand, Math.round(Number(item.unitCostCents) || 0), -value, onHand), updatedAt: FieldValue.serverTimestamp() });
    }
    await writeServerAuditLog({
      workspaceId, uid: user.uid, email: user.email, action: 'landed-cost-undo', entityType: 'transaction', entityId: entryId,
      details: { description: `Landed cost ${entryId} undone (${undoRef.id})`, date, movedToOpenDay: Boolean(lock) },
    }, { db, tx: t });
    return { entryId, undoEntryId: undoRef.id, date, movedToOpenDay: Boolean(lock), replayed: false };
  });
}
