import React, { useState } from 'react';
import { useUIStore } from '../../stores/useUIStore';

export default function DdmCalculator() {
  const language = useUIStore(s => s.language);
  const [dividend, setDividend] = useState<number>(2.5); // D1
  const [growthRate, setGrowthRate] = useState<number>(3); // g
  const [requiredReturn, setRequiredReturn] = useState<number>(8); // r

  const calculateDdm = () => {
    const d = dividend;
    const g = growthRate / 100;
    const r = requiredReturn / 100;

    if (r <= g) return { intrinsicValue: 0, error: true };

    const intrinsicValue = d / (r - g);

    return {
      intrinsicValue: intrinsicValue.toFixed(2),
      error: false
    };
  };

  const results = calculateDdm();

  return (
    <div className="p-6 max-w-xl mx-auto bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm">
      <h2 className="text-xl font-medium text-slate-900 dark:text-white mb-6">
        {language === 'he' ? 'מודל היוון דיבידנדים (Gordon Growth Model)' : 'Dividend Discount Model (DDM)'}
      </h2>
      <p className="text-sm text-slate-500 mb-6">
        {language === 'he' ? 'הערכת שווי הוגן של מניה על סמך הדיבידנדים העתידיים שלה.' : 'Estimates the intrinsic value of a stock based on its future dividends.'}
      </p>

      <div className="grid gap-4 mb-6">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              {language === 'he' ? 'דיבידנד צפוי בשנה הבאה (D1)' : 'Expected Dividend Next Year'}
            </label>
            <input type="number" value={dividend} step="0.1" onChange={(e) => setDividend(Number(e.target.value))} className="w-full px-3 py-2 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-sm" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              {language === 'he' ? 'קצב צמיחת דיבידנד (%)' : 'Dividend Growth Rate (%)'}
            </label>
            <input type="number" value={growthRate} step="0.1" onChange={(e) => setGrowthRate(Number(e.target.value))} className="w-full px-3 py-2 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-sm" />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
            {language === 'he' ? 'תשואה נדרשת (%)' : 'Required Rate of Return (%)'}
          </label>
          <input type="number" value={requiredReturn} step="0.1" onChange={(e) => setRequiredReturn(Number(e.target.value))} className="w-full px-3 py-2 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-sm" />
        </div>
      </div>

      <div className="pt-4 border-t border-slate-100 dark:border-slate-800 mt-2">
        <p className="text-sm text-slate-500 dark:text-slate-400 mb-1">
          {language === 'he' ? 'שווי הוגן למניה (Intrinsic Value)' : 'Intrinsic Stock Value'}
        </p>
        
        {results.error ? (
          <div className="text-rose-500 text-sm mt-2">
            {language === 'he' ? 'שגיאה: התשואה הנדרשת חייבת להיות גבוהה מקצב הצמיחה.' : 'Error: Required return must be greater than the growth rate.'}
          </div>
        ) : (
          <div className="text-4xl font-bold text-indigo-600 dark:text-indigo-400">
            ${results.intrinsicValue}
          </div>
        )}
      </div>
    </div>
  );
}
