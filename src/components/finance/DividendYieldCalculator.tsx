import React, { useState } from 'react';
import { useUIStore } from '../../stores/useUIStore';

export default function DividendYieldCalculator() {
  const language = useUIStore(s => s.language);
  
  const [annualDividend, setAnnualDividend] = useState<number>(2.50);
  const [sharePrice, setSharePrice] = useState<number>(50.00);

  const calculateYield = () => {
    if (sharePrice <= 0) return { yield: 0 };
    const dividendYield = (annualDividend / sharePrice) * 100;
    
    return {
      yield: dividendYield.toFixed(2)
    };
  };

  const results = calculateYield();

  return (
    <div className="p-6 max-w-xl mx-auto bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm">
      <h2 className="text-xl font-medium text-slate-900 dark:text-white mb-6">
        {language === 'he' ? 'תשואת דיבידנד' : 'Dividend Yield Calculator'}
      </h2>
      <p className="text-sm text-slate-500 mb-6">
        {language === 'he' ? 'מציג כמה חברה משלמת בדיבידנדים בכל שנה ביחס למחיר המניה שלה.' : 'Shows how much a company pays out in dividends each year relative to its stock price.'}
      </p>

      <div className="grid grid-cols-2 gap-4 mb-6">
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
            {language === 'he' ? 'דיבידנד שנתי למניה ($)' : 'Annual Dividend per Share ($)'}
          </label>
          <input type="number" step="0.01" value={annualDividend} onChange={(e) => setAnnualDividend(Number(e.target.value))} className="w-full px-3 py-2 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-sm" />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
            {language === 'he' ? 'מחיר מניה ($)' : 'Current Share Price ($)'}
          </label>
          <input type="number" step="0.01" value={sharePrice} onChange={(e) => setSharePrice(Number(e.target.value))} className="w-full px-3 py-2 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-sm" />
        </div>
      </div>

      <div className="pt-6 border-t border-slate-100 dark:border-slate-800">
        <div className="p-4 bg-indigo-50 dark:bg-indigo-900/10 rounded-xl border border-indigo-100 dark:border-indigo-800/30 flex justify-between items-center mt-4">
          <div>
            <p className="text-sm font-medium text-indigo-800 dark:text-indigo-400 mb-1">
              {language === 'he' ? 'תשואת דיבידנד' : 'Dividend Yield'}
            </p>
          </div>
          <div className="text-4xl font-bold text-indigo-600 dark:text-indigo-400">
            {results.yield}%
          </div>
        </div>
      </div>
    </div>
  );
}
