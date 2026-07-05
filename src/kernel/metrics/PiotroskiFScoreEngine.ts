export class PiotroskiFScoreEngine {
  /**
   * Calculates Piotroski F-Score (0-9) based on 9 criteria.
   * Returns score.
   */
  static calculateFScore(
    netIncome: number,
    operatingCashFlow: number,
    roaCurrent: number,
    roaPrevious: number,
    longTermDebtCurrent: number,
    longTermDebtPrevious: number,
    currentRatioCurrent: number,
    currentRatioPrevious: number,
    sharesCurrent: number,
    sharesPrevious: number,
    grossMarginCurrent: number,
    grossMarginPrevious: number,
    assetTurnoverCurrent: number,
    assetTurnoverPrevious: number
  ): number {
    let score = 0;

    // Profitability
    if (netIncome > 0) score++;
    if (operatingCashFlow > 0) score++;
    if (roaCurrent > roaPrevious) score++;
    if (operatingCashFlow > netIncome) score++;

    // Leverage, Liquidity, and Source of Funds
    if (longTermDebtCurrent < longTermDebtPrevious) score++;
    if (currentRatioCurrent > currentRatioPrevious) score++;
    if (sharesCurrent <= sharesPrevious) score++;

    // Operating Efficiency
    if (grossMarginCurrent > grossMarginPrevious) score++;
    if (assetTurnoverCurrent > assetTurnoverPrevious) score++;

    return score;
  }
}
