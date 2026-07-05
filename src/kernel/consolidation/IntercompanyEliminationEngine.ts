import { Transaction } from '../../types';

export class IntercompanyEliminationEngine {
  /**
   * Identifies transactions that should be eliminated upon consolidation (e.g., transfers between subsidiaries).
   */
  static identifyEliminations(transactions: Transaction[], subsidiaryEntityIds: string[]): Transaction[] {
    return transactions.filter(tx => {
      // Check if both the sender and receiver are internal entities
      // Assuming metadata holds sourceEntityId and targetEntityId for intercompany transfers
      const source = tx.metadata?.sourceEntityId;
      const target = tx.metadata?.targetEntityId;
      
      return source && target && subsidiaryEntityIds.includes(source) && subsidiaryEntityIds.includes(target);
    });
  }

  /**
   * Calculates net intercompany balance (should ideally be zero if all intercompany transactions are properly recorded).
   */
  static calculateIntercompanyImbalance(eliminationTransactions: Transaction[]): number {
    // Net sum of all intercompany lines should be 0.
    let netImbalance = 0;
    eliminationTransactions.forEach(tx => {
       tx.lines?.forEach(line => {
         netImbalance += (line.amountCents || 0);
       });
    });
    return netImbalance;
  }
}
