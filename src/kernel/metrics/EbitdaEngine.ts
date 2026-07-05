export class EbitdaEngine {
  /**
   * Calculates EBITDA (Earnings Before Interest, Taxes, Depreciation, and Amortization).
   */
  static calculateEBITDA(netIncome: number, interest: number, taxes: number, depreciation: number, amortization: number): number {
    return netIncome + interest + taxes + depreciation + amortization;
  }

  /**
   * Calculates EBIT (Operating Profit).
   */
  static calculateEBIT(netIncome: number, interest: number, taxes: number): number {
    return netIncome + interest + taxes;
  }
}
