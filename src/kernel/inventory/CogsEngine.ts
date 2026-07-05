export class CogsEngine {
  /**
   * Basic COGS formula: Beginning Inventory + Purchases - Ending Inventory
   */
  static calculatePeriodicCOGS(beginningInventory: number, purchases: number, endingInventory: number): number {
    return beginningInventory + purchases - endingInventory;
  }
  
  /**
   * Calculates gross profit.
   */
  static calculateGrossProfit(netSales: number, cogs: number): number {
    return netSales - cogs;
  }
}
