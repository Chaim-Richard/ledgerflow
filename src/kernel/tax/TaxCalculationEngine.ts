export class TaxCalculationEngine {
  /**
   * Calculates standard sales tax / VAT.
   */
  static calculateSalesTax(subtotalCents: number, taxRatePercentage: number): number {
    if (taxRatePercentage < 0) throw new Error("Tax rate cannot be negative");
    return Math.round(subtotalCents * (taxRatePercentage / 100));
  }

  /**
   * Back-calculates tax amount from a tax-inclusive total.
   */
  static extractTaxFromInclusiveTotal(totalCents: number, taxRatePercentage: number): { subtotal: number, taxAmount: number } {
    if (taxRatePercentage < 0) throw new Error("Tax rate cannot be negative");
    const rateFactor = 1 + (taxRatePercentage / 100);
    const subtotal = Math.round(totalCents / rateFactor);
    const taxAmount = totalCents - subtotal;
    return { subtotal, taxAmount };
  }
}
