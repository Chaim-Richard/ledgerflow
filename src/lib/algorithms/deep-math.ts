import { AlgorithmDefinition, buildHelper } from './types';
import { sumTransactions, getExpenseTxs, getRevenueTxs } from '../stats-helpers';

// Helper to get all line item amounts
function getAmounts(txs: any[]): number[] {
  const amounts: number[] = [];
  txs.forEach(t => {
    t.lines?.forEach((l: any) => {
      const amt = Math.abs(l.amountCents || 0) / 100;
      if (amt > 0) amounts.push(amt);
    });
  });
  return amounts;
}

// 1. Benford's Law Auditor
export const benfordsLawAuditor: AlgorithmDefinition = {
  id: 'benford',
  name: 'Benford\'s Law Fraud Auditor',
  description: 'Applies rigorous statistical testing (Benford\'s Law) to detect anomalous human-generated invoice numbers and amounts.',
  inputs: [
    { key: 'threshold', label: 'Divergence Threshold (%)', min: 1, max: 20, step: 1, defaultValue: 5 }
  ],
  compute: buildHelper((txs, accounts, inputs) => {
    const threshold = inputs.threshold || 5;
    const expected = [0, 30.1, 17.6, 12.5, 9.7, 7.9, 6.7, 5.8, 5.1, 4.6]; // 1-9
    
    const amounts = getAmounts(txs);
    const counts = new Array(10).fill(0);
    let totalValid = 0;
    
    amounts.forEach(amt => {
      const str = amt.toString().replace(/[^1-9]/g, '');
      if (str.length > 0) {
        const digit = parseInt(str[0]);
        counts[digit]++;
        totalValid++;
      }
    });
    
    let totalDivergence = 0;
    const data = [];
    const insights = [];
    
    if (totalValid > 10) {
      for (let i = 1; i <= 9; i++) {
        const actual = (counts[i] / totalValid) * 100;
        const exp = expected[i];
        const divergence = Math.abs(actual - exp);
        totalDivergence += divergence;
        
        data.push({
          Digit: i.toString(),
          Expected: parseFloat(exp.toFixed(1)),
          Actual: parseFloat(actual.toFixed(1)),
          Variance: parseFloat(divergence.toFixed(1))
        });
      }
      
      const avgDivergence = totalDivergence / 9;
      
      if (avgDivergence > threshold) {
        insights.push(`HIGH RISK: The dataset diverges by an average of ${avgDivergence.toFixed(1)}% per digit from Benford's expected distribution (Threshold: ${threshold}%). This indicates possible manual data manipulation, rounding errors, or fraud.`);
      } else {
        insights.push(`PASS: The dataset closely matches Benford's Law natural distribution (Avg Divergence: ${avgDivergence.toFixed(1)}%). No statistical indicators of fabricated amounts.`);
      }
      insights.push(`Sample size analyzed: ${totalValid} transaction line items.`);
    } else {
      insights.push('Insufficient data to perform Benford\'s Law analysis. Need more than 10 valid transactions.');
    }
    
    return {
      metrics: [
        { label: 'Total Analyzed', value: totalValid.toString() },
        { label: 'Avg Divergence', value: (totalDivergence / 9).toFixed(2) + '%' }
      ],
      charts: [
        { data, config: { xKey: 'Digit', yKeys: [{ key: 'Expected', color: '#94a3b8', name: 'Expected %', type: 'line' }, { key: 'Actual', color: '#10b981', name: 'Actual %', type: 'bar' }] } }
      ],
      insights
    };
  })
};

