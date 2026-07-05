import React, { useState } from 'react';
import { useUIStore } from '../../stores/useUIStore';

export default function WorkingCapitalCalculator() {
  const language = useUIStore(s => s.language);
  
  const [currentAssets, setCurrentAssets] = useState<number>(500000);
  const [currentLiabilities, setCurrentLiabilities] = useState<number>(300000);

  const calculateWC = () => {
    const wc = currentAssets - currentLiabilities;
    return {
      wc: wc.toLocaleString(),
      isPositive: wc >= 0
    };
  };

  const results = calculateWC();

  return (
    <div className="p-6 max-w-xl mx-auto bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm">
      <h2 className="text-xl font-medium text-slate-900 dark:text-white mb-6">
        {language === 'he' ? 'הון חוזר (Working Capital)' : 'Working Capital Calculator'}
      </h2>
      <p className="text-sm text-slate-500 mb-6">
        {language === 'he' ? 'מודד את הנזילות לטווח הקצר של העסק ואת בריאותו הפיננסית הכללית.' : 'A measure of a company\'s liquidity, operational efficiency and its short-term financial health.'}
      </p>

      <div className="grid grid-cols-2 gap-4 mb-6">
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
            {language === 'he' ? 'נכסים שוטפים ($)' : 'Current Assets ($)'}
          </label>
          <input type="number" value={currentAssets} onChange={(e) => setCurrentAssets(Number(e.target.value))} className="w-full px-3 py-2 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-sm" />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
            {language === 'he' ? 'התחייבויות שוטפות ($)' : 'Current Liabilities ($)'}
          </label>
          <input type="number" value={currentLiabilities} onChange={(e) => setCurrentLiabilities(Number(e.target.value))} className="w-full px-3 py-2 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-sm" />
        </div>
      </div>

      <div className="pt-6 border-t border-slate-100 dark:border-slate-800">
        <div className={`p-4 rounded-xl border flex justify-between items-center mt-4 ${results.isPositive ? 'bg-emerald-50 dark:bg-emerald-900/10 border-emerald-100 dark:border-emerald-800/30' : 'bg-rose-50 dark:bg-rose-900/10 border-rose-100 dark:border-rose-800/30'}`}>
          <div>
            <p className={`text-sm font-medium mb-1 ${results.isPositive ? 'text-emerald-800 dark:text-emerald-400' : 'text-rose-800 dark:text-rose-400'}`}>
              {language === 'he' ? 'הון חוזר (נטו)' : 'Net Working Capital'}
            </p>
          </div>
          <div className={`text-4xl font-bold ${results.isPositive ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
            ${results.wc}
          </div>
        </div>
      </div>
    </div>
  );
}
