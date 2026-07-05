export class OperatingMarginEngine {
  /**
   * Calculates Operating Margin.
   * Operating Margin = Operating Income / Revenue
   */
  static calculateOperatingMargin(operatingIncome: number, revenue: number): number {
    if (revenue === 0) return 0;
    return operatingIncome / revenue;
  }
}
