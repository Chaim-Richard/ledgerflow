import React, { useState } from 'react';
import { useUIStore } from '../../stores/useUIStore';

export default function EmaCalculator() {
  const language = useUIStore(s => s.language);
  
  const [currentPrice, setCurrentPrice] = useState<number>(130);
  const [previousEma, setPreviousEma] = useState<number>(125);
  const [period, setPeriod] = useState<number>(10);

  const calculateEMA = () => {
    if (period <= 0) return { ema: 0, multiplier: 0 };
    
    const multiplier = 2 / (period + 1);
    const ema = (currentPrice - previousEma) * multiplier + previousEma;
    
    return {
      ema: ema.toFixed(2),
      multiplier: multiplier.toFixed(4)
    };
  };

  const results = calculateEMA();

  return (
    <div className="p-6 max-w-xl mx-auto bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm">
      <h2 className="text-xl font-medium text-slate-900 dark:text-white mb-6">
        {language === 'he' ? 'ממוצע נע אקספוננציאלי (EMA)' : 'Exponential Moving Average (EMA)'}
      </h2>
      <p className="text-sm text-slate-500 mb-6">
        {language === 'he' ? 'מחשב ממוצע נע הנותן משקל רב יותר לנתונים העדכניים.' : 'A type of moving average that places a greater weight and significance on the most recent data points.'}
      </p>

      <div className="grid grid-cols-2 gap-4 mb-6">
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
            {language === 'he' ? 'מחיר נוכחי' : 'Current Price'}
          </label>
          <input type="number" value={currentPrice} onChange={(e) => setCurrentPrice(Number(e.target.value))} className="w-full px-3 py-2 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-sm" />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
            {language === 'he' ? 'EMA קודם' : 'Previous EMA'}
          </label>
          <input type="number" value={previousEma} onChange={(e) => setPreviousEma(Number(e.target.value))} className="w-full px-3 py-2 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-sm" />
        </div>
        <div className="col-span-2">
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
            {language === 'he' ? 'תקופות (למשל 10, 50, 200)' : 'Periods (e.g., 10, 50, 200)'}
          </label>
          <input type="number" step="1" value={period} onChange={(e) => setPeriod(Number(e.target.value))} className="w-full px-3 py-2 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-sm" />
        </div>
      </div>

      <div className="pt-6 border-t border-slate-100 dark:border-slate-800 space-y-4">
        <div className="flex justify-between items-center text-sm text-slate-600 dark:text-slate-400 px-2">
          <span>{language === 'he' ? 'מכפיל:' : 'Multiplier:'}</span>
          <span className="font-medium">{results.multiplier}</span>
        </div>
        
        <div className="p-4 bg-emerald-50 dark:bg-emerald-900/10 rounded-xl border border-emerald-100 dark:border-emerald-800/30 flex justify-between items-center mt-4">
          <div>
            <p className="text-sm font-medium text-emerald-800 dark:text-emerald-400 mb-1">
              {language === 'he' ? 'EMA חדש' : 'New EMA'}
            </p>
          </div>
          <div className="text-4xl font-bold text-emerald-600 dark:text-emerald-400">
            {results.ema}
          </div>
        </div>
      </div>
    </div>
  );
}
