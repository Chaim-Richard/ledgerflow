import React, { useState } from 'react';
import { useUIStore } from '../../stores/useUIStore';

export default function CostOfDebtCalculator() {
  const language = useUIStore(s => s.language);
  
  const [interestExpense, setInterestExpense] = useState<number>(50000);
  const [totalDebt, setTotalDebt] = useState<number>(1000000);
  const [taxRate, setTaxRate] = useState<number>(25);

  const calculateCostOfDebt = () => {
    if (totalDebt <= 0) return { costOfDebt: 0, afterTaxCost: 0 };
    
    const preTaxCost = (interestExpense / totalDebt) * 100;
    const afterTaxCost = preTaxCost * (1 - (taxRate / 100));
    
    return {
      preTaxCost: preTaxCost.toFixed(2),
      afterTaxCost: afterTaxCost.toFixed(2)
    };
  };

  const results = calculateCostOfDebt();

  return (
    <div className="p-6 max-w-xl mx-auto bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm">
      <h2 className="text-xl font-medium text-slate-900 dark:text-white mb-6">
        {language === 'he' ? 'עלות חוב (Cost of Debt)' : 'Cost of Debt Calculator'}
      </h2>
      <p className="text-sm text-slate-500 mb-6">
        {language === 'he' ? 'מחשב את הריבית האפקטיבית שחברה משלמת על חובותיה, לפני ואחרי מס.' : 'Calculates the effective rate that a company pays on its borrowed funds.'}
      </p>

      <div className="grid grid-cols-2 gap-4 mb-6">
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
            {language === 'he' ? 'הוצאות ריבית שנתיות ($)' : 'Annual Interest Expense ($)'}
          </label>
          <input type="number" value={interestExpense} onChange={(e) => setInterestExpense(Number(e.target.value))} className="w-full px-3 py-2 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-sm" />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
            {language === 'he' ? 'סך הכל חוב ($)' : 'Total Debt ($)'}
          </label>
          <input type="number" value={totalDebt} onChange={(e) => setTotalDebt(Number(e.target.value))} className="w-full px-3 py-2 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-sm" />
        </div>
        <div className="col-span-2">
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
            {language === 'he' ? 'שיעור מס חברות (%)' : 'Corporate Tax Rate (%)'}
          </label>
          <input type="number" step="1" value={taxRate} onChange={(e) => setTaxRate(Number(e.target.value))} className="w-full px-3 py-2 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-sm" />
        </div>
      </div>

      <div className="pt-6 border-t border-slate-100 dark:border-slate-800 space-y-4">
        <div className="flex justify-between items-center text-sm text-slate-600 dark:text-slate-400 px-2">
          <span>{language === 'he' ? 'עלות חוב לפני מס:' : 'Pre-Tax Cost of Debt:'}</span>
          <span className="font-medium">{results.preTaxCost}%</span>
        </div>
        
        <div className="p-4 bg-emerald-50 dark:bg-emerald-900/10 rounded-xl border border-emerald-100 dark:border-emerald-800/30 flex justify-between items-center mt-4">
          <div>
            <p className="text-sm font-medium text-emerald-800 dark:text-emerald-400 mb-1">
              {language === 'he' ? 'עלות חוב לאחר מס' : 'After-Tax Cost of Debt'}
            </p>
          </div>
          <div className="text-4xl font-bold text-emerald-600 dark:text-emerald-400">
            {results.afterTaxCost}%
          </div>
        </div>
      </div>
    </div>
  );
}
