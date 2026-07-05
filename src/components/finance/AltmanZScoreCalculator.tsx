import React, { useState } from 'react';
import { useUIStore } from '../../stores/useUIStore';

export default function AltmanZScoreCalculator() {
  const language = useUIStore(s => s.language);
  
  const [workingCapital, setWorkingCapital] = useState<number>(100000);
  const [retainedEarnings, setRetainedEarnings] = useState<number>(250000);
  const [ebit, setEbit] = useState<number>(150000);
  const [marketValueEquity, setMarketValueEquity] = useState<number>(800000);
  const [sales, setSales] = useState<number>(1200000);
  const [totalAssets, setTotalAssets] = useState<number>(1500000);
  const [totalLiabilities, setTotalLiabilities] = useState<number>(500000);

  const calculateZScore = () => {
    if (totalAssets <= 0 || totalLiabilities <= 0) return { score: 0, status: '', color: '' };

    const A = workingCapital / totalAssets;
    const B = retainedEarnings / totalAssets;
    const C = ebit / totalAssets;
    const D = marketValueEquity / totalLiabilities;
    const E = sales / totalAssets;

    // Formula for public manufacturing companies: Z = 1.2A + 1.4B + 3.3C + 0.6D + 1.0E
    const zScore = (1.2 * A) + (1.4 * B) + (3.3 * C) + (0.6 * D) + (1.0 * E);
    
    let status = '';
    let color = '';
    if (zScore > 2.99) {
        status = language === 'he' ? 'אזור בטוח (Safe Zone)' : 'Safe Zone';
        color = 'text-emerald-600 dark:text-emerald-400 bg-emerald-50 border-emerald-100';
    } else if (zScore > 1.81) {
        status = language === 'he' ? 'אזור אפור (Grey Zone)' : 'Grey Zone';
        color = 'text-amber-600 dark:text-amber-400 bg-amber-50 border-amber-100';
    } else {
        status = language === 'he' ? 'אזור מצוקה (Distress Zone)' : 'Distress Zone';
        color = 'text-rose-600 dark:text-rose-400 bg-rose-50 border-rose-100';
    }

    return {
      score: zScore.toFixed(2),
      status,
      color
    };
  };

  const results = calculateZScore();

  return (
    <div className="p-6 max-w-xl mx-auto bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm">
      <h2 className="text-xl font-medium text-slate-900 dark:text-white mb-6">
        {language === 'he' ? 'מדד אלטמן (Altman Z-Score)' : 'Altman Z-Score Calculator'}
      </h2>
      <p className="text-sm text-slate-500 mb-6">
        {language === 'he' ? 'מודל המשמש לניבוי ההסתברות לפשיטת רגל של חברה בתוך שנתיים.' : 'A formula used to predict the probability that a firm will go into bankruptcy within two years.'}
      </p>

      <div className="grid grid-cols-2 gap-4 mb-6">
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
            {language === 'he' ? 'הון חוזר ($)' : 'Working Capital ($)'}
          </label>
          <input type="number" value={workingCapital} onChange={(e) => setWorkingCapital(Number(e.target.value))} className="w-full px-3 py-2 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-sm" />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
            {language === 'he' ? 'רווחים צבורים ($)' : 'Retained Earnings ($)'}
          </label>
          <input type="number" value={retainedEarnings} onChange={(e) => setRetainedEarnings(Number(e.target.value))} className="w-full px-3 py-2 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-sm" />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
            {language === 'he' ? 'רווח תפעולי (EBIT) ($)' : 'EBIT ($)'}
          </label>
          <input type="number" value={ebit} onChange={(e) => setEbit(Number(e.target.value))} className="w-full px-3 py-2 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-sm" />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
            {language === 'he' ? 'שווי שוק של ההון ($)' : 'Market Value of Equity ($)'}
          </label>
          <input type="number" value={marketValueEquity} onChange={(e) => setMarketValueEquity(Number(e.target.value))} className="w-full px-3 py-2 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-sm" />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
            {language === 'he' ? 'מכירות ($)' : 'Total Sales ($)'}
          </label>
          <input type="number" value={sales} onChange={(e) => setSales(Number(e.target.value))} className="w-full px-3 py-2 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-sm" />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
            {language === 'he' ? 'סך נכסים ($)' : 'Total Assets ($)'}
          </label>
          <input type="number" value={totalAssets} onChange={(e) => setTotalAssets(Number(e.target.value))} className="w-full px-3 py-2 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-sm" />
        </div>
        <div className="col-span-2">
           <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
            {language === 'he' ? 'סך התחייבויות ($)' : 'Total Liabilities ($)'}
          </label>
          <input type="number" value={totalLiabilities} onChange={(e) => setTotalLiabilities(Number(e.target.value))} className="w-full px-3 py-2 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-sm" />
        </div>
      </div>

      <div className="pt-6 border-t border-slate-100 dark:border-slate-800">
        <div className={`p-4 rounded-xl border flex justify-between items-center ${results.color}`}>
          <div>
            <p className="text-sm font-medium mb-1 opacity-90">
              {language === 'he' ? 'ציון Z' : 'Z-Score'}
            </p>
            <p className="text-xs opacity-80">{results.status}</p>
          </div>
          <div className="text-4xl font-bold">
            {results.score}
          </div>
        </div>
      </div>
    </div>
  );
}