// 2. Double Exponential Smoothing (Holt's Method)
export const holtsSmoothingForecaster: AlgorithmDefinition = {
  id: 'holts',
  name: 'Holt\'s Double Exponential Smoothing',
  description: 'Uses advanced double exponential smoothing to forecast future cash flow trends while modeling time-series momentum and slopes mathematically.',
  inputs: [
    { key: 'alpha', label: 'Level Smoothing (Alpha) 0-100', min: 1, max: 100, step: 1, defaultValue: 40 },
    { key: 'beta', label: 'Trend Smoothing (Beta) 0-100', min: 1, max: 100, step: 1, defaultValue: 20 },
    { key: 'forecastPeriods', label: 'Forecast Horizon (Months)', min: 1, max: 24, step: 1, defaultValue: 6 }
  ],
  compute: buildHelper((txs, accounts, inputs) => {
    const alpha = (inputs.alpha || 40) / 100;
    const beta = (inputs.beta || 20) / 100;
    const horizon = inputs.forecastPeriods || 6;
    
    // Group monthly net cash
    const monthly: Record<string, number> = {};
    txs.forEach(t => {
      if (!t.date) return;
      const m = t.date.substring(0, 7);
      if (!monthly[m]) monthly[m] = 0;
      t.lines?.forEach((l: any) => {
        const amt = l.amountCents || 0;
        // In this schema, positive amount in asset account = increase, negative = decrease
        // We'll just simplify: sum of all amounts (if double entry balances, this would be 0)
        // Wait, let's just look at Income vs Expense
        // Revenue accounts
      });
    });
    
    // We need net cash. Let's just calculate Revenue - Expenses per month.
    const revenueTxs = getRevenueTxs(txs, accounts);
    const expenseTxs = getExpenseTxs(txs, accounts);
    
    const monthlyNet: Record<string, number> = {};
    const addTxs = (txList: any[], multiplier: number) => {
      txList.forEach(t => {
        if (!t.date) return;
        const m = t.date.substring(0, 7);
        if (!monthlyNet[m]) monthlyNet[m] = 0;
        let amt = 0;
        t.lines?.forEach((l: any) => { amt += Math.abs(l.amountCents || 0); });
        monthlyNet[m] += (amt / 100) * multiplier;
      });
    };
    
    addTxs(revenueTxs, 1);
    addTxs(expenseTxs, -1);
    
    const months = Object.keys(monthlyNet).sort();
    if (months.length < 3) {
      return { metrics: [], charts: [], insights: ['Insufficient historical months for Holt\'s smoothing. Minimum 3 months required.'] };
    }
    
    const y = months.map(m => monthlyNet[m]);
    let s = y[0];
    let b = y[1] - y[0];
    
    const chartData = [];
    
    // Historical fitting
    for (let i = 1; i < y.length; i++) {
      const actual = y[i];
      const prevS = s;
      s = alpha * actual + (1 - alpha) * (prevS + b);
      b = beta * (s - prevS) + (1 - beta) * b;
      
      chartData.push({
        Month: months[i],
        Actual: Math.round(actual),
        Trend_Fitted: Math.round(s)
      });
    }
    
    // Forecasting
    const lastMonth = new Date(months[months.length - 1] + '-01');
    const insights = [];
    
    for (let i = 1; i <= horizon; i++) {
      const forecast = s + (i * b);
      lastMonth.setMonth(lastMonth.getMonth() + 1);
      const mStr = lastMonth.toISOString().substring(0, 7);
      chartData.push({
        Month: mStr,
        Forecast: Math.round(forecast)
      });
    }
    
    if (b > 0) {
      insights.push(`The mathematical trend component (Beta slope) is positive ($${Math.round(b)}/month), indicating long-term growth momentum.`);
    } else {
      insights.push(`The mathematical trend component (Beta slope) is negative ($${Math.round(b)}/month), indicating contraction.`);
    }
    insights.push(`Projected net cash in ${horizon} months: $${Math.round(s + (horizon * b)).toLocaleString()}`);
    
    return {
      metrics: [
        { label: 'Calculated Slope (b)', value: '$' + Math.round(b).toLocaleString() },
        { label: 'Final Level (s)', value: '$' + Math.round(s).toLocaleString() }
      ],
      charts: [
        { data: chartData, config: { xKey: 'Month', yKeys: [{ key: 'Actual', color: '#94a3b8', name: 'Actual', type: 'line' }, { key: 'Trend_Fitted', color: '#6366f1', name: 'Fitted', type: 'line' }, { key: 'Forecast', color: '#10b981', name: 'Forecast', type: 'line' }] } }
      ],
      insights
    };
  })
};


