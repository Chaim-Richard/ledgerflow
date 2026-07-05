import React, { useState } from 'react';
import { useUIStore } from '../../stores/useUIStore';

export default function DolCalculator() {
  const language = useUIStore(s => s.language);
  
  const [sales, setSales] = useState<number>(1000000);
  const [variableCosts, setVariableCosts] = useState<number>(400000);
  const [fixedCosts, setFixedCosts] = useState<number>(200000);

  const calculateDOL = () => {
    const contributionMargin = sales - variableCosts;
    const ebit = contributionMargin - fixedCosts;
    
    if (ebit <= 0) return { dol: 0, status: language === 'he' ? 'הפסד תפעולי' : 'Operating Loss' };
    
    const dol = contributionMargin / ebit;
    
    return {
      dol: dol.toFixed(2),
      status: ''
    };
  };

  const results = calculateDOL();

  return (
    <div className="p-6 max-w-xl mx-auto bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm">
      <h2 className="text-xl font-medium text-slate-900 dark:text-white mb-6">
        {language === 'he' ? 'מינוף תפעולי (DOL)' : 'Degree of Operating Leverage (DOL)'}
      </h2>
      <p className="text-sm text-slate-500 mb-6">
        {language === 'he' ? 'מודד את הרגישות של הרווח התפעולי (EBIT) לשינויים בהיקף המכירות.' : 'Measures how much the operating income of a company changes in response to a change in sales.'}
      </p>

      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="col-span-2">
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
            {language === 'he' ? 'סך מכירות ($)' : 'Total Sales ($)'}
          </label>
          <input type="number" value={sales} onChange={(e) => setSales(Number(e.target.value))} className="w-full px-3 py-2 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-sm" />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
            {language === 'he' ? 'עלויות משתנות ($)' : 'Total Variable Costs ($)'}
          </label>
          <input type="number" value={variableCosts} onChange={(e) => setVariableCosts(Number(e.target.value))} className="w-full px-3 py-2 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-sm" />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
            {language === 'he' ? 'עלויות קבועות ($)' : 'Fixed Costs ($)'}
          </label>
          <input type="number" value={fixedCosts} onChange={(e) => setFixedCosts(Number(e.target.value))} className="w-full px-3 py-2 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-sm" />
        </div>
      </div>

      <div className="pt-6 border-t border-slate-100 dark:border-slate-800">
        <div className="p-4 bg-teal-50 dark:bg-teal-900/10 rounded-xl border border-teal-100 dark:border-teal-800/30 flex justify-between items-center mt-4">
          <div>
            <p className="text-sm font-medium text-teal-800 dark:text-teal-400 mb-1">
              {language === 'he' ? 'מינוף תפעולי (DOL)' : 'DOL'}
            </p>
            <p className="text-xs opacity-80 text-rose-500">{results.status}</p>
          </div>
          <div className="text-4xl font-bold text-teal-600 dark:text-teal-400">
            {results.dol}
          </div>
        </div>
        <p className="text-xs text-slate-500 mt-4 text-center">
          {language === 'he' 
            ? `משמעות: עלייה של 1% במכירות תוביל לעלייה של ${results.dol}% ברווח התפעולי.` 
            : `Meaning: A 1% increase in sales will lead to a ${results.dol}% increase in operating income.`}
        </p>
      </div>
    </div>
  );
}
