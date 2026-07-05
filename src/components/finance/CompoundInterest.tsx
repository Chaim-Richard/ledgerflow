import React, { useState } from 'react';
import { useUIStore } from '../../stores/useUIStore';

export default function CompoundInterest() {
  const language = useUIStore(s => s.language);
  const [principal, setPrincipal] = useState<number>(10000);
  const [rate, setRate] = useState<number>(5);
  const [years, setYears] = useState<number>(10);
  const [compoundFreq, setCompoundFreq] = useState<number>(12);

  const calculateInterest = () => {
    const r = rate / 100;
    const n = compoundFreq;
    const t = years;
    const amount = principal * Math.pow(1 + r / n, n * t);
    const interest = amount - principal;
    
    return {
      total: amount.toFixed(2),
      interest: interest.toFixed(2)
    };
  };

  const results = calculateInterest();

  return (
    <div className="p-6 max-w-xl mx-auto bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm">
      <h2 className="text-xl font-medium text-slate-900 dark:text-white mb-6">
        {language === 'he' ? 'מחשבון ריבית דריבית' : 'Compound Interest'}
      </h2>

      <div className="grid grid-cols-2 gap-4 mb-6">
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
            {language === 'he' ? 'קרן (Principal)' : 'Principal'}
          </label>
          <input
            type="number"
            value={principal}
            onChange={(e) => setPrincipal(Number(e.target.value))}
            className="w-full px-3 py-2 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-sm"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
            {language === 'he' ? 'ריבית שנתית (%)' : 'Annual Rate (%)'}
          </label>
          <input
            type="number"
            value={rate}
            onChange={(e) => setRate(Number(e.target.value))}
            className="w-full px-3 py-2 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-sm"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
            {language === 'he' ? 'תקופה (שנים)' : 'Years'}
          </label>
          <input
            type="number"
            value={years}
            onChange={(e) => setYears(Number(e.target.value))}
            className="w-full px-3 py-2 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-sm"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
            {language === 'he' ? 'תדירות חישוב ריבית' : 'Compound Frequency'}
          </label>
          <select
            value={compoundFreq}
            onChange={(e) => setCompoundFreq(Number(e.target.value))}
            className="w-full px-3 py-2 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-sm"
          >
            <option value={1}>{language === 'he' ? 'שנתי' : 'Annually'}</option>
            <option value={2}>{language === 'he' ? 'חצי שנתי' : 'Semi-Annually'}</option>
            <option value={4}>{language === 'he' ? 'רבעוני' : 'Quarterly'}</option>
            <option value={12}>{language === 'he' ? 'חודשי' : 'Monthly'}</option>
            <option value={365}>{language === 'he' ? 'יומי' : 'Daily'}</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 pt-4 border-t border-slate-100 dark:border-slate-800">
        <div>
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-1">
            {language === 'he' ? 'סך הכל (Total Value)' : 'Total Value'}
          </p>
          <p className="text-2xl font-medium text-slate-900 dark:text-white">${results.total}</p>
        </div>
        
        <div>
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-1">
            {language === 'he' ? 'סך הכל ריבית' : 'Total Interest'}
          </p>
          <p className="text-2xl font-medium text-emerald-600 dark:text-emerald-400">${results.interest}</p>
        </div>
      </div>
    </div>
  );
}
