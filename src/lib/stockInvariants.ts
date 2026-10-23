/**
 * EG-7: the stock closing snapshot and the stock invariants. Pure: the server builds and checks with it
 * (src/server/services/stockClosingService.ts), the nightly Data Health run reads `STOCK_INVARIANT_CHECKS`
 * (src/lib/dataChecks.ts), and the Inventory Valuation panel shows what the server returns.
 *
 * Stock value at a date = the sum of the moves' values dated on or before it (the moving-average value the
 * stock-moves ledger keeps, as Inventory details and Stock aging read it). The books' value = the Inventory
 * accounts' balance at the same date. The three checks:
 *   (a) the stock value equals the Inventory balance; a difference is put on the item whose entry posted a
 *       different value than its stock moves (or that moved with no entry), and what no move explains (a manual
 *       journal to Inventory, an opening balance) is listed by entry;
 *   (b) no item ends any day below zero, by the moves' dates (a move dated back can take a day below zero even
 *       when each move, in the order written, stayed above it);
 *   (c) a snapshot's checksum still matches the moves it covers; otherwise it is stale.
 */
import type { ChartAccount, Transaction } from '../types';
import { resolveAccountRole } from './accountUtils';
import { isPostable, lineAmount, transactionDate } from './txFilters';
import { NO_LOCATION, orderedMoves, type StockMove } from './stockMoves';
import type { CheckFinding, DataCheck } from './dataChecks';

export interface StockClosingRow {
  itemId: string;
  itemName: string;
  /** a Location label value; '' = no location */
  locationId: string;
  quantity: number;
  valueCents: number;
  moveCount: number;
  checksum: string;
}

export interface StockClosing {
  workspaceId: string;
  /** the period end (YYYY-MM-DD) */
  asOf: string;
  rows: StockClosingRow[];
  moveCount: number;
  checksum: string;
  stockValueCents: number;
  /** the Inventory accounts' balance at `asOf` (balancesAsOf, plus the accounts' opening balances) */
  inventoryBalanceCents: number;
  /** stock less books */
  differenceCents: number;
  builtAt: string;
  builtBy: string;
}

const round6 = (n: number) => Math.round(n * 1e6) / 1e6;
const day = (d: unknown) => String(d || '').slice(0, 10);
const money = (cents: number) => (cents / 100).toFixed(2);

/** FNV-1a, 64 bits, as hex: the same in the browser and on the server, over a list kept in order. */
export function fnv64(text: string): string {
  let h = 0xcbf29ce484222325n;
  for (let i = 0; i < text.length; i++) {
    h ^= BigInt(text.charCodeAt(i));
    h = (h * 0x100000001b3n) & 0xffffffffffffffffn;
  }
  return h.toString(16).padStart(16, '0');
}

/** What a move contributes to a checksum: everything that changes a quantity or a value, and its place in the order. */
const moveKey = (m: StockMove) => [m.id || '', m.itemId, m.locationId || NO_LOCATION, day(m.date), m.seq, round6(Number(m.quantity) || 0), round6(Number(m.quantityBefore) || 0), Number(m.valueCents) || 0].join('|');

export const movesChecksum = (moves: StockMove[]) => fnv64(moves.map(moveKey).sort().join('\n'));

/** The moves a closing at `asOf` covers. */
export const movesUpTo = (moves: StockMove[], asOf: string) => moves.filter(m => day(m.date) !== '' && day(m.date) <= asOf);

