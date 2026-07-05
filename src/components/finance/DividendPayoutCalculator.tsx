import React, { useState } from 'react';
import { useUIStore } from '../../stores/useUIStore';

export default function DividendPayoutCalculator() {
  const language = useUIStore(s => s.language);
  
  const [dividends, setDividends] = useState<number>(50000);
  const [netIncome, setNetIncome] = useState<number>(200000);

  const calculateRatio = () => {
    if (netIncome <= 0) return { ratio: 0, status: language === 'he' ? 'אין רווח' : 'No Net Income' };
    const ratio = (dividends / netIncome) * 100;
    
    let status = '';
    if (ratio > 100) status = language === 'he' ? 'דיבידנדים עולים על הרווח (לא בר קיימא)' : 'Dividends exceed net income (unsustainable)';
    else status = '';

    return { ratio: ratio.toFixed(2), status };
  };

  const results = calculateRatio();

  return (
    <div className="p-6 max-w-xl mx-auto bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm">
      <h2 className="text-xl font-medium text-slate-900 dark:text-white mb-6">
        {language === 'he' ? 'יחס חלוקת דיבידנד' : 'Dividend Payout Ratio'}
      </h2>
      <p className="text-sm text-slate-500 mb-6">
        {language === 'he' ? 'החלק מהרווח הנקי שחברה מחלקת לבעלי המניות בצורת דיבידנדים.' : 'The proportion of earnings paid out as dividends to shareholders.'}
      </p>

      <div className="grid grid-cols-2 gap-4 mb-6">
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
            {language === 'he' ? 'סך דיבידנדים ששולמו ($)' : 'Total Dividends Paid ($)'}
          </label>
          <input type="number" value={dividends} onChange={(e) => setDividends(Number(e.target.value))} className="w-full px-3 py-2 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-sm" />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
            {language === 'he' ? 'רווח נקי ($)' : 'Net Income ($)'}
          </label>
          <input type="number" value={netIncome} onChange={(e) => setNetIncome(Number(e.target.value))} className="w-full px-3 py-2 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-sm" />
        </div>
      </div>

      <div className="pt-6 border-t border-slate-100 dark:border-slate-800">
        <div className="p-4 bg-purple-50 dark:bg-purple-900/10 rounded-xl border border-purple-100 dark:border-purple-800/30 flex justify-between items-center mt-4">
          <div>
            <p className="text-sm font-medium text-purple-800 dark:text-purple-400 mb-1">
              {language === 'he' ? 'יחס חלוקה' : 'Payout Ratio'}
            </p>
            {results.status && (
              <p className="text-xs text-rose-500">{results.status}</p>
            )}
          </div>
          <div className="text-4xl font-bold text-purple-600 dark:text-purple-400">
            {results.ratio}%
          </div>
        </div>
      </div>
    </div>
  );
}
