export class TcoEngine {
  /**
   * Calculates Total Cost of Ownership (TCO) over a useful life.
   * TCO = Initial Purchase Cost + (Annual Maintenance Cost * Useful Life) - Salvage Value
   */
  static calculateTCO(initialCost: number, annualMaintenanceCost: number, usefulLifeYears: number, salvageValue: number): number {
    return initialCost + (annualMaintenanceCost * usefulLifeYears) - salvageValue;
  }
}
