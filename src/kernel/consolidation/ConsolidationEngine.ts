import { FxRate, CurrencyEngine } from '../fx/CurrencyEngine';

export class ConsolidationEngine {
  /**
   * Consolidate Balance Sheet accounts using closing rates.
   */
  static consolidateBalanceSheet(
    balanceCents: number, 
    closingRate: FxRate
  ): number {
    return CurrencyEngine.convert(balanceCents, closingRate);
  }

  /**
   * Consolidate Income Statement transactions using historical rates or weighted average rates.
   */
  static consolidateIncomeStatement(
    transactions: Array<{ amountCents: number; rate: FxRate }>
  ): number {
    return transactions.reduce((total, tx) => {
      return total + CurrencyEngine.convert(tx.amountCents, tx.rate);
    }, 0);
  }
}
