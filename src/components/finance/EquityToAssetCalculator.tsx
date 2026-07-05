import React, { useState } from 'react';
import { useUIStore } from '../../stores/useUIStore';

export default function EquityToAssetCalculator() {
  const language = useUIStore(s => s.language);
  
  const [totalEquity, setTotalEquity] = useState<number>(500000);
  const [totalAssets, setTotalAssets] = useState<number>(1500000);

  const calculateRatio = () => {
    if (totalAssets <= 0) return { ratio: 0 };
    const ratio = (totalEquity / totalAssets) * 100;
    
    return {
      ratio: ratio.toFixed(2)
    };
  };

  const results = calculateRatio();

  return (
    <div className="p-6 max-w-xl mx-auto bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm">
      <h2 className="text-xl font-medium text-slate-900 dark:text-white mb-6">
        {language === 'he' ? 'יחס הון לנכסים (Equity to Asset)' : 'Equity to Asset Ratio Calculator'}
      </h2>
      <p className="text-sm text-slate-500 mb-6">
        {language === 'he' ? 'מודד את כמות הנכסים של חברה בבעלות משקיעים (לא ממומנים על ידי חוב).' : 'Measures the proportion of the total assets that are financed by stockholders and not creditors.'}
      </p>

      <div className="grid grid-cols-2 gap-4 mb-6">
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
            {language === 'he' ? 'סך הון עצמי ($)' : 'Total Equity ($)'}
          </label>
          <input type="number" value={totalEquity} onChange={(e) => setTotalEquity(Number(e.target.value))} className="w-full px-3 py-2 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-sm" />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
            {language === 'he' ? 'סך נכסים ($)' : 'Total Assets ($)'}
          </label>
          <input type="number" value={totalAssets} onChange={(e) => setTotalAssets(Number(e.target.value))} className="w-full px-3 py-2 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-sm" />
        </div>
      </div>

      <div className="pt-6 border-t border-slate-100 dark:border-slate-800">
        <div className="p-4 bg-teal-50 dark:bg-teal-900/10 rounded-xl border border-teal-100 dark:border-teal-800/30 flex justify-between items-center mt-4">
          <div>
            <p className="text-sm font-medium text-teal-800 dark:text-teal-400 mb-1">
              {language === 'he' ? 'יחס הון לנכסים' : 'Equity to Asset Ratio'}
            </p>
          </div>
          <div className="text-4xl font-bold text-teal-600 dark:text-teal-400">
            {results.ratio}%
          </div>
        </div>
      </div>
    </div>
  );
}
