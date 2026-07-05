import React, { useState } from 'react';
import { useUIStore } from '../../stores/useUIStore';

export default function EquityMultiplierCalculator() {
  const language = useUIStore(s => s.language);
  
  const [totalAssets, setTotalAssets] = useState<number>(2000000);
  const [totalEquity, setTotalEquity] = useState<number>(500000);

  const calculateMultiplier = () => {
    if (totalEquity <= 0) return { multiplier: 0, debtRatio: 0 };
    const multiplier = totalAssets / totalEquity;
    
    // Total Debt = Total Assets - Total Equity
    const totalDebt = totalAssets - totalEquity;
    const debtRatio = (totalDebt / totalAssets) * 100;
    
    return {
      multiplier: multiplier.toFixed(2),
      debtRatio: debtRatio.toFixed(2)
    };
  };

  const results = calculateMultiplier();

  return (
    <div className="p-6 max-w-xl mx-auto bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm">
      <h2 className="text-xl font-medium text-slate-900 dark:text-white mb-6">
        {language === 'he' ? 'מכפיל הון (Equity Multiplier)' : 'Equity Multiplier Calculator'}
      </h2>
      <p className="text-sm text-slate-500 mb-6">
        {language === 'he' ? 'מודד את כמות נכסי החברה הממומנים על ידי בעלי המניות שלה אל מול חוב.' : 'A risk indicator that measures the portion of a company’s assets that are financed by stockholder\'s equity rather than by debt.'}
      </p>

      <div className="grid grid-cols-2 gap-4 mb-6">
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
            {language === 'he' ? 'סך הכל נכסים ($)' : 'Total Assets ($)'}
          </label>
          <input type="number" value={totalAssets} onChange={(e) => setTotalAssets(Number(e.target.value))} className="w-full px-3 py-2 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-sm" />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
            {language === 'he' ? 'הון עצמי ($)' : 'Total Equity ($)'}
          </label>
          <input type="number" value={totalEquity} onChange={(e) => setTotalEquity(Number(e.target.value))} className="w-full px-3 py-2 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-sm" />
        </div>
      </div>

      <div className="pt-6 border-t border-slate-100 dark:border-slate-800 space-y-4">
         <div className="flex justify-between items-center text-sm text-slate-600 dark:text-slate-400 px-2">
          <span>{language === 'he' ? 'יחס חוב לנכסים:' : 'Implied Debt to Assets:'}</span>
          <span className="font-medium">{results.debtRatio}%</span>
        </div>

        <div className="p-4 bg-sky-50 dark:bg-sky-900/10 rounded-xl border border-sky-100 dark:border-sky-800/30 flex justify-between items-center mt-4">
          <div>
            <p className="text-sm font-medium text-sky-800 dark:text-sky-400 mb-1">
              {language === 'he' ? 'מכפיל הון' : 'Equity Multiplier'}
            </p>
          </div>
          <div className="text-4xl font-bold text-sky-600 dark:text-sky-400">
            {results.multiplier}
          </div>
        </div>
      </div>
    </div>
  );
}
