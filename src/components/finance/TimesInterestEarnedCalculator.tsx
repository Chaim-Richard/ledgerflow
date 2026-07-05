import React, { useState } from 'react';
import { useUIStore } from '../../stores/useUIStore';

export default function TimesInterestEarnedCalculator() {
  const language = useUIStore(s => s.language);
  
  const [ebit, setEbit] = useState<number>(800000);
  const [interestExpense, setInterestExpense] = useState<number>(100000);

  const calculateTIE = () => {
    if (interestExpense <= 0) return { tie: 0 };
    const tie = ebit / interestExpense;
    
    return {
      tie: tie.toFixed(2)
    };
  };

  const results = calculateTIE();

  return (
    <div className="p-6 max-w-xl mx-auto bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm">
      <h2 className="text-xl font-medium text-slate-900 dark:text-white mb-6">
        {language === 'he' ? 'יחס Times Interest Earned' : 'Times Interest Earned (TIE)'}
      </h2>
      <p className="text-sm text-slate-500 mb-6">
        {language === 'he' ? 'מודד כמה פעמים חברה יכולה לכסות את הוצאות הריבית שלה עם הרווח התפעולי.' : 'Measures how many times a company could cover its interest charges with its pretax earnings.'}
      </p>

      <div className="grid grid-cols-2 gap-4 mb-6">
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
            {language === 'he' ? 'רווח תפעולי (EBIT)' : 'EBIT ($)'}
          </label>
          <input type="number" value={ebit} onChange={(e) => setEbit(Number(e.target.value))} className="w-full px-3 py-2 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-sm" />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
            {language === 'he' ? 'הוצאות ריבית' : 'Interest Expense ($)'}
          </label>
          <input type="number" value={interestExpense} onChange={(e) => setInterestExpense(Number(e.target.value))} className="w-full px-3 py-2 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-sm" />
        </div>
      </div>

      <div className="pt-6 border-t border-slate-100 dark:border-slate-800">
        <div className="p-4 bg-indigo-50 dark:bg-indigo-900/10 rounded-xl border border-indigo-100 dark:border-indigo-800/30 flex justify-between items-center mt-4">
          <div>
            <p className="text-sm font-medium text-indigo-800 dark:text-indigo-400 mb-1">
              {language === 'he' ? 'יחס TIE' : 'TIE Ratio'}
            </p>
          </div>
          <div className="text-4xl font-bold text-indigo-600 dark:text-indigo-400">
            {results.tie}x
          </div>
        </div>
      </div>
    </div>
  );
}
