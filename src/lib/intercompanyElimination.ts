import { Transaction, TransactionLine } from '../types';
import { getLineDimension, isPathSubtreeMatch } from './dimensionUtils';

export interface WorldStatement {
  world: string;
  totalRevenueCents: number;
  totalExpenseCents: number;
  netIncomeCents: number;
  transactionCount: number;
}

export interface ConsolidatedLedgerSummary {
  worldStatements: WorldStatement[];
  eliminatedTransferCents: number;
  consolidatedRevenueCents: number;
  consolidatedExpenseCents: number;
  consolidatedNetIncomeCents: number;
}

export class IntercompanyEliminationEngine {
  /**
   * Filters transactions or lines for a specific single World sub-ledger.
   */
  static filterByWorld(
    transactions: Transaction[],
    worldTarget: string
  ): Transaction[] {
    if (!worldTarget || worldTarget.toLowerCase() === 'all' || worldTarget.toLowerCase() === 'consolidated') {
      return transactions;
    }

    return transactions
      .map(tx => {
        const matchingLines = (tx.lines || []).filter(line => {
          const worldVal = getLineDimension(line, tx, 'world');
          return isPathSubtreeMatch(worldVal, worldTarget);
        });

        if (matchingLines.length === 0) return null;
        return { ...tx, lines: matchingLines };
      })
      .filter((tx): tx is Transaction => tx !== null);
  }

  /**
   * Generates world statements per entity and eliminates intercompany transfers for consolidated totals.
   */
  static generateConsolidatedSummary(
    transactions: Transaction[],
    isIncomeLine: (l: TransactionLine) => boolean,
    isExpenseLine: (l: TransactionLine) => boolean
  ): ConsolidatedLedgerSummary {
    const worldMap = new Map<string, { revenue: number; expense: number; txIds: Set<string> }>();
    let eliminatedTransferCents = 0;

    transactions.forEach(tx => {
      // Check if transaction is an intercompany transfer between different worlds
      const lineWorlds = new Set<string>();
      (tx.lines || []).forEach(line => {
        const w = getLineDimension(line, tx, 'world');
        if (w && w !== 'Unassigned') lineWorlds.add(w.toLowerCase().trim());
      });

      const isIntercompanyTx = tx.isIntercompany || lineWorlds.size > 1;

      (tx.lines || []).forEach(line => {
        const worldVal = getLineDimension(line, tx, 'world');
        const worldKey = worldVal === 'Unassigned' ? 'Default Entity' : worldVal;

        if (!worldMap.has(worldKey)) {
          worldMap.set(worldKey, { revenue: 0, expense: 0, txIds: new Set() });
        }
        const record = worldMap.get(worldKey)!;
        record.txIds.add(tx.id);

        const rawAmt = line.amountCents || 0;
        if (isIncomeLine(line)) {
          // Credit is negative in double-entry. For revenue, negative credit increases revenue.
          const revAmt = rawAmt < 0 ? -rawAmt : rawAmt;
          record.revenue += revAmt;
        } else if (isExpenseLine(line)) {
          // Debit is positive in double-entry. Positive debit increases expense.
          const expAmt = rawAmt > 0 ? rawAmt : -rawAmt;
          record.expense += expAmt;
        }

        // Track eliminated intercompany transfer amounts
        if (isIntercompanyTx) {
          eliminatedTransferCents += Math.abs(rawAmt) / 2; // eliminate balancing pairs
        }
      });
    });

    const worldStatements: WorldStatement[] = Array.from(worldMap.entries()).map(([world, data]) => ({
      world,
      totalRevenueCents: data.revenue,
      totalExpenseCents: data.expense,
      netIncomeCents: data.revenue - data.expense,
      transactionCount: data.txIds.size
    }));

    const rawRevenue = worldStatements.reduce((sum, w) => sum + w.totalRevenueCents, 0);
    const rawExpense = worldStatements.reduce((sum, w) => sum + w.totalExpenseCents, 0);

    return {
      worldStatements,
      eliminatedTransferCents: Math.round(eliminatedTransferCents),
      consolidatedRevenueCents: Math.max(0, rawRevenue - Math.round(eliminatedTransferCents)),
      consolidatedExpenseCents: Math.max(0, rawExpense - Math.round(eliminatedTransferCents)),
      consolidatedNetIncomeCents: rawRevenue - rawExpense
    };
  }
}
