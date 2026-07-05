export class PresentValueEngine {
  /**
   * Calculates Net Present Value (NPV) of a series of cash flows.
   */
  static calculateNPV(discountRate: number, cashFlows: number[]): number {
    return cashFlows.reduce((npv, flow, t) => {
      return npv + (flow / Math.pow(1 + discountRate, t));
    }, 0);
  }

  /**
   * Calculates Internal Rate of Return (IRR) using the Newton-Raphson method.
   */
  static calculateIRR(cashFlows: number[], guess: number = 0.1, maxIterations: number = 100): number {
    let rate = guess;
    
    for (let i = 0; i < maxIterations; i++) {
      let npv = 0;
      let dNpv = 0; // Derivative of NPV
      
      for (let t = 0; t < cashFlows.length; t++) {
        npv += cashFlows[t] / Math.pow(1 + rate, t);
        if (t > 0) {
          dNpv -= (t * cashFlows[t]) / Math.pow(1 + rate, t + 1);
        }
      }
      
      if (Math.abs(npv) < 0.0001) {
        return rate;
      }
      
      rate = rate - (npv / dNpv);
    }
    
    throw new Error('IRR did not converge');
  }
}
