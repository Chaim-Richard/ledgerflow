import React, { useState } from 'react';
import { useUIStore } from '../../stores/useUIStore';

export default function MarginMarkupCalculator() {
  const language = useUIStore(s => s.language);
  const [cost, setCost] = useState<number>(50);
  const [price, setPrice] = useState<number>(100);

  const calculateMetrics = () => {
    if (cost <= 0 || price <= 0) return { margin: 0, markup: 0, profit: 0 };
    
    const profit = price - cost;
    const margin = (profit / price) * 100;
    const markup = (profit / cost) * 100;

    return {
      profit: profit.toFixed(2),
      margin: margin.toFixed(2),
      markup: markup.toFixed(2)
    };
  };

  const results = calculateMetrics();

  return (
    <div className="p-6 max-w-xl mx-auto bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm">
      <h2 className="text-xl font-medium text-slate-900 dark:text-white mb-6">
        {language === 'he' ? 'מחשבון שולי רווח לעומת סימון (Margin vs Markup)' : 'Margin vs Markup Calculator'}
      </h2>

      <div className="grid gap-4 mb-6">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              {language === 'he' ? 'עלות הפריט' : 'Cost of Item'}
            </label>
            <input
              type="number"
              value={cost}
              onChange={(e) => setCost(Number(e.target.value))}
              className="w-full px-3 py-2 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              {language === 'he' ? 'מחיר מכירה' : 'Selling Price'}
            </label>
            <input
              type="number"
              value={price}
              onChange={(e) => setPrice(Number(e.target.value))}
              className="w-full px-3 py-2 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-sm"
            />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-y-6 gap-x-4 pt-4 border-t border-slate-100 dark:border-slate-800 mt-2">
        <div>
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-1">
            {language === 'he' ? 'רווח גולמי' : 'Gross Profit'}
          </p>
          <div className="text-2xl font-medium text-emerald-600 dark:text-emerald-400">
            ${results.profit}
          </div>
        </div>
        <div>
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-1">
            {language === 'he' ? 'שולי רווח (Margin)' : 'Margin'}
          </p>
          <div className="text-2xl font-medium text-indigo-600 dark:text-indigo-400">
            {results.margin}%
          </div>
        </div>
        <div>
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-1">
            {language === 'he' ? 'סימון (Markup)' : 'Markup'}
          </p>
          <div className="text-2xl font-medium text-indigo-600 dark:text-indigo-400">
            {results.markup}%
          </div>
        </div>
      </div>
    </div>
  );
}
