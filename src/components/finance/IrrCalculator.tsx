import React, { useState } from 'react';
import { useUIStore } from '../../stores/useUIStore';

export default function IrrCalculator() {
  const language = useUIStore(s => s.language);
  // Simplified IRR: Initial investment, and up to 5 years of cash flows
  const [initialInvestment, setInitialInvestment] = useState<number>(-100000);
  const [cashFlows, setCashFlows] = useState<number[]>([20000, 30000, 40000, 50000, 20000]);

  const updateCashFlow = (index: number, value: number) => {
    const newFlows = [...cashFlows];
    newFlows[index] = value;
    setCashFlows(newFlows);
  };

  // Simple Newton-Raphson approximation for IRR
  const calculateIRR = () => {
    const flows = [initialInvestment, ...cashFlows];
    
    // Check if there's at least one positive and one negative cash flow
    const hasPositive = flows.some(f => f > 0);
    const hasNegative = flows.some(f => f < 0);
    if (!hasPositive || !hasNegative) return 'N/A';

    let guess = 0.1; // initial guess 10%
    let limit = 100;
    
    for (let i = 0; i < limit; i++) {
      let npv = 0;
      let derivativeNpv = 0;
      
      for (let t = 0; t < flows.length; t++) {
        npv += flows[t] / Math.pow(1 + guess, t);
        if (t > 0) {
          derivativeNpv -= (t * flows[t]) / Math.pow(1 + guess, t + 1);
        }
      }
      
      if (Math.abs(npv) < 0.0001) {
        return (guess * 100).toFixed(2);
      }
      
      const nextGuess = guess - (npv / derivativeNpv);
      if (Math.abs(nextGuess - guess) < 0.00001) {
        return (nextGuess * 100).toFixed(2);
      }
      guess = nextGuess;
    }
    
    return 'N/A';
  };

  const irr = calculateIRR();

  return (
    <div className="p-6 max-w-xl mx-auto bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm">
      <h2 className="text-xl font-medium text-slate-900 dark:text-white mb-6">
        {language === 'he' ? 'מחשבון שיעור תשואה פנימי (IRR)' : 'Internal Rate of Return (IRR)'}
      </h2>

      <div className="space-y-4 mb-6">
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
            {language === 'he' ? 'השקעה ראשונית (Year 0 - מספר שלילי)' : 'Initial Investment (Year 0 - Negative)'}
          </label>
          <input 
            type="number" 
            value={initialInvestment} 
            onChange={(e) => setInitialInvestment(Number(e.target.value))} 
            className="w-full px-3 py-2 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-sm" 
          />
        </div>
        
        <div>
          <h3 className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
            {language === 'he' ? 'תזרימי מזומנים (שנים 1-5)' : 'Cash Flows (Years 1-5)'}
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
            {cashFlows.map((cf, idx) => (
              <div key={idx}>
                <label className="block text-xs text-slate-500 mb-1">
                  {language === 'he' ? `שנה ${idx + 1}` : `Year ${idx + 1}`}
                </label>
                <input 
                  type="number" 
                  value={cf} 
                  onChange={(e) => updateCashFlow(idx, Number(e.target.value))} 
                  className="w-full px-2 py-1.5 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-md text-sm" 
                />
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="pt-6 border-t border-slate-100 dark:border-slate-800 flex justify-between items-end">
        <div>
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-1">
            {language === 'he' ? 'שיעור תשואה פנימי (IRR)' : 'Internal Rate of Return (IRR)'}
          </p>
          <div className="text-4xl font-bold text-indigo-600 dark:text-indigo-400">
            {irr === 'N/A' ? 'N/A' : `${irr}%`}
          </div>
        </div>
      </div>
    </div>
  );
}
