import React, { useState } from 'react';
import { useUIStore } from '../../stores/useUIStore';

export default function PriceToCashFlowCalculator() {
  const language = useUIStore(s => s.language);
  
  const [marketCap, setMarketCap] = useState<number>(5000000);
  const [operatingCashFlow, setOperatingCashFlow] = useState<number>(600000);

  const calculateRatio = () => {
    if (operatingCashFlow <= 0) return { ratio: 0, status: '' };
    const ratio = marketCap / operatingCashFlow;
    
    let status = '';
    if (ratio < 10) status = language === 'he' ? 'מוערך בחסר (תזרים חזק)' : 'Potentially Undervalued (Strong CF)';
    else if (ratio < 20) status = language === 'he' ? 'הערכת שווי סבירה' : 'Fair Valuation';
    else status = language === 'he' ? 'מוערך ביתר' : 'Potentially Overvalued';

    return {
      ratio: ratio.toFixed(2),
      status
    };
  };

  const results = calculateRatio();

  return (
    <div className="p-6 max-w-xl mx-auto bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm">
      <h2 className="text-xl font-medium text-slate-900 dark:text-white mb-6">
        {language === 'he' ? 'מכפיל תזרים מזומנים (P/CF)' : 'Price-to-Cash-Flow Ratio (P/CF)'}
      </h2>
      <p className="text-sm text-slate-500 mb-6">
        {language === 'he' ? 'מודד את שווי השוק של החברה ביחס לתזרים המזומנים התפעולי שלה. אינדיקטור טוב ליכולת החברה לייצר מזומן.' : 'Measures the value of a stock\'s price relative to its operating cash flow per share (or market cap to total operating cash flow).'}
      </p>

      <div className="grid grid-cols-2 gap-4 mb-6">
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
            {language === 'he' ? 'שווי שוק ($)' : 'Market Capitalization ($)'}
          </label>
          <input type="number" value={marketCap} onChange={(e) => setMarketCap(Number(e.target.value))} className="w-full px-3 py-2 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-sm" />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
            {language === 'he' ? 'תזרים מזומנים תפעולי ($)' : 'Operating Cash Flow ($)'}
          </label>
          <input type="number" value={operatingCashFlow} onChange={(e) => setOperatingCashFlow(Number(e.target.value))} className="w-full px-3 py-2 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-sm" />
        </div>
      </div>

      <div className="pt-6 border-t border-slate-100 dark:border-slate-800">
        <div className={`p-4 rounded-xl border flex justify-between items-center ${Number(results.ratio) < 15 && Number(results.ratio) > 0 ? 'bg-emerald-50 dark:bg-emerald-900/10 border-emerald-100 dark:border-emerald-800/30' : Number(results.ratio) >= 20 ? 'bg-rose-50 dark:bg-rose-900/10 border-rose-100 dark:border-rose-800/30' : 'bg-indigo-50 dark:bg-indigo-900/10 border-indigo-100 dark:border-indigo-800/30'}`}>
          <div>
            <p className={`text-sm font-medium mb-1 ${Number(results.ratio) < 15 && Number(results.ratio) > 0 ? 'text-emerald-800 dark:text-emerald-400' : Number(results.ratio) >= 20 ? 'text-rose-800 dark:text-rose-400' : 'text-indigo-800 dark:text-indigo-400'}`}>
              {language === 'he' ? 'מכפיל P/CF' : 'P/CF Ratio'}
            </p>
            <p className="text-xs opacity-80">{results.status}</p>
          </div>
          <div className={`text-4xl font-bold ${Number(results.ratio) < 15 && Number(results.ratio) > 0 ? 'text-emerald-600 dark:text-emerald-400' : Number(results.ratio) >= 20 ? 'text-rose-600 dark:text-rose-400' : 'text-indigo-600 dark:text-indigo-400'}`}>
            {results.ratio}x
          </div>
        </div>
      </div>
    </div>
  );
}
