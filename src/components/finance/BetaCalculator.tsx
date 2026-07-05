import React, { useState } from 'react';
import { useUIStore } from '../../stores/useUIStore';

export default function BetaCalculator() {
  const language = useUIStore(s => s.language);
  
  const [covariance, setCovariance] = useState<number>(0.025);
  const [variance, setVariance] = useState<number>(0.020);

  const calculateBeta = () => {
    if (variance === 0) return { beta: 0, status: '' };
    const beta = covariance / variance;
    
    let status = '';
    if (beta > 1) status = language === 'he' ? 'תנודתי יותר מהשוק' : 'More volatile than market';
    else if (beta < 1 && beta > 0) status = language === 'he' ? 'פחות תנודתי מהשוק' : 'Less volatile than market';
    else if (beta === 1) status = language === 'he' ? 'נע יחד עם השוק' : 'Moves with market';
    else status = language === 'he' ? 'יחס הפוך לשוק' : 'Inverse to market';

    return {
      beta: beta.toFixed(2),
      status
    };
  };

  const results = calculateBeta();

  return (
    <div className="p-6 max-w-xl mx-auto bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm">
      <h2 className="text-xl font-medium text-slate-900 dark:text-white mb-6">
        {language === 'he' ? 'מקדם בטא (Beta)' : 'Beta Calculator'}
      </h2>
      <p className="text-sm text-slate-500 mb-6">
        {language === 'he' ? 'מודד את רמת הסיכון המערכתי של נייר ערך ביחס לשוק כולו.' : 'A measure of a stock\'s volatility in relation to the overall market.'}
      </p>

      <div className="grid grid-cols-2 gap-4 mb-6">
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
            {language === 'he' ? 'שונות משותפת (Covariance)' : 'Covariance (Asset & Market)'}
          </label>
          <input type="number" step="0.001" value={covariance} onChange={(e) => setCovariance(Number(e.target.value))} className="w-full px-3 py-2 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-sm" />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
            {language === 'he' ? 'שונות השוק (Variance)' : 'Variance (Market)'}
          </label>
          <input type="number" step="0.001" value={variance} onChange={(e) => setVariance(Number(e.target.value))} className="w-full px-3 py-2 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-sm" />
        </div>
      </div>

      <div className="pt-6 border-t border-slate-100 dark:border-slate-800">
        <div className={`p-4 rounded-xl border flex justify-between items-center ${Number(results.beta) > 1 ? 'bg-rose-50 dark:bg-rose-900/10 border-rose-100 dark:border-rose-800/30' : Number(results.beta) < 1 ? 'bg-emerald-50 dark:bg-emerald-900/10 border-emerald-100 dark:border-emerald-800/30' : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700'}`}>
          <div>
            <p className={`text-sm font-medium mb-1 ${Number(results.beta) > 1 ? 'text-rose-800 dark:text-rose-400' : Number(results.beta) < 1 ? 'text-emerald-800 dark:text-emerald-400' : 'text-slate-800 dark:text-slate-300'}`}>
              {language === 'he' ? 'בטא' : 'Beta'}
            </p>
            <p className="text-xs opacity-80">{results.status}</p>
          </div>
          <div className={`text-4xl font-bold ${Number(results.beta) > 1 ? 'text-rose-600 dark:text-rose-400' : Number(results.beta) < 1 ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-700 dark:text-slate-200'}`}>
            {results.beta}
          </div>
        </div>
      </div>
    </div>
  );
}
