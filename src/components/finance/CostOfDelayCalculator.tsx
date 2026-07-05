import React, { useState } from 'react';
import { useUIStore } from '../../stores/useUIStore';

export default function CostOfDelayCalculator() {
  const language = useUIStore(s => s.language);
  const [monthlyInvestment, setMonthlyInvestment] = useState<number>(500);
  const [expectedReturn, setExpectedReturn] = useState<number>(7);
  const [yearsToInvest, setYearsToInvest] = useState<number>(30);
  const [yearsDelayed, setYearsDelayed] = useState<number>(5);

  const calculateDelay = () => {
    if (monthlyInvestment <= 0 || expectedReturn <= 0 || yearsToInvest <= 0) return { noDelay: 0, withDelay: 0, diff: 0 };

    const r = (expectedReturn / 100) / 12;
    
    // Scenario 1: Start now (invest for N years)
    const monthsNow = yearsToInvest * 12;
    const futureValueNow = monthlyInvestment * ((Math.pow(1 + r, monthsNow) - 1) / r);
    
    // Scenario 2: Start later (invest for N - Delay years)
    const monthsDelayed = Math.max(0, (yearsToInvest - yearsDelayed) * 12);
    const futureValueDelayed = monthlyInvestment * ((Math.pow(1 + r, monthsDelayed) - 1) / r);

    return {
      noDelay: futureValueNow,
      withDelay: futureValueDelayed,
      diff: futureValueNow - futureValueDelayed,
      missedContributions: (monthsNow - monthsDelayed) * monthlyInvestment
    };
  };

  const results = calculateDelay();

  return (
    <div className="p-6 max-w-xl mx-auto bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm">
      <h2 className="text-xl font-medium text-slate-900 dark:text-white mb-6">
        {language === 'he' ? 'עלות הדחייה (Cost of Delay)' : 'Cost of Delay Calculator'}
      </h2>
      <p className="text-sm text-slate-500 mb-6">
        {language === 'he' ? 'ראה כמה כסף אתה מפסיד לטווח ארוך כשאתה דוחה את ההשקעות שלך.' : 'See how much money you lose in the long term by delaying your investments.'}
      </p>

      <div className="grid gap-4 mb-6">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              {language === 'he' ? 'השקעה חודשית' : 'Monthly Investment'}
            </label>
            <input type="number" value={monthlyInvestment} onChange={(e) => setMonthlyInvestment(Number(e.target.value))} className="w-full px-3 py-2 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-sm" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              {language === 'he' ? 'תשואה שנתית (%)' : 'Annual Return (%)'}
            </label>
            <input type="number" value={expectedReturn} onChange={(e) => setExpectedReturn(Number(e.target.value))} className="w-full px-3 py-2 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-sm" />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              {language === 'he' ? 'סה״כ שנות השקעה (מעכשיו)' : 'Total Investing Horizon (from now)'}
            </label>
            <input type="number" value={yearsToInvest} onChange={(e) => setYearsToInvest(Number(e.target.value))} className="w-full px-3 py-2 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-sm" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              {language === 'he' ? 'שנות דחייה עד לתחילת ההשקעה' : 'Years Delayed Before Starting'}
            </label>
            <input type="number" value={yearsDelayed} onChange={(e) => setYearsDelayed(Number(e.target.value))} className="w-full px-3 py-2 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-sm" />
          </div>
        </div>
      </div>

      <div className="grid gap-6 pt-4 border-t border-slate-100 dark:border-slate-800 mt-2">
        <div className="grid grid-cols-2 gap-4">
          <div className="p-4 bg-emerald-50 dark:bg-emerald-900/10 rounded-lg border border-emerald-100 dark:border-emerald-800/30">
            <p className="text-sm font-medium text-emerald-800 dark:text-emerald-300 mb-1">
              {language === 'he' ? 'אם תתחיל עכשיו' : 'If You Start Now'}
            </p>
            <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
              ${Math.round(results.noDelay).toLocaleString()}
            </div>
          </div>
          
          <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-200 dark:border-slate-700">
            <p className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              {language === 'he' ? `אם תתחיל בעוד ${yearsDelayed} שנים` : `If You Wait ${yearsDelayed} Years`}
            </p>
            <div className="text-2xl font-bold text-slate-700 dark:text-slate-300">
              ${Math.round(results.withDelay).toLocaleString()}
            </div>
          </div>
        </div>

        <div className="p-4 bg-rose-50 dark:bg-rose-900/10 rounded-lg border border-rose-100 dark:border-rose-900/30 text-center">
          <p className="text-sm font-medium text-rose-800 dark:text-rose-300 mb-1">
            {language === 'he' ? 'העלות של לחכות (כסף שהפסדת)' : 'The Cost of Waiting (Lost Wealth)'}
          </p>
          <div className="text-3xl font-bold text-rose-600 dark:text-rose-400 mb-2">
            ${Math.round(results.diff).toLocaleString()}
          </div>
          <p className="text-xs text-rose-700 dark:text-rose-400/80">
            {language === 'he' 
              ? `מתוך סכום זה, רק $${results.missedContributions.toLocaleString()} הם הפקדות שלא עשית, השאר זה ריבית דריבית שהלכה לאיבוד.` 
              : `Of this, only $${results.missedContributions.toLocaleString()} is missed contributions. The rest is lost compound interest.`}
          </p>
        </div>
      </div>
    </div>
  );
}
