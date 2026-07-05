import React, { useState } from 'react';
import { useUIStore } from '../../stores/useUIStore';

export default function DsoCalculator() {
  const language = useUIStore(s => s.language);
  
  const [accountsReceivable, setAccountsReceivable] = useState<number>(50000);
  const [creditSales, setCreditSales] = useState<number>(500000);
  const [daysInPeriod, setDaysInPeriod] = useState<number>(365);

  const calculateDSO = () => {
    if (creditSales <= 0) return { dso: 0 };
    const dso = (accountsReceivable / creditSales) * daysInPeriod;
    
    return {
      dso: dso.toFixed(1)
    };
  };

  const results = calculateDSO();

  return (
    <div className="p-6 max-w-xl mx-auto bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm">
      <h2 className="text-xl font-medium text-slate-900 dark:text-white mb-6">
        {language === 'he' ? 'ימי אשראי לקוחות (DSO)' : 'Days Sales Outstanding (DSO)'}
      </h2>
      <p className="text-sm text-slate-500 mb-6">
        {language === 'he' ? 'המספר הממוצע של ימים שלוקח לחברה לגבות תשלום לאחר מכירה באשראי.' : 'A measure of the average number of days that it takes a company to collect payment after a sale has been made.'}
      </p>

      <div className="grid grid-cols-2 gap-4 mb-6">
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
            {language === 'he' ? 'חייבים (לקוחות) ($)' : 'Accounts Receivable ($)'}
          </label>
          <input type="number" value={accountsReceivable} onChange={(e) => setAccountsReceivable(Number(e.target.value))} className="w-full px-3 py-2 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-sm" />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
            {language === 'he' ? 'מכירות באשראי ($)' : 'Total Credit Sales ($)'}
          </label>
          <input type="number" value={creditSales} onChange={(e) => setCreditSales(Number(e.target.value))} className="w-full px-3 py-2 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-sm" />
        </div>
        <div className="col-span-2">
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
            {language === 'he' ? 'ימים בתקופה (לרוב 365)' : 'Number of Days in Period'}
          </label>
          <input type="number" value={daysInPeriod} onChange={(e) => setDaysInPeriod(Number(e.target.value))} className="w-full px-3 py-2 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-sm" />
        </div>
      </div>

      <div className="pt-6 border-t border-slate-100 dark:border-slate-800">
        <div className="p-4 bg-emerald-50 dark:bg-emerald-900/10 rounded-xl border border-emerald-100 dark:border-emerald-800/30 flex justify-between items-center mt-4">
          <div>
            <p className="text-sm font-medium text-emerald-800 dark:text-emerald-400 mb-1">
              {language === 'he' ? 'ימי חוב (DSO)' : 'DSO'}
            </p>
          </div>
          <div className="text-4xl font-bold text-emerald-600 dark:text-emerald-400">
            {results.dso} {language === 'he' ? 'ימים' : 'Days'}
          </div>
        </div>
      </div>
    </div>
  );
}
