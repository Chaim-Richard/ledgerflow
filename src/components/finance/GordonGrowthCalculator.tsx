import React, { useState } from 'react';
import { useUIStore } from '../../stores/useUIStore';

export default function GordonGrowthCalculator() {
  const language = useUIStore(s => s.language);
  
  const [expectedDividend, setExpectedDividend] = useState<number>(2.50);
  const [costOfEquity, setCostOfEquity] = useState<number>(8);
  const [growthRate, setGrowthRate] = useState<number>(3);

  const calculateIntrinsicValue = () => {
    if (costOfEquity <= growthRate) return { value: 0, status: language === 'he' ? 'עלות ההון חייבת להיות גבוהה משיעור הצמיחה' : 'Cost of equity must be > growth rate' };
    
    const value = expectedDividend / ((costOfEquity / 100) - (growthRate / 100));
    
    return {
      value: value.toFixed(2),
      status: ''
    };
  };

  const results = calculateIntrinsicValue();

  return (
    <div className="p-6 max-w-xl mx-auto bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm">
      <h2 className="text-xl font-medium text-slate-900 dark:text-white mb-6">
        {language === 'he' ? 'מודל גורדון (צמיחת דיבידנד)' : 'Gordon Growth Model (DDM)'}
      </h2>
      <p className="text-sm text-slate-500 mb-6">
        {language === 'he' ? 'מעריך את השווי הפנימי של מניה על בסיס סדרת דיבידנדים עתידית הצומחת בשיעור קבוע.' : 'Determines the intrinsic value of a stock based on a future series of dividends that grow at a constant rate.'}
      </p>

      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="col-span-2">
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
            {language === 'he' ? 'דיבידנד צפוי בשנה הבאה (D1) ($)' : 'Expected Dividend Next Year (D1) ($)'}
          </label>
          <input type="number" step="0.01" value={expectedDividend} onChange={(e) => setExpectedDividend(Number(e.target.value))} className="w-full px-3 py-2 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-sm" />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
            {language === 'he' ? 'שיעור תשואה נדרש (Cost of Equity %)' : 'Required Rate of Return (%)'}
          </label>
          <input type="number" step="0.1" value={costOfEquity} onChange={(e) => setCostOfEquity(Number(e.target.value))} className="w-full px-3 py-2 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-sm" />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
            {language === 'he' ? 'שיעור צמיחת דיבידנד קבוע (%)' : 'Constant Dividend Growth Rate (%)'}
          </label>
          <input type="number" step="0.1" value={growthRate} onChange={(e) => setGrowthRate(Number(e.target.value))} className="w-full px-3 py-2 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-sm" />
        </div>
      </div>

      <div className="pt-6 border-t border-slate-100 dark:border-slate-800">
        <div className="p-4 bg-emerald-50 dark:bg-emerald-900/10 rounded-xl border border-emerald-100 dark:border-emerald-800/30 flex justify-between items-center mt-4">
          <div>
            <p className="text-sm font-medium text-emerald-800 dark:text-emerald-400 mb-1">
              {language === 'he' ? 'שווי הוגן למניה (Intrinsic Value)' : 'Intrinsic Stock Value'}
            </p>
            <p className="text-xs opacity-80 text-rose-500">{results.status}</p>
          </div>
          <div className="text-4xl font-bold text-emerald-600 dark:text-emerald-400">
             {Number(results.value) > 0 ? `$${results.value}` : 'N/A'}
          </div>
        </div>
      </div>
    </div>
  );
}
