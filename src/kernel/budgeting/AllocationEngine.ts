export class AllocationEngine {
  /**
   * Allocates an overhead cost across multiple departments based on a weighting factor (e.g. headcount, sq footage).
   */
  static allocateOverhead(totalCostCents: number, weights: Record<string, number>): Record<string, number> {
    const totalWeight = Object.values(weights).reduce((a, b) => a + b, 0);
    if (totalWeight === 0) return {};

    const allocations: Record<string, number> = {};
    let allocatedTotal = 0;
    
    const keys = Object.keys(weights);
    for (let i = 0; i < keys.length; i++) {
      const key = keys[i];
      // For the last element, assign the remainder to avoid penny rounding issues
      if (i === keys.length - 1) {
        allocations[key] = totalCostCents - allocatedTotal;
      } else {
        const allocated = Math.round(totalCostCents * (weights[key] / totalWeight));
        allocations[key] = allocated;
        allocatedTotal += allocated;
      }
    }
    
    return allocations;
  }
}
