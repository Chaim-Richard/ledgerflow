import React, { useState } from 'react';
import { useUIStore } from '../../stores/useUIStore';

export default function RoicCalculator() {
  const language = useUIStore(s => s.language);
  
  const [nopat, setNopat] = useState<number>(150000);
  const [investedCapital, setInvestedCapital] = useState<number>(1000000);

  const calculateROIC = () => {
    if (investedCapital <= 0) return { roic: 0 };
    const roic = (nopat / investedCapital) * 100;
    return { roic: roic.toFixed(2) };
  };

  const results = calculateROIC();

  return (
    <div className="p-6 max-w-xl mx-auto bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm">
      <h2 className="text-xl font-medium text-slate-900 dark:text-white mb-6">
        {language === 'he' ? 'תשואה על הון מושקע (ROIC)' : 'Return on Invested Capital (ROIC)'}
      </h2>
      <p className="text-sm text-slate-500 mb-6">
        {language === 'he' ? 'מעריך עד כמה יעיל החברה מקצה את הונה להשקעות רווחיות.' : 'Assesses a company\'s efficiency at allocating the capital under its control to profitable investments.'}
      </p>

      <div className="grid grid-cols-2 gap-4 mb-6">
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
            {language === 'he' ? 'NOPAT ($)' : 'Net Operating Profit After Tax ($)'}
          </label>
          <input type="number" value={nopat} onChange={(e) => setNopat(Number(e.target.value))} className="w-full px-3 py-2 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-sm" />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
            {language === 'he' ? 'הון מושקע ($)' : 'Invested Capital ($)'}
          </label>
          <input type="number" value={investedCapital} onChange={(e) => setInvestedCapital(Number(e.target.value))} className="w-full px-3 py-2 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-sm" />
        </div>
      </div>

      <div className="pt-6 border-t border-slate-100 dark:border-slate-800">
        <div className="p-4 bg-emerald-50 dark:bg-emerald-900/10 rounded-xl border border-emerald-100 dark:border-emerald-800/30 flex justify-between items-center mt-4">
          <div>
            <p className="text-sm font-medium text-emerald-800 dark:text-emerald-400 mb-1">
              {language === 'he' ? 'תשואה על הון מושקע (ROIC)' : 'ROIC'}
            </p>
          </div>
          <div className="text-4xl font-bold text-emerald-600 dark:text-emerald-400">
            {results.roic}%
          </div>
        </div>
      </div>
    </div>
  );
}