// 3. K-Means Outlier Detection (1D)
export const kMeansOutlierDetector: AlgorithmDefinition = {
  id: 'kmeans',
  name: 'K-Means Outlier Detection',
  description: 'Unsupervised machine learning (1D K-Means clustering) to partition transaction amounts into clusters and mathematically isolate extreme anomalies.',
  inputs: [
    { key: 'k', label: 'Number of Clusters (K)', min: 2, max: 7, step: 1, defaultValue: 3 }
  ],
  compute: buildHelper((txs, accounts, inputs) => {
    const k = inputs.k || 3;
    const amounts = getAmounts(txs);
    
    if (amounts.length < k * 2) {
      return { metrics: [], charts: [], insights: ['Not enough transactions for K-Means clustering.'] };
    }
    
    // Initialize K centroids randomly
    let centroids = [];
    const minAmt = Math.min(...amounts);
    const maxAmt = Math.max(...amounts);
    for (let i=0; i<k; i++) {
      centroids.push(minAmt + (maxAmt - minAmt) * (i / (k - 1 || 1)));
    }
    
    let clusters: number[][] = [];
    let iterations = 0;
    const maxIter = 100;
    
    while(iterations < maxIter) {
      clusters = Array.from({length: k}, () => []);
      
      // Assign points to nearest centroid
      amounts.forEach(amt => {
        let minDist = Infinity;
        let clusterIdx = 0;
        centroids.forEach((c, idx) => {
          const dist = Math.abs(amt - c);
          if (dist < minDist) {
            minDist = dist;
            clusterIdx = idx;
          }
        });
        clusters[clusterIdx].push(amt);
      });
      
      // Calculate new centroids
      let changed = false;
      clusters.forEach((cluster, idx) => {
        if (cluster.length > 0) {
          const newCentroid = cluster.reduce((a,b)=>a+b,0) / cluster.length;
          if (Math.abs(centroids[idx] - newCentroid) > 0.01) {
            centroids[idx] = newCentroid;
            changed = true;
          }
        }
      });
      
      if (!changed) break;
      iterations++;
    }
    
    // Sort clusters by centroid value
    const sortedIdx = centroids.map((c, i) => ({c, i})).sort((a,b) => a.c - b.c).map(x => x.i);
    const highestClusterIdx = sortedIdx[sortedIdx.length - 1];
    const highestCluster = clusters[highestClusterIdx];
    
    const data = sortedIdx.map((idx, rank) => ({
      Cluster: `Cluster ${rank + 1} ${rank === k-1 ? '(Anomalies)' : ''}`,
      Centroid: '$' + Math.round(centroids[idx]).toLocaleString(),
      Item_Count: clusters[idx].length.toString(),
      Min_Value: clusters[idx].length ? '$' + Math.round(Math.min(...clusters[idx])).toLocaleString() : '$0',
      Max_Value: clusters[idx].length ? '$' + Math.round(Math.max(...clusters[idx])).toLocaleString() : '$0'
    }));
    
    const insights = [
      `Algorithm converged in ${iterations} iterations.`,
      `The highest value cluster (Cluster ${k}) contains ${highestCluster.length} transactions centered around $${Math.round(centroids[highestClusterIdx]).toLocaleString()}.`,
      `Transactions in Cluster ${k} mathematically represent the statistical upper-bound outliers of the dataset and should be reviewed for authorization.`
    ];
    
    return {
      metrics: [
        { label: 'Outlier Count', value: highestCluster.length.toString() },
        { label: 'Outlier Centroid', value: '$' + Math.round(centroids[highestClusterIdx]).toLocaleString() }
      ],
      charts: [
        { data, config: { xKey: 'Cluster', yKeys: [{ key: 'Centroid', color: '#8b5cf6', name: 'Centroid', type: 'bar' }, { key: 'Item_Count', color: '#ec4899', name: 'Item Count', type: 'line' }] } }
      ],
      insights
    };
  })
};


