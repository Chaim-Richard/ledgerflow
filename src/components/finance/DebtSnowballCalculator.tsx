import React, { useState } from 'react';
import { useUIStore } from '../../stores/useUIStore';

interface Debt {
  name: string;
  balance: number;
  minPayment: number;
  rate: number;
}

export default function DebtSnowballCalculator() {
  const language = useUIStore(s => s.language);
  const [extraPayment, setExtraPayment] = useState<number>(200);
  const [debts, setDebts] = useState<Debt[]>([
    { name: 'Credit Card', balance: 2500, minPayment: 50, rate: 22 },
    { name: 'Car Loan', balance: 12000, minPayment: 300, rate: 6 },
    { name: 'Student Loan', balance: 25000, minPayment: 250, rate: 4 }
  ]);

  const calculateSnowball = () => {
    // Sort by balance (smallest first)
    const sortedDebts = [...debts].sort((a, b) => a.balance - b.balance);
    
    let totalBalance = sortedDebts.reduce((acc, d) => acc + d.balance, 0);
    let totalMinPayments = sortedDebts.reduce((acc, d) => acc + d.minPayment, 0);
    
    return {
      sortedDebts,
      totalBalance: totalBalance.toFixed(2),
      totalMonthlyCommitment: (totalMinPayments + extraPayment).toFixed(2)
    };
  };

  const results = calculateSnowball();

  return (
    <div className="p-6 max-w-2xl mx-auto bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm">
      <h2 className="text-xl font-medium text-slate-900 dark:text-white mb-6">
        {language === 'he' ? 'מחשבון כדור שלג (סילוק חובות)' : 'Debt Snowball Calculator'}
      </h2>
      <p className="text-sm text-slate-500 mb-6">
        {language === 'he' ? 'שיטת כדור השלג: תשלום מינימלי על הכל, והפניית כל הכסף הפנוי לחוב הקטן ביותר קודם.' : 'Snowball method: Pay minimums on everything, and put all extra cash towards the smallest balance first.'}
      </p>

      <div className="mb-6">
        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
          {language === 'he' ? 'תשלום נוסף לחודש (מעבר למינימום)' : 'Extra Monthly Payment (Beyond Minimums)'}
        </label>
        <input 
          type="number" 
          value={extraPayment} 
          onChange={(e) => setExtraPayment(Number(e.target.value))} 
          className="w-full px-3 py-2 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-sm max-w-xs" 
        />
      </div>

      <div className="space-y-4 mb-8">
        <h3 className="font-medium text-slate-900 dark:text-white">
          {language === 'he' ? 'החובות שלך (מומלץ לפרוע מלמעלה למטה)' : 'Your Debts (Pay off from top to bottom)'}
        </h3>
        
        {results.sortedDebts.map((debt, index) => (
          <div key={index} className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-100 dark:border-slate-800">
            <div>
              <div className="font-medium text-slate-900 dark:text-white flex items-center">
                <span className="flex items-center justify-center w-6 h-6 rounded-full bg-indigo-100 text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-400 text-xs mr-3">
                  {index + 1}
                </span>
                {debt.name}
              </div>
              <div className="text-xs text-slate-500 mt-1 ml-9">
                {language === 'he' ? 'ריבית' : 'Rate'}: {debt.rate}% | {language === 'he' ? 'מינימום' : 'Min'}: ${debt.minPayment}
              </div>
            </div>
            <div className="text-right">
              <div className="text-lg font-medium text-slate-700 dark:text-slate-300">
                ${debt.balance.toLocaleString()}
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-y-6 gap-x-4 pt-4 border-t border-slate-100 dark:border-slate-800">
        <div>
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-1">
            {language === 'he' ? 'סך כל החובות' : 'Total Debt Balance'}
          </p>
          <div className="text-2xl font-bold text-rose-600 dark:text-rose-400">
            ${Number(results.totalBalance).toLocaleString()}
          </div>
        </div>
        <div>
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-1">
            {language === 'he' ? 'התחייבות חודשית כוללת' : 'Total Monthly Commitment'}
          </p>
          <div className="text-2xl font-medium text-slate-700 dark:text-slate-300">
            ${Number(results.totalMonthlyCommitment).toLocaleString()}
          </div>
        </div>
      </div>
    </div>
  );
}
