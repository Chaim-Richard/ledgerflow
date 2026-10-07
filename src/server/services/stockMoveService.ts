/**
 * Writes the stock-moves ledger (W-02, src/lib/stockMoves.ts): every service that changes an item's
 * quantity on hand calls this inside the same database transaction, after its reads, so the history
 * and the quantity are written together or not at all. Only the server writes the table
 * (supabase/migrations/20261013060000_stock_moves.sql); members read it.
 */
import type { Firestore, Transaction as DbTransaction } from '../db/firestore';
import type { StockMove } from '../../lib/stockMoves';

export type NewStockMove = Omit<StockMove, 'id' | 'seq' | 'createdAt'>;

export function writeStockMoves(db: Firestore, t: DbTransaction, moves: NewStockMove[]): void {
  if (moves.length === 0) return;
  const now = new Date().toISOString();
  moves.forEach((move, i) => {
    const ref = db.collection('stockMoves').doc();
    t.set(ref, { ...move, seq: `${now}#${String(i).padStart(5, '0')}`, createdAt: now });
  });
}
