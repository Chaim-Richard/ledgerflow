export class ProrationEngine {
  /**
   * Prorates an annual expense for a specific number of days.
   */
  static prorateAnnual(annualAmountCents: number, daysActive: number, daysInYear: number = 365): number {
    return Math.round(annualAmountCents * (daysActive / daysInYear));
  }

  /**
   * Prorates a monthly expense based on active days in the month.
   */
  static prorateMonthly(monthlyAmountCents: number, daysActive: number, daysInMonth: number): number {
     return Math.round(monthlyAmountCents * (daysActive / daysInMonth));
  }
}
