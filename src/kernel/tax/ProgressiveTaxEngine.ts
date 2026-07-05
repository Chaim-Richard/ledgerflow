export class ProgressiveTaxEngine {
  /**
   * Calculates progressive income tax based on tax brackets.
   * Brackets must be sorted ascending by limit.
   * Last bracket can have a limit of Infinity.
   */
  static calculateProgressiveTax(taxableIncomeCents: number, brackets: { limitCents: number, rate: number }[]): number {
    let remainingIncome = taxableIncomeCents;
    let totalTax = 0;
    let previousLimit = 0;

    for (const bracket of brackets) {
      const taxableInBracket = Math.min(remainingIncome, bracket.limitCents - previousLimit);
      if (taxableInBracket <= 0) break;

      totalTax += taxableInBracket * bracket.rate;
      remainingIncome -= taxableInBracket;
      previousLimit = bracket.limitCents;
    }

    return Math.round(totalTax);
  }
}
