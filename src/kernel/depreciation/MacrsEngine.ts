export class MacrsEngine {
  /**
   * MACRS Half-Year Convention Table for 3, 5, 7, 10, 15, and 20 year properties.
   * Rates are expressed as percentages.
   */
  private static MACRS_TABLE: Record<number, number[]> = {
    3: [33.33, 44.45, 14.81, 7.41],
    5: [20.00, 32.00, 19.20, 11.52, 11.52, 5.76],
    7: [14.29, 24.49, 17.49, 12.49, 8.93, 8.92, 8.93, 4.46],
    10: [10.00, 18.00, 14.40, 11.52, 9.22, 7.37, 6.55, 6.55, 6.56, 6.55, 3.28]
  };

  /**
   * Calculates MACRS depreciation for a specific year.
   */
  static calculateMACRS(costBasis: number, propertyClassYears: number, year: number): number {
    const rates = this.MACRS_TABLE[propertyClassYears];
    if (!rates) throw new Error(`Unsupported MACRS property class: ${propertyClassYears}`);
    if (year < 1 || year > rates.length) return 0; // Asset fully depreciated

    const rate = rates[year - 1] / 100;
    return Math.round(costBasis * rate);
  }
}
