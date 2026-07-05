export class RopEngine {
  /**
   * Reorder point with variable demand and lead time.
   * Reorder Point = (Average Daily Demand * Average Lead Time) + Safety Stock
   */
  static calculateAdvancedROP(avgDailyDemand: number, avgLeadTimeDays: number, safetyStock: number): number {
    return (avgDailyDemand * avgLeadTimeDays) + safetyStock;
  }

  /**
   * Calculate Safety Stock based on max variations.
   * Safety Stock = (Max Daily Demand * Max Lead Time) - (Avg Daily Demand * Avg Lead Time)
   */
  static calculateSafetyStock(maxDailyDemand: number, maxLeadTimeDays: number, avgDailyDemand: number, avgLeadTimeDays: number): number {
    const maxUsage = maxDailyDemand * maxLeadTimeDays;
    const avgUsage = avgDailyDemand * avgLeadTimeDays;
    return Math.max(0, maxUsage - avgUsage);
  }
}
