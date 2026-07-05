import React, { useState } from 'react';
import { useUIStore } from '../../stores/useUIStore';

export default function DscrCalculator() {
  const language = useUIStore(s => s.language);
  
  const [noi, setNoi] = useState<number>(120000);
  const [debtService, setDebtService] = useState<number>(90000);

  const calculateDSCR = () => {
    if (debtService <= 0) return { ratio: 0, status: '' };
    const ratio = noi / debtService;
    
    let status = '';
    if (ratio >= 1.2) status = language === 'he' ? 'בריא (מספיק תזרים לכיסוי)' : 'Healthy Coverage (> 1.2)';
    else if (ratio >= 1.0) status = language === 'he' ? 'גבולי (מספיק בקושי)' : 'Marginal Coverage';
    else status = language === 'he' ? 'בסיכון (אין מספיק תזרים)' : 'Risky (Negative cash flow)';

    return {
      ratio: ratio.toFixed(2),
      status
    };
  };

  const results = calculateDSCR();

  return (
    <div className="p-6 max-w-xl mx-auto bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm">
      <h2 className="text-xl font-medium text-slate-900 dark:text-white mb-6">
        {language === 'he' ? 'יחס כיסוי שירות חוב (DSCR)' : 'Debt Service Coverage Ratio (DSCR)'}
      </h2>
      <p className="text-sm text-slate-500 mb-6">
        {language === 'he' ? 'מודד את התזרים הפנוי של נכס או חברה לכיסוי תשלומי החוב השוטפים (קרן וריבית).' : 'Measures the available cash flow to pay current debt obligations.'}
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
            {language === 'he' ? 'סך תשלומי חוב (קרן+ריבית) ($)' : 'Total Debt Service ($)'}
          </label>
          <input type="number" value={debtService} onChange={(e) => setDebtService(Number(e.target.value))} className="w-full px-3 py-2 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-sm" />
        </div>
      </div>

      <div className="pt-6 border-t border-slate-100 dark:border-slate-800">
        <div className={`p-4 rounded-xl border flex justify-between items-center ${Number(results.ratio) >= 1.2 ? 'bg-emerald-50 dark:bg-emerald-900/10 border-emerald-100 dark:border-emerald-800/30' : Number(results.ratio) >= 1.0 ? 'bg-amber-50 dark:bg-amber-900/10 border-amber-100 dark:border-amber-800/30' : 'bg-rose-50 dark:bg-rose-900/10 border-rose-100 dark:border-rose-800/30'}`}>
          <div>
            <p className={`text-sm font-medium mb-1 ${Number(results.ratio) >= 1.2 ? 'text-emerald-800 dark:text-emerald-400' : Number(results.ratio) >= 1.0 ? 'text-amber-800 dark:text-amber-400' : 'text-rose-800 dark:text-rose-400'}`}>
              {language === 'he' ? 'יחס DSCR' : 'DSCR Ratio'}
            </p>
            <p className="text-xs opacity-80">{results.status}</p>
          </div>
          <div className={`text-4xl font-bold ${Number(results.ratio) >= 1.2 ? 'text-emerald-600 dark:text-emerald-400' : Number(results.ratio) >= 1.0 ? 'text-amber-600 dark:text-amber-400' : 'text-rose-600 dark:text-rose-400'}`}>
            {results.ratio}x
          </div>
        </div>
      </div>
    </div>
  );
}
