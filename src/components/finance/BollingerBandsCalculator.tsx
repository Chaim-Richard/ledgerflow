import React, { useState } from 'react';
import { useUIStore } from '../../stores/useUIStore';

export default function BollingerBandsCalculator() {
  const language = useUIStore(s => s.language);
  
  const [sma20, setSma20] = useState<number>(100);
  const [stdDev, setStdDev] = useState<number>(5);
  const [currentPrice, setCurrentPrice] = useState<number>(112);
  const [multiplier, setMultiplier] = useState<number>(2);

  const calculateBands = () => {
    const upperBand = sma20 + (stdDev * multiplier);
    const lowerBand = sma20 - (stdDev * multiplier);
    
    let status = '';
    if (currentPrice > upperBand) status = language === 'he' ? 'מחיר מעל הרצועה (Overbought)' : 'Above Upper Band (Overbought)';
    else if (currentPrice < lowerBand) status = language === 'he' ? 'מחיר מתחת לרצועה (Oversold)' : 'Below Lower Band (Oversold)';
    else status = language === 'he' ? 'בתוך הרצועות' : 'Within Bands';

    return {
      upperBand: upperBand.toFixed(2),
      lowerBand: lowerBand.toFixed(2),
      status
    };
  };

  const results = calculateBands();

  return (
    <div className="p-6 max-w-xl mx-auto bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm">
      <h2 className="text-xl font-medium text-slate-900 dark:text-white mb-6">
        {language === 'he' ? 'רצועות בולינגר' : 'Bollinger Bands Calculator'}
      </h2>
      <p className="text-sm text-slate-500 mb-6">
        {language === 'he' ? 'כלי ניתוח טכני המוגדר על ידי מערכת של קווים המצוירים במרחק של סטיות תקן מממוצע נע.' : 'A technical analysis tool defined by a set of lines plotted two standard deviations away from a simple moving average.'}
      </p>

      <div className="grid grid-cols-2 gap-4 mb-6">
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
            {language === 'he' ? 'ממוצע נע (SMA 20)' : 'SMA (e.g. 20-Day)'}
          </label>
          <input type="number" step="0.01" value={sma20} onChange={(e) => setSma20(Number(e.target.value))} className="w-full px-3 py-2 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-sm" />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
            {language === 'he' ? 'סטיית תקן' : 'Standard Deviation'}
          </label>
          <input type="number" step="0.01" value={stdDev} onChange={(e) => setStdDev(Number(e.target.value))} className="w-full px-3 py-2 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-sm" />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
            {language === 'he' ? 'מחיר נוכחי' : 'Current Price'}
          </label>
          <input type="number" step="0.01" value={currentPrice} onChange={(e) => setCurrentPrice(Number(e.target.value))} className="w-full px-3 py-2 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-sm" />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
            {language === 'he' ? 'מכפיל סטיית תקן' : 'Std Dev Multiplier'}
          </label>
          <input type="number" step="0.1" value={multiplier} onChange={(e) => setMultiplier(Number(e.target.value))} className="w-full px-3 py-2 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-sm" />
        </div>
      </div>

      <div className="pt-6 border-t border-slate-100 dark:border-slate-800 space-y-4">
        <div className="flex justify-between items-center text-sm text-slate-600 dark:text-slate-400 px-2">
          <span>{language === 'he' ? 'רצועה עליונה:' : 'Upper Band:'}</span>
          <span className="font-medium text-emerald-600">{results.upperBand}</span>
        </div>
        <div className="flex justify-between items-center text-sm text-slate-600 dark:text-slate-400 px-2">
          <span>{language === 'he' ? 'רצועה תחתונה:' : 'Lower Band:'}</span>
          <span className="font-medium text-rose-600">{results.lowerBand}</span>
        </div>
        
        <div className={`p-4 rounded-xl border flex justify-between items-center mt-4 ${currentPrice > Number(results.upperBand) ? 'bg-rose-50 dark:bg-rose-900/10 border-rose-100 dark:border-rose-800/30' : currentPrice < Number(results.lowerBand) ? 'bg-emerald-50 dark:bg-emerald-900/10 border-emerald-100 dark:border-emerald-800/30' : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700'}`}>
          <div>
            <p className={`text-sm font-medium mb-1 ${currentPrice > Number(results.upperBand) ? 'text-rose-800 dark:text-rose-400' : currentPrice < Number(results.lowerBand) ? 'text-emerald-800 dark:text-emerald-400' : 'text-slate-800 dark:text-slate-300'}`}>
              {language === 'he' ? 'סטטוס מחיר' : 'Price Status'}
            </p>
          </div>
          <div className={`text-xl font-bold ${currentPrice > Number(results.upperBand) ? 'text-rose-600 dark:text-rose-400' : currentPrice < Number(results.lowerBand) ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-700 dark:text-slate-200'}`}>
            {results.status}
          </div>
        </div>
      </div>
    </div>
  );
}
