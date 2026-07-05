import React, { useState } from 'react';
import { useUIStore } from '../../stores/useUIStore';

export default function EvEbitdaCalculator() {
  const language = useUIStore(s => s.language);
  
  const [enterpriseValue, setEnterpriseValue] = useState<number>(6000000);
  const [ebitda, setEbitda] = useState<number>(1200000);

  const calculateMultiple = () => {
    if (ebitda <= 0) return { multiple: 0 };
    const multiple = enterpriseValue / ebitda;
    return { multiple: multiple.toFixed(2) };
  };

  const results = calculateMultiple();

  return (
    <div className="p-6 max-w-xl mx-auto bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm">
      <h2 className="text-xl font-medium text-slate-900 dark:text-white mb-6">
        {language === 'he' ? 'מכפיל EV/EBITDA' : 'EV/EBITDA Multiple'}
      </h2>
      <p className="text-sm text-slate-500 mb-6">
        {language === 'he' ? 'יחס המשווה את שווי הפעילות של חברה לרווח שלה לפני ריבית, מסים, פחת והפחתות.' : 'A ratio that compares a company\'s Enterprise Value to its Earnings Before Interest, Taxes, Depreciation, and Amortization.'}
      </p>

      <div className="grid grid-cols-2 gap-4 mb-6">
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
            {language === 'he' ? 'שווי פעילות (EV) ($)' : 'Enterprise Value (EV) ($)'}
          </label>
          <input type="number" value={enterpriseValue} onChange={(e) => setEnterpriseValue(Number(e.target.value))} className="w-full px-3 py-2 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-sm" />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
            {language === 'he' ? 'EBITDA ($)' : 'EBITDA ($)'}
          </label>
          <input type="number" value={ebitda} onChange={(e) => setEbitda(Number(e.target.value))} className="w-full px-3 py-2 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-sm" />
        </div>
      </div>

      <div className="pt-6 border-t border-slate-100 dark:border-slate-800">
        <div className="p-4 bg-teal-50 dark:bg-teal-900/10 rounded-xl border border-teal-100 dark:border-teal-800/30 flex justify-between items-center mt-4">
          <div>
            <p className="text-sm font-medium text-teal-800 dark:text-teal-400 mb-1">
              {language === 'he' ? 'מכפיל EV/EBITDA' : 'EV/EBITDA Multiple'}
            </p>
          </div>
          <div className="text-4xl font-bold text-teal-600 dark:text-teal-400">
            {results.multiple}x
          </div>
        </div>
      </div>
    </div>
  );
}
