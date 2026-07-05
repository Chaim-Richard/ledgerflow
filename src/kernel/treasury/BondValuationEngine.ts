export class BondValuationEngine {
  /**
   * Calculates the Present Value of a Bond (Price).
   */
  static calculateBondPrice(faceValue: number, couponRate: number, marketDiscountRate: number, yearsToMaturity: number, paymentsPerYear: number = 2): number {
    const periodRate = marketDiscountRate / paymentsPerYear;
    const totalPeriods = yearsToMaturity * paymentsPerYear;
    const couponPayment = (faceValue * couponRate) / paymentsPerYear;

    let presentValueCoupons = 0;
    if (periodRate !== 0) {
      presentValueCoupons = couponPayment * ((1 - Math.pow(1 + periodRate, -totalPeriods)) / periodRate);
    } else {
      presentValueCoupons = couponPayment * totalPeriods;
    }

    const presentValueFace = faceValue / Math.pow(1 + periodRate, totalPeriods);

    return presentValueCoupons + presentValueFace;
  }
}
