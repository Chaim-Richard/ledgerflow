export interface FxRate {
  baseCurrency: string;
  targetCurrency: string;
  rate: number;
  timestamp: string;
  rateSource: string;
}

export class CurrencyEngine {
  /**
   * Convert an amount using a specific historical rate.
   */
  static convert(amountCents: number, rate: FxRate): number {
    return Math.round(amountCents * rate.rate);
  }

  /**
   * Inverts an FX rate (e.g., from USD/EUR to EUR/USD).
   */
  static invertRate(rate: FxRate): FxRate {
    if (rate.rate === 0) throw new Error("Cannot invert a zero rate.");
    return {
      ...rate,
      baseCurrency: rate.targetCurrency,
      targetCurrency: rate.baseCurrency,
      rate: 1 / rate.rate
    };
  }

  /**
   * Calculates the spread between a buy rate and a sell rate.
   */
  static calculateSpread(buyRate: number, sellRate: number): number {
    return Math.abs(buyRate - sellRate);
  }

  /**
   * Validation check for extreme inconsistencies in FX triangulations.
   * Check USD/EUR, EUR/GBP, GBP/USD for extreme inconsistencies.
   */
  static validateTriangulation(rate1: number, rate2: number, rate3: number): boolean {
    // Expected: rate1 * rate2 * rate3 should be roughly 1.
    const product = rate1 * rate2 * rate3;
    const threshold = 0.05; // 5% variance threshold
    
    if (Math.abs(1 - product) > threshold) {
      console.warn(`FX Consistency Warning: Triangulation failed. Product is ${product}`);
      return false;
    }
    return true;
  }
}
