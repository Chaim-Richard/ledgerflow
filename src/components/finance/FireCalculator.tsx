import React, { useState } from 'react';
import { useUIStore } from '../../stores/useUIStore';

export default function FireCalculator() {
  const language = useUIStore(s => s.language);
  const [annualExpenses, setAnnualExpenses] = useState<number>(60000);
  const [currentSavings, setCurrentSavings] = useState<number>(100000);
  const [monthlyContribution, setMonthlyContribution] = useState<number>(2000);
  const [expectedReturn, setExpectedReturn] = useState<number>(7); // After inflation (real return)
  const [withdrawalRate, setWithdrawalRate] = useState<number>(4); // Safe withdrawal rate (SWR)

  const calculateFire = () => {
    // FIRE Target = Annual Expenses / Safe Withdrawal Rate
    const fireTarget = annualExpenses / (withdrawalRate / 100);
    
    // Calculate time to reach target
    const targetShortfall = fireTarget - currentSavings;
    
    if (targetShortfall <= 0) {
      return { fireTarget: fireTarget.toFixed(2), yearsToFire: 0, isReached: true };
    }

    const ratePerMonth = (expectedReturn / 100) / 12;
    
    // Solve for N in Future Value of Annuity + Compound Interest formula
    // FV = PV*(1+r)^n + PMT*(((1+r)^n - 1)/r)
    // This is mathematically complex to isolate n algebraically with both PV and PMT,
    // so we'll do a simple iterative approach (month by month) up to 100 years.
    
    let balance = currentSavings;
    let months = 0;
    const maxMonths = 100 * 12; // Cap at 100 years to prevent infinite loop
    
    while (balance < fireTarget && months < maxMonths) {
      balance = balance * (1 + ratePerMonth) + monthlyContribution;
      months++;
    }

    const yearsToFire = months / 12;

    return {
      fireTarget: fireTarget.toFixed(2),
      yearsToFire: yearsToFire.toFixed(1),
      isReached: false,
      maxedOut: months >= maxMonths
    };
  };

  const results = calculateFire();

  return (
    <div className="p-6 max-w-xl mx-auto bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm">
      <h2 className="text-xl font-medium text-slate-900 dark:text-white mb-6">
        {language === 'he' ? 'מחשבון חופש כלכלי (FIRE)' : 'Financial Independence (FIRE) Calculator'}
      </h2>

      <div className="grid gap-4 mb-6">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              {language === 'he' ? 'הוצאות שנתיות צפויות' : 'Expected Annual Expenses'}
            </label>
            <input type="number" value={annualExpenses} onChange={(e) => setAnnualExpenses(Number(e.target.value))} className="w-full px-3 py-2 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-sm" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              {language === 'he' ? 'שיעור משיכה בטוח (SWR %)' : 'Safe Withdrawal Rate (%)'}
            </label>
            <input type="number" value={withdrawalRate} step="0.1" onChange={(e) => setWithdrawalRate(Number(e.target.value))} className="w-full px-3 py-2 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-sm" />
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              {language === 'he' ? 'חיסכון קיים' : 'Current Savings'}
            </label>
            <input type="number" value={currentSavings} onChange={(e) => setCurrentSavings(Number(e.target.value))} className="w-full px-3 py-2 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-sm" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              {language === 'he' ? 'חיסכון חודשי' : 'Monthly Saving'}
            </label>
            <input type="number" value={monthlyContribution} onChange={(e) => setMonthlyContribution(Number(e.target.value))} className="w-full px-3 py-2 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-sm" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              {language === 'he' ? 'תשואה ריאלית (%)' : 'Real Return (%)'}
            </label>
            <input type="number" value={expectedReturn} onChange={(e) => setExpectedReturn(Number(e.target.value))} className="w-full px-3 py-2 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-sm" />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-y-6 gap-x-4 pt-4 border-t border-slate-100 dark:border-slate-800 mt-2">
        <div className="col-span-2">
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-1">
            {language === 'he' ? 'יעד חופש כלכלי (FIRE Number)' : 'Financial Independence Target (FIRE Number)'}
          </p>
          <div className="text-4xl font-bold text-indigo-600 dark:text-indigo-400">
            ${Number(results.fireTarget).toLocaleString()}
          </div>
        </div>
        
        <div>
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-1">
            {language === 'he' ? 'זמן עד להגעה ליעד' : 'Time to Reach Target'}
          </p>
          {results.isReached ? (
             <div className="text-2xl font-medium text-emerald-600 dark:text-emerald-400">
               {language === 'he' ? 'הגעת ליעד!' : 'Goal Reached!'}
             </div>
          ) : results.maxedOut ? (
             <div className="text-2xl font-medium text-rose-600 dark:text-rose-400">
               {language === 'he' ? 'יותר מ-100 שנים' : '> 100 Years'}
             </div>
          ) : (
            <div className="text-3xl font-bold text-slate-700 dark:text-slate-300">
              {results.yearsToFire} {language === 'he' ? 'שנים' : 'Years'}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
