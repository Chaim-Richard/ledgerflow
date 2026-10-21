/**
 * A-114: stock moved between locations, read back from the stock-moves ledger. The server writes
 * every move as a pair in one write (transfer-out then transfer-in: the same item, day, quantity,
 * writer and written moment; src/server/services/stockTransferService.ts), so a pair is recognised
 * by those shared facts — never by guessing. A move whose pair is not in the loaded history is
 * shown on its own with the reason, never dropped and never paired by force. Pure.
 */
import type { StockMove } from './stockMoves';

export interface TransferPair {
  key: string;
  itemId: string;
  itemName: string;
  /** the day of the move (YYYY-MM-DD) */
  date: string;
  /** units moved (always positive) */
  quantity: number;
  /** the location ids ('' = no location) */
  from: string;
  to: string;
  uid?: string;
  /** the moment the pair was written */
  createdAt: string;
  /** both halves are in the loaded history */
  complete: boolean;
  /** why an incomplete pair cannot be shown whole */
  problem?: string;
}

/**
 * The location moves as pairs, newest first. Moves that are not location moves are ignored; so is
 * any pairing that would need a guess.
 */
export function transferPairs(moves: StockMove[]): TransferPair[] {
  const bySeq = (a: StockMove, b: StockMove) =>
    String(a.createdAt || '').localeCompare(String(b.createdAt || '')) || String(a.seq || '').localeCompare(String(b.seq || ''));
  const outs = (moves || []).filter(m => m.kind === 'transfer-out').sort(bySeq);
  const ins = (moves || []).filter(m => m.kind === 'transfer-in').sort(bySeq);
  const used = new Set<number>();
  const pairs: TransferPair[] = [];
  const name = (m: StockMove) => String(m.itemName || m.itemId);
  for (const out of outs) {
    const quantity = Math.abs(Number(out.quantity) || 0);
    const match = ins.findIndex((m, i) =>
      !used.has(i) && m.itemId === out.itemId
      && String(m.date || '').slice(0, 10) === String(out.date || '').slice(0, 10)
      && String(m.createdAt || '') === String(out.createdAt || '')
      && Math.abs(Number(m.quantity) || 0) === quantity);
    if (match === -1) {
      pairs.push({
        key: `out:${String(out.id || out.seq)}`, itemId: out.itemId, itemName: name(out),
        date: String(out.date || '').slice(0, 10), quantity,
        from: out.locationId || '', to: '',
        ...(out.uid ? { uid: out.uid } : {}), createdAt: String(out.createdAt || ''),
        complete: false, problem: 'Its move-in half is not in the loaded history.',
      });
      continue;
    }
    used.add(match);
    const into = ins[match];
    pairs.push({
      key: `pair:${String(out.id || out.seq)}:${String(into.id || into.seq)}`,
      itemId: out.itemId, itemName: name(out),
      date: String(out.date || '').slice(0, 10), quantity,
      from: out.locationId || '', to: into.locationId || '',
      ...(out.uid ? { uid: out.uid } : {}), createdAt: String(out.createdAt || ''),
      complete: true,
    });
  }
  ins.forEach((m, i) => {
    if (used.has(i)) return;
    pairs.push({
      key: `in:${String(m.id || m.seq)}`, itemId: m.itemId, itemName: name(m),
      date: String(m.date || '').slice(0, 10), quantity: Math.abs(Number(m.quantity) || 0),
      from: '', to: m.locationId || '',
      ...(m.uid ? { uid: m.uid } : {}), createdAt: String(m.createdAt || ''),
      complete: false, problem: 'Its move-out half is not in the loaded history.',
    });
  });
  return pairs.sort((a, b) =>
    b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt)
    || a.itemName.localeCompare(b.itemName) || a.key.localeCompare(b.key));
}

export const STOCK_TRANSFERS_CSV_HEADERS = [
  'Date', 'Item', 'Quantity', 'From', 'To', 'Complete', 'Note',
];

export function stockTransfersCsvRows(
  pairs: TransferPair[],
  locationName: (id: string) => string,
): Array<Array<string | number>> {
  return pairs.map(p => [
    p.date, p.itemName, p.quantity,
    p.from ? locationName(p.from) : '(no location)',
    p.to ? locationName(p.to) : '(no location)',
    p.complete ? 'yes' : 'no', p.problem || '',
  ]);
}
