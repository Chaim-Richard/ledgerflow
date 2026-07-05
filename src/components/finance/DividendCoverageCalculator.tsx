import React, { useState } from 'react';
import { useUIStore } from '../../stores/useUIStore';

export default function DividendCoverageCalculator() {
  const language = useUIStore(s => s.language);
  
  const [netIncome, setNetIncome] = useState<number>(2000000);
  const [dividends, setDividends] = useState<number>(500000);

  const calculateCoverage = () => {
    if (dividends <= 0) return { coverage: 0, status: '' };
    const coverage = netIncome / dividends;
    
    let status = '';
    if (coverage < 1) status = language === 'he' ? 'סיכון גבוה (דיבידנד גבוה מרווחים)' : 'High Risk (Dividends exceed income)';
    else if (coverage < 2) status = language === 'he' ? 'סביר' : 'Adequate';
    else status = language === 'he' ? 'בטוח' : 'Safe';

    return {
      coverage: coverage.toFixed(2),
      status
    };
  };

  const results = calculateCoverage();

  return (
    <div className="p-6 max-w-xl mx-auto bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm">
      <h2 className="text-xl font-medium text-slate-900 dark:text-white mb-6">
        {language === 'he' ? 'יחס כיסוי דיבידנד' : 'Dividend Coverage Ratio'}
      </h2>
      <p className="text-sm text-slate-500 mb-6">
        {language === 'he' ? 'מודד כמה פעמים חברה יכולה לשלם את הדיבידנדים שלה באמצעות הרווח הנקי.' : 'Measures the number of times a company can pay its current level of dividends to shareholders.'}
      </p>

      <div className="grid grid-cols-2 gap-4 mb-6">
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
            {language === 'he' ? 'רווח נקי ($)' : 'Net Income ($)'}
          </label>
          <input type="number" value={netIncome} onChange={(e) => setNetIncome(Number(e.target.value))} className="w-full px-3 py-2 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-sm" />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
            {language === 'he' ? 'דיבידנדים שחולקו ($)' : 'Dividends Paid ($)'}
          </label>
          <input type="number" value={dividends} onChange={(e) => setDividends(Number(e.target.value))} className="w-full px-3 py-2 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-sm" />
        </div>
      </div>

      <div className="pt-6 border-t border-slate-100 dark:border-slate-800">
        <div className={`p-4 rounded-xl border flex justify-between items-center ${Number(results.coverage) >= 2 ? 'bg-emerald-50 dark:bg-emerald-900/10 border-emerald-100 dark:border-emerald-800/30' : Number(results.coverage) >= 1 ? 'bg-amber-50 dark:bg-amber-900/10 border-amber-100 dark:border-amber-800/30' : 'bg-rose-50 dark:bg-rose-900/10 border-rose-100 dark:border-rose-800/30'}`}>
          <div>
            <p className={`text-sm font-medium mb-1 ${Number(results.coverage) >= 2 ? 'text-emerald-800 dark:text-emerald-400' : Number(results.coverage) >= 1 ? 'text-amber-800 dark:text-amber-400' : 'text-rose-800 dark:text-rose-400'}`}>
              {language === 'he' ? 'יחס כיסוי' : 'Coverage Ratio'}
            </p>
            <p className="text-xs opacity-80">{results.status}</p>
          </div>
          <div className={`text-4xl font-bold ${Number(results.coverage) >= 2 ? 'text-emerald-600 dark:text-emerald-400' : Number(results.coverage) >= 1 ? 'text-amber-600 dark:text-amber-400' : 'text-rose-600 dark:text-rose-400'}`}>
            {results.coverage}x
          </div>
        </div>
      </div>
    </div>
  );
}
