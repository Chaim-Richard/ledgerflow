import React, { useState } from 'react';
import { useUIStore } from '../../stores/useUIStore';

export default function DtiCalculator() {
  const language = useUIStore(s => s.language);
  const [monthlyIncome, setMonthlyIncome] = useState<number>(5000);
  const [mortgage, setMortgage] = useState<number>(1200);
  const [autoLoan, setAutoLoan] = useState<number>(300);
  const [creditCards, setCreditCards] = useState<number>(150);
  const [otherDebt, setOtherDebt] = useState<number>(100);

  const calculateDTI = () => {
    if (monthlyIncome <= 0) return { dti: 0, totalDebt: 0 };
    
    const totalDebt = mortgage + autoLoan + creditCards + otherDebt;
    const dti = (totalDebt / monthlyIncome) * 100;

    return {
      totalDebt: totalDebt.toFixed(2),
      dti: dti.toFixed(2)
    };
  };

  const results = calculateDTI();

  return (
    <div className="p-6 max-w-xl mx-auto bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm">
      <h2 className="text-xl font-medium text-slate-900 dark:text-white mb-6">
        {language === 'he' ? 'מחשבון יחס חוב להכנסה (DTI)' : 'Debt-to-Income (DTI) Calculator'}
      </h2>

      <div className="grid gap-4 mb-6">
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
            {language === 'he' ? 'הכנסה חודשית ברוטו' : 'Monthly Gross Income'}
          </label>
          <input
            type="number"
            value={monthlyIncome}
            onChange={(e) => setMonthlyIncome(Number(e.target.value))}
            className="w-full px-3 py-2 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-sm"
          />
        </div>
        
        <div className="pt-4 mt-2 border-t border-slate-100 dark:border-slate-800">
          <p className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-4">
            {language === 'he' ? 'התחייבויות חודשיות' : 'Monthly Debt Payments'}
          </p>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                {language === 'he' ? 'משכנתא / שכר דירה' : 'Mortgage / Rent'}
              </label>
              <input
                type="number"
                value={mortgage}
                onChange={(e) => setMortgage(Number(e.target.value))}
                className="w-full px-3 py-2 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                {language === 'he' ? 'הלוואות רכב' : 'Auto Loans'}
              </label>
              <input
                type="number"
                value={autoLoan}
                onChange={(e) => setAutoLoan(Number(e.target.value))}
                className="w-full px-3 py-2 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                {language === 'he' ? 'כרטיסי אשראי' : 'Credit Cards'}
              </label>
              <input
                type="number"
                value={creditCards}
                onChange={(e) => setCreditCards(Number(e.target.value))}
                className="w-full px-3 py-2 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                {language === 'he' ? 'חובות אחרים' : 'Other Debt'}
              </label>
              <input
                type="number"
                value={otherDebt}
                onChange={(e) => setOtherDebt(Number(e.target.value))}
                className="w-full px-3 py-2 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-sm"
              />
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-y-6 gap-x-4 pt-4 border-t border-slate-100 dark:border-slate-800 mt-2">
        <div>
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-1">
            {language === 'he' ? 'סך חוב חודשי' : 'Total Monthly Debt'}
          </p>
          <div className="text-2xl font-medium text-slate-700 dark:text-slate-300">
            ${results.totalDebt}
          </div>
        </div>
        <div>
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-1">
            {language === 'he' ? 'יחס חוב להכנסה' : 'Debt-to-Income Ratio'}
          </p>
          <div className={`text-3xl font-medium ${Number(results.dti) > 43 ? 'text-rose-600' : 'text-indigo-600'}`}>
            {results.dti}%
          </div>
          <p className="text-xs text-slate-500 mt-1">
             {Number(results.dti) > 43 ? 
               (language === 'he' ? 'מסוכן (>43%)' : 'High Risk (>43%)') : 
               (language === 'he' ? 'תקין (<=43%)' : 'Good (<=43%)')}
          </p>
        </div>
      </div>
    </div>
  );
}