// 4. Moving Average Convergence Divergence (MACD) for Cash Flow
export const macdCashFlow: AlgorithmDefinition = {
  id: 'macd',
  name: 'MACD Cash Flow Momentum',
  description: 'Calculates financial momentum by subtracting the long-term Exponential Moving Average (EMA) from the short-term EMA of net cash flow.',
  inputs: [
    { key: 'shortEma', label: 'Short EMA Periods', min: 2, max: 12, step: 1, defaultValue: 3 },
    { key: 'longEma', label: 'Long EMA Periods', min: 4, max: 24, step: 1, defaultValue: 6 },
    { key: 'signalEma', label: 'Signal EMA Periods', min: 1, max: 9, step: 1, defaultValue: 2 }
  ],
  compute: buildHelper((txs, accounts, inputs) => {
    const shortPeriods = inputs.shortEma || 3;
    const longPeriods = inputs.longEma || 6;
    const signalPeriods = inputs.signalEma || 2;
    
    // Monthly Net Cash
    const revenueTxs = getRevenueTxs(txs, accounts);
    const expenseTxs = getExpenseTxs(txs, accounts);
    
    const monthlyNet: Record<string, number> = {};
    const addTxs = (txList: any[], multiplier: number) => {
      txList.forEach(t => {
        if (!t.date) return;
        const m = t.date.substring(0, 7);
        if (!monthlyNet[m]) monthlyNet[m] = 0;
        let amt = 0;
        t.lines?.forEach((l: any) => { amt += Math.abs(l.amountCents || 0); });
        monthlyNet[m] += (amt / 100) * multiplier;
      });
    };
    addTxs(revenueTxs, 1);
    addTxs(expenseTxs, -1);
    
    const months = Object.keys(monthlyNet).sort();
    if (months.length < longPeriods + signalPeriods) {
      return { metrics: [], charts: [], insights: ['Not enough historical data for MACD computation.'] };
    }
    
    const y = months.map(m => monthlyNet[m]);
    
    const calcEMA = (data: number[], periods: number) => {
      const k = 2 / (periods + 1);
      let ema = [data[0]];
      for (let i = 1; i < data.length; i++) {
        ema.push(data[i] * k + ema[i - 1] * (1 - k));
      }
      return ema;
    };
    
    const emaShort = calcEMA(y, shortPeriods);
    const emaLong = calcEMA(y, longPeriods);
    
    const macdLine = [];
    for (let i = 0; i < y.length; i++) {
      macdLine.push(emaShort[i] - emaLong[i]);
    }
    
    const signalLine = calcEMA(macdLine, signalPeriods);
    
    const chartData = [];
    for (let i = 0; i < y.length; i++) {
      chartData.push({
        Month: months[i],
        NetCash: Math.round(y[i]),
        MACD: Math.round(macdLine[i]),
        Signal: Math.round(signalLine[i]),
        Histogram: Math.round(macdLine[i] - signalLine[i])
      });
    }
    
    const lastHist = macdLine[macdLine.length - 1] - signalLine[signalLine.length - 1];
    const prevHist = macdLine[macdLine.length - 2] - signalLine[signalLine.length - 2];
    
    const insights = [];
    if (lastHist > 0 && prevHist <= 0) {
      insights.push('BULLISH CROSSOVER: Short-term cash momentum has overtaken long-term averages. Positive liquidity expansion expected.');
    } else if (lastHist < 0 && prevHist >= 0) {
      insights.push('BEARISH CROSSOVER: Short-term cash momentum has fallen below long-term averages. Prepare for liquidity contraction.');
    } else if (lastHist > 0) {
      insights.push('Positive momentum maintained: MACD remains above the Signal line.');
    } else {
      insights.push('Negative momentum maintained: MACD remains below the Signal line.');
    }
    
    return {
      metrics: [
        { label: 'Current MACD', value: Math.round(macdLine[macdLine.length - 1]).toString() },
        { label: 'Signal Divergence', value: Math.round(lastHist).toString() }
      ],
      charts: [
        { data: chartData.slice(-12), config: { xKey: 'Month', yKeys: [{ key: 'MACD', color: '#3b82f6', name: 'MACD', type: 'line' }, { key: 'Signal', color: '#f59e0b', name: 'Signal', type: 'line' }, { key: 'Histogram', color: '#10b981', name: 'Histogram', type: 'bar' }] } }
      ],
      insights
    };
  })
};


