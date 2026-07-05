import React, { useState } from 'react';
import { useUIStore } from '../../stores/useUIStore';

export default function EmergencyFundCalculator() {
  const language = useUIStore(s => s.language);
  const [rentMortgage, setRentMortgage] = useState<number>(1500);
  const [utilities, setUtilities] = useState<number>(300);
  const [groceries, setGroceries] = useState<number>(600);
  const [transportation, setTransportation] = useState<number>(250);
  const [insurance, setInsurance] = useState<number>(200);
  const [debtPayments, setDebtPayments] = useState<number>(300);
  const [otherEssentials, setOtherEssentials] = useState<number>(200);
  const [currentSavings, setCurrentSavings] = useState<number>(5000);

  const calculateFund = () => {
    const monthlyExpenses = rentMortgage + utilities + groceries + transportation + insurance + debtPayments + otherEssentials;
    
    // Recommendations
    const minGoal = monthlyExpenses * 3; // 3 months
    const idealGoal = monthlyExpenses * 6; // 6 months

    return {
      monthlyExpenses: monthlyExpenses.toFixed(2),
      minGoal: minGoal.toFixed(2),
      idealGoal: idealGoal.toFixed(2),
      gapToIdeal: Math.max(0, idealGoal - currentSavings).toFixed(2),
      percentToIdeal: idealGoal > 0 ? Math.min(100, (currentSavings / idealGoal) * 100).toFixed(0) : '0'
    };
  };

  const results = calculateFund();

  return (
    <div className="p-6 max-w-2xl mx-auto bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm">
      <h2 className="text-xl font-medium text-slate-900 dark:text-white mb-6">
        {language === 'he' ? 'מחשבון קרן חירום (Emergency Fund)' : 'Emergency Fund Calculator'}
      </h2>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-6">
        <div>
          <h3 className="font-medium text-slate-900 dark:text-white mb-4 pb-2 border-b border-slate-100 dark:border-slate-800">
            {language === 'he' ? 'הוצאות חודשיות הכרחיות' : 'Essential Monthly Expenses'}
          </h3>
          <div className="space-y-3">
            <div>
              <label className="block text-xs text-slate-600 dark:text-slate-400 mb-1">
                {language === 'he' ? 'שכר דירה / משכנתא' : 'Rent / Mortgage'}
              </label>
              <input type="number" value={rentMortgage} onChange={(e) => setRentMortgage(Number(e.target.value))} className="w-full px-3 py-1.5 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-sm" />
            </div>
            <div>
              <label className="block text-xs text-slate-600 dark:text-slate-400 mb-1">
                {language === 'he' ? 'חשבונות (חשמל, מים, אינטרנט)' : 'Utilities'}
              </label>
              <input type="number" value={utilities} onChange={(e) => setUtilities(Number(e.target.value))} className="w-full px-3 py-1.5 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-sm" />
            </div>
            <div>
              <label className="block text-xs text-slate-600 dark:text-slate-400 mb-1">
                {language === 'he' ? 'אוכל וסופר' : 'Groceries'}
              </label>
              <input type="number" value={groceries} onChange={(e) => setGroceries(Number(e.target.value))} className="w-full px-3 py-1.5 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-sm" />
            </div>
            <div>
              <label className="block text-xs text-slate-600 dark:text-slate-400 mb-1">
                {language === 'he' ? 'תחבורה / דלק' : 'Transportation'}
              </label>
              <input type="number" value={transportation} onChange={(e) => setTransportation(Number(e.target.value))} className="w-full px-3 py-1.5 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-sm" />
            </div>
            <div>
              <label className="block text-xs text-slate-600 dark:text-slate-400 mb-1">
                {language === 'he' ? 'ביטוחים ובריאות' : 'Insurance & Healthcare'}
              </label>
              <input type="number" value={insurance} onChange={(e) => setInsurance(Number(e.target.value))} className="w-full px-3 py-1.5 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-sm" />
            </div>
            <div>
              <label className="block text-xs text-slate-600 dark:text-slate-400 mb-1">
                {language === 'he' ? 'החזרי חובות (הלוואות, אשראי)' : 'Minimum Debt Payments'}
              </label>
              <input type="number" value={debtPayments} onChange={(e) => setDebtPayments(Number(e.target.value))} className="w-full px-3 py-1.5 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-sm" />
            </div>
            <div>
              <label className="block text-xs text-slate-600 dark:text-slate-400 mb-1">
                {language === 'he' ? 'שונות חובה' : 'Other Essentials'}
              </label>
              <input type="number" value={otherEssentials} onChange={(e) => setOtherEssentials(Number(e.target.value))} className="w-full px-3 py-1.5 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-sm" />
            </div>
          </div>
        </div>

        <div className="flex flex-col">
          <div className="mb-6">
            <h3 className="font-medium text-slate-900 dark:text-white mb-4 pb-2 border-b border-slate-100 dark:border-slate-800">
              {language === 'he' ? 'מצב נוכחי' : 'Current Status'}
            </h3>
            <div>
              <label className="block text-xs text-slate-600 dark:text-slate-400 mb-1">
                {language === 'he' ? 'חיסכון לחירום כרגע' : 'Current Emergency Savings'}
              </label>
              <input type="number" value={currentSavings} onChange={(e) => setCurrentSavings(Number(e.target.value))} className="w-full px-3 py-2 bg-white dark:bg-slate-950 border border-indigo-200 dark:border-indigo-800 rounded-lg text-sm" />
            </div>
          </div>

          <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-xl flex-1 flex flex-col justify-center">
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-1 text-center">
              {language === 'he' ? 'הוצאות חודשיות בסיסיות' : 'Total Monthly Essentials'}
            </p>
            <div className="text-3xl font-bold text-slate-800 dark:text-slate-200 text-center mb-6">
              ${Number(results.monthlyExpenses).toLocaleString()}
            </div>
            
            <div className="space-y-4">
              <div>
                <p className="text-xs text-slate-500 mb-1 flex justify-between">
                  <span>{language === 'he' ? 'יעד מינימלי (3 חודשים)' : 'Minimum Goal (3 Months)'}</span>
                  <span className="font-medium text-slate-700 dark:text-slate-300">${Number(results.minGoal).toLocaleString()}</span>
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-500 mb-1 flex justify-between">
                  <span>{language === 'he' ? 'יעד אידיאלי (6 חודשים)' : 'Ideal Goal (6 Months)'}</span>
                  <span className="font-medium text-indigo-600 dark:text-indigo-400">${Number(results.idealGoal).toLocaleString()}</span>
                </p>
                <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2 mt-2 overflow-hidden">
                  <div 
                    className={`h-2 rounded-full ${Number(results.percentToIdeal) >= 100 ? 'bg-emerald-500' : 'bg-indigo-500'}`} 
                    style={{ width: `${results.percentToIdeal}%` }}
                  ></div>
                </div>
                <p className="text-xs text-slate-500 mt-1 text-right">
                  {results.percentToIdeal}%
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
