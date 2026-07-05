import React, { useState } from 'react';
import { useUIStore } from '../../stores/useUIStore';

export default function PriceToSalesCalculator() {
  const language = useUIStore(s => s.language);
  
  const [marketCap, setMarketCap] = useState<number>(5000000);
  const [totalSales, setTotalSales] = useState<number>(2500000);

  const calculatePS = () => {
    if (totalSales <= 0) return { ps: 0, status: '' };
    const ps = marketCap / totalSales;
    
    let status = '';
    if (ps < 1) status = language === 'he' ? 'זול מבחינת מכירות' : 'Low (Value)';
    else if (ps <= 2) status = language === 'he' ? 'ממוצע' : 'Average';
    else status = language === 'he' ? 'גבוה (ציפיית צמיחה רבה)' : 'High (Growth expected)';

    return {
      ps: ps.toFixed(2),
      status
    };
  };

  const results = calculatePS();

  return (
    <div className="p-6 max-w-xl mx-auto bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm">
      <h2 className="text-xl font-medium text-slate-900 dark:text-white mb-6">
        {language === 'he' ? 'מכפיל מכירות (P/S)' : 'Price-to-Sales (P/S) Ratio'}
      </h2>
      <p className="text-sm text-slate-500 mb-6">
        {language === 'he' ? 'משווה את שווי השוק של החברה להכנסות שלה. שימושי במיוחד לחברות שעדיין לא רווחיות.' : 'Compares a company\'s stock price to its revenues. Often used for evaluating companies that do not have net income.'}
      </p>

      <div className="grid grid-cols-2 gap-4 mb-6">
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
            {language === 'he' ? 'שווי שוק ($)' : 'Market Cap ($)'}
          </label>
          <input type="number" value={marketCap} onChange={(e) => setMarketCap(Number(e.target.value))} className="w-full px-3 py-2 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-sm" />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
            {language === 'he' ? 'סך הכל מכירות - 12 חודשים ($)' : 'Total Sales TTM ($)'}
          </label>
          <input type="number" value={totalSales} onChange={(e) => setTotalSales(Number(e.target.value))} className="w-full px-3 py-2 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-sm" />
        </div>
      </div>

      <div className="pt-6 border-t border-slate-100 dark:border-slate-800">
        <div className={`p-4 rounded-xl border flex justify-between items-center ${Number(results.ps) < 1 ? 'bg-emerald-50 dark:bg-emerald-900/10 border-emerald-100 dark:border-emerald-800/30' : Number(results.ps) <= 2 ? 'bg-amber-50 dark:bg-amber-900/10 border-amber-100 dark:border-amber-800/30' : 'bg-rose-50 dark:bg-rose-900/10 border-rose-100 dark:border-rose-800/30'}`}>
          <div>
            <p className={`text-sm font-medium mb-1 ${Number(results.ps) < 1 ? 'text-emerald-800 dark:text-emerald-400' : Number(results.ps) <= 2 ? 'text-amber-800 dark:text-amber-400' : 'text-rose-800 dark:text-rose-400'}`}>
              {language === 'he' ? 'מכפיל מכירות' : 'P/S Ratio'}
            </p>
            <p className="text-xs opacity-80">{results.status}</p>
          </div>
          <div className={`text-4xl font-bold ${Number(results.ps) < 1 ? 'text-emerald-600 dark:text-emerald-400' : Number(results.ps) <= 2 ? 'text-amber-600 dark:text-amber-400' : 'text-rose-600 dark:text-rose-400'}`}>
            {results.ps}
          </div>
        </div>
      </div>
    </div>
  );
}
