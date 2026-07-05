export class OvertimeEngine {
  /**
   * Calculates overtime pay based on time-and-a-half over standard hours (e.g. 40).
   */
  static calculateOvertimePay(hoursWorked: number, hourlyRateCents: number, standardHours: number = 40): number {
    if (hoursWorked <= standardHours) return 0;
    const overtimeHours = hoursWorked - standardHours;
    return Math.round(overtimeHours * hourlyRateCents * 1.5);
  }

  /**
   * Calculates total pay including overtime.
   */
  static calculateTotalPay(hoursWorked: number, hourlyRateCents: number, standardHours: number = 40): number {
    const regularHours = Math.min(hoursWorked, standardHours);
    const regularPay = regularHours * hourlyRateCents;
    const overtimePay = this.calculateOvertimePay(hoursWorked, hourlyRateCents, standardHours);
    return regularPay + overtimePay;
  }
}
