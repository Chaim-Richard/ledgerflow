export class DsoEngine {
  /**
   * Calculates Days Sales Outstanding (DSO) = (Accounts Receivable / Total Credit Sales) * Number of Days
   */
  static calculateDSO(accountsReceivableCents: number, totalCreditSalesCents: number, daysInPeriod: number): number {
    if (totalCreditSalesCents === 0) return 0;
    return (accountsReceivableCents / totalCreditSalesCents) * daysInPeriod;
  }
  
  /**
   * Calculates Days Payable Outstanding (DPO) = (Accounts Payable / COGS) * Number of Days
   */
  static calculateDPO(accountsPayableCents: number, cogsCents: number, daysInPeriod: number): number {
    if (cogsCents === 0) return 0;
    return (accountsPayableCents / cogsCents) * daysInPeriod;
  }

  /**
   * Calculates Days Inventory Outstanding (DIO) = (Average Inventory / COGS) * Number of Days
   */
  static calculateDIO(averageInventoryCents: number, cogsCents: number, daysInPeriod: number): number {
     if (cogsCents === 0) return 0;
     return (averageInventoryCents / cogsCents) * daysInPeriod;
  }
  
  /**
   * Calculates the Cash Conversion Cycle (CCC) = DIO + DSO - DPO
   */
  static calculateCashConversionCycle(dio: number, dso: number, dpo: number): number {
    return dio + dso - dpo;
  }
}
