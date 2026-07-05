export class DepreciationEngine {
  /**
   * Calculates Straight Line depreciation for a given period.
   */
  static calculateStraightLine(cost: number, salvageValue: number, usefulLifePeriods: number): number {
    if (usefulLifePeriods <= 0) return 0;
    return (cost - salvageValue) / usefulLifePeriods;
  }

  /**
   * Calculates Double Declining Balance for a given period.
   */
  static calculateDDB(bookValue: number, usefulLifePeriods: number): number {
    if (usefulLifePeriods <= 0) return 0;
    const straightLineRate = 1 / usefulLifePeriods;
    const ddbRate = straightLineRate * 2;
    return bookValue * ddbRate;
  }

  /**
   * Calculates Sum-of-the-Years'-Digits depreciation for a specific period.
   */
  static calculateSumOfYearsDigits(cost: number, salvageValue: number, usefulLifePeriods: number, period: number): number {
    if (usefulLifePeriods <= 0 || period <= 0 || period > usefulLifePeriods) return 0;
    const sumOfDigits = (usefulLifePeriods * (usefulLifePeriods + 1)) / 2;
    const remainingLife = usefulLifePeriods - period + 1;
    return (cost - salvageValue) * (remainingLife / sumOfDigits);
  }

  /**
   * Calculates optimal depreciation for a period, automatically switching from
   * DDB to Straight Line when SL produces a larger deduction.
   */
  static calculateOptimalDepreciation(
    cost: number,
    salvageValue: number,
    bookValue: number,
    remainingPeriods: number
  ): number {
    if (remainingPeriods <= 0) return 0;
    if (bookValue <= salvageValue) return 0;

    const slAmount = this.calculateStraightLine(bookValue, salvageValue, remainingPeriods);
    const ddbAmount = this.calculateDDB(bookValue, remainingPeriods);

    // DDB -> crossover check -> Straight Line
    const depreciationExpense = Math.max(slAmount, ddbAmount);

    // Prevent depreciating below salvage value
    if (bookValue - depreciationExpense < salvageValue) {
      return bookValue - salvageValue;
    }

    return depreciationExpense;
  }
}
