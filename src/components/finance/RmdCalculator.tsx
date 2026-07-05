import React, { useState } from 'react';
import { useUIStore } from '../../stores/useUIStore';

export default function RmdCalculator() {
  const language = useUIStore(s => s.language);
  const [age, setAge] = useState<number>(73);
  const [accountBalance, setAccountBalance] = useState<number>(500000);

  // Simplified Uniform Lifetime Table for RMD (IRS approx values for age 73-100)
  const getDistributionPeriod = (age: number) => {
    if (age < 73) return 0; // RMD typically starts at 73 now
    const table: Record<number, number> = {
      73: 26.5, 74: 25.5, 75: 24.6, 76: 23.7, 77: 22.9, 78: 22.0, 79: 21.1,
      80: 20.2, 81: 19.4, 82: 18.5, 83: 17.7, 84: 16.8, 85: 16.0, 86: 15.2,
      87: 14.4, 88: 13.7, 89: 12.9, 90: 12.2, 91: 11.5, 92: 10.8, 93: 10.1,
      94: 9.5, 95: 8.9, 96: 8.4, 97: 7.8, 98: 7.3, 99: 6.8, 100: 6.4
    };
    return table[age] || 5.0; // Default for 100+ for simplicity
  };

  const calculateRmd = () => {
    const period = getDistributionPeriod(age);
    if (period === 0) return { rmdAmount: 0, period: 0, percent: 0 };

    const rmdAmount = accountBalance / period;
    const percent = (rmdAmount / accountBalance) * 100;

    return {
      rmdAmount: rmdAmount.toFixed(2),
      period: period,
      percent: percent.toFixed(2)
    };
  };

  const results = calculateRmd();

  return (
    <div className="p-6 max-w-xl mx-auto bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm">
      <h2 className="text-xl font-medium text-slate-900 dark:text-white mb-6">
        {language === 'he' ? 'מחשבון משיכת חובה (RMD)' : 'Required Minimum Distribution (RMD)'}
      </h2>
      <p className="text-sm text-slate-500 mb-6">
        {language === 'he' ? 'מחשבון משיכת חובה מקרנות פנסיה בארה״ב (החל מגיל 73).' : 'Calculates the Required Minimum Distribution from US retirement accounts (starting age 73).'}
      </p>

      <div className="grid grid-cols-2 gap-4 mb-6">
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
            {language === 'he' ? 'גיל נוכחי' : 'Current Age'}
          </label>
          <input type="number" value={age} onChange={(e) => setAge(Number(e.target.value))} className="w-full px-3 py-2 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-sm" />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
            {language === 'he' ? 'יתרת חשבון פנסיה' : 'Retirement Account Balance'}
          </label>
          <input type="number" value={accountBalance} onChange={(e) => setAccountBalance(Number(e.target.value))} className="w-full px-3 py-2 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-sm" />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-y-6 gap-x-4 pt-4 border-t border-slate-100 dark:border-slate-800 mt-2">
        {age < 73 ? (
          <div className="col-span-2 text-center text-slate-500 py-4">
            {language === 'he' ? 'אין חובת משיכה לפני גיל 73 לפי החוק החדש (SECURE Act 2.0).' : 'No RMD required before age 73 under the SECURE 2.0 Act.'}
          </div>
        ) : (
          <>
            <div className="col-span-2">
              <p className="text-sm text-slate-500 dark:text-slate-400 mb-1">
                {language === 'he' ? 'סכום משיכת חובה שנתית (RMD)' : 'Required Minimum Distribution Amount'}
              </p>
              <div className="text-4xl font-bold text-rose-600 dark:text-rose-400">
                ${Number(results.rmdAmount).toLocaleString()}
              </div>
            </div>
            <div>
              <p className="text-sm text-slate-500 dark:text-slate-400 mb-1">
                {language === 'he' ? 'מקדם חלוקה (IRS Factor)' : 'Distribution Period (IRS Factor)'}
              </p>
              <div className="text-xl font-medium text-slate-700 dark:text-slate-300">
                {results.period} {language === 'he' ? 'שנים' : 'years'}
              </div>
            </div>
            <div>
              <p className="text-sm text-slate-500 dark:text-slate-400 mb-1">
                {language === 'he' ? 'אחוז מהחשבון' : 'Percentage of Balance'}
              </p>
              <div className="text-xl font-medium text-slate-700 dark:text-slate-300">
                {results.percent}%
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
