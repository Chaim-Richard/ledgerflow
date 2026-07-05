import React, { useState } from 'react';
import { useUIStore } from '../../stores/useUIStore';

export default function OcfRatioCalculator() {
  const language = useUIStore(s => s.language);
  
  const [operatingCashFlow, setOperatingCashFlow] = useState<number>(300000);
  const [currentLiabilities, setCurrentLiabilities] = useState<number>(200000);

  const calculateOCF = () => {
    if (currentLiabilities <= 0) return { ratio: 0, status: '' };
    const ratio = operatingCashFlow / currentLiabilities;
    
    let status = '';
    if (ratio >= 1) status = language === 'he' ? 'טוב (תזרים מכסה התחייבויות)' : 'Good (Cash flow covers liabilities)';
    else status = language === 'he' ? 'חלש (תזרים חסר)' : 'Weak (Insufficient operating cash)';

    return {
      ratio: ratio.toFixed(2),
      status
    };
  };

  const results = calculateOCF();

  return (
    <div className="p-6 max-w-xl mx-auto bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm">
      <h2 className="text-xl font-medium text-slate-900 dark:text-white mb-6">
        {language === 'he' ? 'יחס תזרים מזומנים מפעילות' : 'Operating Cash Flow (OCF) Ratio'}
      </h2>
      <p className="text-sm text-slate-500 mb-6">
        {language === 'he' ? 'מודד כמה טוב התחייבויות שוטפות מכוסות על ידי תזרים המזומנים המופק מפעילות הליבה.' : 'Measures how well current liabilities are covered by the cash flow generated from a company\'s operations.'}
      </p>

      <div className="grid grid-cols-2 gap-4 mb-6">
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
            {language === 'he' ? 'תזרים מפעילות שוטפת ($)' : 'Operating Cash Flow ($)'}
          </label>
          <input type="number" value={operatingCashFlow} onChange={(e) => setOperatingCashFlow(Number(e.target.value))} className="w-full px-3 py-2 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-sm" />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
            {language === 'he' ? 'התחייבויות שוטפות ($)' : 'Current Liabilities ($)'}
          </label>
          <input type="number" value={currentLiabilities} onChange={(e) => setCurrentLiabilities(Number(e.target.value))} className="w-full px-3 py-2 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-sm" />
        </div>
      </div>

      <div className="pt-6 border-t border-slate-100 dark:border-slate-800">
        <div className={`p-4 rounded-xl border flex justify-between items-center ${Number(results.ratio) >= 1 ? 'bg-emerald-50 dark:bg-emerald-900/10 border-emerald-100 dark:border-emerald-800/30' : 'bg-rose-50 dark:bg-rose-900/10 border-rose-100 dark:border-rose-800/30'}`}>
          <div>
            <p className={`text-sm font-medium mb-1 ${Number(results.ratio) >= 1 ? 'text-emerald-800 dark:text-emerald-400' : 'text-rose-800 dark:text-rose-400'}`}>
              {language === 'he' ? 'יחס OCF' : 'OCF Ratio'}
            </p>
            <p className="text-xs opacity-80">{results.status}</p>
          </div>
          <div className={`text-4xl font-bold ${Number(results.ratio) >= 1 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
            {results.ratio}x
          </div>
        </div>
      </div>
    </div>
  );
}
