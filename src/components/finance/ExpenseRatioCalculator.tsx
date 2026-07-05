import React, { useState } from 'react';
import { useUIStore } from '../../stores/useUIStore';

export default function ExpenseRatioCalculator() {
  const language = useUIStore(s => s.language);
  const [initialInvestment, setInitialInvestment] = useState<number>(100000);
  const [annualContribution, setAnnualContribution] = useState<number>(12000);
  const [years, setYears] = useState<number>(30);
  const [expectedReturn, setExpectedReturn] = useState<number>(7);
  
  const [fundAExpense, setFundAExpense] = useState<number>(0.05); // Low cost ETF
  const [fundBExpense, setFundBExpense] = useState<number>(1.25); // Actively managed

  const calculateGrowth = (expenseRate: number) => {
    const netReturn = (expectedReturn - expenseRate) / 100;
    
    let balance = initialInvestment;
    let totalFees = 0;
    let totalContributions = initialInvestment;
    
    // Yearly compounding for simplicity
    for (let i = 0; i < years; i++) {
      // Begin year
      balance += annualContribution;
      totalContributions += annualContribution;
      
      // End year
      const grossGrowth = balance * (expectedReturn / 100);
      const fee = (balance + grossGrowth) * (expenseRate / 100);
      
      balance = balance + grossGrowth - fee;
      totalFees += fee;
    }

    return {
      balance,
      totalFees
    };
  };

  const fundA = calculateGrowth(fundAExpense);
  const fundB = calculateGrowth(fundBExpense);
  const difference = fundA.balance - fundB.balance;

  return (
    <div className="p-6 max-w-2xl mx-auto bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm">
      <h2 className="text-xl font-medium text-slate-900 dark:text-white mb-6">
        {language === 'he' ? 'השפעת דמי ניהול (Expense Ratio)' : 'Investment Fee (Expense Ratio) Calculator'}
      </h2>
      <p className="text-sm text-slate-500 mb-6">
        {language === 'he' ? 'השווה את ההשפעה ארוכת הטווח של דמי הניהול על תיק ההשקעות שלך.' : 'Compare the long-term impact of expense ratios (fees) on your investment portfolio.'}
      </p>

      <div className="grid gap-6 mb-6">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              {language === 'he' ? 'השקעה התחלתית' : 'Initial Investment'}
            </label>
            <input type="number" value={initialInvestment} onChange={(e) => setInitialInvestment(Number(e.target.value))} className="w-full px-3 py-2 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-sm" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              {language === 'he' ? 'הפקדה שנתית' : 'Annual Contribution'}
            </label>
            <input type="number" value={annualContribution} onChange={(e) => setAnnualContribution(Number(e.target.value))} className="w-full px-3 py-2 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-sm" />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              {language === 'he' ? 'תקופה (שנים)' : 'Time Horizon (Years)'}
            </label>
            <input type="number" value={years} onChange={(e) => setYears(Number(e.target.value))} className="w-full px-3 py-2 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-sm" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              {language === 'he' ? 'תשואה שנתית ממוצעת (%)' : 'Expected Return (%)'}
            </label>
            <input type="number" value={expectedReturn} onChange={(e) => setExpectedReturn(Number(e.target.value))} className="w-full px-3 py-2 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-sm" />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 pt-4 border-t border-slate-100 dark:border-slate-800">
          <div className="p-4 bg-indigo-50/50 dark:bg-indigo-900/10 rounded-lg border border-indigo-100 dark:border-indigo-900/30">
            <label className="block text-sm font-medium text-indigo-900 dark:text-indigo-300 mb-1">
              {language === 'he' ? 'קרן א׳ - דמי ניהול (%)' : 'Fund A Expense Ratio (%)'}
            </label>
            <input type="number" step="0.01" value={fundAExpense} onChange={(e) => setFundAExpense(Number(e.target.value))} className="w-full px-3 py-2 bg-white dark:bg-slate-950 border border-indigo-200 dark:border-indigo-800 rounded-lg text-sm" />
          </div>
          <div className="p-4 bg-rose-50/50 dark:bg-rose-900/10 rounded-lg border border-rose-100 dark:border-rose-900/30">
            <label className="block text-sm font-medium text-rose-900 dark:text-rose-300 mb-1">
              {language === 'he' ? 'קרן ב׳ - דמי ניהול (%)' : 'Fund B Expense Ratio (%)'}
            </label>
            <input type="number" step="0.01" value={fundBExpense} onChange={(e) => setFundBExpense(Number(e.target.value))} className="w-full px-3 py-2 bg-white dark:bg-slate-950 border border-rose-200 dark:border-rose-800 rounded-lg text-sm" />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-6 pt-4">
        <div className="space-y-4">
          <div>
            <p className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-1">
              {language === 'he' ? 'יתרת קרן א׳' : 'Fund A Final Balance'}
            </p>
            <div className="text-2xl font-bold text-indigo-600 dark:text-indigo-400">
              ${Math.round(fundA.balance).toLocaleString()}
            </div>
            <p className="text-xs text-slate-500 mt-1">
              {language === 'he' ? 'סך דמי ניהול:' : 'Total Fees:'} ${Math.round(fundA.totalFees).toLocaleString()}
            </p>
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <p className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-1">
              {language === 'he' ? 'יתרת קרן ב׳' : 'Fund B Final Balance'}
            </p>
            <div className="text-2xl font-bold text-rose-600 dark:text-rose-400">
              ${Math.round(fundB.balance).toLocaleString()}
            </div>
            <p className="text-xs text-slate-500 mt-1">
              {language === 'he' ? 'סך דמי ניהול:' : 'Total Fees:'} ${Math.round(fundB.totalFees).toLocaleString()}
            </p>
          </div>
        </div>

        <div className="col-span-2 p-4 bg-emerald-50 dark:bg-emerald-900/20 rounded-xl border border-emerald-100 dark:border-emerald-800 text-center">
          <p className="text-sm font-medium text-emerald-800 dark:text-emerald-300 mb-1">
            {language === 'he' ? 'ההפרש בגלל דמי הניהול!' : 'The difference lost to fees!'}
          </p>
          <div className="text-3xl font-bold text-emerald-600 dark:text-emerald-400">
            ${Math.round(difference).toLocaleString()}
          </div>
        </div>
      </div>
    </div>
  );
}
