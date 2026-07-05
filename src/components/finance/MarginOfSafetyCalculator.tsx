import React, { useState } from 'react';
import { useUIStore } from '../../stores/useUIStore';

export default function MarginOfSafetyCalculator() {
  const language = useUIStore(s => s.language);
  
  const [intrinsicValue, setIntrinsicValue] = useState<number>(100);
  const [currentPrice, setCurrentPrice] = useState<number>(75);

  const calculateMargin = () => {
    if (intrinsicValue <= 0) return { margin: 0, status: '' };
    const margin = ((intrinsicValue - currentPrice) / intrinsicValue) * 100;
    
    let status = '';
    if (margin >= 20) status = language === 'he' ? 'מרווח טוב לקנייה (מרווח > 20%)' : 'Good Buying Margin (> 20%)';
    else if (margin > 0) status = language === 'he' ? 'מוערך בחסר במעט' : 'Slightly Undervalued';
    else status = language === 'he' ? 'מוערך ביתר (אין מרווח)' : 'Overvalued (No Margin)';

    return {
      margin: margin.toFixed(2),
      status
    };
  };

  const results = calculateMargin();

  return (
    <div className="p-6 max-w-xl mx-auto bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm">
      <h2 className="text-xl font-medium text-slate-900 dark:text-white mb-6">
        {language === 'he' ? 'מרווח ביטחון (Margin of Safety)' : 'Margin of Safety Calculator'}
      </h2>
      <p className="text-sm text-slate-500 mb-6">
        {language === 'he' ? 'עיקרון מרכזי בהשקעות ערך המודד את הפער בין השווי הפנימי של מניה למחירה בשוק.' : 'A core principle of value investing that calculates the percentage difference between a stock\'s intrinsic value and its market price.'}
      </p>

      <div className="grid grid-cols-2 gap-4 mb-6">
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
            {language === 'he' ? 'שווי פנימי מוערך ($)' : 'Estimated Intrinsic Value ($)'}
          </label>
          <input type="number" value={intrinsicValue} onChange={(e) => setIntrinsicValue(Number(e.target.value))} className="w-full px-3 py-2 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-sm" />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
            {language === 'he' ? 'מחיר שוק נוכחי ($)' : 'Current Market Price ($)'}
          </label>
          <input type="number" value={currentPrice} onChange={(e) => setCurrentPrice(Number(e.target.value))} className="w-full px-3 py-2 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-sm" />
        </div>
      </div>

      <div className="pt-6 border-t border-slate-100 dark:border-slate-800">
        <div className={`p-4 rounded-xl border flex justify-between items-center ${Number(results.margin) >= 20 ? 'bg-emerald-50 dark:bg-emerald-900/10 border-emerald-100 dark:border-emerald-800/30' : Number(results.margin) > 0 ? 'bg-indigo-50 dark:bg-indigo-900/10 border-indigo-100 dark:border-indigo-800/30' : 'bg-rose-50 dark:bg-rose-900/10 border-rose-100 dark:border-rose-800/30'}`}>
          <div>
            <p className={`text-sm font-medium mb-1 ${Number(results.margin) >= 20 ? 'text-emerald-800 dark:text-emerald-400' : Number(results.margin) > 0 ? 'text-indigo-800 dark:text-indigo-400' : 'text-rose-800 dark:text-rose-400'}`}>
              {language === 'he' ? 'מרווח ביטחון' : 'Margin of Safety'}
            </p>
            <p className="text-xs opacity-80">{results.status}</p>
          </div>
          <div className={`text-4xl font-bold ${Number(results.margin) >= 20 ? 'text-emerald-600 dark:text-emerald-400' : Number(results.margin) > 0 ? 'text-indigo-600 dark:text-indigo-400' : 'text-rose-600 dark:text-rose-400'}`}>
            {results.margin}%
          </div>
        </div>
      </div>
    </div>
  );
}
