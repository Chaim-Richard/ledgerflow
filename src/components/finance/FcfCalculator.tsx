import React, { useState } from 'react';
import { useUIStore } from '../../stores/useUIStore';

export default function FcfCalculator() {
  const language = useUIStore(s => s.language);
  
  const [operatingCashFlow, setOperatingCashFlow] = useState<number>(500000);
  const [capitalExpenditures, setCapitalExpenditures] = useState<number>(150000); // CapEx
  const [dividends, setDividends] = useState<number>(50000); // For Free Cash Flow to Equity

  const calculateFCF = () => {
    // Unlevered Free Cash Flow (FCFF approximation from OCF)
    const fcf = operatingCashFlow - capitalExpenditures;
    
    // Free Cash Flow to Equity (FCFE)
    const fcfe = fcf - dividends; // simplified

    return {
      fcf,
      fcfe
    };
  };

  const results = calculateFCF();

  return (
    <div className="p-6 max-w-xl mx-auto bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm">
      <h2 className="text-xl font-medium text-slate-900 dark:text-white mb-6">
        {language === 'he' ? 'תזרים מזומנים חופשי (FCF)' : 'Free Cash Flow (FCF) Calculator'}
      </h2>
      <p className="text-sm text-slate-500 mb-6">
        {language === 'he' ? 'מחשב כמה מזומנים נותרו לחברה לאחר הוצאות הון.' : 'Calculates the cash a company generates after accounting for capital expenditures.'}
      </p>

      <div className="space-y-4 mb-6">
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
            {language === 'he' ? 'תזרים מפעילות שוטפת (Operating Cash Flow)' : 'Operating Cash Flow (OCF)'}
          </label>
          <input type="number" value={operatingCashFlow} onChange={(e) => setOperatingCashFlow(Number(e.target.value))} className="w-full px-3 py-2 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-sm" />
        </div>
        
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
            {language === 'he' ? 'השקעות הון (CapEx)' : 'Capital Expenditures (CapEx)'}
          </label>
          <input type="number" value={capitalExpenditures} onChange={(e) => setCapitalExpenditures(Number(e.target.value))} className="w-full px-3 py-2 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-sm" />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
            {language === 'he' ? 'דיבידנדים ששולמו (Dividends)' : 'Dividends Paid'}
          </label>
          <input type="number" value={dividends} onChange={(e) => setDividends(Number(e.target.value))} className="w-full px-3 py-2 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-sm" />
        </div>
      </div>

      <div className="pt-6 border-t border-slate-100 dark:border-slate-800 space-y-4">
        <div className="flex justify-between items-center p-4 bg-emerald-50 dark:bg-emerald-900/10 rounded-xl border border-emerald-100 dark:border-emerald-800/30">
          <div>
            <p className="text-sm font-medium text-emerald-800 dark:text-emerald-400 mb-1">
              {language === 'he' ? 'תזרים חופשי (FCF)' : 'Free Cash Flow (FCF)'}
            </p>
            <p className="text-xs text-emerald-600/70">OCF - CapEx</p>
          </div>
          <div className="text-3xl font-bold text-emerald-600 dark:text-emerald-400">
            ${results.fcf.toLocaleString()}
          </div>
        </div>
        
        <div className="flex justify-between items-center p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700">
          <div>
            <p className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              {language === 'he' ? 'תזרים חופשי לבעלי המניות (FCFE)' : 'Free Cash Flow to Equity'}
            </p>
            <p className="text-xs text-slate-500">FCF - Dividends</p>
          </div>
          <div className="text-2xl font-bold text-slate-700 dark:text-slate-300">
            ${results.fcfe.toLocaleString()}
          </div>
        </div>
      </div>
    </div>
  );
}
