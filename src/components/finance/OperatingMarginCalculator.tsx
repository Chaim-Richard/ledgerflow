import React, { useState } from 'react';
import { useUIStore } from '../../stores/useUIStore';

export default function OperatingMarginCalculator() {
  const language = useUIStore(s => s.language);
  
  const [revenue, setRevenue] = useState<number>(1000000);
  const [operatingIncome, setOperatingIncome] = useState<number>(200000);

  const calculateMargin = () => {
    if (revenue <= 0) return { margin: 0 };
    const margin = (operatingIncome / revenue) * 100;
    
    return {
      margin: margin.toFixed(2)
    };
  };

  const results = calculateMargin();

  return (
    <div className="p-6 max-w-xl mx-auto bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm">
      <h2 className="text-xl font-medium text-slate-900 dark:text-white mb-6">
        {language === 'he' ? 'שולי רווח תפעולי (Operating Margin)' : 'Operating Margin Calculator'}
      </h2>
      <p className="text-sm text-slate-500 mb-6">
        {language === 'he' ? 'מודד כמה רווח החברה מרוויחה על כל דולר של מכירות, לאחר תשלום עבור עלויות ייצור משתנות (כגון שכר וחומרי גלם).' : 'Measures how much profit a company makes on a dollar of sales, after paying for variable costs of production.'}
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
            {language === 'he' ? 'רווח תפעולי (EBIT) ($)' : 'Operating Income ($)'}
          </label>
          <input type="number" value={operatingIncome} onChange={(e) => setOperatingIncome(Number(e.target.value))} className="w-full px-3 py-2 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-sm" />
        </div>
      </div>

      <div className="pt-6 border-t border-slate-100 dark:border-slate-800">
        <div className="p-4 bg-indigo-50 dark:bg-indigo-900/10 rounded-xl border border-indigo-100 dark:border-indigo-800/30 flex justify-between items-center mt-4">
          <div>
            <p className="text-sm font-medium text-indigo-800 dark:text-indigo-400 mb-1">
              {language === 'he' ? 'שולי רווח תפעולי' : 'Operating Margin'}
            </p>
          </div>
          <div className="text-4xl font-bold text-indigo-600 dark:text-indigo-400">
            {results.margin}%
          </div>
        </div>
      </div>
    </div>
  );
}
