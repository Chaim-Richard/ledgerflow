import React, { useState } from 'react';
import { useUIStore } from '../../stores/useUIStore';

export default function DebtToEquityCalculator() {
  const language = useUIStore(s => s.language);
  
  const [shortTermDebt, setShortTermDebt] = useState<number>(50000);
  const [longTermDebt, setLongTermDebt] = useState<number>(150000);
  const [shareholdersEquity, setShareholdersEquity] = useState<number>(100000);

  const calculateRatio = () => {
    const totalDebt = shortTermDebt + longTermDebt;
    const ratio = shareholdersEquity > 0 ? totalDebt / shareholdersEquity : 0;

    let riskLevel = '';
    if (ratio <= 1) riskLevel = language === 'he' ? 'סיכון נמוך (Low Risk)' : 'Low Risk';
    else if (ratio <= 2) riskLevel = language === 'he' ? 'סיכון בינוני (Moderate)' : 'Moderate Risk';
    else riskLevel = language === 'he' ? 'סיכון גבוה (High Risk)' : 'High Risk';

    return {
      totalDebt,
      ratio: ratio.toFixed(2),
      riskLevel
    };
  };

  const results = calculateRatio();

  return (
    <div className="p-6 max-w-xl mx-auto bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm">
      <h2 className="text-xl font-medium text-slate-900 dark:text-white mb-6">
        {language === 'he' ? 'יחס חוב להון עצמי (D/E)' : 'Debt-to-Equity Ratio'}
      </h2>
      <p className="text-sm text-slate-500 mb-6">
        {language === 'he' ? 'מודד את המינוף הפיננסי של חברה (הפרופורציה שבה חברה מממנת את נכסיה דרך חוב לעומת הון עצמי).' : 'Measures financial leverage, showing the proportion of debt and equity used to finance a company\'s assets.'}
      </p>

      <div className="grid gap-4 mb-6">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              {language === 'he' ? 'חוב לטווח קצר' : 'Short-Term Debt'}
            </label>
            <input type="number" value={shortTermDebt} onChange={(e) => setShortTermDebt(Number(e.target.value))} className="w-full px-3 py-2 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-sm" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              {language === 'he' ? 'חוב לטווח ארוך' : 'Long-Term Debt'}
            </label>
            <input type="number" value={longTermDebt} onChange={(e) => setLongTermDebt(Number(e.target.value))} className="w-full px-3 py-2 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-sm" />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
            {language === 'he' ? 'הון עצמי (Shareholders\' Equity)' : 'Shareholders\' Equity'}
          </label>
          <input type="number" value={shareholdersEquity} onChange={(e) => setShareholdersEquity(Number(e.target.value))} className="w-full px-3 py-2 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-sm" />
        </div>
      </div>

      <div className="pt-6 border-t border-slate-100 dark:border-slate-800 flex justify-between items-center p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl border">
        <div>
          <p className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
            {language === 'he' ? 'יחס חוב/הון' : 'D/E Ratio'}
          </p>
          <div className="text-3xl font-bold text-slate-900 dark:text-white">
            {results.ratio}
          </div>
          <p className="text-xs text-slate-500 mt-1">{language === 'he' ? 'סה״כ חוב: $' : 'Total Debt: $'}{results.totalDebt.toLocaleString()}</p>
        </div>
        <div className="text-right">
          <span className={`inline-block px-3 py-1 rounded-full text-sm font-bold ${Number(results.ratio) <= 1 ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400' : Number(results.ratio) <= 2 ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400' : 'bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-400'}`}>
            {results.riskLevel}
          </span>
        </div>
      </div>
    </div>
  );
}
