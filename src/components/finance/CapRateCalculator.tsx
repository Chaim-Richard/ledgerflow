import React, { useState } from 'react';
import { useUIStore } from '../../stores/useUIStore';

export default function CapRateCalculator() {
  const language = useUIStore(s => s.language);
  
  const [noi, setNoi] = useState<number>(85000);
  const [propertyValue, setPropertyValue] = useState<number>(1000000);

  const calculateCapRate = () => {
    if (propertyValue <= 0) return { rate: 0 };
    const rate = (noi / propertyValue) * 100;
    
    return {
      rate: rate.toFixed(2)
    };
  };

  const results = calculateCapRate();

  return (
    <div className="p-6 max-w-xl mx-auto bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm">
      <h2 className="text-xl font-medium text-slate-900 dark:text-white mb-6">
        {language === 'he' ? 'שיעור היוון נדל"ן (Cap Rate)' : 'Capitalization Rate (Cap Rate)'}
      </h2>
      <p className="text-sm text-slate-500 mb-6">
        {language === 'he' ? 'מעריך את התשואה הפוטנציאלית של השקעת נדל"ן על סמך ההכנסה התפעולית הנקייה ושווי הנכס.' : 'Evaluates the potential return on a real estate investment based on the income it is expected to generate.'}
      </p>

      <div className="grid grid-cols-2 gap-4 mb-6">
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
            {language === 'he' ? 'הכנסה תפעולית נקייה (NOI) ($)' : 'Net Operating Income ($)'}
          </label>
          <input type="number" value={noi} onChange={(e) => setNoi(Number(e.target.value))} className="w-full px-3 py-2 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-sm" />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
            {language === 'he' ? 'שווי הנכס / מחיר רכישה ($)' : 'Property Value ($)'}
          </label>
          <input type="number" value={propertyValue} onChange={(e) => setPropertyValue(Number(e.target.value))} className="w-full px-3 py-2 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-sm" />
        </div>
      </div>

      <div className="pt-6 border-t border-slate-100 dark:border-slate-800">
        <div className="p-4 bg-emerald-50 dark:bg-emerald-900/10 rounded-xl border border-emerald-100 dark:border-emerald-800/30 flex justify-between items-center mt-4">
          <div>
            <p className="text-sm font-medium text-emerald-800 dark:text-emerald-400 mb-1">
              {language === 'he' ? 'שיעור היוון (Cap Rate)' : 'Cap Rate'}
            </p>
          </div>
          <div className="text-4xl font-bold text-emerald-600 dark:text-emerald-400">
            {results.rate}%
          </div>
        </div>
      </div>
    </div>
  );
}
