import React, { useState } from 'react';
import { useUIStore } from '../../stores/useUIStore';

export default function AssetTurnoverCalculator() {
  const language = useUIStore(s => s.language);
  
  const [revenue, setRevenue] = useState<number>(2000000);
  const [averageTotalAssets, setAverageTotalAssets] = useState<number>(500000);

  const calculateRatio = () => {
    if (averageTotalAssets <= 0) return { ratio: 0 };
    const ratio = revenue / averageTotalAssets;
    
    return {
      ratio: ratio.toFixed(2)
    };
  };

  const results = calculateRatio();

  return (
    <div className="p-6 max-w-xl mx-auto bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm">
      <h2 className="text-xl font-medium text-slate-900 dark:text-white mb-6">
        {language === 'he' ? 'מחזור נכסים (Asset Turnover)' : 'Asset Turnover Ratio'}
      </h2>
      <p className="text-sm text-slate-500 mb-6">
        {language === 'he' ? 'מודד את היעילות שבה חברה משתמשת בנכסיה כדי לייצר מכירות או הכנסות.' : 'Measures the value of a company\'s sales or revenues generated relative to the value of its assets.'}
      </p>

      <div className="grid grid-cols-2 gap-4 mb-6">
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
            {language === 'he' ? 'הכנסות / מכירות ($)' : 'Total Revenue ($)'}
          </label>
          <input type="number" value={revenue} onChange={(e) => setRevenue(Number(e.target.value))} className="w-full px-3 py-2 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-sm" />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
            {language === 'he' ? 'ממוצע סך הנכסים ($)' : 'Average Total Assets ($)'}
          </label>
          <input type="number" value={averageTotalAssets} onChange={(e) => setAverageTotalAssets(Number(e.target.value))} className="w-full px-3 py-2 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-sm" />
        </div>
      </div>

      <div className="pt-6 border-t border-slate-100 dark:border-slate-800">
        <div className="p-4 bg-indigo-50 dark:bg-indigo-900/10 rounded-xl border border-indigo-100 dark:border-indigo-800/30 flex justify-between items-center mt-4">
          <div>
            <p className="text-sm font-medium text-indigo-800 dark:text-indigo-400 mb-1">
              {language === 'he' ? 'יחס מחזור נכסים' : 'Asset Turnover Ratio'}
            </p>
          </div>
          <div className="text-4xl font-bold text-indigo-600 dark:text-indigo-400">
            {results.ratio}x
          </div>
        </div>
      </div>
    </div>
  );
}
