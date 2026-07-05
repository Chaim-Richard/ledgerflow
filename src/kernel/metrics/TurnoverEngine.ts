export class TurnoverEngine {
  /**
   * Calculates Asset Turnover Ratio = Net Sales / Average Total Assets
   */
  static calculateAssetTurnover(netSales: number, averageTotalAssets: number): number {
    if (averageTotalAssets === 0) return 0;
    return netSales / averageTotalAssets;
  }

  /**
   * Calculates Inventory Turnover Ratio = COGS / Average Inventory
   */
  static calculateInventoryTurnover(cogs: number, averageInventory: number): number {
    if (averageInventory === 0) return 0;
    return cogs / averageInventory;
  }

  /**
   * Calculates Receivables Turnover Ratio = Net Credit Sales / Average Accounts Receivable
   */
  static calculateReceivablesTurnover(netCreditSales: number, averageAccountsReceivable: number): number {
    if (averageAccountsReceivable === 0) return 0;
    return netCreditSales / averageAccountsReceivable;
  }
}
