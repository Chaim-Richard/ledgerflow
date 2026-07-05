import React, { useState } from 'react';
import { useUIStore } from '../../stores/useUIStore';

export default function CashOnCashCalculator() {
  const language = useUIStore(s => s.language);
  const [purchasePrice, setPurchasePrice] = useState<number>(300000);
  const [downPayment, setDownPayment] = useState<number>(60000);
  const [closingCosts, setClosingCosts] = useState<number>(5000);
  const [rehabCosts, setRehabCosts] = useState<number>(10000);
  
  const [monthlyRent, setMonthlyRent] = useState<number>(2500);
  const [monthlyMortgage, setMonthlyMortgage] = useState<number>(1200);
  const [monthlyExpenses, setMonthlyExpenses] = useState<number>(500); // taxes, insurance, maintenance, vacancy

  const calculateReturn = () => {
    const totalCashInvested = downPayment + closingCosts + rehabCosts;
    const annualRent = monthlyRent * 12;
    const annualMortgage = monthlyMortgage * 12;
    const annualExpenses = monthlyExpenses * 12;
    
    const annualCashFlow = annualRent - annualMortgage - annualExpenses;
    const cashOnCashReturn = totalCashInvested > 0 ? (annualCashFlow / totalCashInvested) * 100 : 0;

    return {
      totalCashInvested,
      annualCashFlow,
      monthlyCashFlow: annualCashFlow / 12,
      cashOnCashReturn: cashOnCashReturn.toFixed(2)
    };
  };

  const results = calculateReturn();

  return (
    <div className="p-6 max-w-2xl mx-auto bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm">
      <h2 className="text-xl font-medium text-slate-900 dark:text-white mb-6">
        {language === 'he' ? 'תשואת מזומן על מזומן (Cash on Cash)' : 'Cash on Cash Return Calculator'}
      </h2>

      <div className="grid md:grid-cols-2 gap-6 mb-6">
        <div>
          <h3 className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-3 border-b border-slate-200 dark:border-slate-800 pb-1">
            {language === 'he' ? 'השקעה התחלתית' : 'Initial Investment'}
          </h3>
          <div className="space-y-3">
            <div>
              <label className="block text-xs text-slate-600 dark:text-slate-400 mb-1">
                {language === 'he' ? 'מחיר רכישה' : 'Purchase Price'}
              </label>
              <input type="number" value={purchasePrice} onChange={(e) => setPurchasePrice(Number(e.target.value))} className="w-full px-3 py-1.5 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-sm" />
            </div>
            <div>
              <label className="block text-xs text-slate-600 dark:text-slate-400 mb-1">
                {language === 'he' ? 'הון עצמי (Down Payment)' : 'Down Payment'}
              </label>
              <input type="number" value={downPayment} onChange={(e) => setDownPayment(Number(e.target.value))} className="w-full px-3 py-1.5 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-sm" />
            </div>
            <div>
              <label className="block text-xs text-slate-600 dark:text-slate-400 mb-1">
                {language === 'he' ? 'עלויות סגירה / תיווך' : 'Closing Costs'}
              </label>
              <input type="number" value={closingCosts} onChange={(e) => setClosingCosts(Number(e.target.value))} className="w-full px-3 py-1.5 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-sm" />
            </div>
            <div>
              <label className="block text-xs text-slate-600 dark:text-slate-400 mb-1">
                {language === 'he' ? 'שיפוצים / התאמות' : 'Rehab / Repairs'}
              </label>
              <input type="number" value={rehabCosts} onChange={(e) => setRehabCosts(Number(e.target.value))} className="w-full px-3 py-1.5 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-sm" />
            </div>
          </div>
        </div>

        <div>
          <h3 className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-3 border-b border-slate-200 dark:border-slate-800 pb-1">
            {language === 'he' ? 'תזרים חודשי' : 'Monthly Cash Flow'}
          </h3>
          <div className="space-y-3">
            <div>
              <label className="block text-xs text-slate-600 dark:text-slate-400 mb-1">
                {language === 'he' ? 'הכנסה משכירות' : 'Rental Income'}
              </label>
              <input type="number" value={monthlyRent} onChange={(e) => setMonthlyRent(Number(e.target.value))} className="w-full px-3 py-1.5 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-sm" />
            </div>
            <div>
              <label className="block text-xs text-slate-600 dark:text-slate-400 mb-1">
                {language === 'he' ? 'החזר משכנתא' : 'Mortgage Payment'}
              </label>
              <input type="number" value={monthlyMortgage} onChange={(e) => setMonthlyMortgage(Number(e.target.value))} className="w-full px-3 py-1.5 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-sm" />
            </div>
            <div>
              <label className="block text-xs text-slate-600 dark:text-slate-400 mb-1">
                {language === 'he' ? 'הוצאות (מס, ביטוח, ניהול)' : 'Other Expenses (Tax, Ins, Maint)'}
              </label>
              <input type="number" value={monthlyExpenses} onChange={(e) => setMonthlyExpenses(Number(e.target.value))} className="w-full px-3 py-1.5 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-sm" />
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-y-6 gap-x-4 pt-4 border-t border-slate-100 dark:border-slate-800 mt-2">
        <div>
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-1">
            {language === 'he' ? 'סה״כ מזומן מושקע' : 'Total Cash Invested'}
          </p>
          <div className="text-xl font-medium text-slate-700 dark:text-slate-300">
            ${results.totalCashInvested.toLocaleString()}
          </div>
        </div>
        <div>
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-1">
            {language === 'he' ? 'תזרים מזומנים שנתי' : 'Annual Cash Flow'}
          </p>
          <div className={`text-xl font-medium ${results.annualCashFlow >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
            ${results.annualCashFlow.toLocaleString()}
          </div>
        </div>
        <div>
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-1">
            {language === 'he' ? 'תשואת Cash on Cash' : 'Cash on Cash Return'}
          </p>
          <div className="text-3xl font-bold text-indigo-600 dark:text-indigo-400">
            {results.cashOnCashReturn}%
          </div>
        </div>
      </div>
    </div>
  );
}
