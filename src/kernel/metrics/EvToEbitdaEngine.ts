export class EvToEbitdaEngine {
  /**
   * Calculates the EV/EBITDA multiple.
   */
  static calculateEvToEbitda(enterpriseValue: number, ebitda: number): number {
    if (ebitda === 0) return Infinity;
    return enterpriseValue / ebitda;
  }
}
