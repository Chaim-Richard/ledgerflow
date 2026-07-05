import React, { useState } from 'react';
import { useUIStore } from '../../stores/useUIStore';

export default function EpsGrowthCalculator() {
  const language = useUIStore(s => s.language);
  
  const [currentEps, setCurrentEps] = useState<number>(3.50);
  const [previousEps, setPreviousEps] = useState<number>(3.00);

  const calculateGrowth = () => {
    if (previousEps === 0) return { growth: 0 };
    const growth = ((currentEps - previousEps) / Math.abs(previousEps)) * 100;
    
    return {
      growth: growth.toFixed(2)
    };
  };

  const results = calculateGrowth();

  return (
    <div className="p-6 max-w-xl mx-auto bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm">
      <h2 className="text-xl font-medium text-slate-900 dark:text-white mb-6">
        {language === 'he' ? 'צמיחת רווח למניה (EPS Growth)' : 'EPS Growth Calculator'}
      </h2>
      <p className="text-sm text-slate-500 mb-6">
        {language === 'he' ? 'מודד את שיעור הגידול ברווח הנקי למניה בין שתי תקופות.' : 'Measures the rate of growth of a company\'s earnings per share over a specific period.'}
      </p>

      <div className="grid grid-cols-2 gap-4 mb-6">
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
            {language === 'he' ? 'רווח למניה בתקופה קודמת' : 'Previous EPS ($)'}
          </label>
          <input type="number" step="0.01" value={previousEps} onChange={(e) => setPreviousEps(Number(e.target.value))} className="w-full px-3 py-2 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-sm" />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
            {language === 'he' ? 'רווח למניה נוכחי' : 'Current EPS ($)'}
          </label>
          <input type="number" step="0.01" value={currentEps} onChange={(e) => setCurrentEps(Number(e.target.value))} className="w-full px-3 py-2 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-sm" />
        </div>
      </div>

      <div className="pt-6 border-t border-slate-100 dark:border-slate-800">
        <div className={`p-4 rounded-xl border flex justify-between items-center ${Number(results.growth) >= 0 ? 'bg-emerald-50 dark:bg-emerald-900/10 border-emerald-100 dark:border-emerald-800/30' : 'bg-rose-50 dark:bg-rose-900/10 border-rose-100 dark:border-rose-800/30'}`}>
          <div>
            <p className={`text-sm font-medium mb-1 ${Number(results.growth) >= 0 ? 'text-emerald-800 dark:text-emerald-400' : 'text-rose-800 dark:text-rose-400'}`}>
              {language === 'he' ? 'צמיחת EPS' : 'EPS Growth Rate'}
            </p>
          </div>
          <div className={`text-4xl font-bold ${Number(results.growth) >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
            {Number(results.growth) > 0 ? '+' : ''}{results.growth}%
          </div>
        </div>
      </div>
    </div>
  );
}
