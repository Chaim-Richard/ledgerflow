export class FactoringEngine {
  /**
   * Calculates the cost of factoring an invoice.
   */
  static calculateFactoringFee(invoiceAmountCents: number, discountRatePercentage: number, reservePercentage: number): { fee: number, advance: number, reserve: number } {
    const fee = Math.round(invoiceAmountCents * (discountRatePercentage / 100));
    const reserve = Math.round(invoiceAmountCents * (reservePercentage / 100));
    const advance = invoiceAmountCents - fee - reserve;
    
    return { fee, advance, reserve };
  }
}
