import React, { useState } from 'react';
import { useUIStore } from '../../stores/useUIStore';

export default function CagrCalculator() {
  const language = useUIStore(s => s.language);
  
  const [beginningValue, setBeginningValue] = useState<number>(10000);
  const [endingValue, setEndingValue] = useState<number>(25000);
  const [years, setYears] = useState<number>(5);

  const calculateCAGR = () => {
    if (beginningValue <= 0 || years <= 0) return { cagr: 0 };
    const cagr = (Math.pow(endingValue / beginningValue, 1 / years) - 1) * 100;
    return { cagr: cagr.toFixed(2) };
  };

  const results = calculateCAGR();

  return (
    <div className="p-6 max-w-xl mx-auto bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm">
      <h2 className="text-xl font-medium text-slate-900 dark:text-white mb-6">
        {language === 'he' ? 'קצב צמיחה שנתי מורכב (CAGR)' : 'Compound Annual Growth Rate (CAGR)'}
      </h2>
      <p className="text-sm text-slate-500 mb-6">
        {language === 'he' ? 'מודד את שיעור התשואה השנתי של השקעה לאורך פרק זמן קבוע, בהנחה שהרווחים מושקעים מחדש.' : 'Measures the mean annual growth rate of an investment over a specified period of time longer than one year.'}
      </p>

      <div className="grid gap-4 mb-6">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              {language === 'he' ? 'ערך התחלתי ($)' : 'Beginning Value ($)'}
            </label>
            <input type="number" value={beginningValue} onChange={(e) => setBeginningValue(Number(e.target.value))} className="w-full px-3 py-2 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-sm" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              {language === 'he' ? 'ערך סופי ($)' : 'Ending Value ($)'}
            </label>
            <input type="number" value={endingValue} onChange={(e) => setEndingValue(Number(e.target.value))} className="w-full px-3 py-2 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-sm" />
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
            {language === 'he' ? 'מספר שנים' : 'Number of Years'}
          </label>
          <input type="number" value={years} onChange={(e) => setYears(Number(e.target.value))} className="w-full px-3 py-2 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-sm" />
        </div>
      </div>

      <div className="pt-6 border-t border-slate-100 dark:border-slate-800">
        <div className="p-4 bg-emerald-50 dark:bg-emerald-900/10 rounded-xl border border-emerald-100 dark:border-emerald-800/30 flex justify-between items-center">
          <div>
            <p className="text-sm font-medium text-emerald-800 dark:text-emerald-400 mb-1">
              {language === 'he' ? 'שיעור CAGR' : 'CAGR'}
            </p>
          </div>
          <div className="text-4xl font-bold text-emerald-600 dark:text-emerald-400">
            {results.cagr}%
          </div>
        </div>
      </div>
    </div>
  );
}
