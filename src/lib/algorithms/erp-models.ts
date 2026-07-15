import { AlgorithmDefinition, buildHelper } from './types';
import { getRevenueTxs, getExpenseTxs } from '../stats-helpers';

// Helper to calculate normal CDF
function normalCDF(x: number) {
  let t = 1 / (1 + 0.2316419 * Math.abs(x));
  let d = 0.3989423 * Math.exp(-x * x / 2);
  let p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
  return x > 0 ? 1 - p : p;
}

// 1. Economic Order Quantity (EOQ)
export const economicOrderQuantity: AlgorithmDefinition = {
  id: 'eoq',
  name: 'Economic Order Quantity (EOQ)',
  description: 'Calculates the optimal order quantity to minimize the total holding costs and ordering costs for inventory.',
  inputs: [
    { key: 'annualDemand', label: 'Annual Demand (Units)', min: 100, max: 1000000, step: 100, defaultValue: 12000 },
    { key: 'orderCost', label: 'Fixed Cost Per Order ($)', min: 10, max: 5000, step: 10, defaultValue: 100 },
    { key: 'holdingCost', label: 'Holding Cost Per Unit / Yr ($)', min: 0.1, max: 100, step: 0.1, defaultValue: 2.5 }
  ],
  compute: buildHelper((txs, accounts, inputs) => {
    const D = inputs.annualDemand || 12000;
    const S = inputs.orderCost || 100;
    const H = inputs.holdingCost || 2.5;

    // EOQ Formula: sqrt( (2 * D * S) / H )
    const eoq = Math.sqrt((2 * D * S) / H);
    
    const numOrders = D / eoq;
    const totalOrderCost = numOrders * S;
    const totalHoldingCost = (eoq / 2) * H;
    const totalCost = totalOrderCost + totalHoldingCost;

    const data = [];
    // Sensitivity analysis over different demand values
    for (let factor = 0.5; factor <= 1.5; factor += 0.1) {
      const simD = D * factor;
      const simEoq = Math.sqrt((2 * simD * S) / H);
      data.push({
        Demand: Math.round(simD),
        Optimal_EOQ: Math.round(simEoq),
        Total_Cost: Math.round((simD / simEoq) * S + (simEoq / 2) * H)
      });
    }

    return {
      metrics: [
        { label: 'Optimal Order Quantity', value: Math.round(eoq).toLocaleString() + ' Units' },
        { label: 'Total Annual Cost Minimized', value: '$' + Math.round(totalCost).toLocaleString() },
        { label: 'Orders Per Year', value: numOrders.toFixed(1) }
      ],
      charts: [
        { 
          data, 
          config: { 
            xKey: 'Demand', 
            yKeys: [
              { key: 'Total_Cost', color: '#ef4444', name: 'Total Inventory Cost', type: 'line' },
              { key: 'Optimal_EOQ', color: '#3b82f6', name: 'Optimal EOQ', type: 'line' }
            ] 
          } 
        }
      ],
      insights: [
        `By ordering strictly ${Math.round(eoq)} units per cycle, you theoretically balance order costs and carrying costs.`,
        `This will require roughly ${numOrders.toFixed(1)} inventory shipments per year to meet the demand of ${D.toLocaleString()} units.`
      ]
    };
  })
};

