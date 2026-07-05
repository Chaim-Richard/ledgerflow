import React, { useState } from 'react';
import { useUIStore } from '../../stores/useUIStore';

export default function DflCalculator() {
  const language = useUIStore(s => s.language);
  
  const [ebit, setEbit] = useState<number>(400000);
  const [interestExpense, setInterestExpense] = useState<number>(100000);

  const calculateDFL = () => {
    const ebt = ebit - interestExpense;
    if (ebt <= 0) return { dfl: 0, status: language === 'he' ? 'הפסד לפני מס' : 'EBT is zero or negative' };
    
    const dfl = ebit / ebt;
    
    return {
      dfl: dfl.toFixed(2),
      status: ''
    };
  };

  const results = calculateDFL();

  return (
    <div className="p-6 max-w-xl mx-auto bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm">
      <h2 className="text-xl font-medium text-slate-900 dark:text-white mb-6">
        {language === 'he' ? 'מינוף פיננסי (DFL)' : 'Degree of Financial Leverage (DFL)'}
      </h2>
      <p className="text-sm text-slate-500 mb-6">
        {language === 'he' ? 'מודד את הרגישות של הרווח למניה (EPS) של החברה לשינויים ברווח התפעולי שלה (EBIT), כתוצאה מחוב.' : 'Measures the sensitivity of a company\'s earnings per share (EPS) to fluctuations in its operating income, as a result of changes in its capital structure.'}
      </p>

      <div className="grid grid-cols-2 gap-4 mb-6">
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
            {language === 'he' ? 'רווח תפעולי (EBIT) ($)' : 'Operating Income (EBIT) ($)'}
          </label>
          <input type="number" value={ebit} onChange={(e) => setEbit(Number(e.target.value))} className="w-full px-3 py-2 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-sm" />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
            {language === 'he' ? 'הוצאות ריבית ($)' : 'Interest Expense ($)'}
          </label>
          <input type="number" value={interestExpense} onChange={(e) => setInterestExpense(Number(e.target.value))} className="w-full px-3 py-2 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-sm" />
        </div>
      </div>

      <div className="pt-6 border-t border-slate-100 dark:border-slate-800">
        <div className="p-4 bg-indigo-50 dark:bg-indigo-900/10 rounded-xl border border-indigo-100 dark:border-indigo-800/30 flex justify-between items-center mt-4">
          <div>
            <p className="text-sm font-medium text-indigo-800 dark:text-indigo-400 mb-1">
              {language === 'he' ? 'מינוף פיננסי (DFL)' : 'DFL'}
            </p>
            <p className="text-xs opacity-80 text-rose-500">{results.status}</p>
          </div>
          <div className="text-4xl font-bold text-indigo-600 dark:text-indigo-400">
            {results.dfl}
          </div>
        </div>
        <p className="text-xs text-slate-500 mt-4 text-center">
          {language === 'he' 
            ? `משמעות: עלייה של 1% ברווח התפעולי (EBIT) תוביל לעלייה של ${results.dfl}% ברווח למניה (EPS).` 
            : `Meaning: A 1% increase in EBIT will result in a ${results.dfl}% increase in EPS.`}
        </p>
      </div>
    </div>
  );
}
