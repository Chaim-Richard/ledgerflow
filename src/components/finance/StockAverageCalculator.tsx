import React, { useState } from 'react';
import { useUIStore } from '../../stores/useUIStore';

export default function StockAverageCalculator() {
  const language = useUIStore(s => s.language);
  const [shares1, setShares1] = useState<number>(100);
  const [price1, setPrice1] = useState<number>(50);
  const [shares2, setShares2] = useState<number>(50);
  const [price2, setPrice2] = useState<number>(45);

  const calculateAverage = () => {
    if (shares1 < 0 || price1 < 0 || shares2 < 0 || price2 < 0) return { totalShares: 0, averagePrice: 0, totalCost: 0 };
    
    const cost1 = shares1 * price1;
    const cost2 = shares2 * price2;
    const totalCost = cost1 + cost2;
    const totalShares = shares1 + shares2;
    const averagePrice = totalShares > 0 ? totalCost / totalShares : 0;

    return {
      totalShares,
      averagePrice: averagePrice.toFixed(2),
      totalCost: totalCost.toFixed(2)
    };
  };

  const results = calculateAverage();

  return (
    <div className="p-6 max-w-xl mx-auto bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm">
      <h2 className="text-xl font-medium text-slate-900 dark:text-white mb-6">
        {language === 'he' ? 'מחשבון מיצוע מניות' : 'Stock Average Calculator'}
      </h2>

      <div className="grid gap-6 mb-6">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <h3 className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2 border-b border-slate-200 dark:border-slate-800 pb-1">
              {language === 'he' ? 'רכישה ראשונה' : 'First Purchase'}
            </h3>
            <div className="space-y-3">
              <div>
                <label className="block text-xs text-slate-600 dark:text-slate-400 mb-1">
                  {language === 'he' ? 'כמות מניות' : 'Number of Shares'}
                </label>
                <input type="number" value={shares1} onChange={(e) => setShares1(Number(e.target.value))} className="w-full px-3 py-1.5 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-sm" />
              </div>
              <div>
                <label className="block text-xs text-slate-600 dark:text-slate-400 mb-1">
                  {language === 'he' ? 'מחיר למניה' : 'Purchase Price'}
                </label>
                <input type="number" value={price1} onChange={(e) => setPrice1(Number(e.target.value))} className="w-full px-3 py-1.5 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-sm" />
              </div>
            </div>
          </div>
          
          <div>
            <h3 className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2 border-b border-slate-200 dark:border-slate-800 pb-1">
              {language === 'he' ? 'רכישה שנייה (מיצוע)' : 'Second Purchase'}
            </h3>
            <div className="space-y-3">
              <div>
                <label className="block text-xs text-slate-600 dark:text-slate-400 mb-1">
                  {language === 'he' ? 'כמות מניות' : 'Number of Shares'}
                </label>
                <input type="number" value={shares2} onChange={(e) => setShares2(Number(e.target.value))} className="w-full px-3 py-1.5 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-sm" />
              </div>
              <div>
                <label className="block text-xs text-slate-600 dark:text-slate-400 mb-1">
                  {language === 'he' ? 'מחיר למניה' : 'Purchase Price'}
                </label>
                <input type="number" value={price2} onChange={(e) => setPrice2(Number(e.target.value))} className="w-full px-3 py-1.5 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-sm" />
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-y-6 gap-x-4 pt-4 border-t border-slate-100 dark:border-slate-800 mt-2">
        <div>
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-1">
            {language === 'he' ? 'סה״כ מניות' : 'Total Shares'}
          </p>
          <div className="text-2xl font-medium text-slate-700 dark:text-slate-300">
            {results.totalShares}
          </div>
        </div>
        <div className="bg-slate-50 dark:bg-slate-800/50 p-3 rounded-lg -my-3 col-span-2 flex flex-col justify-center">
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-1">
            {language === 'he' ? 'מחיר ממוצע למניה' : 'Average Price per Share'}
          </p>
          <div className="text-3xl font-bold text-indigo-600 dark:text-indigo-400">
            ${results.averagePrice}
          </div>
          <p className="text-xs text-slate-500 mt-1">
             {language === 'he' ? 'עלות כוללת: ' : 'Total Cost: '}${results.totalCost}
          </p>
        </div>
      </div>
    </div>
  );
}