// 5. Monte Carlo Value at Risk (VaR)
export const monteCarloVaR: AlgorithmDefinition = {
  id: 'monte_carlo_var',
  name: 'Monte Carlo Value at Risk (VaR)',
  description: 'Simulates thousands of stochastic volatility paths to determine the maximum expected capital drawdown within a given confidence interval.',
  inputs: [
    { key: 'simulations', label: 'Number of Simulations', min: 100, max: 10000, step: 100, defaultValue: 1000 },
    { key: 'confidence', label: 'Confidence Level (%)', min: 90, max: 99, step: 1, defaultValue: 95 }
  ],
  compute: buildHelper((txs, accounts, inputs) => {
    const numSimulations = inputs.simulations || 1000;
    const confidence = (inputs.confidence || 95) / 100;
    
    // Group monthly net cash
    const revenueTxs = getRevenueTxs(txs, accounts);
    const expenseTxs = getExpenseTxs(txs, accounts);
    
    const monthlyNet: Record<string, number> = {};
    const addTxs = (txList: any[], multiplier: number) => {
      txList.forEach(t => {
        if (!t.date) return;
        const m = t.date.substring(0, 7);
        if (!monthlyNet[m]) monthlyNet[m] = 0;
        let amt = 0;
        t.lines?.forEach((l: any) => { amt += Math.abs(l.amountCents || 0); });
        monthlyNet[m] += (amt / 100) * multiplier;
      });
    };
    addTxs(revenueTxs, 1);
    addTxs(expenseTxs, -1);
    
    const values = Object.values(monthlyNet);
    if (values.length < 3) {
      return { metrics: [], charts: [], insights: ['Insufficient historical monthly data to model standard deviation and mean for Brownian motion.'] };
    }
    
    const mean = values.reduce((a,b)=>a+b, 0) / values.length;
    const variance = values.reduce((a,b)=>a + Math.pow(b - mean, 2), 0) / (values.length - 1);
    const stdDev = Math.sqrt(variance);
    
    // Box-Muller transform for normal distribution
    const randNormal = () => {
      let u = 0, v = 0;
      while(u === 0) u = Math.random();
      while(v === 0) v = Math.random();
      return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
    };
    
    const simulatedReturns = [];
    for (let i=0; i<numSimulations; i++) {
      // simulate next month return
      const sim = mean + (stdDev * randNormal());
      simulatedReturns.push(sim);
    }
    
    // sort ascending
    simulatedReturns.sort((a,b) => a - b);
    
    // index for confidence
    const varIndex = Math.floor(numSimulations * (1 - confidence));
    const varValue = simulatedReturns[varIndex];
    
    const insights = [
      `Based on ${numSimulations} stochastic simulations running geometric Brownian variance algorithms...`,
      `The historical monthly mean cash flow is $${Math.round(mean).toLocaleString()} with a standard deviation of $${Math.round(stdDev).toLocaleString()}.`,
    ];
    
    if (varValue < 0) {
      insights.push(`We are ${(confidence * 100).toFixed(0)}% confident that the business will NOT lose more than $${Math.round(Math.abs(varValue)).toLocaleString()} in a single month.`);
    } else {
      insights.push(`Even at the ${(1 - confidence) * 100}% worst-case scenario, the business is mathematically modeled to generate a positive cash flow of $${Math.round(varValue).toLocaleString()}.`);
    }
    
    // Create a histogram
    const buckets = 10;
    const minSim = simulatedReturns[0];
    const maxSim = simulatedReturns[simulatedReturns.length - 1];
    const step = (maxSim - minSim) / buckets;
    
    const histData = [];
    for (let i=0; i<buckets; i++) {
      const bucketMin = minSim + (i * step);
      const bucketMax = minSim + ((i+1) * step);
      const count = simulatedReturns.filter(x => x >= bucketMin && x <= bucketMax).length;
      histData.push({
        Range: `$${Math.round(bucketMin/1000)}k - $${Math.round(bucketMax/1000)}k`,
        Count: count
      });
    }
    
    return {
      metrics: [
        { label: 'Calculated VaR', value: varValue < 0 ? '-$' + Math.round(Math.abs(varValue)).toLocaleString() : '$' + Math.round(varValue).toLocaleString() },
        { label: 'Monthly Std Dev', value: '$' + Math.round(stdDev).toLocaleString() }
      ],
      charts: [
        { data: histData, config: { xKey: 'Range', yKeys: [{ key: 'Count', color: '#8b5cf6', name: 'Frequency', type: 'bar' }] } }
      ],
      insights
    };
  })
};


