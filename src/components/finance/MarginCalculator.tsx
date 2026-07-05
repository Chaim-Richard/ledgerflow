import React, { useState } from 'react';
import { useUIStore } from '../../stores/useUIStore';

export default function MarginCalculator() {
  const language = useUIStore(s => s.language);
  const [cost, setCost] = useState<number>(100);
  const [revenue, setRevenue] = useState<number>(150);

  const calculateMetrics = () => {
    const grossProfit = revenue - cost;
    const margin = revenue > 0 ? (grossProfit / revenue) * 100 : 0;
    const markup = cost > 0 ? (grossProfit / cost) * 100 : 0;
    
    return {
      grossProfit: grossProfit.toFixed(2),
      margin: margin.toFixed(2),
      markup: markup.toFixed(2)
    };
  };

  const metrics = calculateMetrics();

  return (
    <div className="p-6 max-w-xl mx-auto bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm">
      <h2 className="text-xl font-medium text-slate-900 dark:text-white mb-6">
        {language === 'he' ? 'מחשבון שולי רווח' : 'Margin & Markup Calculator'}
      </h2>

      <div className="grid grid-cols-2 gap-4 mb-6">
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
            {language === 'he' ? 'עלות (Cost)' : 'Cost'}
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
            {language === 'he' ? 'הכנסה (Revenue)' : 'Revenue'}
          </label>
          <input
            type="number"
            value={revenue}
            onChange={(e) => setRevenue(Number(e.target.value))}
            className="w-full px-3 py-2 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-sm"
          />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4 pt-4 border-t border-slate-100 dark:border-slate-800">
        <div>
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-1">
            {language === 'he' ? 'רווח גולמי' : 'Gross Profit'}
          </p>
          <p className="text-xl font-medium text-slate-900 dark:text-white">${metrics.grossProfit}</p>
        </div>
        
        <div>
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-1">
            {language === 'he' ? 'שולי רווח (Margin)' : 'Margin'}
          </p>
          <p className="text-xl font-medium text-emerald-600 dark:text-emerald-400">{metrics.margin}%</p>
        </div>
        
        <div>
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-1">
            {language === 'he' ? 'סימון (Markup)' : 'Markup'}
          </p>
          <p className="text-xl font-medium text-blue-600 dark:text-blue-400">{metrics.markup}%</p>
        </div>
      </div>
    </div>
  );
}
