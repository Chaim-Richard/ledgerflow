import React, { useState } from 'react';
import { useUIStore } from '../../stores/useUIStore';

export default function PegRatioCalculator() {
  const language = useUIStore(s => s.language);
  
  const [peRatio, setPeRatio] = useState<number>(25);
  const [earningsGrowthRate, setEarningsGrowthRate] = useState<number>(15);

  const calculatePEG = () => {
    if (earningsGrowthRate <= 0) return { peg: 0, assessment: '' };
    const peg = peRatio / earningsGrowthRate;
    
    let assessment = '';
    if (peg < 1) assessment = language === 'he' ? 'זול (Undervalued)' : 'Undervalued (Good)';
    else if (peg <= 1.5) assessment = language === 'he' ? 'סביר (Fairly Valued)' : 'Fairly Valued';
    else assessment = language === 'he' ? 'יקר (Overvalued)' : 'Overvalued (Poor)';

    return {
      peg: peg.toFixed(2),
      assessment
    };
  };

  const results = calculatePEG();

  return (
    <div className="p-6 max-w-xl mx-auto bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm">
      <h2 className="text-xl font-medium text-slate-900 dark:text-white mb-6">
        {language === 'he' ? 'יחס PEG' : 'PEG Ratio Calculator'}
      </h2>
      <p className="text-sm text-slate-500 mb-6">
        {language === 'he' ? 'משווה את מכפיל הרווח (P/E) לקצב צמיחת הרווחים הצפוי של החברה.' : 'Compares a company\'s Price-to-Earnings (P/E) ratio to its expected earnings growth rate.'}
      </p>

      <div className="grid grid-cols-2 gap-4 mb-6">
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
            {language === 'he' ? 'מכפיל רווח (P/E)' : 'P/E Ratio'}
          </label>
          <input type="number" step="0.1" value={peRatio} onChange={(e) => setPeRatio(Number(e.target.value))} className="w-full px-3 py-2 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-sm" />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
            {language === 'he' ? 'קצב צמיחת רווחים (EPS %)' : 'Earnings Growth Rate (%)'}
          </label>
          <input type="number" step="0.1" value={earningsGrowthRate} onChange={(e) => setEarningsGrowthRate(Number(e.target.value))} className="w-full px-3 py-2 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-sm" />
        </div>
      </div>

      <div className="pt-6 border-t border-slate-100 dark:border-slate-800">
        <div className={`p-4 rounded-xl border flex justify-between items-center ${Number(results.peg) < 1 ? 'bg-emerald-50 dark:bg-emerald-900/10 border-emerald-100 dark:border-emerald-800/30' : Number(results.peg) <= 1.5 ? 'bg-amber-50 dark:bg-amber-900/10 border-amber-100 dark:border-amber-800/30' : 'bg-rose-50 dark:bg-rose-900/10 border-rose-100 dark:border-rose-800/30'}`}>
          <div>
            <p className={`text-sm font-medium mb-1 ${Number(results.peg) < 1 ? 'text-emerald-800 dark:text-emerald-400' : Number(results.peg) <= 1.5 ? 'text-amber-800 dark:text-amber-400' : 'text-rose-800 dark:text-rose-400'}`}>
              {language === 'he' ? 'יחס PEG' : 'PEG Ratio'}
            </p>
            <p className="text-xs opacity-80">{results.assessment}</p>
          </div>
          <div className={`text-4xl font-bold ${Number(results.peg) < 1 ? 'text-emerald-600 dark:text-emerald-400' : Number(results.peg) <= 1.5 ? 'text-amber-600 dark:text-amber-400' : 'text-rose-600 dark:text-rose-400'}`}>
            {results.peg}
          </div>
        </div>
      </div>
    </div>
  );
}
