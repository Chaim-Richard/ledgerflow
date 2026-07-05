import { RootOptimizer } from "../lib/algorithms.ts";

export interface SimulationParams {
  data: number[];
  horizon?: number;
  trials?: number;
}

export interface SimulationResult {
  mean: number;
  trajectory?: { day: number; expected: number; low: number; high: number }[];
  confidenceInterval: { low: number; high: number };
  horizon: number;
  trials: number;
  seasonality: any[];
  var95: number;
  drift: number;
  sigma: number;
  serverTimeMs: number;
}

export class CortexService {
  /**
   * High-Performance Neural Simulation
   * Combines Fourier-detected seasonality with Geometric Brownian Motion
   */
  static async runLiquiditySimulation(params: SimulationParams): Promise<SimulationResult> {
    const startTime = Date.now();
    const { data, horizon = 90, trials = 1000 } = params;

    // 1. Detect Seasonality via Fourier Transform (Algorithm Layer)
    const seasonality = RootOptimizer.detectFourierSeasonality(data);
    
    // 2. Calculate Value at Risk (VaR) for historical volatility
    const returns = [];
    for(let i=1; i<data.length; i++) {
      const r = (data[i] - data[i-1]) / (data[i-1] || 1);
      if(!isNaN(r) && isFinite(r)) returns.push(r);
    }
    
    const var95 = RootOptimizer.calculateVaR(returns, 0.95, 30); // 30-day VaR

    // 3. Monte Carlo Simulation with Fourier Cycles and Geometric Brownian Motion
    const results = [];
    const primaryPeriod = seasonality[0]?.period || 30; 
    const amplitude = Math.min(0.2, seasonality[0]?.amplitude || 0.05);
    
    const drift = returns.reduce((a, b) => a + b, 0) / (returns.length || 1);
    const variance = returns.reduce((a, b) => a + Math.pow(b - drift, 2), 0) / (returns.length || 1);
    const sigma = Math.sqrt(variance);

    // Speed optimization: Use a faster normal distribution approximation
    const normalRandom = () => {
      let u = 0, v = 0;
      while(u === 0) u = Math.random(); 
      while(v === 0) v = Math.random();
      return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
    };

    const trialPaths: number[][] = Array(trials).fill(0).map(() => new Array(horizon));

    for (let trial = 0; trial < trials; trial++) {
      let lastVal = data[data.length - 1] || 1;
      for (let i = 0; i < horizon; i++) {
         const seasonalityFactor = 1 + amplitude * Math.sin(2 * Math.PI * (i / primaryPeriod));
         const epsilon = normalRandom();
         const growth = Math.exp((drift - 0.5 * variance) + sigma * epsilon);
         lastVal = lastVal * growth * seasonalityFactor;
         if (lastVal < 0) lastVal = 1e-6;
         if (lastVal > 1e15) lastVal = 1e15; 
         trialPaths[trial][i] = lastVal;
      }
      results.push(lastVal);
    }

    // Calculate daily bounds for the trajectory
    const trajectory = [];
    for (let i = 0; i < horizon; i++) {
        const dayValues = trialPaths.map(path => path[i]).sort((a,b) => a-b);
        trajectory.push({
            day: i + 1,
            expected: dayValues.reduce((sum, val) => sum + val, 0) / trials,
            low: dayValues[Math.floor(trials * 0.05)],
            high: dayValues[Math.floor(trials * 0.95)]
        });
    }

    const mean = results.reduce((a, b) => a + b, 0) / trials;
    const sortedResults = results.filter(v => !isNaN(v)).sort((a,b) => a-b);
    
    return {
      mean,
      trajectory,
      confidenceInterval: {
        low: sortedResults[Math.floor(sortedResults.length * 0.05)] || 0,
        high: sortedResults[Math.floor(sortedResults.length * 0.95)] || 0
      },
      horizon,
      trials,
      seasonality: seasonality.slice(0, 3),
      var95,
      drift,
      sigma,
      serverTimeMs: Date.now() - startTime
    };
  }
}
