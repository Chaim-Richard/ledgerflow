import React, { useState } from 'react';
import { useUIStore } from '../../stores/useUIStore';

export default function EarningsYieldCalculator() {
  const language = useUIStore(s => s.language);
  
  const [eps, setEps] = useState<number>(5.00);
  const [sharePrice, setSharePrice] = useState<number>(100.00);

  const calculateYield = () => {
    if (sharePrice <= 0) return { yield: 0, peRatio: 0 };
    const earningsYield = (eps / sharePrice) * 100;
    const peRatio = sharePrice / eps;
    
    return {
      yield: earningsYield.toFixed(2),
      peRatio: peRatio.toFixed(2)
    };
  };

  const results = calculateYield();

  return (
    <div className="p-6 max-w-xl mx-auto bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm">
      <h2 className="text-xl font-medium text-slate-900 dark:text-white mb-6">
        {language === 'he' ? 'תשואת רווחים (Earnings Yield)' : 'Earnings Yield Calculator'}
      </h2>
      <p className="text-sm text-slate-500 mb-6">
        {language === 'he' ? 'הרווח למניה (EPS) מחולק במחיר המניה. זהו ההופכי של מכפיל הרווח (P/E).' : 'Earnings per share (EPS) divided by the share price. It is the reciprocal of the P/E ratio.'}
      </p>

      <div className="grid grid-cols-2 gap-4 mb-6">
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
            {language === 'he' ? 'רווח למניה (EPS) ($)' : 'Earnings Per Share (EPS)'}
          </label>
          <input type="number" step="0.01" value={eps} onChange={(e) => setEps(Number(e.target.value))} className="w-full px-3 py-2 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-sm" />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
            {language === 'he' ? 'מחיר מניה ($)' : 'Current Share Price ($)'}
          </label>
          <input type="number" step="0.01" value={sharePrice} onChange={(e) => setSharePrice(Number(e.target.value))} className="w-full px-3 py-2 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-sm" />
        </div>
      </div>

      <div className="pt-6 border-t border-slate-100 dark:border-slate-800 space-y-4">
        <div className="flex justify-between items-center text-sm text-slate-600 dark:text-slate-400 px-2">
          <span>{language === 'he' ? 'מכפיל רווח (P/E):' : 'Implied P/E Ratio:'}</span>
          <span className="font-medium">{results.peRatio}x</span>
        </div>
        
        <div className="p-4 bg-emerald-50 dark:bg-emerald-900/10 rounded-xl border border-emerald-100 dark:border-emerald-800/30 flex justify-between items-center mt-4">
          <div>
            <p className="text-sm font-medium text-emerald-800 dark:text-emerald-400 mb-1">
              {language === 'he' ? 'תשואת רווחים' : 'Earnings Yield'}
            </p>
          </div>
          <div className="text-4xl font-bold text-emerald-600 dark:text-emerald-400">
            {results.yield}%
          </div>
        </div>
      </div>
    </div>
  );
}
