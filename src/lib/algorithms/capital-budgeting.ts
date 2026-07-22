import { AlgorithmDefinition, AlgoResult } from './types';
import { calculateWACC, calculateNPV, calculateIRR } from './math';

export const CAPITAL_BUDGETING_ALGO: AlgorithmDefinition = {
  id: 'valuation_1',
  name: 'WACC & NPV Capital Valuation',
  domain: 'finance',
  tags: ['Valuation', 'NPV', 'IRR', 'WACC', 'Capital'],
  description: 'Calculates Weighted Average Cost of Capital (WACC), Net Present Value (NPV), and Internal Rate of Return (IRR) for capital investments and project budgeting.',
  inputs: [
    {
      key: 'costOfEquityPct',
      label: 'Cost of Equity (%)',
      min: 1,
      max: 30,
      step: 0.5,
      defaultValue: 10
    },
    {
      key: 'costOfDebtPct',
      label: 'Cost of Debt (%)',
      min: 1,
      max: 20,
      step: 0.5,
      defaultValue: 5
    },
    {
      key: 'taxRatePct',
      label: 'Corporate Tax Rate (%)',
      min: 0,
      max: 50,
      step: 1,
      defaultValue: 21
    },
    {
      key: 'equityDebtRatio',
      label: 'Equity Weight (%)',
      min: 0,
      max: 100,
      step: 5,
      defaultValue: 70
    }
  ],
  compute: (transactions, accounts, inputs): AlgoResult => {
    const ke = (inputs['costOfEquityPct'] || 10) / 100;
    const kd = (inputs['costOfDebtPct'] || 5) / 100;
    const tax = (inputs['taxRatePct'] || 21) / 100;
    const equityPct = (inputs['equityDebtRatio'] || 70) / 100;
    const debtPct = 1 - equityPct;
    
    // Calculate WACC
    // WACC = (E/V * Ke) + (D/V * Kd * (1 - Tax))
    const wacc = (equityPct * ke) + (debtPct * kd * (1 - tax));
    const waccPct = (wacc * 100).toFixed(2);
    
    // Extract recent annual revenue / cash flows from ledger
    // Group transaction cash flows by year
    const yearlyFlows: Record<string, number> = {};
    transactions.forEach(tx => {
      const year = tx.date.substring(0, 4);
      if (!yearlyFlows[year]) yearlyFlows[year] = 0;
      yearlyFlows[year] += tx.totalAmountCents / 100;
    });
    
    const sortedYears = Object.keys(yearlyFlows).sort();
    const cashFlowArray = sortedYears.map(y => yearlyFlows[y]);
    
    // Assume an initial capital investment baseline if cash flows exist
    const initialInvestment = cashFlowArray.length > 0 ? Math.max(...cashFlowArray.map(v => Math.abs(v))) * 2 : 100000;
    const npv = calculateNPV(wacc, initialInvestment, cashFlowArray.length > 0 ? cashFlowArray : [30000, 40000, 50000, 60000]);
    const irr = calculateIRR(initialInvestment, cashFlowArray.length > 0 ? cashFlowArray : [30000, 40000, 50000, 60000]);
    
    const chartData = [
      { Parameter: 'Cost of Equity', 'Rate (%)': parseFloat((ke * 100).toFixed(2)) },
      { Parameter: 'Cost of Debt (After-Tax)', 'Rate (%)': parseFloat((kd * (1 - tax) * 100).toFixed(2)) },
      { Parameter: 'Blended WACC', 'Rate (%)': parseFloat(waccPct) }
    ];

    const insights = [];
    insights.push(`The calculated Weighted Average Cost of Capital (WACC) hurdle rate is ${waccPct}%.`);
    insights.push(`At a hurdle rate of ${waccPct}%, the net present value (NPV) of historical project cash flows is $${npv.toLocaleString(undefined, { maximumFractionDigits: 0 })}.`);
    if (irr > wacc) {
      insights.push(`Internal Rate of Return (IRR: ${(irr * 100).toFixed(2)}%) exceeds WACC (${waccPct}%). Investment generates positive economic value added (EVA).`);
    } else {
      insights.push(`Internal Rate of Return (IRR: ${(irr * 100).toFixed(2)}%) is below the hurdle rate (${waccPct}%). Re-evaluate capital allocation strategy.`);
    }

    return {
      metrics: [
        { label: 'Calculated WACC', value: `${waccPct}%`, color: 'text-indigo-600' },
        { label: 'Projected NPV', value: `$${Math.round(npv).toLocaleString()}`, color: npv >= 0 ? 'text-emerald-500' : 'text-rose-500' },
        { label: 'Implied IRR', value: `${(irr * 100).toFixed(1)}%` }
      ],
      charts: [
        {
          config: {
            xKey: 'Parameter',
            yKeys: [
              { key: 'Rate (%)', name: 'Discount Rate %', color: '#8b5cf6', type: 'bar' }
            ]
          },
          data: chartData
        }
      ],
      insights
    };
  }
};
