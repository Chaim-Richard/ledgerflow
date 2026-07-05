import React, { useState } from 'react';
import { useUIStore } from '../../stores/useUIStore';

export default function LoanCalculator() {
  const language = useUIStore(s => s.language);
  const [loanAmount, setLoanAmount] = useState<number>(250000);
  const [interestRate, setInterestRate] = useState<number>(5.5);
  const [loanTerm, setLoanTerm] = useState<number>(30); // in years

  const calculateLoan = () => {
    if (loanAmount <= 0 || loanTerm <= 0) return { payment: 0, totalInterest: 0, totalPayment: 0 };
    
    const principal = loanAmount;
    const ratePerMonth = (interestRate / 100) / 12;
    const numberOfPayments = loanTerm * 12;

    let monthlyPayment = 0;
    if (ratePerMonth === 0) {
      monthlyPayment = principal / numberOfPayments;
    } else {
      monthlyPayment = (principal * ratePerMonth * Math.pow(1 + ratePerMonth, numberOfPayments)) / (Math.pow(1 + ratePerMonth, numberOfPayments) - 1);
    }

    const totalPayment = monthlyPayment * numberOfPayments;
    const totalInterest = totalPayment - principal;

    return {
      payment: monthlyPayment.toFixed(2),
      totalInterest: totalInterest.toFixed(2),
      totalPayment: totalPayment.toFixed(2)
    };
  };

  const results = calculateLoan();

  return (
    <div className="p-6 max-w-xl mx-auto bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm">
      <h2 className="text-xl font-medium text-slate-900 dark:text-white mb-6">
        {language === 'he' ? 'מחשבון הלוואה ומשכנתא' : 'Loan & Mortgage Calculator'}
      </h2>

      <div className="grid gap-4 mb-6">
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
            {language === 'he' ? 'סכום ההלוואה' : 'Loan Amount'}
          </label>
          <input
            type="number"
            value={loanAmount}
            onChange={(e) => setLoanAmount(Number(e.target.value))}
            className="w-full px-3 py-2 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-sm"
          />
        </div>
        
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              {language === 'he' ? 'ריבית שנתית (%)' : 'Annual Interest Rate (%)'}
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
              {language === 'he' ? 'תקופת הלוואה (שנים)' : 'Loan Term (Years)'}
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

      <div className="pt-4 border-t border-slate-100 dark:border-slate-800 mt-2 space-y-4">
        <div>
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-1">
            {language === 'he' ? 'תשלום חודשי' : 'Monthly Payment'}
          </p>
          <div className="text-3xl font-medium text-indigo-600 dark:text-indigo-400">
            ${results.payment}
          </div>
        </div>
        
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-1">
              {language === 'he' ? 'סך הכל ריבית' : 'Total Interest'}
            </p>
            <div className="text-xl font-medium text-slate-700 dark:text-slate-300">
              ${results.totalInterest}
            </div>
          </div>
          <div>
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-1">
              {language === 'he' ? 'סך הכל תשלומים' : 'Total of Payments'}
            </p>
            <div className="text-xl font-medium text-slate-700 dark:text-slate-300">
              ${results.totalPayment}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
