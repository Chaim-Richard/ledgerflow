/**
 * Writes the stock-moves ledger (W-02, src/lib/stockMoves.ts): every service that changes an item's
 * quantity on hand calls this inside the same database transaction, after its reads, so the history
 * and the quantity are written together or not at all. Only the server writes the table
 * (supabase/migrations/20261013060000_stock_moves.sql); members read it.
 *
 * Until that migration is applied to a database, stock changes must keep working as before W-02:
 * `stockMovesReady` (called in each service's read phase) says whether the table is there, and
 * without it nothing is written or read from it and the server says once which migration to apply.
 */
import type { Firestore, Transaction as DbTransaction } from '../db/firestore';
import type { StockMove } from '../../lib/stockMoves';

export type NewStockMove = Omit<StockMove, 'id' | 'seq' | 'createdAt'>;

let known: { exists: boolean; at: number } | null = null;
let warned = false;

/** Whether the stock-moves table exists (cached; a missing table is looked for again after a minute). */
export async function stockMovesReady(db: Firestore): Promise<boolean> {
  if (known && (known.exists || Date.now() - known.at < 60_000)) return known.exists;
  try {
    const result = await db.pool.query(`select to_regclass('public."stockMoves"') is not null as ok`);
    known = { exists: Boolean(result.rows[0]?.ok), at: Date.now() };
  } catch {
    known = { exists: false, at: Date.now() };
  }
  if (!known.exists && !warned) {
    warned = true;
    console.warn('[stock history] the stockMoves table is missing: apply supabase/migrations/20261013060000_stock_moves.sql. Stock changes still work; their history is not kept until then.');
  }
  return known.exists;
}

export function writeStockMoves(db: Firestore, t: DbTransaction, moves: NewStockMove[]): void {
  if (moves.length === 0 || known?.exists === false) return;
  const now = new Date().toISOString();
  moves.forEach((move, i) => {
    const ref = db.collection('stockMoves').doc();
    t.set(ref, { ...move, seq: `${now}#${String(i).padStart(5, '0')}`, createdAt: now });
  });
}
