import React, { useState } from 'react';
import { useUIStore } from '../../stores/useUIStore';

export default function CarAffordabilityCalculator() {
  const language = useUIStore(s => s.language);
  const [monthlyIncome, setMonthlyIncome] = useState<number>(5000);
  const [downPayment, setDownPayment] = useState<number>(5000);
  const [tradeInValue, setTradeInValue] = useState<number>(0);
  const [interestRate, setInterestRate] = useState<number>(5);
  const [loanTerm, setLoanTerm] = useState<number>(48); // 20/4/10 rule recommends 4 years (48 months)

  const calculateAffordability = () => {
    // 20/4/10 Rule
    // 20% down payment (downPayment + tradeInValue)
    // 4 year loan term maximum
    // 10% of monthly gross income for total transportation costs (loan + insurance + gas + maintenance)
    // Let's assume loan payment can be 50% of the 10% transportation budget (so 5% of monthly income)
    
    const maxMonthlyPayment = monthlyIncome * 0.10 * 0.5; // 5% of gross income just for the loan
    const maxTransportationBudget = monthlyIncome * 0.10; // 10% total
    
    const ratePerMonth = (interestRate / 100) / 12;
    
    // Calculate max loan amount based on max monthly payment
    let maxLoanAmount = 0;
    if (ratePerMonth > 0) {
      maxLoanAmount = maxMonthlyPayment * ((Math.pow(1 + ratePerMonth, loanTerm) - 1) / (ratePerMonth * Math.pow(1 + ratePerMonth, loanTerm)));
    } else {
      maxLoanAmount = maxMonthlyPayment * loanTerm;
    }

    const maxCarPrice = maxLoanAmount + downPayment + tradeInValue;
    
    // Check if 20% down payment rule is met
    const totalDown = downPayment + tradeInValue;
    const currentDownPercent = maxCarPrice > 0 ? (totalDown / maxCarPrice) * 100 : 0;
    const is20PercentMet = currentDownPercent >= 20;

    return {
      maxMonthlyPayment: maxMonthlyPayment.toFixed(2),
      maxTransportationBudget: maxTransportationBudget.toFixed(2),
      maxLoanAmount: maxLoanAmount.toFixed(2),
      maxCarPrice: maxCarPrice.toFixed(2),
      currentDownPercent: currentDownPercent.toFixed(1),
      is20PercentMet
    };
  };

  const results = calculateAffordability();

  return (
    <div className="p-6 max-w-xl mx-auto bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm">
      <h2 className="text-xl font-medium text-slate-900 dark:text-white mb-6">
        {language === 'he' ? 'מחשבון תקציב רכב (חוק 20/4/10)' : 'Car Affordability Calculator (20/4/10 Rule)'}
      </h2>
      <p className="text-sm text-slate-500 mb-6">
        {language === 'he' ? 'חוק 20/4/10: 20% מקדמה, עד 4 שנות הלוואה, ומקסימום 10% מההכנסה לתחבורה.' : 'The 20/4/10 rule: 20% down, 4-year max term, and max 10% of income on total transportation.'}
      </p>

      <div className="grid gap-4 mb-6">
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
            {language === 'he' ? 'הכנסה חודשית (ברוטו)' : 'Gross Monthly Income'}
          </label>
          <input type="number" value={monthlyIncome} onChange={(e) => setMonthlyIncome(Number(e.target.value))} className="w-full px-3 py-2 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-sm" />
        </div>
        
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              {language === 'he' ? 'מקדמה במזומן' : 'Cash Down Payment'}
            </label>
            <input type="number" value={downPayment} onChange={(e) => setDownPayment(Number(e.target.value))} className="w-full px-3 py-2 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-sm" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              {language === 'he' ? 'שווי רכב קודם (Trade-in)' : 'Trade-in Value'}
            </label>
            <input type="number" value={tradeInValue} onChange={(e) => setTradeInValue(Number(e.target.value))} className="w-full px-3 py-2 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-sm" />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              {language === 'he' ? 'ריבית צפויה (%)' : 'Expected Interest Rate (%)'}
            </label>
            <input type="number" value={interestRate} onChange={(e) => setInterestRate(Number(e.target.value))} className="w-full px-3 py-2 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-sm" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              {language === 'he' ? 'תקופת הלוואה (חודשים)' : 'Loan Term (Months)'}
            </label>
            <input type="number" value={loanTerm} onChange={(e) => setLoanTerm(Number(e.target.value))} className="w-full px-3 py-2 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-sm" />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-y-6 gap-x-4 pt-4 border-t border-slate-100 dark:border-slate-800 mt-2">
        <div className="col-span-2">
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-1">
            {language === 'he' ? 'מחיר רכב מקסימלי מומלץ' : 'Recommended Max Car Price'}
          </p>
          <div className="text-4xl font-bold text-indigo-600 dark:text-indigo-400">
            ${Number(results.maxCarPrice).toLocaleString()}
          </div>
        </div>
        
        <div>
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-1">
            {language === 'he' ? 'החזר הלוואה מקסימלי לחודש' : 'Max Monthly Loan Payment'}
          </p>
          <div className="text-xl font-medium text-slate-700 dark:text-slate-300">
            ${Number(results.maxMonthlyPayment).toLocaleString()}
          </div>
          <p className="text-xs text-slate-500 mt-1">
            {language === 'he' ? 'מתוך תקציב תחבורה: ' : 'From transport budget: '}${Number(results.maxTransportationBudget).toLocaleString()}
          </p>
        </div>

        <div>
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-1">
            {language === 'he' ? 'סטטוס מקדמה מול היעד (20%)' : 'Down Payment Status vs 20% Goal'}
          </p>
          <div className={`text-xl font-medium ${results.is20PercentMet ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'}`}>
            {results.currentDownPercent}% {results.is20PercentMet ? '✓' : '✗'}
          </div>
          <p className="text-xs text-slate-500 mt-1">
            {results.is20PercentMet 
              ? (language === 'he' ? 'מעולה! אתה עומד בכלל ה-20%.' : 'Great! You meet the 20% rule.') 
              : (language === 'he' ? 'כדאי להגדיל את המקדמה ל-20%.' : 'Consider increasing down payment.')}
          </p>
        </div>
      </div>
    </div>
  );
}
