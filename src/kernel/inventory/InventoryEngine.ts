export class InventoryEngine {
  /**
   * Calculates the Cost of Goods Sold (COGS) using First-In-First-Out (FIFO).
   */
  static calculateFIFO(inventoryBatches: { quantity: number, unitCostCents: number }[], unitsSold: number): number {
    let cogs = 0;
    let remainingToSell = unitsSold;
    
    // Create a copy so we don't mutate the original array
    const batches = [...inventoryBatches].map(b => ({ ...b }));

    for (const batch of batches) {
      if (remainingToSell <= 0) break;
      const unitsFromBatch = Math.min(batch.quantity, remainingToSell);
      cogs += unitsFromBatch * batch.unitCostCents;
      batch.quantity -= unitsFromBatch;
      remainingToSell -= unitsFromBatch;
    }

    if (remainingToSell > 0) {
      throw new Error('Not enough inventory to satisfy sales volume.');
    }

    return cogs;
  }

  /**
   * Calculates the Weighted Average Cost (WAC).
   */
  static calculateWAC(inventoryBatches: { quantity: number, unitCostCents: number }[]): number {
    let totalQuantity = 0;
    let totalCost = 0;

    for (const batch of inventoryBatches) {
      totalQuantity += batch.quantity;
      totalCost += batch.quantity * batch.unitCostCents;
    }

    return totalQuantity === 0 ? 0 : Math.round(totalCost / totalQuantity);
  }
}
