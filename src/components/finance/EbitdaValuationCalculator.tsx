import React, { useState } from 'react';
import { useUIStore } from '../../stores/useUIStore';

export default function EbitdaValuationCalculator() {
  const language = useUIStore(s => s.language);
  const [revenue, setRevenue] = useState<number>(1000000);
  const [cogs, setCogs] = useState<number>(400000);
  const [operatingExpenses, setOperatingExpenses] = useState<number>(300000);
  const [depreciation, setDepreciation] = useState<number>(50000);
  const [amortization, setAmortization] = useState<number>(10000);
  const [ebitdaMultiple, setEbitdaMultiple] = useState<number>(4.5);

  const calculateValuation = () => {
    // Gross Profit
    const grossProfit = revenue - cogs;
    
    // Operating Profit (EBIT)
    const ebit = grossProfit - operatingExpenses;
    
    // EBITDA = EBIT + Depreciation + Amortization
    const ebitda = ebit + depreciation + amortization;
    
    // Enterprise Value
    const enterpriseValue = ebitda * ebitdaMultiple;

    return {
      ebit,
      ebitda,
      enterpriseValue,
      ebitdaMargin: revenue > 0 ? (ebitda / revenue) * 100 : 0
    };
  };

  const results = calculateValuation();

  return (
    <div className="p-6 max-w-xl mx-auto bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm">
      <h2 className="text-xl font-medium text-slate-900 dark:text-white mb-6">
        {language === 'he' ? 'הערכת שווי חברה לפי מכפיל EBITDA' : 'Business Valuation (EBITDA Multiple)'}
      </h2>

      <div className="grid gap-4 mb-6">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              {language === 'he' ? 'הכנסות (Revenue)' : 'Annual Revenue'}
            </label>
            <input type="number" value={revenue} onChange={(e) => setRevenue(Number(e.target.value))} className="w-full px-3 py-2 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-sm" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              {language === 'he' ? 'עלות המכר (COGS)' : 'Cost of Goods Sold (COGS)'}
            </label>
            <input type="number" value={cogs} onChange={(e) => setCogs(Number(e.target.value))} className="w-full px-3 py-2 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-sm" />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
            {language === 'he' ? 'הוצאות תפעוליות (Operating Expenses)' : 'Operating Expenses (excluding D&A)'}
          </label>
          <input type="number" value={operatingExpenses} onChange={(e) => setOperatingExpenses(Number(e.target.value))} className="w-full px-3 py-2 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-sm" />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              {language === 'he' ? 'פחת (Depreciation)' : 'Depreciation'}
            </label>
            <input type="number" value={depreciation} onChange={(e) => setDepreciation(Number(e.target.value))} className="w-full px-3 py-2 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-sm" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              {language === 'he' ? 'הפחתות (Amortization)' : 'Amortization'}
            </label>
            <input type="number" value={amortization} onChange={(e) => setAmortization(Number(e.target.value))} className="w-full px-3 py-2 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-sm" />
          </div>
        </div>
        
        <div className="pt-4 mt-2 border-t border-slate-100 dark:border-slate-800">
          <label className="block text-sm font-medium text-indigo-700 dark:text-indigo-400 mb-1">
            {language === 'he' ? 'מכפיל ה-EBITDA בענף' : 'Industry EBITDA Multiple'}
          </label>
          <input type="number" step="0.1" value={ebitdaMultiple} onChange={(e) => setEbitdaMultiple(Number(e.target.value))} className="w-full px-3 py-2 bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800 rounded-lg text-sm font-bold text-indigo-900 dark:text-indigo-300" />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-y-6 gap-x-4 pt-4 border-t border-slate-100 dark:border-slate-800">
        <div>
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-1">EBITDA</p>
          <div className="text-2xl font-bold text-slate-700 dark:text-slate-300">
            ${Number(results.ebitda).toLocaleString()}
          </div>
          <p className="text-xs text-slate-500 mt-1">
            {language === 'he' ? 'שולי EBITDA:' : 'Margin:'} {results.ebitdaMargin.toFixed(1)}%
          </p>
        </div>
        <div>
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-1">
            {language === 'he' ? 'שווי פעילות מחושב' : 'Estimated Enterprise Value'}
          </p>
          <div className="text-3xl font-bold text-emerald-600 dark:text-emerald-400">
            ${Number(results.enterpriseValue).toLocaleString()}
          </div>
        </div>
      </div>
    </div>
  );
}
