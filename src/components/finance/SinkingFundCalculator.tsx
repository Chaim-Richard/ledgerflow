import React, { useState } from 'react';
import { useUIStore } from '../../stores/useUIStore';

export default function SinkingFundCalculator() {
  const language = useUIStore(s => s.language);
  const [goalAmount, setGoalAmount] = useState<number>(10000);
  const [currentSaved, setCurrentSaved] = useState<number>(2000);
  const [monthsToGoal, setMonthsToGoal] = useState<number>(12);
  const [annualInterestRate, setAnnualInterestRate] = useState<number>(4);

  const calculateSinkingFund = () => {
    const amountNeeded = goalAmount - currentSaved;
    
    if (amountNeeded <= 0 || monthsToGoal <= 0) return { monthlyContribution: 0, totalInterest: 0 };
    if (annualInterestRate <= 0) {
      return { monthlyContribution: amountNeeded / monthsToGoal, totalInterest: 0 };
    }

    // Future Value of an Annuity to find PMT
    // PMT = (FV * r) / ((1 + r)^n - 1)
    
    // Future value of current savings:
    const r = (annualInterestRate / 100) / 12;
    const n = monthsToGoal;
    const fvOfCurrentSavings = currentSaved * Math.pow(1 + r, n);
    
    // Remaining target to reach via monthly contributions:
    const targetFv = goalAmount - fvOfCurrentSavings;
    
    const monthlyContribution = (targetFv * r) / (Math.pow(1 + r, n) - 1);
    const totalDeposited = monthlyContribution * n;
    const totalInterest = targetFv - totalDeposited + (fvOfCurrentSavings - currentSaved);

    return {
      monthlyContribution: monthlyContribution.toFixed(2),
      totalInterest: totalInterest.toFixed(2),
      fvOfCurrentSavings: fvOfCurrentSavings.toFixed(2)
    };
  };

  const results = calculateSinkingFund();

  return (
    <div className="p-6 max-w-xl mx-auto bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm">
      <h2 className="text-xl font-medium text-slate-900 dark:text-white mb-6">
        {language === 'he' ? 'מחשבון קרן ייעודית (Sinking Fund)' : 'Sinking Fund Calculator'}
      </h2>

      <div className="grid gap-4 mb-6">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              {language === 'he' ? 'סכום יעד' : 'Goal Amount'}
            </label>
            <input type="number" value={goalAmount} onChange={(e) => setGoalAmount(Number(e.target.value))} className="w-full px-3 py-2 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-sm" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              {language === 'he' ? 'חסכונות נוכחיים' : 'Current Savings'}
            </label>
            <input type="number" value={currentSaved} onChange={(e) => setCurrentSaved(Number(e.target.value))} className="w-full px-3 py-2 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-sm" />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              {language === 'he' ? 'חודשים עד ליעד' : 'Months to Goal'}
            </label>
            <input type="number" value={monthsToGoal} onChange={(e) => setMonthsToGoal(Number(e.target.value))} className="w-full px-3 py-2 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-sm" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              {language === 'he' ? 'ריבית שנתית מצופה (%)' : 'Expected APY (%)'}
            </label>
            <input type="number" value={annualInterestRate} onChange={(e) => setAnnualInterestRate(Number(e.target.value))} className="w-full px-3 py-2 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-sm" />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-y-6 gap-x-4 pt-4 border-t border-slate-100 dark:border-slate-800 mt-2">
        <div className="col-span-2">
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-1">
            {language === 'he' ? 'הפקדה חודשית דרושה' : 'Required Monthly Contribution'}
          </p>
          <div className="text-4xl font-bold text-indigo-600 dark:text-indigo-400">
            ${Number(results.monthlyContribution).toLocaleString()}
          </div>
        </div>
        <div>
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-1">
            {language === 'he' ? 'סך הכל ריבית שנצברה' : 'Total Interest Earned'}
          </p>
          <div className="text-xl font-medium text-emerald-600 dark:text-emerald-400">
            ${Number(results.totalInterest).toLocaleString()}
          </div>
        </div>
        <div>
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-1">
            {language === 'he' ? 'סך הכל מהפקדות (מעכשיו)' : 'Total New Deposits'}
          </p>
          <div className="text-xl font-medium text-slate-700 dark:text-slate-300">
            ${(Number(results.monthlyContribution) * monthsToGoal).toLocaleString()}
          </div>
        </div>
      </div>
    </div>
  );
}
