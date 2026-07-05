export class DaysSalesInInventoryEngine {
  /**
   * Calculates Days Sales in Inventory (DSI).
   * DSI = (Average Inventory / COGS) * 365
   */
  static calculateDSI(averageInventory: number, cogs: number, daysInYear: number = 365): number {
    if (cogs === 0) return 0;
    return (averageInventory / cogs) * daysInYear;
  }
}
