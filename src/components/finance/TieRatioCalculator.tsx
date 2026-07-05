import React, { useState } from 'react';
import { useUIStore } from '../../stores/useUIStore';

export default function TieRatioCalculator() {
  const language = useUIStore(s => s.language);
  
  const [ebit, setEbit] = useState<number>(500000);
  const [interestExpense, setInterestExpense] = useState<number>(100000);

  const calculateRatio = () => {
    if (interestExpense <= 0) return { ratio: 0, status: '' };
    const ratio = ebit / interestExpense;
    
    let status = '';
    if (ratio >= 2.5) status = language === 'he' ? 'סיכון נמוך (יכולת טובה לשלם ריבית)' : 'Low Risk (Strong ability to pay interest)';
    else if (ratio >= 1.5) status = language === 'he' ? 'סיכון בינוני' : 'Moderate Risk';
    else status = language === 'he' ? 'סיכון גבוה (קשיי נזילות)' : 'High Risk (Liquidity concerns)';

    return {
      ratio: ratio.toFixed(2),
      status
    };
  };

  const results = calculateRatio();

  return (
    <div className="p-6 max-w-xl mx-auto bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm">
      <h2 className="text-xl font-medium text-slate-900 dark:text-white mb-6">
        {language === 'he' ? 'יחס כיסוי ריבית (TIE)' : 'Times Interest Earned (TIE)'}
      </h2>
      <p className="text-sm text-slate-500 mb-6">
        {language === 'he' ? 'מודד את יכולת החברה לעמוד בתשלומי הריבית על החוב שלה.' : 'A measure of a company\'s ability to meet its debt obligations based on its current income.'}
      </p>

      <div className="grid grid-cols-2 gap-4 mb-6">
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
            {language === 'he' ? 'רווח תפעולי (EBIT) ($)' : 'EBIT ($)'}
          </label>
          <input type="number" value={ebit} onChange={(e) => setEbit(Number(e.target.value))} className="w-full px-3 py-2 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-sm" />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
            {language === 'he' ? 'הוצאות ריבית ($)' : 'Interest Expense ($)'}
          </label>
          <input type="number" value={interestExpense} onChange={(e) => setInterestExpense(Number(e.target.value))} className="w-full px-3 py-2 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-sm" />
        </div>
      </div>

      <div className="pt-6 border-t border-slate-100 dark:border-slate-800">
        <div className={`p-4 rounded-xl border flex justify-between items-center ${Number(results.ratio) >= 2.5 ? 'bg-emerald-50 dark:bg-emerald-900/10 border-emerald-100 dark:border-emerald-800/30' : Number(results.ratio) >= 1.5 ? 'bg-amber-50 dark:bg-amber-900/10 border-amber-100 dark:border-amber-800/30' : 'bg-rose-50 dark:bg-rose-900/10 border-rose-100 dark:border-rose-800/30'}`}>
          <div>
            <p className={`text-sm font-medium mb-1 ${Number(results.ratio) >= 2.5 ? 'text-emerald-800 dark:text-emerald-400' : Number(results.ratio) >= 1.5 ? 'text-amber-800 dark:text-amber-400' : 'text-rose-800 dark:text-rose-400'}`}>
              {language === 'he' ? 'יחס כיסוי ריבית' : 'TIE Ratio'}
            </p>
            <p className="text-xs opacity-80">{results.status}</p>
          </div>
          <div className={`text-4xl font-bold ${Number(results.ratio) >= 2.5 ? 'text-emerald-600 dark:text-emerald-400' : Number(results.ratio) >= 1.5 ? 'text-amber-600 dark:text-amber-400' : 'text-rose-600 dark:text-rose-400'}`}>
            {results.ratio}
          </div>
        </div>
      </div>
    </div>
  );
}
