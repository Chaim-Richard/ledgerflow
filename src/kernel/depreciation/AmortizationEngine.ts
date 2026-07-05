export class AmortizationEngine {
  /**
   * Calculates straight-line amortization for an intangible asset.
   */
  static calculateStraightLineAmortization(principal: number, residualValue: number, usefulLifePeriods: number): number {
    if (usefulLifePeriods <= 0) return 0;
    return (principal - residualValue) / usefulLifePeriods;
  }

  /**
   * Calculates mortgage-style loan amortization payment (Principal + Interest).
   */
  static calculateLoanPayment(principal: number, annualInterestRate: number, totalPeriods: number, periodsPerYear: number = 12): number {
    if (annualInterestRate === 0) return principal / totalPeriods;
    const periodRate = annualInterestRate / periodsPerYear;
    return (principal * periodRate) / (1 - Math.pow(1 + periodRate, -totalPeriods));
  }
}
