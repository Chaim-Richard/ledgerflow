export class SeveranceEngine {
  /**
   * Calculates standard severance pay based on weeks per year of service.
   */
  static calculateSeverance(weeklySalaryCents: number, yearsOfService: number, weeksPerYear: number = 2): number {
    return Math.round(weeklySalaryCents * yearsOfService * weeksPerYear);
  }
}
