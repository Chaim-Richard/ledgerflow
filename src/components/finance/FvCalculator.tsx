import React, { useState } from 'react';
import { useUIStore } from '../../stores/useUIStore';

export default function FvCalculator() {
  const language = useUIStore(s => s.language);
  const [presentValue, setPresentValue] = useState<number>(10000);
  const [interestRate, setInterestRate] = useState<number>(5);
  const [periods, setPeriods] = useState<number>(10);

  const calculateFv = () => {
    if (periods <= 0) return 0;
    const rate = interestRate / 100;
    const fv = presentValue * Math.pow(1 + rate, periods);
    return fv.toFixed(2);
  };

  return (
    <div className="p-6 max-w-xl mx-auto bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm">
      <h2 className="text-xl font-medium text-slate-900 dark:text-white mb-6">
        {language === 'he' ? 'מחשבון ערך עתידי (FV)' : 'Future Value (FV) Calculator'}
      </h2>

      <div className="grid gap-4 mb-6">
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
            {language === 'he' ? 'ערך נוכחי (PV)' : 'Present Value (PV)'}
          </label>
          <input
            type="number"
            value={presentValue}
            onChange={(e) => setPresentValue(Number(e.target.value))}
            className="w-full px-3 py-2 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-sm"
          />
        </div>
        
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              {language === 'he' ? 'שיעור ריבית (%)' : 'Interest Rate (%)'}
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
              {language === 'he' ? 'תקופות (בשנים)' : 'Periods (Years)'}
            </label>
            <input
              type="number"
              value={periods}
              onChange={(e) => setPeriods(Number(e.target.value))}
              className="w-full px-3 py-2 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-sm"
            />
          </div>
        </div>
      </div>

      <div className="pt-4 border-t border-slate-100 dark:border-slate-800 mt-2">
        <p className="text-sm text-slate-500 dark:text-slate-400 mb-1">
          {language === 'he' ? 'ערך עתידי (FV)' : 'Future Value (FV)'}
        </p>
        <div className="text-3xl font-medium text-indigo-600 dark:text-indigo-400">
          ${calculateFv()}
        </div>
      </div>
    </div>
  );
}
