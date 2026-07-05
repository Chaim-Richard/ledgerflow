export class TrendEngine {
  /**
   * Calculates simple moving average (SMA) over a given period.
   */
  static calculateSMA(dataPoints: number[], period: number): number[] {
    if (period <= 0 || dataPoints.length < period) return [];
    
    const sma: number[] = [];
    for (let i = 0; i <= dataPoints.length - period; i++) {
      const window = dataPoints.slice(i, i + period);
      const sum = window.reduce((a, b) => a + b, 0);
      sma.push(sum / period);
    }
    return sma;
  }

  /**
   * Calculates exponential moving average (EMA).
   */
  static calculateEMA(dataPoints: number[], period: number): number[] {
    if (period <= 0 || dataPoints.length < period) return [];
    
    const ema: number[] = [];
    const multiplier = 2 / (period + 1);
    
    // Start with SMA for first EMA point
    const firstWindow = dataPoints.slice(0, period);
    let prevEMA = firstWindow.reduce((a, b) => a + b, 0) / period;
    ema.push(prevEMA);

    for (let i = period; i < dataPoints.length; i++) {
      const currentEMA = (dataPoints[i] - prevEMA) * multiplier + prevEMA;
      ema.push(currentEMA);
      prevEMA = currentEMA;
    }
    return ema;
  }
}