// 2. Weighted Average Cost of Capital (WACC)
export const weightedAverageCostOfCapital: AlgorithmDefinition = {
  id: 'wacc',
  name: 'Weighted Average Cost of Capital (WACC)',
  description: 'Calculates the overall cost of capital by mathematically blending the cost of equity and cost of debt based on capital structure weightings.',
  inputs: [
    { key: 'costEquity', label: 'Cost of Equity (%)', min: 1, max: 30, step: 0.1, defaultValue: 10 },
    { key: 'costDebt', label: 'Cost of Debt (%)', min: 1, max: 20, step: 0.1, defaultValue: 5 },
    { key: 'taxRate', label: 'Corporate Tax Rate (%)', min: 0, max: 40, step: 1, defaultValue: 21 },
    { key: 'debtRatio', label: 'Debt to Total Capital (%)', min: 0, max: 100, step: 1, defaultValue: 40 }
  ],
  compute: buildHelper((txs, accounts, inputs) => {
    const Ke = (inputs.costEquity || 10) / 100;
    const Kd = (inputs.costDebt || 5) / 100;
    const T = (inputs.taxRate || 21) / 100;
    const Wd = (inputs.debtRatio || 40) / 100;
    const We = 1 - Wd;

    // WACC = (E/V * Ke) + (D/V * Kd * (1-T))
    const wacc = (We * Ke) + (Wd * Kd * (1 - T));

    const data = [];
    // WACC at different debt ratios
    for (let simWd = 0; simWd <= 100; simWd += 10) {
      const simWe = (100 - simWd) / 100;
      const decWd = simWd / 100;
      const simWacc = (simWe * Ke) + (decWd * Kd * (1 - T));
      data.push({
        Debt_Ratio: `${simWd}%`,
        WACC: parseFloat((simWacc * 100).toFixed(2))
      });
    }

    return {
      metrics: [
        { label: 'Blended WACC', value: (wacc * 100).toFixed(2) + '%' },
        { label: 'After-Tax Cost of Debt', value: ((Kd * (1 - T)) * 100).toFixed(2) + '%' },
        { label: 'Equity Weight', value: (We * 100).toFixed(0) + '%' }
      ],
      charts: [
        { 
          data, 
          config: { 
            xKey: 'Debt_Ratio', 
            yKeys: [
              { key: 'WACC', color: '#10b981', name: 'WACC (%)', type: 'line' }
            ] 
          } 
        }
      ],
      insights: [
        `Your mathematical hurdle rate for new investments should be ${(wacc * 100).toFixed(2)}%. Any ROI below this destroys firm value.`,
        `The tax shield on interest payments reduces your effective cost of debt from ${(Kd * 100).toFixed(2)}% to ${((Kd * (1 - T)) * 100).toFixed(2)}%.`
      ]
    };
  })
};

// 3. Black-Scholes Option Pricing
export const blackScholesPricing: AlgorithmDefinition = {
  id: 'black_scholes',
  name: 'Black-Scholes-Merton Option Pricing',
  description: 'Uses continuous-time stochastic calculus to compute the fair theoretical value of a European call/put option (useful for Cap Table / Equity grants).',
  inputs: [
    { key: 'stockPrice', label: 'Underlying Asset Price (S)', min: 1, max: 1000, step: 1, defaultValue: 100 },
    { key: 'strikePrice', label: 'Strike Price (K)', min: 1, max: 1000, step: 1, defaultValue: 100 },
    { key: 'time', label: 'Time to Expiration (Years)', min: 0.1, max: 10, step: 0.1, defaultValue: 1.0 },
    { key: 'volatility', label: 'Implied Volatility (σ) %', min: 1, max: 150, step: 1, defaultValue: 30 },
    { key: 'riskFree', label: 'Risk-Free Rate (r) %', min: 0, max: 10, step: 0.1, defaultValue: 4.5 }
  ],
  compute: buildHelper((txs, accounts, inputs) => {
    const S = inputs.stockPrice || 100;
    const K = inputs.strikePrice || 100;
    const T = inputs.time || 1.0;
    const v = (inputs.volatility || 30) / 100;
    const r = (inputs.riskFree || 4.5) / 100;

    // d1 = (ln(S/K) + (r + σ^2/2)*T) / (σ*sqrt(T))
    const d1 = (Math.log(S / K) + (r + (v * v) / 2) * T) / (v * Math.sqrt(T));
    const d2 = d1 - v * Math.sqrt(T);

    // Call = S * N(d1) - K * e^(-r*T) * N(d2)
    const callPrice = S * normalCDF(d1) - K * Math.exp(-r * T) * normalCDF(d2);
    // Put = K * e^(-r*T) * N(-d2) - S * N(-d1)
    const putPrice = K * Math.exp(-r * T) * normalCDF(-d2) - S * normalCDF(-d1);

    const data = [];
    for (let simS = S * 0.5; simS <= S * 1.5; simS += S * 0.05) {
      const s_d1 = (Math.log(simS / K) + (r + (v * v) / 2) * T) / (v * Math.sqrt(T));
      const s_d2 = s_d1 - v * Math.sqrt(T);
      const simCall = simS * normalCDF(s_d1) - K * Math.exp(-r * T) * normalCDF(s_d2);
      
      data.push({
        Underlying_Price: parseFloat(simS.toFixed(2)),
        Call_Value: parseFloat(simCall.toFixed(2))
      });
    }

    return {
      metrics: [
        { label: 'Fair Call Value', value: '$' + callPrice.toFixed(2) },
        { label: 'Fair Put Value', value: '$' + putPrice.toFixed(2) },
        { label: 'd1 (Delta Approx)', value: normalCDF(d1).toFixed(3) }
      ],
      charts: [
        { 
          data, 
          config: { 
            xKey: 'Underlying_Price', 
            yKeys: [
              { key: 'Call_Value', color: '#3b82f6', name: 'Call Option Value', type: 'line' }
            ] 
          } 
        }
      ],
      insights: [
        `Based on Brownian motion, the theoretical fair value of this equity grant is $${callPrice.toFixed(2)} per share.`,
        `The option has a delta of roughly ${normalCDF(d1).toFixed(2)}, meaning for every $1 increase in the underlying, the option value increases by ~$${normalCDF(d1).toFixed(2)}.`
      ]
    };
  })
};

