export class ShrinkageEngine {
  /**
   * Calculates inventory shrinkage.
   * Shrinkage = Book Inventory - Physical Inventory
   */
  static calculateShrinkage(bookInventoryValue: number, physicalInventoryValue: number): number {
    return Math.max(0, bookInventoryValue - physicalInventoryValue);
  }

  /**
   * Calculates shrinkage as a percentage of book inventory.
   */
  static calculateShrinkagePercentage(bookInventoryValue: number, physicalInventoryValue: number): number {
    if (bookInventoryValue === 0) return 0;
    const shrinkage = this.calculateShrinkage(bookInventoryValue, physicalInventoryValue);
    return (shrinkage / bookInventoryValue) * 100;
  }
}
