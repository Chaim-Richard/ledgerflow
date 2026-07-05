import React, { useState } from 'react';
import { useUIStore } from '../../stores/useUIStore';

export default function EpsCalculator() {
  const language = useUIStore(s => s.language);
  
  const [netIncome, setNetIncome] = useState<number>(1000000);
  const [preferredDividends, setPreferredDividends] = useState<number>(100000);
  const [sharesOutstanding, setSharesOutstanding] = useState<number>(500000);

  const calculateEPS = () => {
    if (sharesOutstanding <= 0) return { eps: 0 };
    const eps = (netIncome - preferredDividends) / sharesOutstanding;
    
    return {
      eps: eps.toFixed(2)
    };
  };

  const results = calculateEPS();

  return (
    <div className="p-6 max-w-xl mx-auto bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm">
      <h2 className="text-xl font-medium text-slate-900 dark:text-white mb-6">
        {language === 'he' ? 'רווח למניה (EPS)' : 'Earnings Per Share (EPS)'}
      </h2>
      <p className="text-sm text-slate-500 mb-6">
        {language === 'he' ? 'מחשב את הרווח שמייצרת החברה עבור כל מניה רגילה אחת.' : 'Calculates a company\'s net profit divided by the number of common shares it has outstanding.'}
      </p>

      <div className="grid gap-4 mb-6">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              {language === 'he' ? 'רווח נקי ($)' : 'Net Income ($)'}
            </label>
            <input type="number" value={netIncome} onChange={(e) => setNetIncome(Number(e.target.value))} className="w-full px-3 py-2 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-sm" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              {language === 'he' ? 'דיבידנד למניות בכורה ($)' : 'Preferred Dividends ($)'}
            </label>
            <input type="number" value={preferredDividends} onChange={(e) => setPreferredDividends(Number(e.target.value))} className="w-full px-3 py-2 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-sm" />
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
            {language === 'he' ? 'מספר מניות מונפקות' : 'Outstanding Shares'}
          </label>
          <input type="number" value={sharesOutstanding} onChange={(e) => setSharesOutstanding(Number(e.target.value))} className="w-full px-3 py-2 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-sm" />
        </div>
      </div>

      <div className="pt-6 border-t border-slate-100 dark:border-slate-800">
        <div className="p-4 bg-emerald-50 dark:bg-emerald-900/10 rounded-xl border border-emerald-100 dark:border-emerald-800/30 flex justify-between items-center mt-4">
          <div>
            <p className="text-sm font-medium text-emerald-800 dark:text-emerald-400 mb-1">
              {language === 'he' ? 'רווח למניה (EPS)' : 'EPS'}
            </p>
          </div>
          <div className="text-4xl font-bold text-emerald-600 dark:text-emerald-400">
            ${results.eps}
          </div>
        </div>
      </div>
    </div>
  );
}
