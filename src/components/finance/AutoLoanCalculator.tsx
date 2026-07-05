import React, { useState } from 'react';
import { useUIStore } from '../../stores/useUIStore';

export default function AutoLoanCalculator() {
  const language = useUIStore(s => s.language);
  const [carPrice, setCarPrice] = useState<number>(30000);
  const [downPayment, setDownPayment] = useState<number>(5000);
  const [tradeInValue, setTradeInValue] = useState<number>(2000);
  const [interestRate, setInterestRate] = useState<number>(4.5);
  const [loanTerm, setLoanTerm] = useState<number>(60); // in months
  const [salesTaxRate, setSalesTaxRate] = useState<number>(7);

  const calculateAutoLoan = () => {
    if (loanTerm <= 0) return { monthlyPayment: 0, totalInterest: 0, totalCost: 0, loanAmount: 0 };
    
    const taxableAmount = carPrice - tradeInValue;
    const salesTax = taxableAmount > 0 ? taxableAmount * (salesTaxRate / 100) : 0;
    
    const totalCarCost = carPrice + salesTax;
    const loanAmount = totalCarCost - downPayment - tradeInValue;

    if (loanAmount <= 0) return { monthlyPayment: 0, totalInterest: 0, totalCost: totalCarCost, loanAmount: 0 };

    const ratePerMonth = (interestRate / 100) / 12;

    let monthlyPayment = 0;
    if (ratePerMonth === 0) {
      monthlyPayment = loanAmount / loanTerm;
    } else {
      monthlyPayment = (loanAmount * ratePerMonth * Math.pow(1 + ratePerMonth, loanTerm)) / (Math.pow(1 + ratePerMonth, loanTerm) - 1);
    }

    const totalPayment = monthlyPayment * loanTerm;
    const totalInterest = totalPayment - loanAmount;
    const totalCost = totalPayment + downPayment + tradeInValue;

    return {
      monthlyPayment: monthlyPayment.toFixed(2),
      totalInterest: totalInterest.toFixed(2),
      totalCost: totalCost.toFixed(2),
      loanAmount: loanAmount.toFixed(2)
    };
  };

  const results = calculateAutoLoan();

  return (
    <div className="p-6 max-w-xl mx-auto bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm">
      <h2 className="text-xl font-medium text-slate-900 dark:text-white mb-6">
        {language === 'he' ? 'מחשבון הלוואת רכב' : 'Auto Loan Calculator'}
      </h2>

      <div className="grid gap-4 mb-6">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              {language === 'he' ? 'מחיר הרכב' : 'Car Price'}
            </label>
            <input
              type="number"
              value={carPrice}
              onChange={(e) => setCarPrice(Number(e.target.value))}
              className="w-full px-3 py-2 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              {language === 'he' ? 'מקדם מכירות (%)' : 'Sales Tax Rate (%)'}
            </label>
            <input
              type="number"
              value={salesTaxRate}
              onChange={(e) => setSalesTaxRate(Number(e.target.value))}
              className="w-full px-3 py-2 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-sm"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              {language === 'he' ? 'מקדמה' : 'Down Payment'}
            </label>
            <input
              type="number"
              value={downPayment}
              onChange={(e) => setDownPayment(Number(e.target.value))}
              className="w-full px-3 py-2 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              {language === 'he' ? 'שווי טרייד-אין' : 'Trade-in Value'}
            </label>
            <input
              type="number"
              value={tradeInValue}
              onChange={(e) => setTradeInValue(Number(e.target.value))}
              className="w-full px-3 py-2 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-sm"
            />
          </div>
        </div>
        
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              {language === 'he' ? 'ריבית (%)' : 'Interest Rate (%)'}
            </label>
            <input
              type="number"
              value={interestRate}
              onChange={(e) => setInterestRate(Number(e.target.value))}
              className="w-full px-3 py-2 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              {language === 'he' ? 'תקופת הלוואה (חודשים)' : 'Loan Term (Months)'}
            </label>
            <input
              type="number"
              value={loanTerm}
              onChange={(e) => setLoanTerm(Number(e.target.value))}
              className="w-full px-3 py-2 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-sm"
            />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-y-6 gap-x-4 pt-4 border-t border-slate-100 dark:border-slate-800 mt-2">
        <div>
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-1">
            {language === 'he' ? 'תשלום חודשי' : 'Monthly Payment'}
          </p>
          <div className="text-3xl font-medium text-indigo-600 dark:text-indigo-400">
            ${results.monthlyPayment}
          </div>
        </div>
        <div>
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-1">
            {language === 'he' ? 'סכום הלוואה' : 'Loan Amount'}
          </p>
          <div className="text-2xl font-medium text-slate-700 dark:text-slate-300">
            ${results.loanAmount}
          </div>
        </div>
        <div>
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-1">
            {language === 'he' ? 'סך הכל ריבית' : 'Total Interest Paid'}
          </p>
          <div className="text-2xl font-medium text-rose-600 dark:text-rose-400">
            ${results.totalInterest}
          </div>
        </div>
        <div>
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-1">
            {language === 'he' ? 'עלות כוללת (כולל ריבית)' : 'Total Cost of Car'}
          </p>
          <div className="text-2xl font-medium text-slate-700 dark:text-slate-300">
            ${results.totalCost}
          </div>
        </div>
      </div>
    </div>
  );
}