/** The closing snapshot at `asOf`, per item and location (what the history starts with counts as no location). */
export function buildStockClosing(input: { workspaceId: string; asOf: string; moves: StockMove[]; inventoryBalanceCents: number; builtBy: string; at: string }): StockClosing {
  const covered = movesUpTo(input.moves, input.asOf);
  const byItem = new Map<string, StockMove[]>();
  for (const m of covered) byItem.set(m.itemId, [...(byItem.get(m.itemId) || []), m]);
  const rows: StockClosingRow[] = [];
  for (const [itemId, list] of byItem) {
    const ordered = orderedMoves(list);
    const itemName = String(list.find(m => m.itemName)?.itemName || itemId);
    const at = new Map<string, { quantity: number; valueCents: number; moves: StockMove[] }>();
    const slot = (where: string) => at.get(where) || at.set(where, { quantity: 0, valueCents: 0, moves: [] }).get(where)!;
    if (ordered[0].quantityBefore) slot(NO_LOCATION).quantity = round6(Number(ordered[0].quantityBefore) || 0);
    for (const m of ordered) {
      const s = slot(m.locationId || NO_LOCATION);
      s.quantity = round6(s.quantity + (Number(m.quantity) || 0));
      s.valueCents += Number(m.valueCents) || 0;
      s.moves.push(m);
    }
    for (const [locationId, s] of at) {
      rows.push({ itemId, itemName, locationId, quantity: s.quantity, valueCents: s.valueCents, moveCount: s.moves.length, checksum: movesChecksum(s.moves) });
    }
  }
  rows.sort((a, b) => a.itemName.localeCompare(b.itemName) || a.locationId.localeCompare(b.locationId));
  const stockValueCents = rows.reduce((s, r) => s + r.valueCents, 0);
  return {
    workspaceId: input.workspaceId, asOf: input.asOf, rows, moveCount: covered.length, checksum: movesChecksum(covered),
    stockValueCents, inventoryBalanceCents: input.inventoryBalanceCents, differenceCents: stockValueCents - input.inventoryBalanceCents,
    builtAt: input.at, builtBy: input.builtBy,
  };
}

export interface BooksCheck {
  ok: boolean;
  asOf: string;
  stockValueCents: number;
  inventoryBalanceCents: number;
  /** stock less books */
  differenceCents: number;
  byItem: Array<{ itemId: string; itemName: string; differenceCents: number }>;
  /** Inventory amounts no stock move explains (stock less books, so a journal of +10.00 to Inventory is −1,000) */
  unattributed: Array<{ transactionId: string; date: string; description: string; differenceCents: number }>;
  message: string;
}

/**
 * Check (a). `inventoryBalanceCents` is the Inventory balance from balancesAsOf when the caller has it; without it the
 * balance is summed from `entries` (and the accounts' opening balances). The split by item reads `entries`.
 */
