import React, { useState } from 'react';
import { useUIStore } from '../../stores/useUIStore';

export default function NetProfitMarginCalculator() {
  const language = useUIStore(s => s.language);
  
  const [revenue, setRevenue] = useState<number>(1000000);
  const [netIncome, setNetIncome] = useState<number>(120000);

  const calculateMargin = () => {
    if (revenue <= 0) return { margin: 0 };
    const margin = (netIncome / revenue) * 100;
    
    return {
      margin: margin.toFixed(2)
    };
  };

  const results = calculateMargin();

  return (
    <div className="p-6 max-w-xl mx-auto bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm">
      <h2 className="text-xl font-medium text-slate-900 dark:text-white mb-6">
        {language === 'he' ? 'שולי רווח נקי (Net Profit Margin)' : 'Net Profit Margin Calculator'}
      </h2>
      <p className="text-sm text-slate-500 mb-6">
        {language === 'he' ? 'מודד כמה מההכנסות הופכות לרווח נקי, לאחר כל ההוצאות, המיסים והריביות.' : 'Measures how much net income or profit is generated as a percentage of revenue.'}
      </p>

      <div className="grid grid-cols-2 gap-4 mb-6">
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
            {language === 'he' ? 'הכנסות / מכירות ($)' : 'Total Revenue ($)'}
          </label>
          <input type="number" value={revenue} onChange={(e) => setRevenue(Number(e.target.value))} className="w-full px-3 py-2 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-sm" />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
            {language === 'he' ? 'רווח נקי ($)' : 'Net Income ($)'}
          </label>
          <input type="number" value={netIncome} onChange={(e) => setNetIncome(Number(e.target.value))} className="w-full px-3 py-2 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-sm" />
        </div>
      </div>

      <div className="pt-6 border-t border-slate-100 dark:border-slate-800">
        <div className="p-4 bg-emerald-50 dark:bg-emerald-900/10 rounded-xl border border-emerald-100 dark:border-emerald-800/30 flex justify-between items-center mt-4">
          <div>
            <p className="text-sm font-medium text-emerald-800 dark:text-emerald-400 mb-1">
              {language === 'he' ? 'שולי רווח נקי' : 'Net Profit Margin'}
            </p>
          </div>
          <div className="text-4xl font-bold text-emerald-600 dark:text-emerald-400">
            {results.margin}%
          </div>
        </div>
      </div>
    </div>
  );
}
