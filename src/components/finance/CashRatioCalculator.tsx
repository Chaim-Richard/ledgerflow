import React, { useState } from 'react';
import { useUIStore } from '../../stores/useUIStore';

export default function CashRatioCalculator() {
  const language = useUIStore(s => s.language);
  
  const [cash, setCash] = useState<number>(250000);
  const [cashEquivalents, setCashEquivalents] = useState<number>(50000);
  const [currentLiabilities, setCurrentLiabilities] = useState<number>(400000);

  const calculateRatio = () => {
    if (currentLiabilities <= 0) return { ratio: 0, status: '' };
    const ratio = (cash + cashEquivalents) / currentLiabilities;
    
    let status = '';
    if (ratio >= 1) status = language === 'he' ? 'מצוין (יכולת מלאה לכסות חובות)' : 'Excellent (Full capacity to cover liabilities)';
    else if (ratio >= 0.5) status = language === 'he' ? 'תקין' : 'Adequate';
    else status = language === 'he' ? 'סיכון נזילות (לא מספיק מזומן)' : 'Liquidity Risk (Insufficient cash)';

    return {
      ratio: ratio.toFixed(2),
      status
    };
  };

  const results = calculateRatio();

  return (
    <div className="p-6 max-w-xl mx-auto bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm">
      <h2 className="text-xl font-medium text-slate-900 dark:text-white mb-6">
        {language === 'he' ? 'יחס מזומן (Cash Ratio)' : 'Cash Ratio Calculator'}
      </h2>
      <p className="text-sm text-slate-500 mb-6">
        {language === 'he' ? 'מודד את יכולתה של חברה לפרוע את התחייבויותיה לטווח קצר באמצעות מזומנים ושווי מזומנים בלבד.' : 'Measures a company\'s ability to pay off short-term liabilities with cash and cash equivalents.'}
      </p>

      <div className="grid grid-cols-2 gap-4 mb-6">
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
            {language === 'he' ? 'מזומן ($)' : 'Cash ($)'}
          </label>
          <input type="number" value={cash} onChange={(e) => setCash(Number(e.target.value))} className="w-full px-3 py-2 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-sm" />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
            {language === 'he' ? 'שווי מזומנים ($)' : 'Cash Equivalents ($)'}
          </label>
          <input type="number" value={cashEquivalents} onChange={(e) => setCashEquivalents(Number(e.target.value))} className="w-full px-3 py-2 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-sm" />
        </div>
        <div className="col-span-2">
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
            {language === 'he' ? 'התחייבויות שוטפות ($)' : 'Current Liabilities ($)'}
          </label>
          <input type="number" value={currentLiabilities} onChange={(e) => setCurrentLiabilities(Number(e.target.value))} className="w-full px-3 py-2 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-sm" />
        </div>
      </div>

      <div className="pt-6 border-t border-slate-100 dark:border-slate-800">
        <div className={`p-4 rounded-xl border flex justify-between items-center ${Number(results.ratio) >= 0.5 ? 'bg-emerald-50 dark:bg-emerald-900/10 border-emerald-100 dark:border-emerald-800/30' : 'bg-rose-50 dark:bg-rose-900/10 border-rose-100 dark:border-rose-800/30'}`}>
          <div>
            <p className={`text-sm font-medium mb-1 ${Number(results.ratio) >= 0.5 ? 'text-emerald-800 dark:text-emerald-400' : 'text-rose-800 dark:text-rose-400'}`}>
              {language === 'he' ? 'יחס מזומן' : 'Cash Ratio'}
            </p>
            <p className="text-xs opacity-80">{results.status}</p>
          </div>
          <div className={`text-4xl font-bold ${Number(results.ratio) >= 0.5 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
            {results.ratio}
          </div>
        </div>
      </div>
    </div>
  );
}
