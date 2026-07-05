import React, { useState } from 'react';
import { useUIStore } from '../../stores/useUIStore';

export default function RuleOf72Calculator() {
  const language = useUIStore(s => s.language);
  
  const [interestRate, setInterestRate] = useState<number>(8);

  const calculateYears = () => {
    if (interestRate <= 0) return { years: 0 };
    const years = 72 / interestRate;
    return { years: years.toFixed(1) };
  };

  const results = calculateYears();

  return (
    <div className="p-6 max-w-xl mx-auto bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm">
      <h2 className="text-xl font-medium text-slate-900 dark:text-white mb-6">
        {language === 'he' ? 'כלל ה-72 (הכפלת השקעה)' : 'Rule of 72 Calculator'}
      </h2>
      <p className="text-sm text-slate-500 mb-6">
        {language === 'he' ? 'כלל אצבע פשוט להערכת מספר השנים שייקח להכפיל את ההשקעה שלך בהינתן שיעור תשואה שנתי קבוע.' : 'A quick, useful formula that is popularly used to estimate the number of years required to double the invested money at a given annual rate of return.'}
      </p>

      <div className="mb-6">
        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
          {language === 'he' ? 'שיעור ריבית / תשואה שנתית (%)' : 'Annual Interest / Return Rate (%)'}
        </label>
        <input type="number" step="0.1" value={interestRate} onChange={(e) => setInterestRate(Number(e.target.value))} className="w-full px-3 py-2 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-sm" />
      </div>

      <div className="pt-6 border-t border-slate-100 dark:border-slate-800">
        <div className="p-4 bg-amber-50 dark:bg-amber-900/10 rounded-xl border border-amber-100 dark:border-amber-800/30 flex justify-between items-center mt-4">
          <div>
            <p className="text-sm font-medium text-amber-800 dark:text-amber-400 mb-1">
              {language === 'he' ? 'זמן משוער להכפלה' : 'Estimated Time to Double'}
            </p>
          </div>
          <div className="text-4xl font-bold text-amber-600 dark:text-amber-400">
            {results.years} {language === 'he' ? 'שנים' : 'Years'}
          </div>
        </div>
      </div>
    </div>
  );
}
