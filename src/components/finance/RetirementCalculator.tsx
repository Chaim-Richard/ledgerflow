import React, { useState } from 'react';
import { useUIStore } from '../../stores/useUIStore';

export default function RetirementCalculator() {
  const language = useUIStore(s => s.language);
  const [currentAge, setCurrentAge] = useState<number>(30);
  const [retirementAge, setRetirementAge] = useState<number>(65);
  const [currentSavings, setCurrentSavings] = useState<number>(50000);
  const [monthlyContribution, setMonthlyContribution] = useState<number>(500);
  const [annualReturn, setAnnualReturn] = useState<number>(7);

  const calculateRetirement = () => {
    const years = retirementAge - currentAge;
    if (years <= 0) return { futureValue: currentSavings, totalContributions: 0, totalInterest: 0 };
    
    const ratePerMonth = (annualReturn / 100) / 12;
    const months = years * 12;

    // Compound interest on initial savings
    const futureValueOfInitial = currentSavings * Math.pow(1 + ratePerMonth, months);
    
    // Future value of an annuity (monthly contributions)
    const futureValueOfContributions = ratePerMonth === 0 ? 
      (monthlyContribution * months) : 
      (monthlyContribution * (Math.pow(1 + ratePerMonth, months) - 1)) / ratePerMonth;
      
    const futureValue = futureValueOfInitial + futureValueOfContributions;
    const totalContributions = currentSavings + (monthlyContribution * months);
    const totalInterest = futureValue - totalContributions;

    return {
      futureValue: futureValue.toFixed(2),
      totalContributions: totalContributions.toFixed(2),
      totalInterest: totalInterest.toFixed(2)
    };
  };

  const results = calculateRetirement();

  return (
    <div className="p-6 max-w-xl mx-auto bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm">
      <h2 className="text-xl font-medium text-slate-900 dark:text-white mb-6">
        {language === 'he' ? 'מחשבון חיסכון פנסיוני (Retirement)' : 'Retirement Savings Calculator'}
      </h2>

      <div className="grid gap-4 mb-6">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              {language === 'he' ? 'גיל נוכחי' : 'Current Age'}
            </label>
            <input type="number" value={currentAge} onChange={(e) => setCurrentAge(Number(e.target.value))} className="w-full px-3 py-2 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-sm" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              {language === 'he' ? 'גיל פרישה מתוכנן' : 'Retirement Age'}
            </label>
            <input type="number" value={retirementAge} onChange={(e) => setRetirementAge(Number(e.target.value))} className="w-full px-3 py-2 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-sm" />
          </div>
        </div>
        
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              {language === 'he' ? 'חיסכון נוכחי' : 'Current Savings'}
            </label>
            <input type="number" value={currentSavings} onChange={(e) => setCurrentSavings(Number(e.target.value))} className="w-full px-3 py-2 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-sm" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              {language === 'he' ? 'הפקדה חודשית' : 'Monthly Contribution'}
            </label>
            <input type="number" value={monthlyContribution} onChange={(e) => setMonthlyContribution(Number(e.target.value))} className="w-full px-3 py-2 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-sm" />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
            {language === 'he' ? 'תשואה שנתית משוערת (%)' : 'Estimated Annual Return (%)'}
          </label>
          <input type="number" value={annualReturn} onChange={(e) => setAnnualReturn(Number(e.target.value))} className="w-full px-3 py-2 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-sm" />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-y-6 gap-x-4 pt-4 border-t border-slate-100 dark:border-slate-800 mt-2">
        <div className="col-span-2">
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-1">
            {language === 'he' ? 'סכום צפוי בגיל פרישה' : 'Estimated Balance at Retirement'}
          </p>
          <div className="text-4xl font-bold text-indigo-600 dark:text-indigo-400">
            ${Number(results.futureValue).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
        </div>
        <div>
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-1">
            {language === 'he' ? 'סך הפקדות' : 'Total Contributions'}
          </p>
          <div className="text-xl font-medium text-slate-700 dark:text-slate-300">
            ${Number(results.totalContributions).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
        </div>
        <div>
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-1">
            {language === 'he' ? 'סך תשואה (ריבית דריבית)' : 'Total Interest Earned'}
          </p>
          <div className="text-xl font-medium text-emerald-600 dark:text-emerald-400">
            ${Number(results.totalInterest).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
        </div>
      </div>
    </div>
  );
}
