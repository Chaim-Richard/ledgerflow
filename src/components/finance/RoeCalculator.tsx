import React, { useState } from 'react';
import { useUIStore } from '../../stores/useUIStore';

export default function RoeCalculator() {
  const language = useUIStore(s => s.language);
  
  const [netIncome, setNetIncome] = useState<number>(500000);
  const [shareholdersEquity, setShareholdersEquity] = useState<number>(2500000);

  const calculateROE = () => {
    if (shareholdersEquity === 0) return { roe: 0 };
    const roe = (netIncome / shareholdersEquity) * 100;
    return { roe: roe.toFixed(2) };
  };

  const results = calculateROE();

  return (
    <div className="p-6 max-w-xl mx-auto bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm">
      <h2 className="text-xl font-medium text-slate-900 dark:text-white mb-6">
        {language === 'he' ? 'תשואה להון (ROE)' : 'Return on Equity (ROE)'}
      </h2>
      <p className="text-sm text-slate-500 mb-6">
        {language === 'he' ? 'מודד את יעילות החברה בייצור רווחים מתוך ההון העצמי שהושקע בה.' : 'Measures a corporation\'s profitability in relation to stockholders\' equity.'}
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
            {language === 'he' ? 'הון עצמי ($)' : 'Shareholders\' Equity ($)'}
          </label>
          <input type="number" value={shareholdersEquity} onChange={(e) => setShareholdersEquity(Number(e.target.value))} className="w-full px-3 py-2 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-sm" />
        </div>
      </div>

      <div className="pt-6 border-t border-slate-100 dark:border-slate-800">
        <div className="p-4 bg-indigo-50 dark:bg-indigo-900/10 rounded-xl border border-indigo-100 dark:border-indigo-800/30 flex justify-between items-center">
          <div>
            <p className="text-sm font-medium text-indigo-800 dark:text-indigo-400 mb-1">
              {language === 'he' ? 'תשואה להון (ROE)' : 'ROE'}
            </p>
          </div>
          <div className="text-4xl font-bold text-indigo-600 dark:text-indigo-400">
            {results.roe}%
          </div>
        </div>
      </div>
    </div>
  );
}