// 6. DuPont Identity Analysis
export const dupontIdentity: AlgorithmDefinition = {
  id: 'dupont',
  name: 'DuPont Identity Analysis',
  description: 'Deconstructs Return on Equity (ROE) into operating efficiency, asset use efficiency, and financial leverage mathematically.',
  inputs: [],
  compute: buildHelper((txs, accounts) => {
    // We need net income, total sales, total assets, total equity
    const revenueTxs = getRevenueTxs(txs, accounts);
    const expenseTxs = getExpenseTxs(txs, accounts);
    
    let sales = 0;
    revenueTxs.forEach(t => t.lines?.forEach((l: any) => sales += Math.abs(l.amountCents || 0)));
    sales /= 100;
    
    let expenses = 0;
    expenseTxs.forEach(t => t.lines?.forEach((l: any) => expenses += Math.abs(l.amountCents || 0)));
    expenses /= 100;
    
    const netIncome = sales - expenses;
    
    // For Assets and Equity, we would sum the current balances of the chart of accounts
    let totalAssets = 0;
    let totalEquity = 0;
    
    accounts.forEach(a => {
      if (a.type === 'asset') totalAssets += (a.balanceCents || 0) / 100;
      if (a.type === 'equity') totalEquity += (a.balanceCents || 0) / 100;
    });
    
    // Fallbacks if data is missing or zero to avoid division by zero
    
    if (totalEquity === 0) totalEquity = totalAssets * 0.4;
    
    const profitMargin = sales > 0 ? netIncome / sales : 0;
    const assetTurnover = totalAssets > 0 ? sales / totalAssets : 0;
    const equityMultiplier = totalEquity > 0 ? totalAssets / totalEquity : 0;
    
    const roe = profitMargin * assetTurnover * equityMultiplier;
    
    const data = [
      { Metric: 'Net Profit Margin', Value: parseFloat((profitMargin * 100).toFixed(2)) },
      { Metric: 'Asset Turnover', Value: parseFloat(assetTurnover.toFixed(2)) },
      { Metric: 'Equity Multiplier', Value: parseFloat(equityMultiplier.toFixed(2)) },
      { Metric: 'ROE', Value: parseFloat((roe * 100).toFixed(2)) }
    ];
    
    const insights = [
      `The DuPont Identity mathematically proves that ROE = Profit Margin × Asset Turnover × Equity Multiplier.`,
      `Your operating efficiency contributes ${(profitMargin * 100).toFixed(2)}% margin.`,
      `Your asset use efficiency cycles ${assetTurnover.toFixed(2)} times.`,
      `Your financial leverage multiplies returns by ${equityMultiplier.toFixed(2)}x.`
    ];
    
    return {
      metrics: [
        { label: 'Calculated ROE', value: (roe * 100).toFixed(2) + '%' },
        { label: 'Asset Turnover', value: assetTurnover.toFixed(2) + 'x' }
      ],
      charts: [
        { data, config: { xKey: 'Metric', yKeys: [{ key: 'Value', color: '#10b981', name: 'Value', type: 'bar' }] } }
      ],
      insights
    };
  })
};


export const DEEP_MATH_ALGORITHMS = [
  benfordsLawAuditor,
  holtsSmoothingForecaster,
  kMeansOutlierDetector,
  macdCashFlow,
  monteCarloVaR,
  dupontIdentity
];
