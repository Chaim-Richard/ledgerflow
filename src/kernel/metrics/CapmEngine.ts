export class CapmEngine {
  /**
   * Calculates the Expected Return using the Capital Asset Pricing Model (CAPM).
   * ER = Rf + Beta * (Rm - Rf)
   */
  static calculateExpectedReturn(riskFreeRate: number, beta: number, expectedMarketReturn: number): number {
    const marketRiskPremium = expectedMarketReturn - riskFreeRate;
    return riskFreeRate + (beta * marketRiskPremium);
  }
}
