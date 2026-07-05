import React, { useState } from 'react';
import { useUIStore } from '../../stores/useUIStore';

export default function EnterpriseValueCalculator() {
  const language = useUIStore(s => s.language);
  
  const [marketCap, setMarketCap] = useState<number>(5000000);
  const [totalDebt, setTotalDebt] = useState<number>(1000000);
  const [cash, setCash] = useState<number>(500000);

  const calculateEV = () => {
    const ev = marketCap + totalDebt - cash;
    return {
      ev: ev.toLocaleString()
    };
  };

  const results = calculateEV();

  return (
    <div className="p-6 max-w-xl mx-auto bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm">
      <h2 className="text-xl font-medium text-slate-900 dark:text-white mb-6">
        {language === 'he' ? 'שווי פעילות (Enterprise Value)' : 'Enterprise Value (EV)'}
      </h2>
      <p className="text-sm text-slate-500 mb-6">
        {language === 'he' ? 'מדד מקיף לשווי הכולל של החברה, המשמש לעיתים קרובות כחלופה לשווי שוק בלבד.' : 'A measure of a company\'s total value, often used as a more comprehensive alternative to equity market capitalization.'}
      </p>

      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="col-span-2">
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
            {language === 'he' ? 'שווי שוק (Market Cap) ($)' : 'Market Capitalization ($)'}
          </label>
          <input type="number" value={marketCap} onChange={(e) => setMarketCap(Number(e.target.value))} className="w-full px-3 py-2 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-sm" />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
            {language === 'he' ? 'סך חוב ($)' : 'Total Debt ($)'}
          </label>
          <input type="number" value={totalDebt} onChange={(e) => setTotalDebt(Number(e.target.value))} className="w-full px-3 py-2 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-sm" />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
            {language === 'he' ? 'מזומנים ושווי מזומנים ($)' : 'Cash and Equivalents ($)'}
          </label>
          <input type="number" value={cash} onChange={(e) => setCash(Number(e.target.value))} className="w-full px-3 py-2 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-sm" />
        </div>
      </div>

      <div className="pt-6 border-t border-slate-100 dark:border-slate-800">
        <div className="p-4 bg-sky-50 dark:bg-sky-900/10 rounded-xl border border-sky-100 dark:border-sky-800/30 flex justify-between items-center mt-4">
          <div>
            <p className="text-sm font-medium text-sky-800 dark:text-sky-400 mb-1">
              {language === 'he' ? 'שווי פעילות (EV)' : 'Enterprise Value'}
            </p>
          </div>
          <div className="text-4xl font-bold text-sky-600 dark:text-sky-400">
            ${results.ev}
          </div>
        </div>
      </div>
    </div>
  );
}
