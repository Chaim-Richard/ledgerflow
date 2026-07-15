import React, { useState } from 'react';
import { useUIStore } from '../../stores/useUIStore';

export default function CreditCardPayoff() {
  const language = useUIStore(s => s.language);
  const [balance, setBalance] = useState<number>(5000);
  const [interestRate, setInterestRate] = useState<number>(18.99);
  const [monthlyPayment, setMonthlyPayment] = useState<number>(200);

  const calculatePayoff = () => {
    if (balance <= 0 || monthlyPayment <= 0) return { months: 0, totalInterest: 0, impossible: false };
    
    const ratePerMonth = (interestRate / 100) / 12;
    const interestFirstMonth = balance * ratePerMonth;
    
    if (monthlyPayment <= interestFirstMonth) {
      return { months: 0, totalInterest: 0, impossible: true };
    }

    const months = -(Math.log(1 - (balance * ratePerMonth) / monthlyPayment) / Math.log(1 + ratePerMonth));
    const totalPayment = Math.ceil(months) * monthlyPayment;
    const totalInterest = totalPayment - balance;

    return {
      months: Math.ceil(months),
      totalInterest: totalInterest.toFixed(2),
      impossible: false
    };
  };

  const results = calculatePayoff();

  return (
    <div className="p-6 max-w-xl mx-auto bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm hover:shadow-md transition-all duration-200">
      <h2 className="text-xl font-medium text-slate-900 dark:text-white mb-6">
        {language === 'he' ? 'מחשבון סילוק אשראי' : 'Credit Card Payoff Calculator'}
      </h2>

      <div className="grid gap-4 mb-6">
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
            {language === 'he' ? 'יתרת חוב' : 'Credit Card Balance'}
          </label>
          <input
            type="number"
            value={balance}
            onChange={(e) => setBalance(Number(e.target.value))}
            className="w-full px-3 py-2 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-sm"
          />
        </div>
        
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              {language === 'he' ? 'ריבית (APR %)' : 'Interest Rate (APR %)'}
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
              {language === 'he' ? 'תשלום חודשי' : 'Monthly Payment'}
            </label>
            <input
              type="number"
              value={monthlyPayment}
              onChange={(e) => setMonthlyPayment(Number(e.target.value))}
              className="w-full px-3 py-2 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-sm"
            />
          </div>
        </div>
      </div>

      {results.impossible ? (
        <div className="p-4 bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900 rounded-lg">
          <p className="text-sm text-rose-600 dark:text-rose-400 font-medium">
            {language === 'he' ? 'התשלום החודשי נמוך מהריבית, החוב לעולם לא ישולם.' : 'Your monthly payment is less than the monthly interest. You will never pay off this debt.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-y-6 gap-x-4 pt-4 border-t border-slate-100 dark:border-slate-800 mt-2">
          <div>
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-1">
              {language === 'he' ? 'חודשים לסיום החוב' : 'Months to Pay Off'}
            </p>
            <div className="text-3xl font-medium text-indigo-600 dark:text-indigo-400">
              {results.months} {language === 'he' ? 'חודשים' : 'months'}
            </div>
          </div>
          <div>
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-1">
              {language === 'he' ? 'סך הכל ריבית' : 'Total Interest Paid'}
            </p>
            <div className="text-3xl font-medium text-rose-600 dark:text-rose-400">
              ${results.totalInterest}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
