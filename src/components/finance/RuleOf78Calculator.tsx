import React, { useState } from 'react';
import { useUIStore } from '../../stores/useUIStore';

export default function RuleOf78Calculator() {
  const language = useUIStore(s => s.language);
  const [loanTerm, setLoanTerm] = useState<number>(12); // months
  const [totalInterest, setTotalInterest] = useState<number>(1000);
  const [monthPayoff, setMonthPayoff] = useState<number>(3); // payoff after month X

  const calculateRefund = () => {
    if (loanTerm <= 0 || monthPayoff < 0 || monthPayoff > loanTerm) return { unearnedInterest: 0, sumOfDigits: 0, remainingDigits: 0 };
    
    // Sum of digits for the full term (e.g. for 12, it's 78)
    const sumOfDigits = (loanTerm * (loanTerm + 1)) / 2;
    
    // Remaining months after payoff
    const remainingMonths = loanTerm - monthPayoff;
    const remainingDigits = (remainingMonths * (remainingMonths + 1)) / 2;
    
    // Unearned interest (refund)
    const unearnedInterest = totalInterest * (remainingDigits / sumOfDigits);

    return {
      unearnedInterest: unearnedInterest.toFixed(2),
      sumOfDigits,
      remainingDigits
    };
  };

  const results = calculateRefund();

  return (
    <div className="p-6 max-w-xl mx-auto bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm">
      <h2 className="text-xl font-medium text-slate-900 dark:text-white mb-6">
        {language === 'he' ? 'מחשבון חוק 78 (החזר ריבית בהלוואות)' : 'Rule of 78 Calculator (Loan Refund)'}
      </h2>
      <p className="text-sm text-slate-500 mb-6">
        {language === 'he' ? 'חישוב הריבית הלא-מרווחת המוחזרת בעת פירעון מוקדם של הלוואה.' : 'Calculates the unearned interest refund when paying off a loan early using the Rule of 78 method.'}
      </p>

      <div className="grid gap-4 mb-6">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              {language === 'he' ? 'תקופת הלוואה (חודשים)' : 'Total Loan Term (Months)'}
            </label>
            <input
              type="number"
              value={loanTerm}
              onChange={(e) => setLoanTerm(Number(e.target.value))}
              className="w-full px-3 py-2 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              {language === 'he' ? 'סך כל הריבית' : 'Total Interest Charge'}
            </label>
            <input
              type="number"
              value={totalInterest}
              onChange={(e) => setTotalInterest(Number(e.target.value))}
              className="w-full px-3 py-2 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-sm"
            />
          </div>
        </div>
        
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
            {language === 'he' ? 'פירעון מוקדם לאחר חודש מס׳' : 'Payoff after Month #'}
          </label>
          <input
            type="number"
            value={monthPayoff}
            onChange={(e) => setMonthPayoff(Number(e.target.value))}
            className="w-full px-3 py-2 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-sm"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-y-6 gap-x-4 pt-4 border-t border-slate-100 dark:border-slate-800 mt-2">
        <div>
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-1">
            {language === 'he' ? 'החזר ריבית (לא מרווחת)' : 'Interest Refund (Unearned)'}
          </p>
          <div className="text-3xl font-medium text-emerald-600 dark:text-emerald-400">
            ${results.unearnedInterest}
          </div>
        </div>
        <div>
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-1">
            {language === 'he' ? 'ריבית ששולמה' : 'Interest Paid (Earned)'}
          </p>
          <div className="text-2xl font-medium text-slate-700 dark:text-slate-300">
            ${(totalInterest - Number(results.unearnedInterest)).toFixed(2)}
          </div>
        </div>
      </div>
    </div>
  );
}
