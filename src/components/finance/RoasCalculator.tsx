import React, { useState } from 'react';
import { useUIStore } from '../../stores/useUIStore';

export default function RoasCalculator() {
  const language = useUIStore(s => s.language);
  const [adSpend, setAdSpend] = useState<number>(5000);
  const [revenueFromAds, setRevenueFromAds] = useState<number>(15000);

  const calculateRoas = () => {
    const roas = adSpend > 0 ? revenueFromAds / adSpend : 0;
    const roasPercentage = roas * 100;
    
    return {
      roasRatio: roas.toFixed(2),
      roasPercentage: roasPercentage.toFixed(2)
    };
  };

  const results = calculateRoas();

  return (
    <div className="p-6 max-w-xl mx-auto bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm">
      <h2 className="text-xl font-medium text-slate-900 dark:text-white mb-6">
        {language === 'he' ? 'מחשבון החזר על הוצאות פרסום (ROAS)' : 'ROAS Calculator'}
      </h2>

      <div className="grid grid-cols-2 gap-4 mb-6">
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
            {language === 'he' ? 'הוצאות פרסום' : 'Ad Spend'}
          </label>
          <input
            type="number"
            value={adSpend}
            onChange={(e) => setAdSpend(Number(e.target.value))}
            className="w-full px-3 py-2 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-sm"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
            {language === 'he' ? 'הכנסה מפרסום' : 'Revenue from Ads'}
          </label>
          <input
            type="number"
            value={revenueFromAds}
            onChange={(e) => setRevenueFromAds(Number(e.target.value))}
            className="w-full px-3 py-2 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-sm"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 pt-4 border-t border-slate-100 dark:border-slate-800">
        <div>
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-1">
            {language === 'he' ? 'ROAS (יחס)' : 'ROAS Ratio'}
          </p>
          <p className="text-2xl font-medium text-slate-900 dark:text-white">{results.roasRatio}x</p>
        </div>
        
        <div>
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-1">
            {language === 'he' ? 'ROAS (%)' : 'ROAS %'}
          </p>
          <p className="text-2xl font-medium text-emerald-600 dark:text-emerald-400">{results.roasPercentage}%</p>
        </div>
      </div>
    </div>
  );
}
