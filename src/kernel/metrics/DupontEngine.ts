export class DupontEngine {
  /**
   * Calculates ROE using the 3-step DuPont Analysis model.
   * ROE = Net Profit Margin * Asset Turnover * Equity Multiplier
   */
  static calculateDuPontROE(netIncome: number, revenue: number, averageTotalAssets: number, averageShareholderEquity: number): { roe: number, margin: number, turnover: number, multiplier: number } {
    const margin = revenue === 0 ? 0 : netIncome / revenue;
    const turnover = averageTotalAssets === 0 ? 0 : revenue / averageTotalAssets;
    const multiplier = averageShareholderEquity === 0 ? 0 : averageTotalAssets / averageShareholderEquity;
    
    return {
      roe: margin * turnover * multiplier,
      margin,
      turnover,
      multiplier
    };
  }
}
