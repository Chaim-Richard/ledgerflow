import React, { useState } from 'react';
import { useUIStore } from '../../stores/useUIStore';

export default function PriceToBookCalculator() {
  const language = useUIStore(s => s.language);
  
  const [sharePrice, setSharePrice] = useState<number>(50);
  const [bookValuePerShare, setBookValuePerShare] = useState<number>(25);

  const calculateRatio = () => {
    if (bookValuePerShare <= 0) return { ratio: 0 };
    const ratio = sharePrice / bookValuePerShare;
    return { ratio: ratio.toFixed(2) };
  };

  const results = calculateRatio();

  return (
    <div className="p-6 max-w-xl mx-auto bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm">
      <h2 className="text-xl font-medium text-slate-900 dark:text-white mb-6">
        {language === 'he' ? 'יחס מחיר לערך בספרים (P/B)' : 'Price-to-Book Ratio (P/B)'}
      </h2>
      <p className="text-sm text-slate-500 mb-6">
        {language === 'he' ? 'משווה את שווי השוק של החברה לערכה בספרים.' : 'Compares a company\'s market value to its book value.'}
      </p>

      <div className="grid grid-cols-2 gap-4 mb-6">
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
            {language === 'he' ? 'מחיר למניה ($)' : 'Share Price ($)'}
          </label>
          <input type="number" value={sharePrice} onChange={(e) => setSharePrice(Number(e.target.value))} className="w-full px-3 py-2 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-sm" />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
            {language === 'he' ? 'ערך בספרים למניה ($)' : 'Book Value Per Share ($)'}
          </label>
          <input type="number" value={bookValuePerShare} onChange={(e) => setBookValuePerShare(Number(e.target.value))} className="w-full px-3 py-2 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-sm" />
        </div>
      </div>

      <div className="pt-6 border-t border-slate-100 dark:border-slate-800">
        <div className="p-4 bg-indigo-50 dark:bg-indigo-900/10 rounded-xl border border-indigo-100 dark:border-indigo-800/30 flex justify-between items-center mt-4">
          <div>
            <p className="text-sm font-medium text-indigo-800 dark:text-indigo-400 mb-1">
              {language === 'he' ? 'יחס P/B' : 'P/B Ratio'}
            </p>
          </div>
          <div className="text-4xl font-bold text-indigo-600 dark:text-indigo-400">
            {results.ratio}
          </div>
        </div>
      </div>
    </div>
  );
}
