import React, { useState } from 'react';
import { useUIStore } from '../../stores/useUIStore';

export default function FcfeCalculator() {
  const language = useUIStore(s => s.language);
  
  const [netIncome, setNetIncome] = useState<number>(500000);
  const [depreciation, setDepreciation] = useState<number>(50000);
  const [capex, setCapex] = useState<number>(100000);
  const [changeInNwc, setChangeInNwc] = useState<number>(20000);
  const [netBorrowing, setNetBorrowing] = useState<number>(30000);

  const calculateFCFE = () => {
    // FCFE = Net Income + Depreciation - Capex - Change in NWC + Net Borrowing
    const fcfe = netIncome + depreciation - capex - changeInNwc + netBorrowing;
    
    return {
      fcfe: fcfe.toFixed(2)
    };
  };

  const results = calculateFCFE();

  return (
    <div className="p-6 max-w-xl mx-auto bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm">
      <h2 className="text-xl font-medium text-slate-900 dark:text-white mb-6">
        {language === 'he' ? 'תזרים מזומנים חופשי להון (FCFE)' : 'Free Cash Flow to Equity (FCFE)'}
      </h2>
      <p className="text-sm text-slate-500 mb-6">
        {language === 'he' ? 'מודד את תזרים המזומנים הזמין לבעלי המניות לאחר הוצאות הון, שינויים בהון חוזר ופירעון/לקיחת חוב.' : 'Measures how much cash is available to the equity shareholders of a company after all expenses, reinvestment, and debt are paid.'}
      </p>

      <div className="grid gap-4 mb-6">
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
            {language === 'he' ? 'רווח נקי ($)' : 'Net Income ($)'}
          </label>
          <input type="number" value={netIncome} onChange={(e) => setNetIncome(Number(e.target.value))} className="w-full px-3 py-2 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-sm" />
        </div>
        
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              {language === 'he' ? 'פחת והפחתות ($)' : 'Depreciation & Amortization ($)'}
            </label>
            <input type="number" value={depreciation} onChange={(e) => setDepreciation(Number(e.target.value))} className="w-full px-3 py-2 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-sm" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              {language === 'he' ? 'הוצאות הון (CapEx) ($)' : 'Capital Expenditure ($)'}
            </label>
            <input type="number" value={capex} onChange={(e) => setCapex(Number(e.target.value))} className="w-full px-3 py-2 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-sm" />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              {language === 'he' ? 'שינוי בהון חוזר נטו ($)' : 'Change in NWC ($)'}
            </label>
            <input type="number" value={changeInNwc} onChange={(e) => setChangeInNwc(Number(e.target.value))} className="w-full px-3 py-2 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-sm" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              {language === 'he' ? 'הלוואות נטו ($)' : 'Net Borrowing ($)'}
            </label>
            <input type="number" value={netBorrowing} onChange={(e) => setNetBorrowing(Number(e.target.value))} className="w-full px-3 py-2 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-sm" />
          </div>
        </div>
      </div>

      <div className="pt-6 border-t border-slate-100 dark:border-slate-800">
        <div className="p-4 bg-sky-50 dark:bg-sky-900/10 rounded-xl border border-sky-100 dark:border-sky-800/30 flex justify-between items-center mt-4">
          <div>
            <p className="text-sm font-medium text-sky-800 dark:text-sky-400 mb-1">
              {language === 'he' ? 'FCFE' : 'FCFE'}
            </p>
          </div>
          <div className="text-4xl font-bold text-sky-600 dark:text-sky-400">
            ${Number(results.fcfe).toLocaleString()}
          </div>
        </div>
      </div>
    </div>
  );
}
