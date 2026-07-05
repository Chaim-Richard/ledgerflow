export class CommissionEngine {
  /**
   * Calculates straight commission based on sales.
   */
  static calculateStraightCommission(salesAmountCents: number, commissionRate: number): number {
    return Math.round(salesAmountCents * commissionRate);
  }

  /**
   * Calculates commission against a draw. 
   * Returns the payout (the draw amount if commission < draw, or commission amount if commission > draw).
   * It also returns the balance to carry forward.
   */
  static calculateDrawAgainstCommission(commissionEarnedCents: number, drawAmountCents: number, previousDrawBalanceCents: number = 0): { payoutCents: number, carryForwardBalanceCents: number } {
    const totalDrawLiability = drawAmountCents + previousDrawBalanceCents;
    
    if (commissionEarnedCents > totalDrawLiability) {
      return {
        payoutCents: commissionEarnedCents,
        carryForwardBalanceCents: 0
      };
    } else {
      return {
        payoutCents: drawAmountCents, // Guaranteed minimum draw
        carryForwardBalanceCents: totalDrawLiability - commissionEarnedCents
      };
    }
  }
}