export function checkStockAgainstBooks(input: { asOf: string; moves: StockMove[]; entries: Transaction[]; accounts: ChartAccount[]; inventoryBalanceCents?: number }): BooksCheck {
  const inventory = new Set(input.accounts.filter(a => resolveAccountRole(a) === 'inventory').map(a => a.id));
  const covered = movesUpTo(input.moves, input.asOf);
  const names = new Map(covered.map(m => [m.itemId, String(m.itemName || m.itemId)]));
  const byItem = new Map<string, number>();
  const toItem = (itemId: string, cents: number) => { if (cents) byItem.set(itemId, (byItem.get(itemId) || 0) + cents); };
  const movesByEntry = new Map<string, StockMove[]>();
  for (const m of covered) {
    if (m.transactionId) movesByEntry.set(m.transactionId, [...(movesByEntry.get(m.transactionId) || []), m]);
  }
  const unattributed: BooksCheck['unattributed'] = [];
  let booksFromEntries = 0;
  const seen = new Set<string>();
  for (const tx of input.entries) {
    const d = transactionDate(tx);
    if (!isPostable(tx) || d === '' || d > input.asOf) continue;
    const posted = (tx.lines || []).filter(l => l && inventory.has(l.accountId)).reduce((s, l) => s + lineAmount(l, tx), 0);
    booksFromEntries += posted;
    const moves = movesByEntry.get(tx.id) || [];
    seen.add(tx.id);
    const moved = moves.reduce((s, m) => s + (Number(m.valueCents) || 0), 0);
    if (moved === posted) continue;
    const items = [...new Set(moves.map(m => m.itemId))];
    if (items.length === 1) toItem(items[0], moved - posted);
    else unattributed.push({ transactionId: tx.id, date: d, description: String(tx.description || ''), differenceCents: moved - posted });
  }
  // moves whose entry is not in the books on the date (none, voided, deleted): stock with no value in the books
  for (const m of covered) if (!m.transactionId || !seen.has(m.transactionId)) toItem(m.itemId, Number(m.valueCents) || 0);
  const opening = input.accounts.filter(a => inventory.has(a.id)).reduce((s, a) => s + (Number(a.openingBalanceCents) || 0), 0);
  if (opening) unattributed.push({ transactionId: '', date: '', description: 'Opening balance of the Inventory account', differenceCents: -opening });
  const stockValueCents = covered.reduce((s, m) => s + (Number(m.valueCents) || 0), 0);
  const inventoryBalanceCents = input.inventoryBalanceCents ?? booksFromEntries + opening;
  const residual = inventoryBalanceCents - (booksFromEntries + opening);
  if (residual) unattributed.push({ transactionId: '', date: '', description: 'Inventory balance not found in the entries read', differenceCents: -residual });
  const differenceCents = stockValueCents - inventoryBalanceCents;
  const items = [...byItem].map(([itemId, c]) => ({ itemId, itemName: names.get(itemId) || itemId, differenceCents: c })).sort((a, b) => a.itemName.localeCompare(b.itemName));
  const parts = [
    ...items.map(i => `${i.itemName} ${money(i.differenceCents)}`),
    ...unattributed.map(u => `${u.description || u.transactionId}${u.date ? ` (${u.date})` : ''} ${money(u.differenceCents)}`),
  ];
  const message = differenceCents === 0
    ? `On ${input.asOf} the stock is worth ${money(stockValueCents)}, the same as the Inventory account.`
    : `On ${input.asOf} the stock is worth ${money(stockValueCents)} but the Inventory account shows ${money(inventoryBalanceCents)}: the books have ${money(Math.abs(differenceCents))} ${differenceCents < 0 ? 'more' : 'less'} than the stock.${parts.length ? ` From: ${parts.slice(0, 5).join('; ')}${parts.length > 5 ? `; and ${parts.length - 5} more` : ''}.` : ''}`;
  return { ok: differenceCents === 0, asOf: input.asOf, stockValueCents, inventoryBalanceCents, differenceCents, byItem: items, unattributed, message };
}

export interface NegativeDay { itemId: string; itemName: string; date: string; quantity: number }

/**
 * Each item's quantity at the end of each day it moved, by the moves' dates: the history's start (the first move's
 * quantity before, in the order written) plus every move dated on or before that day.
 */
export function datedQuantities(moves: StockMove[]): Map<string, Array<{ date: string; quantity: number }>> {
  const byItem = new Map<string, StockMove[]>();
  for (const m of moves) if (day(m.date)) byItem.set(m.itemId, [...(byItem.get(m.itemId) || []), m]);
  const out = new Map<string, Array<{ date: string; quantity: number }>>();
  for (const [itemId, list] of byItem) {
    const start = round6(Number(orderedMoves(list)[0].quantityBefore) || 0);
    const byDay = new Map<string, number>();
    for (const m of list) byDay.set(day(m.date), round6((byDay.get(day(m.date)) || 0) + (Number(m.quantity) || 0)));
    let q = start;
    out.set(itemId, [...byDay].sort(([a], [b]) => a.localeCompare(b)).map(([date, change]) => ({ date, quantity: (q = round6(q + change)) })));
  }
  return out;
}

/** Check (b): the first day each item ended below zero. */
export function negativeStockDays(moves: StockMove[]): { ok: boolean; items: NegativeDay[]; message: string } {
  const names = new Map(moves.map(m => [m.itemId, String(m.itemName || m.itemId)]));
  const items: NegativeDay[] = [];
  for (const [itemId, days] of datedQuantities(moves)) {
    const first = days.find(d => d.quantity < 0);
    if (first) items.push({ itemId, itemName: names.get(itemId) || itemId, date: first.date, quantity: first.quantity });
  }
  items.sort((a, b) => a.date.localeCompare(b.date) || a.itemName.localeCompare(b.itemName));
  const message = items.length === 0
    ? 'No item is below zero on any day.'
    : items.slice(0, 5).map(i => `${i.itemName} is at ${i.quantity} at the end of ${i.date}`).join('; ') + (items.length > 5 ? `; and ${items.length - 5} more items` : '') + '.';
  return { ok: items.length === 0, items, message };
}

