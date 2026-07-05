import React, { useState } from 'react';
import { useUIStore } from '../../stores/useUIStore';

export default function PaybackPeriodCalculator() {
  const language = useUIStore(s => s.language);
  
  const [initialInvestment, setInitialInvestment] = useState<number>(50000);
  const [annualCashFlow, setAnnualCashFlow] = useState<number>(15000);

  const calculatePayback = () => {
    if (annualCashFlow <= 0) return 0;
    return initialInvestment / annualCashFlow;
  };

  const payback = calculatePayback();
  const years = Math.floor(payback);
  const months = Math.round((payback - years) * 12);

  return (
    <div className="p-6 max-w-xl mx-auto bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm">
      <h2 className="text-xl font-medium text-slate-900 dark:text-white mb-6">
        {language === 'he' ? 'תקופת החזר השקעה (Payback Period)' : 'Payback Period Calculator'}
      </h2>
      <p className="text-sm text-slate-500 mb-6">
        {language === 'he' ? 'מחשב כמה זמן ייקח להחזיר את ההשקעה הראשונית דרך תזרימי המזומנים.' : 'Calculates the amount of time it takes to recover the cost of an investment.'}
      </p>

      <div className="grid gap-4 mb-6">
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
            {language === 'he' ? 'השקעה ראשונית' : 'Initial Investment'}
          </label>
          <input type="number" value={initialInvestment} onChange={(e) => setInitialInvestment(Number(e.target.value))} className="w-full px-3 py-2 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-sm" />
        </div>
        
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
            {language === 'he' ? 'תזרים מזומנים שנתי (קבוע)' : 'Annual Cash Flow (Constant)'}
          </label>
          <input type="number" value={annualCashFlow} onChange={(e) => setAnnualCashFlow(Number(e.target.value))} className="w-full px-3 py-2 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-sm" />
        </div>
      </div>

      <div className="p-6 bg-emerald-50 dark:bg-emerald-900/10 rounded-xl border border-emerald-100 dark:border-emerald-800/50 text-center">
        <p className="text-sm font-medium text-emerald-800 dark:text-emerald-400 mb-2">
          {language === 'he' ? 'זמן להחזר ההשקעה' : 'Time to Recover Investment'}
        </p>
        <div className="text-4xl font-bold text-emerald-600 dark:text-emerald-400 mb-2">
          {payback.toFixed(2)} <span className="text-xl font-medium">{language === 'he' ? 'שנים' : 'Years'}</span>
        </div>
        {payback > 0 && (
          <p className="text-sm text-emerald-700 dark:text-emerald-500">
            ({language === 'he' ? 'בערך' : 'Approx.'} {years} {language === 'he' ? 'שנים ו-' : 'years and '} {months} {language === 'he' ? 'חודשים' : 'months'})
          </p>
        )}
      </div>
    </div>
  );
}
