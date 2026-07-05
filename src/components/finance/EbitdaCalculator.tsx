import React, { useState } from 'react';
import { useUIStore } from '../../stores/useUIStore';

export default function EbitdaCalculator() {
  const language = useUIStore(s => s.language);
  const [netIncome, setNetIncome] = useState<number>(100000);
  const [interest, setInterest] = useState<number>(15000);
  const [taxes, setTaxes] = useState<number>(25000);
  const [depreciation, setDepreciation] = useState<number>(10000);
  const [amortization, setAmortization] = useState<number>(5000);

  const calculateEbitda = () => {
    return netIncome + interest + taxes + depreciation + amortization;
  };

  return (
    <div className="p-6 max-w-xl mx-auto bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm">
      <h2 className="text-xl font-medium text-slate-900 dark:text-white mb-6">
        {language === 'he' ? 'מחשבון EBITDA' : 'EBITDA Calculator'}
      </h2>

      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="col-span-2">
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
            {language === 'he' ? 'רווח נקי' : 'Net Income'}
          </label>
          <input
            type="number"
            value={netIncome}
            onChange={(e) => setNetIncome(Number(e.target.value))}
            className="w-full px-3 py-2 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-sm"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
            {language === 'he' ? 'הוצאות ריבית' : 'Interest Expense'}
          </label>
          <input
            type="number"
            value={interest}
            onChange={(e) => setInterest(Number(e.target.value))}
            className="w-full px-3 py-2 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-sm"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
            {language === 'he' ? 'מסים' : 'Taxes'}
          </label>
          <input
            type="number"
            value={taxes}
            onChange={(e) => setTaxes(Number(e.target.value))}
            className="w-full px-3 py-2 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-sm"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
            {language === 'he' ? 'פחת' : 'Depreciation'}
          </label>
          <input
            type="number"
            value={depreciation}
            onChange={(e) => setDepreciation(Number(e.target.value))}
            className="w-full px-3 py-2 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-sm"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
            {language === 'he' ? 'הפחתות' : 'Amortization'}
          </label>
          <input
            type="number"
            value={amortization}
            onChange={(e) => setAmortization(Number(e.target.value))}
            className="w-full px-3 py-2 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-sm"
          />
        </div>
      </div>

      <div className="pt-4 border-t border-slate-100 dark:border-slate-800 mt-2">
        <p className="text-sm text-slate-500 dark:text-slate-400 mb-1">
          EBITDA
        </p>
        <div className="text-3xl font-medium text-emerald-600 dark:text-emerald-400">
          ${calculateEbitda().toLocaleString()}
        </div>
      </div>
    </div>
  );
}
