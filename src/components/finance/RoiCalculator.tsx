import React, { useState } from 'react';
import { useUIStore } from '../../stores/useUIStore';

export default function RoiCalculator() {
  const language = useUIStore(s => s.language);
  
  const [initialInvestment, setInitialInvestment] = useState<number>(10000);
  const [finalValue, setFinalValue] = useState<number>(12500);

  const calculateROI = () => {
    if (initialInvestment <= 0) return { roi: 0 };
    const netReturn = finalValue - initialInvestment;
    const roi = (netReturn / initialInvestment) * 100;
    
    return {
      netReturn: netReturn.toFixed(2),
      roi: roi.toFixed(2)
    };
  };

  const results = calculateROI();

  return (
    <div className="p-6 max-w-xl mx-auto bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm">
      <h2 className="text-xl font-medium text-slate-900 dark:text-white mb-6">
        {language === 'he' ? 'החזר השקעה (ROI)' : 'Return on Investment (ROI)'}
      </h2>
      <p className="text-sm text-slate-500 mb-6">
        {language === 'he' ? 'מודד את הרווח או ההפסד מהשקעה ביחס לסכום שהושקע בהתחלה.' : 'Evaluates the efficiency or profitability of an investment.'}
      </p>

      <div className="grid grid-cols-2 gap-4 mb-6">
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
            {language === 'he' ? 'השקעה התחלתית ($)' : 'Initial Investment ($)'}
          </label>
          <input type="number" value={initialInvestment} onChange={(e) => setInitialInvestment(Number(e.target.value))} className="w-full px-3 py-2 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-sm" />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
            {language === 'he' ? 'שווי סופי ($)' : 'Final Value ($)'}
          </label>
          <input type="number" value={finalValue} onChange={(e) => setFinalValue(Number(e.target.value))} className="w-full px-3 py-2 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-sm" />
        </div>
      </div>

      <div className="pt-6 border-t border-slate-100 dark:border-slate-800 space-y-4">
        <div className="flex justify-between items-center text-sm text-slate-600 dark:text-slate-400 px-2">
          <span>{language === 'he' ? 'רווח/הפסד נטו:' : 'Net Return:'}</span>
          <span className={`font-medium ${Number(results.netReturn) >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
            ${Number(results.netReturn).toLocaleString()}
          </span>
        </div>
        
        <div className={`p-4 rounded-xl border flex justify-between items-center mt-4 ${Number(results.roi) >= 0 ? 'bg-emerald-50 dark:bg-emerald-900/10 border-emerald-100 dark:border-emerald-800/30' : 'bg-rose-50 dark:bg-rose-900/10 border-rose-100 dark:border-rose-800/30'}`}>
          <div>
            <p className={`text-sm font-medium mb-1 ${Number(results.roi) >= 0 ? 'text-emerald-800 dark:text-emerald-400' : 'text-rose-800 dark:text-rose-400'}`}>
              {language === 'he' ? 'ROI' : 'ROI'}
            </p>
          </div>
          <div className={`text-4xl font-bold ${Number(results.roi) >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
            {results.roi}%
          </div>
        </div>
      </div>
    </div>
  );
}