/** Check (c): whether the moves a snapshot covers are still the moves it was built from. */
export function closingFreshness(closing: Pick<StockClosing, 'asOf' | 'checksum' | 'moveCount' | 'rows'>, moves: StockMove[]): { fresh: boolean; changedItems: string[]; message: string } {
  const covered = movesUpTo(moves, closing.asOf);
  if (movesChecksum(covered) === closing.checksum) return { fresh: true, changedItems: [], message: `The stock closing of ${closing.asOf} still matches its ${closing.moveCount} stock moves.` };
  const now = buildStockClosing({ workspaceId: '', asOf: closing.asOf, moves: covered, inventoryBalanceCents: 0, builtBy: '', at: '' });
  const key = (r: StockClosingRow) => `${r.itemId}\u0000${r.locationId}`;
  const then = new Map(closing.rows.map(r => [key(r), r.checksum]));
  const nowRows = new Map(now.rows.map(r => [key(r), r]));
  const changed = new Set<string>();
  for (const r of now.rows) if (then.get(key(r)) !== r.checksum) changed.add(r.itemName);
  for (const r of closing.rows) if (!nowRows.has(key(r))) changed.add(r.itemName);
  const changedItems = [...changed].sort();
  return {
    fresh: false, changedItems,
    message: `The stock closing of ${closing.asOf} is stale: its stock moves were changed since it was taken (${covered.length} now, ${closing.moveCount} then${changedItems.length ? `; ${changedItems.slice(0, 5).join(', ')}` : ''}).`,
  };
}

/** The nightly Data Health checks (the context carries the stock moves and the stock closings). */
export const STOCK_INVARIANT_CHECKS: DataCheck[] = [
  {
    id: 'stock-vs-books',
    label: 'Stock value differs from the Inventory account (EG-7)',
    remedy: 'Open Inventory Valuation and the entries named: post the stock change with its entry, or correct the journal to Inventory.',
    run: ({ stockMoves, transactions, accounts, today }) => {
      if (!stockMoves?.length) return [];
      const check = checkStockAgainstBooks({ asOf: today, moves: stockMoves, entries: transactions, accounts });
      return check.ok ? [] : [{ id: `stock-vs-books-${check.differenceCents}`, checkId: 'stock-vs-books', severity: 'high', title: `Stock and the Inventory account differ by ${money(Math.abs(check.differenceCents))}`, description: check.message }];
    },
  },
  {
    id: 'stock-negative-on-date',
    label: 'Items below zero on a day, by the moves\' dates (EG-7)',
    remedy: 'Date the stock that came in on or before the day it went out, or correct the move dated too early.',
    run: ({ stockMoves }) => negativeStockDays(stockMoves || []).items.map((i): CheckFinding => ({
      id: `stock-negative-on-date-${i.itemId}-${i.date}`, checkId: 'stock-negative-on-date', severity: 'medium',
      title: `${i.itemName} is below zero on ${i.date}`, description: `${i.itemName} ends ${i.date} at ${i.quantity}, by the dates of its stock moves.`,
      record: { type: 'item', id: i.itemId },
    })),
  },
  {
    id: 'stock-closing-stale',
    label: 'Stock closings whose stock moves changed (EG-7)',
    remedy: 'An owner takes the stock closing again (Inventory Valuation), after checking why a closed period\'s stock changed.',
    run: ({ stockMoves, stockClosings }) => (stockClosings || []).flatMap(c => {
      const f = closingFreshness(c, stockMoves || []);
      return f.fresh ? [] : [{ id: `stock-closing-stale-${c.asOf}-${c.checksum}`, checkId: 'stock-closing-stale', severity: 'high' as const, title: `The stock closing of ${c.asOf} is stale`, description: f.message }];
    }),
  },
];
