import React, { useState } from 'react';
import { useUIStore } from '../../stores/useUIStore';

export default function FixedAssetTurnoverCalculator() {
  const language = useUIStore(s => s.language);
  
  const [revenue, setRevenue] = useState<number>(2000000);
  const [netFixedAssets, setNetFixedAssets] = useState<number>(500000);

  const calculateRatio = () => {
    if (netFixedAssets <= 0) return { ratio: 0 };
    const ratio = revenue / netFixedAssets;
    
    return {
      ratio: ratio.toFixed(2)
    };
  };

  const results = calculateRatio();

  return (
    <div className="p-6 max-w-xl mx-auto bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm">
      <h2 className="text-xl font-medium text-slate-900 dark:text-white mb-6">
        {language === 'he' ? 'מחזור נכסים קבועים' : 'Fixed Asset Turnover'}
      </h2>
      <p className="text-sm text-slate-500 mb-6">
        {language === 'he' ? 'מודד כמה ביעילות חברה מנצלת את הציוד והמכונות (נכסים קבועים) לייצור הכנסות.' : 'Measures operating performance and indicates how efficiently a company uses its fixed assets (PP&E) to generate revenue.'}
      </p>

      <div className="grid grid-cols-2 gap-4 mb-6">
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
            {language === 'he' ? 'הכנסות / מכירות ($)' : 'Revenue / Sales ($)'}
          </label>
          <input type="number" value={revenue} onChange={(e) => setRevenue(Number(e.target.value))} className="w-full px-3 py-2 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-sm" />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
            {language === 'he' ? 'נכסים קבועים נטו ($)' : 'Net Fixed Assets ($)'}
          </label>
          <input type="number" value={netFixedAssets} onChange={(e) => setNetFixedAssets(Number(e.target.value))} className="w-full px-3 py-2 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-sm" />
        </div>
      </div>

      <div className="pt-6 border-t border-slate-100 dark:border-slate-800">
        <div className="p-4 bg-sky-50 dark:bg-sky-900/10 rounded-xl border border-sky-100 dark:border-sky-800/30 flex justify-between items-center mt-4">
          <div>
            <p className="text-sm font-medium text-sky-800 dark:text-sky-400 mb-1">
              {language === 'he' ? 'מחזור נכסים קבועים' : 'Fixed Asset Turnover'}
            </p>
          </div>
          <div className="text-4xl font-bold text-sky-600 dark:text-sky-400">
            {results.ratio}x
          </div>
        </div>
      </div>
    </div>
  );
}
