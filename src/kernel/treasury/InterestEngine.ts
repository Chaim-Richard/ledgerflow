export class InterestEngine {
  /**
   * Calculates simple interest.
   */
  static calculateSimpleInterest(principalCents: number, annualRate: number, days: number): number {
    return Math.round(principalCents * annualRate * (days / 365));
  }

  /**
   * Calculates compound interest.
   */
  static calculateCompoundInterest(principalCents: number, annualRate: number, compoundingPeriodsPerYear: number, years: number): number {
    const ratePerPeriod = annualRate / compoundingPeriodsPerYear;
    const totalPeriods = compoundingPeriodsPerYear * years;
    const amount = principalCents * Math.pow(1 + ratePerPeriod, totalPeriods);
    return Math.round(amount - principalCents);
  }

  /**
   * Calculates continuous compound interest (PERT).
   */
  static calculateContinuousCompound(principalCents: number, annualRate: number, years: number): number {
    const amount = principalCents * Math.exp(annualRate * years);
    return Math.round(amount - principalCents);
  }
}
