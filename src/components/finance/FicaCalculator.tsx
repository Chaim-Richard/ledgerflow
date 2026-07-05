import React, { useState } from 'react';
import { useUIStore } from '../../stores/useUIStore';

export default function FicaCalculator() {
  const language = useUIStore(s => s.language);
  const [grossIncome, setGrossIncome] = useState<number>(75000);
  const [isSelfEmployed, setIsSelfEmployed] = useState<boolean>(false);

  const calculateFICA = () => {
    if (grossIncome <= 0) return { socialSecurity: 0, medicare: 0, total: 0 };
    
    // FICA rules (using simplified standard US rates for demonstration)
    // Social Security: 6.2% up to limit (around $168k in 2024, ignored for simplicity here or set a cap)
    // Medicare: 1.45% (plus additional 0.9% over 200k, ignored for simplicity)
    // Self-employed pays double (12.4% and 2.9%)
    
    const ssCap = 168600;
    const ssSubjectIncome = Math.min(grossIncome, ssCap);
    
    let ssRate = isSelfEmployed ? 0.124 : 0.062;
    let medRate = isSelfEmployed ? 0.029 : 0.0145;

    const socialSecurity = ssSubjectIncome * ssRate;
    const medicare = grossIncome * medRate;
    const total = socialSecurity + medicare;

    return {
      socialSecurity: socialSecurity.toFixed(2),
      medicare: medicare.toFixed(2),
      total: total.toFixed(2)
    };
  };

  const results = calculateFICA();

  return (
    <div className="p-6 max-w-xl mx-auto bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm">
      <h2 className="text-xl font-medium text-slate-900 dark:text-white mb-6">
        {language === 'he' ? 'מחשבון מיסי העסקה (FICA - ארה״ב)' : 'FICA / Payroll Tax Calculator (US)'}
      </h2>

      <div className="grid gap-4 mb-6">
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
            {language === 'he' ? 'הכנסה שנתית ברוטו' : 'Gross Annual Income'}
          </label>
          <input
            type="number"
            value={grossIncome}
            onChange={(e) => setGrossIncome(Number(e.target.value))}
            className="w-full px-3 py-2 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-sm"
          />
        </div>
        
        <div className="flex items-center space-x-2">
          <input
            type="checkbox"
            id="selfEmployed"
            checked={isSelfEmployed}
            onChange={(e) => setIsSelfEmployed(e.target.checked)}
            className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
          />
          <label htmlFor="selfEmployed" className="text-sm font-medium text-slate-700 dark:text-slate-300">
            {language === 'he' ? 'עצמאי (Self-Employed - תשלום כפול)' : 'Self-Employed (Pays both employer and employee portions)'}
          </label>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-y-6 gap-x-4 pt-4 border-t border-slate-100 dark:border-slate-800 mt-2">
        <div>
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-1">
            {language === 'he' ? 'ביטוח לאומי (Social Security)' : 'Social Security Tax'}
          </p>
          <div className="text-2xl font-medium text-slate-700 dark:text-slate-300">
            ${results.socialSecurity}
          </div>
        </div>
        <div>
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-1">
            {language === 'he' ? 'מס בריאות (Medicare)' : 'Medicare Tax'}
          </p>
          <div className="text-2xl font-medium text-slate-700 dark:text-slate-300">
            ${results.medicare}
          </div>
        </div>
        <div className="col-span-2">
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-1">
            {language === 'he' ? 'סך מיסי העסקה (FICA)' : 'Total FICA Tax'}
          </p>
          <div className="text-3xl font-bold text-rose-600 dark:text-rose-400">
            ${results.total}
          </div>
        </div>
      </div>
    </div>
  );
}
