import React, { useState } from 'react';
import { useUIStore } from '../../stores/useUIStore';

export default function GrossMarginCalculator() {
  const language = useUIStore(s => s.language);
  
  const [revenue, setRevenue] = useState<number>(1000000);
  const [cogs, setCogs] = useState<number>(450000);

  const calculateMargin = () => {
    if (revenue <= 0) return { margin: 0, grossProfit: 0 };
    const grossProfit = revenue - cogs;
    const margin = (grossProfit / revenue) * 100;
    
    return {
      margin: margin.toFixed(2),
      grossProfit: grossProfit.toLocaleString()
    };
  };

  const results = calculateMargin();

  return (
    <div className="p-6 max-w-xl mx-auto bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm">
      <h2 className="text-xl font-medium text-slate-900 dark:text-white mb-6">
        {language === 'he' ? 'שולי רווח גולמי (Gross Margin)' : 'Gross Margin Calculator'}
      </h2>
      <p className="text-sm text-slate-500 mb-6">
        {language === 'he' ? 'אחוז המכירות שנותר לאחר הפחתת עלות המכר (COGS).' : 'The percentage of revenue that exceeds the cost of goods sold (COGS).'}
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
            {language === 'he' ? 'עלות המכר (COGS) ($)' : 'Cost of Goods Sold ($)'}
          </label>
          <input type="number" value={cogs} onChange={(e) => setCogs(Number(e.target.value))} className="w-full px-3 py-2 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-sm" />
        </div>
      </div>

      <div className="pt-6 border-t border-slate-100 dark:border-slate-800 space-y-4">
         <div className="flex justify-between items-center text-sm text-slate-600 dark:text-slate-400 px-2">
          <span>{language === 'he' ? 'רווח גולמי:' : 'Gross Profit:'}</span>
          <span className="font-medium">${results.grossProfit}</span>
        </div>

        <div className="p-4 bg-sky-50 dark:bg-sky-900/10 rounded-xl border border-sky-100 dark:border-sky-800/30 flex justify-between items-center mt-4">
          <div>
            <p className="text-sm font-medium text-sky-800 dark:text-sky-400 mb-1">
              {language === 'he' ? 'שולי רווח גולמי' : 'Gross Margin'}
            </p>
          </div>
          <div className="text-4xl font-bold text-sky-600 dark:text-sky-400">
            {results.margin}%
          </div>
        </div>
      </div>
    </div>
  );
}