// 4. Customer Lifetime Value (CLV)
export const customerLifetimeValue: AlgorithmDefinition = {
  id: 'clv',
  name: 'Predictive Customer Lifetime Value (CLV)',
  description: 'Uses retention curves, margin modeling, and discount rates to project the net present value (NPV) of a single customer.',
  inputs: [
    { key: 'arpu', label: 'Average Revenue Per User ($/mo)', min: 10, max: 10000, step: 10, defaultValue: 150 },
    { key: 'grossMargin', label: 'Gross Margin (%)', min: 10, max: 100, step: 1, defaultValue: 80 },
    { key: 'churnRate', label: 'Monthly Churn Rate (%)', min: 0.1, max: 20, step: 0.1, defaultValue: 2.5 },
    { key: 'discountRate', label: 'Annual Discount Rate (%)', min: 0, max: 30, step: 1, defaultValue: 10 }
  ],
  compute: buildHelper((txs, accounts, inputs) => {
    const arpu = inputs.arpu || 150;
    const margin = (inputs.grossMargin || 80) / 100;
    const churn = (inputs.churnRate || 2.5) / 100;
    const discountAnnual = (inputs.discountRate || 10) / 100;
    const discountMonthly = discountAnnual / 12;

    const monthlyProfit = arpu * margin;
    const retention = 1 - churn;
    
    // Sum of infinite geometric series: CLV = Profit * sum( (retention / (1+d))^t )
    // Which simplifies to: Profit * (retention / (1 + d - retention)) 
    // Usually standard SaaS simplified CLV is just Profit / Churn. 
    // We use the discounted NPV version for mathematical rigor.
    const clv = monthlyProfit * (retention / (1 + discountMonthly - retention));
    
    // Average lifespan
    const lifespanMonths = 1 / churn;

    const data = [];
    let currentAlive = 100;
    let cumulatedValue = 0;
    for (let month = 1; month <= 60; month++) { // 5 year horizon
      cumulatedValue += (currentAlive / 100) * monthlyProfit * Math.pow(1 - discountMonthly, month);
      data.push({
        Month: month,
        Cohort_Retention: parseFloat(currentAlive.toFixed(1)),
        Cumulated_NPV: parseFloat(cumulatedValue.toFixed(2))
      });
      currentAlive *= retention;
    }

    return {
      metrics: [
        { label: 'Discounted CLV', value: '$' + Math.round(clv).toLocaleString() },
        { label: 'Avg Lifespan', value: lifespanMonths.toFixed(1) + ' Months' },
        { label: 'Monthly Profit/User', value: '$' + monthlyProfit.toFixed(2) }
      ],
      charts: [
        { 
          data, 
          config: { 
            xKey: 'Month', 
            yKeys: [
              { key: 'Cumulated_NPV', color: '#10b981', name: 'Accumulated Value ($)', type: 'bar' },
              { key: 'Cohort_Retention', color: '#f59e0b', name: 'Retention (%)', type: 'line' }
            ] 
          } 
        }
      ],
      insights: [
        `A customer is mathematically worth $${Math.round(clv).toLocaleString()} in today's dollars, after accounting for a ${inputs.discountRate}% annual discount rate.`,
        `You can safely spend up to $${Math.round(clv / 3).toLocaleString()} (assuming a 3:1 LTV:CAC target ratio) to acquire a new user.`
      ]
    };
  })
};

export const ERP_MODELS = [
  economicOrderQuantity,
  weightedAverageCostOfCapital,
  blackScholesPricing,
  customerLifetimeValue
];

