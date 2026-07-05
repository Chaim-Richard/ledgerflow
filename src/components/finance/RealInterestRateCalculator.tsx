import React, { useState } from 'react';
import { useUIStore } from '../../stores/useUIStore';

export default function RealInterestRateCalculator() {
  const language = useUIStore(s => s.language);
  
  const [nominalRate, setNominalRate] = useState<number>(5);
  const [inflationRate, setInflationRate] = useState<number>(2.5);

  const calculateRealRate = () => {
    // Fisher Equation: (1 + Nominal) = (1 + Real) * (1 + Inflation)
    // Real = ((1 + Nominal) / (1 + Inflation)) - 1
    const nominal = nominalRate / 100;
    const inflation = inflationRate / 100;
    
    const realRate = ((1 + nominal) / (1 + inflation)) - 1;
    
    // Simple approximation: Nominal - Inflation
    const simpleRealRate = nominalRate - inflationRate;
    
    return {
      realRate: (realRate * 100).toFixed(2),
      simpleRealRate: simpleRealRate.toFixed(2)
    };
  };

  const results = calculateRealRate();

  return (
    <div className="p-6 max-w-xl mx-auto bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm">
      <h2 className="text-xl font-medium text-slate-900 dark:text-white mb-6">
        {language === 'he' ? 'שער ריבית ריאלית (משוואת פישר)' : 'Real Interest Rate Calculator'}
      </h2>
      <p className="text-sm text-slate-500 mb-6">
        {language === 'he' ? 'מחשב את שיעור הריבית האמיתי המשוקלל בשיעור האינפלציה.' : 'Calculates the true interest rate adjusted for inflation using the Fisher Equation.'}
      </p>

      <div className="grid grid-cols-2 gap-4 mb-6">
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
            {language === 'he' ? 'ריבית נומינלית (%)' : 'Nominal Interest Rate (%)'}
          </label>
          <input type="number" step="0.1" value={nominalRate} onChange={(e) => setNominalRate(Number(e.target.value))} className="w-full px-3 py-2 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-sm" />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
            {language === 'he' ? 'שיעור אינפלציה (%)' : 'Inflation Rate (%)'}
          </label>
          <input type="number" step="0.1" value={inflationRate} onChange={(e) => setInflationRate(Number(e.target.value))} className="w-full px-3 py-2 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-sm" />
        </div>
      </div>

      <div className="pt-6 border-t border-slate-100 dark:border-slate-800 space-y-4">
        <div className="flex justify-between items-center text-sm text-slate-600 dark:text-slate-400 px-2">
          <span>{language === 'he' ? 'חישוב פשוט (נומינלי - אינפלציה):' : 'Simple Approx (Nominal - Inflation):'}</span>
          <span className="font-medium">{results.simpleRealRate}%</span>
        </div>
        
        <div className={`p-4 rounded-xl border flex justify-between items-center mt-4 ${Number(results.realRate) > 0 ? 'bg-emerald-50 dark:bg-emerald-900/10 border-emerald-100 dark:border-emerald-800/30' : 'bg-rose-50 dark:bg-rose-900/10 border-rose-100 dark:border-rose-800/30'}`}>
          <div>
            <p className={`text-sm font-medium mb-1 ${Number(results.realRate) > 0 ? 'text-emerald-800 dark:text-emerald-400' : 'text-rose-800 dark:text-rose-400'}`}>
              {language === 'he' ? 'ריבית ריאלית (פישר)' : 'Real Interest Rate (Fisher)'}
            </p>
          </div>
          <div className={`text-4xl font-bold ${Number(results.realRate) > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
            {results.realRate}%
          </div>
        </div>
      </div>
    </div>
  );
}
