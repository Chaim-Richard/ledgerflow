
export class AuditRuleEngine {
  /**
   * Checks if a transaction violates the segregation of duties principle.
   * e.g., the person who created the bill also approved the payment.
   */
  static checkSegregationOfDuties(creatorId: string, approverId: string): boolean {
    return creatorId === approverId;
  }

  /**
   * Flags transactions made outside of regular business hours (potential fraud indicator).
   */
  static checkOffHoursActivity(txDateString: string, startHour: number = 6, endHour: number = 20): boolean {
    const date = new Date(txDateString);
    const hour = date.getUTCHours();
    return hour < startHour || hour > endHour;
  }

  /**
   * Flags transactions with round numbers over a threshold (e.g., $10,000.00).
   */
  static checkSuspiciousRoundNumbers(amountCents: number, thresholdCents: number = 500000): boolean {
    if (amountCents < thresholdCents) return false;
    return amountCents % 10000 === 0; // Exactly divisible by $100.00
  }
}
