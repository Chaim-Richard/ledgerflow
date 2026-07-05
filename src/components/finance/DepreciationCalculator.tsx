import React, { useState } from 'react';
import { useUIStore } from '../../stores/useUIStore';

export default function DepreciationCalculator() {
  const language = useUIStore(s => s.language);
  const [assetCost, setAssetCost] = useState<number>(50000);
  const [salvageValue, setSalvageValue] = useState<number>(5000);
  const [usefulLife, setUsefulLife] = useState<number>(5);

  const calculateDepreciation = () => {
    if (usefulLife <= 0) return { straightLine: 0, depreciationRate: 0 };
    const depreciableCost = assetCost - salvageValue;
    const straightLine = depreciableCost / usefulLife;
    const depreciationRate = (1 / usefulLife) * 100;

    return {
      straightLine: straightLine.toFixed(2),
      depreciationRate: depreciationRate.toFixed(2)
    };
  };

  const results = calculateDepreciation();

  return (
    <div className="p-6 max-w-xl mx-auto bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm">
      <h2 className="text-xl font-medium text-slate-900 dark:text-white mb-6">
        {language === 'he' ? 'מחשבון פחת (קו ישר)' : 'Depreciation Calculator (Straight-Line)'}
      </h2>

      <div className="grid gap-4 mb-6">
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
            {language === 'he' ? 'עלות הנכס' : 'Asset Cost'}
          </label>
          <input
            type="number"
            value={assetCost}
            onChange={(e) => setAssetCost(Number(e.target.value))}
            className="w-full px-3 py-2 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-sm"
          />
        </div>
        
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              {language === 'he' ? 'ערך שייר (Salvage Value)' : 'Salvage Value'}
            </label>
            <input
              type="number"
              value={salvageValue}
              onChange={(e) => setSalvageValue(Number(e.target.value))}
              className="w-full px-3 py-2 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              {language === 'he' ? 'אורך חיים שימושי (בשנים)' : 'Useful Life (Years)'}
            </label>
            <input
              type="number"
              value={usefulLife}
              onChange={(e) => setUsefulLife(Number(e.target.value))}
              className="w-full px-3 py-2 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-sm"
            />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 pt-4 border-t border-slate-100 dark:border-slate-800 mt-2">
        <div>
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-1">
            {language === 'he' ? 'הוצאת פחת שנתית' : 'Annual Depreciation Expense'}
          </p>
          <div className="text-3xl font-medium text-indigo-600 dark:text-indigo-400">
            ${results.straightLine}
          </div>
        </div>
        <div>
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-1">
            {language === 'he' ? 'שיעור פחת' : 'Depreciation Rate'}
          </p>
          <div className="text-3xl font-medium text-slate-700 dark:text-slate-300">
            {results.depreciationRate}%
          </div>
        </div>
      </div>
    </div>
  );
}
