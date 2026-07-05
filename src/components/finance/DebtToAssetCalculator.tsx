import React, { useState } from 'react';
import { useUIStore } from '../../stores/useUIStore';

export default function DebtToAssetCalculator() {
  const language = useUIStore(s => s.language);
  
  const [totalDebt, setTotalDebt] = useState<number>(400000);
  const [totalAssets, setTotalAssets] = useState<number>(1000000);

  const calculateRatio = () => {
    if (totalAssets <= 0) return { ratio: 0, status: '' };
    const ratio = totalDebt / totalAssets;
    
    let status = '';
    if (ratio < 0.3) status = language === 'he' ? 'סיכון נמוך' : 'Low Risk';
    else if (ratio <= 0.6) status = language === 'he' ? 'סיכון בינוני' : 'Moderate Risk';
    else status = language === 'he' ? 'סיכון גבוה' : 'High Risk';

    return {
      ratio: ratio.toFixed(2),
      ratioPercent: (ratio * 100).toFixed(1),
      status
    };
  };

  const results = calculateRatio();

  return (
    <div className="p-6 max-w-xl mx-auto bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm">
      <h2 className="text-xl font-medium text-slate-900 dark:text-white mb-6">
        {language === 'he' ? 'יחס חוב לסך נכסים' : 'Debt-to-Asset Ratio'}
      </h2>
      <p className="text-sm text-slate-500 mb-6">
        {language === 'he' ? 'מודד את שיעור נכסי החברה שממומנים על ידי חוב.' : 'Indicates the proportion of a company\'s assets that are financed by debt.'}
      </p>

      <div className="grid grid-cols-2 gap-4 mb-6">
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
            {language === 'he' ? 'סך הכל חוב ($)' : 'Total Debt ($)'}
          </label>
          <input type="number" value={totalDebt} onChange={(e) => setTotalDebt(Number(e.target.value))} className="w-full px-3 py-2 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-sm" />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
            {language === 'he' ? 'סך הכל נכסים ($)' : 'Total Assets ($)'}
          </label>
          <input type="number" value={totalAssets} onChange={(e) => setTotalAssets(Number(e.target.value))} className="w-full px-3 py-2 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-sm" />
        </div>
      </div>

      <div className="pt-6 border-t border-slate-100 dark:border-slate-800">
        <div className={`p-4 rounded-xl border flex justify-between items-center ${Number(results.ratio) < 0.5 ? 'bg-emerald-50 dark:bg-emerald-900/10 border-emerald-100 dark:border-emerald-800/30' : 'bg-rose-50 dark:bg-rose-900/10 border-rose-100 dark:border-rose-800/30'}`}>
          <div>
            <p className={`text-sm font-medium mb-1 ${Number(results.ratio) < 0.5 ? 'text-emerald-800 dark:text-emerald-400' : 'text-rose-800 dark:text-rose-400'}`}>
              {language === 'he' ? 'יחס חוב/נכסים' : 'Debt/Asset Ratio'}
            </p>
            <p className="text-xs opacity-80">{results.status} ({results.ratioPercent}% debt)</p>
          </div>
          <div className={`text-4xl font-bold ${Number(results.ratio) < 0.5 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
            {results.ratio}
          </div>
        </div>
      </div>
    </div>
  );
}
