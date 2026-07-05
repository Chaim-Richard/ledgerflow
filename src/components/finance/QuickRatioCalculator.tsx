import React, { useState } from 'react';
import { useUIStore } from '../../stores/useUIStore';

export default function QuickRatioCalculator() {
  const language = useUIStore(s => s.language);
  
  const [cash, setCash] = useState<number>(40000);
  const [marketableSecurities, setMarketableSecurities] = useState<number>(10000);
  const [accountsReceivable, setAccountsReceivable] = useState<number>(30000);
  const [currentLiabilities, setCurrentLiabilities] = useState<number>(50000);

  const calculateQuickRatio = () => {
    if (currentLiabilities <= 0) return { ratio: 0, status: '' };
    const quickAssets = cash + marketableSecurities + accountsReceivable;
    const ratio = quickAssets / currentLiabilities;
    
    let status = '';
    if (ratio >= 1) status = language === 'he' ? 'טוב (יכולת לכסות התחייבויות)' : 'Good (Can cover short-term liabilities)';
    else status = language === 'he' ? 'חלש (סיכון נזילות)' : 'Weak (Potential liquidity risk)';

    return {
      ratio: ratio.toFixed(2),
      quickAssets,
      status
    };
  };

  const results = calculateQuickRatio();

  return (
    <div className="p-6 max-w-xl mx-auto bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm">
      <h2 className="text-xl font-medium text-slate-900 dark:text-white mb-6">
        {language === 'he' ? 'יחס מהיר (Acid-Test)' : 'Quick Ratio (Acid-Test)'}
      </h2>
      <p className="text-sm text-slate-500 mb-6">
        {language === 'he' ? 'מודד את יכולת החברה לפרוע את התחייבויותיה השוטפות תוך שימוש בנכסיה הנזילים ביותר (ללא מלאי).' : 'Measures a company\'s ability to pay its current liabilities without needing to sell its inventory.'}
      </p>

      <div className="grid gap-4 mb-6">
        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              {language === 'he' ? 'מזומנים ($)' : 'Cash ($)'}
            </label>
            <input type="number" value={cash} onChange={(e) => setCash(Number(e.target.value))} className="w-full px-3 py-2 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-sm" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              {language === 'he' ? 'ני״ע סחירים ($)' : 'Securities ($)'}
            </label>
            <input type="number" value={marketableSecurities} onChange={(e) => setMarketableSecurities(Number(e.target.value))} className="w-full px-3 py-2 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-sm" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              {language === 'he' ? 'חייבים ($)' : 'A/R ($)'}
            </label>
            <input type="number" value={accountsReceivable} onChange={(e) => setAccountsReceivable(Number(e.target.value))} className="w-full px-3 py-2 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-sm" />
          </div>
        </div>
        
        <div className="pt-2">
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
            {language === 'he' ? 'התחייבויות שוטפות ($)' : 'Current Liabilities ($)'}
          </label>
          <input type="number" value={currentLiabilities} onChange={(e) => setCurrentLiabilities(Number(e.target.value))} className="w-full px-3 py-2 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-sm" />
        </div>
      </div>

      <div className="pt-6 border-t border-slate-100 dark:border-slate-800 space-y-4">
        <div className="flex justify-between items-center text-sm text-slate-600 dark:text-slate-400 px-2">
          <span>{language === 'he' ? 'סך נכסים מהירים:' : 'Total Quick Assets:'}</span>
          <span className="font-medium">${Number(results.quickAssets).toLocaleString()}</span>
        </div>
        
        <div className={`p-4 rounded-xl border flex justify-between items-center mt-4 ${Number(results.ratio) >= 1 ? 'bg-emerald-50 dark:bg-emerald-900/10 border-emerald-100 dark:border-emerald-800/30' : 'bg-rose-50 dark:bg-rose-900/10 border-rose-100 dark:border-rose-800/30'}`}>
          <div>
            <p className={`text-sm font-medium mb-1 ${Number(results.ratio) >= 1 ? 'text-emerald-800 dark:text-emerald-400' : 'text-rose-800 dark:text-rose-400'}`}>
              {language === 'he' ? 'יחס מהיר' : 'Quick Ratio'}
            </p>
            <p className="text-xs opacity-80">{results.status}</p>
          </div>
          <div className={`text-4xl font-bold ${Number(results.ratio) >= 1 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
            {results.ratio}
          </div>
        </div>
      </div>
    </div>
  );
}
