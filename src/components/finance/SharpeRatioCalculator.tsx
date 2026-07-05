import React, { useState } from 'react';
import { useUIStore } from '../../stores/useUIStore';

export default function SharpeRatioCalculator() {
  const language = useUIStore(s => s.language);
  
  const [portfolioReturn, setPortfolioReturn] = useState<number>(10);
  const [riskFreeRate, setRiskFreeRate] = useState<number>(3);
  const [portfolioStdDev, setPortfolioStdDev] = useState<number>(12); // Standard Deviation (Volatility)

  const calculateSharpe = () => {
    if (portfolioStdDev <= 0) return { sharpe: 0, rating: '' };

    const sharpe = (portfolioReturn - riskFreeRate) / portfolioStdDev;
    
    let rating = '';
    if (sharpe >= 3) rating = language === 'he' ? 'מצוין (Excellent)' : 'Excellent';
    else if (sharpe >= 2) rating = language === 'he' ? 'טוב מאוד (Very Good)' : 'Very Good';
    else if (sharpe >= 1) rating = language === 'he' ? 'טוב (Good)' : 'Good';
    else if (sharpe > 0) rating = language === 'he' ? 'סביר (Sub-optimal)' : 'Sub-optimal';
    else rating = language === 'he' ? 'גרוע (Bad/Negative)' : 'Bad/Negative';

    return {
      sharpe: sharpe.toFixed(2),
      rating
    };
  };

  const results = calculateSharpe();

  return (
    <div className="p-6 max-w-xl mx-auto bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm">
      <h2 className="text-xl font-medium text-slate-900 dark:text-white mb-6">
        {language === 'he' ? 'מדד שארפ (Sharpe Ratio)' : 'Sharpe Ratio Calculator'}
      </h2>
      <p className="text-sm text-slate-500 mb-6">
        {language === 'he' ? 'מודד ביצועים של תיק השקעות בהתאמה לסיכון (העודף תשואה על פני נכס חסר סיכון, מחולק בסטיית התקן).' : 'Measures the risk-adjusted return of an investment portfolio (excess return over the risk-free rate per unit of volatility).'}
      </p>

      <div className="grid gap-4 mb-6">
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
            {language === 'he' ? 'תשואת התיק (%)' : 'Portfolio Return (%)'}
          </label>
          <input type="number" step="0.1" value={portfolioReturn} onChange={(e) => setPortfolioReturn(Number(e.target.value))} className="w-full px-3 py-2 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-sm" />
        </div>
        
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
            {language === 'he' ? 'ריבית חסרת סיכון (%)' : 'Risk-Free Rate (%)'}
          </label>
          <input type="number" step="0.1" value={riskFreeRate} onChange={(e) => setRiskFreeRate(Number(e.target.value))} className="w-full px-3 py-2 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-sm" />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
            {language === 'he' ? 'סטיית תקן של התיק / תנודתיות (%)' : 'Portfolio Standard Deviation / Volatility (%)'}
          </label>
          <input type="number" step="0.1" value={portfolioStdDev} onChange={(e) => setPortfolioStdDev(Number(e.target.value))} className="w-full px-3 py-2 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-sm" />
        </div>
      </div>

      <div className="pt-6 border-t border-slate-100 dark:border-slate-800">
        <div className="flex justify-between items-center p-4 bg-indigo-50 dark:bg-indigo-900/10 rounded-xl border border-indigo-100 dark:border-indigo-800/50">
          <div>
            <p className="text-sm font-medium text-indigo-800 dark:text-indigo-400 mb-1">
              {language === 'he' ? 'מדד שארפ' : 'Sharpe Ratio'}
            </p>
            <div className="text-4xl font-bold text-indigo-600 dark:text-indigo-400">
              {results.sharpe}
            </div>
          </div>
          <div className="text-right">
            <p className="text-xs text-indigo-700 dark:text-indigo-500 mb-1">{language === 'he' ? 'דירוג:' : 'Rating:'}</p>
            <span className="inline-block px-3 py-1 bg-white dark:bg-indigo-950 rounded-full text-sm font-bold text-indigo-700 dark:text-indigo-300 shadow-sm border border-indigo-100 dark:border-indigo-800">
              {results.rating}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
