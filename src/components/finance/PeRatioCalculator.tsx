import React, { useState } from 'react';
import { useUIStore } from '../../stores/useUIStore';

export default function PeRatioCalculator() {
  const language = useUIStore(s => s.language);
  
  const [stockPrice, setStockPrice] = useState<number>(120);
  const [earningsPerShare, setEarningsPerShare] = useState<number>(8);
  const [expectedGrowthRate, setExpectedGrowthRate] = useState<number>(10); // For PEG ratio

  const calculateMetrics = () => {
    const peRatio = earningsPerShare > 0 ? stockPrice / earningsPerShare : 0;
    const earningsYield = stockPrice > 0 ? (earningsPerShare / stockPrice) * 100 : 0;
    const pegRatio = expectedGrowthRate > 0 ? peRatio / expectedGrowthRate : 0;

    return {
      peRatio: peRatio.toFixed(2),
      earningsYield: earningsYield.toFixed(2),
      pegRatio: pegRatio.toFixed(2)
    };
  };

  const results = calculateMetrics();

  return (
    <div className="p-6 max-w-xl mx-auto bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm">
      <h2 className="text-xl font-medium text-slate-900 dark:text-white mb-6">
        {language === 'he' ? 'מכפיל רווח ותשואת רווח' : 'P/E Ratio & Earnings Yield'}
      </h2>
      <p className="text-sm text-slate-500 mb-6">
        {language === 'he' ? 'הערכת שווי של מניה לפי רווחיה.' : 'Valuation metrics based on a company\'s earnings.'}
      </p>

      <div className="grid gap-4 mb-6">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              {language === 'he' ? 'מחיר המניה נוכחי' : 'Current Stock Price'}
            </label>
            <input type="number" step="0.01" value={stockPrice} onChange={(e) => setStockPrice(Number(e.target.value))} className="w-full px-3 py-2 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-sm" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              {language === 'he' ? 'רווח למניה (EPS)' : 'Earnings per Share (EPS)'}
            </label>
            <input type="number" step="0.01" value={earningsPerShare} onChange={(e) => setEarningsPerShare(Number(e.target.value))} className="w-full px-3 py-2 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-sm" />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
            {language === 'he' ? 'קצב צמיחת רווחים צפוי (%)' : 'Expected Earnings Growth Rate (%)'}
          </label>
          <input type="number" step="0.1" value={expectedGrowthRate} onChange={(e) => setExpectedGrowthRate(Number(e.target.value))} className="w-full px-3 py-2 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-sm" />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4 pt-4 border-t border-slate-100 dark:border-slate-800 mt-2">
        <div className="col-span-1 p-3 bg-indigo-50 dark:bg-indigo-900/10 rounded-lg border border-indigo-100 dark:border-indigo-800/30 text-center">
          <p className="text-sm font-medium text-indigo-800 dark:text-indigo-400 mb-1" title="Price / EPS">
            {language === 'he' ? 'מכפיל רווח' : 'P/E Ratio'}
          </p>
          <div className="text-2xl font-bold text-indigo-600 dark:text-indigo-400">
            {results.peRatio}
          </div>
        </div>
        
        <div className="col-span-1 p-3 bg-emerald-50 dark:bg-emerald-900/10 rounded-lg border border-emerald-100 dark:border-emerald-800/30 text-center">
          <p className="text-sm font-medium text-emerald-800 dark:text-emerald-400 mb-1" title="EPS / Price">
            {language === 'he' ? 'תשואת רווח' : 'Earnings Yield'}
          </p>
          <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
            {results.earningsYield}%
          </div>
        </div>

        <div className="col-span-1 p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-200 dark:border-slate-700 text-center">
          <p className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-1" title="P/E Ratio / Growth Rate">
            {language === 'he' ? 'מכפיל PEG' : 'PEG Ratio'}
          </p>
          <div className="text-2xl font-bold text-slate-700 dark:text-slate-300">
            {results.pegRatio}
          </div>
          <p className="text-[10px] text-slate-400 mt-1">{language === 'he' ? 'מתחת ל-1 נחשב זול' : '< 1 is undervalued'}</p>
        </div>
      </div>
    </div>
  );
}
