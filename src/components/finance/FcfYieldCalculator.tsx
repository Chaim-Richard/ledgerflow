import React, { useState } from 'react';
import { useUIStore } from '../../stores/useUIStore';

export default function FcfYieldCalculator() {
  const language = useUIStore(s => s.language);
  
  const [fcf, setFcf] = useState<number>(2000000);
  const [marketCap, setMarketCap] = useState<number>(50000000);

  const calculateYield = () => {
    if (marketCap <= 0) return { yield: 0, multiple: 0 };
    const fcfYield = (fcf / marketCap) * 100;
    const multiple = marketCap / fcf;
    
    return {
      yield: fcfYield.toFixed(2),
      multiple: multiple.toFixed(2)
    };
  };

  const results = calculateYield();

  return (
    <div className="p-6 max-w-xl mx-auto bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm">
      <h2 className="text-xl font-medium text-slate-900 dark:text-white mb-6">
        {language === 'he' ? 'תשואת תזרים מזומנים חופשי (FCF Yield)' : 'Free Cash Flow (FCF) Yield'}
      </h2>
      <p className="text-sm text-slate-500 mb-6">
        {language === 'he' ? 'משווה את תזרים המזומנים החופשי לשווי השוק של החברה (מדד ערך מחמיר יותר מ-P/E).' : 'An evaluation metric comparing a company\'s free cash flow to its market value.'}
      </p>

      <div className="grid grid-cols-2 gap-4 mb-6">
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
            {language === 'he' ? 'תזרים חופשי (FCF) ($)' : 'Free Cash Flow ($)'}
          </label>
          <input type="number" value={fcf} onChange={(e) => setFcf(Number(e.target.value))} className="w-full px-3 py-2 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-sm" />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
            {language === 'he' ? 'שווי שוק ($)' : 'Market Cap ($)'}
          </label>
          <input type="number" value={marketCap} onChange={(e) => setMarketCap(Number(e.target.value))} className="w-full px-3 py-2 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-sm" />
        </div>
      </div>

      <div className="pt-6 border-t border-slate-100 dark:border-slate-800 space-y-4">
        <div className="flex justify-between items-center text-sm text-slate-600 dark:text-slate-400 px-2">
          <span>{language === 'he' ? 'מכפיל FCF:' : 'Price / FCF Multiple:'}</span>
          <span className="font-medium">{results.multiple}x</span>
        </div>
        
        <div className="p-4 bg-sky-50 dark:bg-sky-900/10 rounded-xl border border-sky-100 dark:border-sky-800/30 flex justify-between items-center mt-4">
          <div>
            <p className="text-sm font-medium text-sky-800 dark:text-sky-400 mb-1">
              {language === 'he' ? 'תשואת FCF' : 'FCF Yield'}
            </p>
          </div>
          <div className="text-4xl font-bold text-sky-600 dark:text-sky-400">
            {results.yield}%
          </div>
        </div>
      </div>
    </div>
  );
}
