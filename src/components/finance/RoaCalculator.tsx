import React, { useState } from 'react';
import { useUIStore } from '../../stores/useUIStore';

export default function RoaCalculator() {
  const language = useUIStore(s => s.language);
  
  const [netIncome, setNetIncome] = useState<number>(500000);
  const [totalAssets, setTotalAssets] = useState<number>(5000000);

  const calculateROA = () => {
    if (totalAssets === 0) return { roa: 0 };
    const roa = (netIncome / totalAssets) * 100;
    return { roa: roa.toFixed(2) };
  };

  const results = calculateROA();

  return (
    <div className="p-6 max-w-xl mx-auto bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm">
      <h2 className="text-xl font-medium text-slate-900 dark:text-white mb-6">
        {language === 'he' ? 'תשואה לנכסים (ROA)' : 'Return on Assets (ROA)'}
      </h2>
      <p className="text-sm text-slate-500 mb-6">
        {language === 'he' ? 'מודד כמה רווח חברה מייצרת ביחס לסך הנכסים שלה.' : 'Measures how profitable a company is relative to its total assets.'}
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
            {language === 'he' ? 'סך נכסים ($)' : 'Total Assets ($)'}
          </label>
          <input type="number" value={totalAssets} onChange={(e) => setTotalAssets(Number(e.target.value))} className="w-full px-3 py-2 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-sm" />
        </div>
      </div>

      <div className="pt-6 border-t border-slate-100 dark:border-slate-800">
        <div className="p-4 bg-sky-50 dark:bg-sky-900/10 rounded-xl border border-sky-100 dark:border-sky-800/30 flex justify-between items-center">
          <div>
            <p className="text-sm font-medium text-sky-800 dark:text-sky-400 mb-1">
              {language === 'he' ? 'תשואה לנכסים (ROA)' : 'ROA'}
            </p>
          </div>
          <div className="text-4xl font-bold text-sky-600 dark:text-sky-400">
            {results.roa}%
          </div>
        </div>
      </div>
    </div>
  );
}
