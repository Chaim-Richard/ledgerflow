import React, { useState } from 'react';
import { useUIStore } from '../../stores/useUIStore';

export default function MacdCalculator() {
  const language = useUIStore(s => s.language);
  
  const [ema12, setEma12] = useState<number>(150);
  const [ema26, setEma26] = useState<number>(145);
  const [signalLineEma9, setSignalLineEma9] = useState<number>(4);

  const calculateMACD = () => {
    const macdLine = ema12 - ema26;
    const histogram = macdLine - signalLineEma9;
    
    let status = '';
    if (histogram > 0 && macdLine > signalLineEma9) status = language === 'he' ? 'מומנטום שוורי (קנייה)' : 'Bullish Momentum';
    else if (histogram < 0 && macdLine < signalLineEma9) status = language === 'he' ? 'מומנטום דובי (מכירה)' : 'Bearish Momentum';
    else status = language === 'he' ? 'מומנטום מעורב' : 'Mixed / Neutral';
    
    return {
      macdLine: macdLine.toFixed(2),
      histogram: histogram.toFixed(2),
      status
    };
  };

  const results = calculateMACD();

  return (
    <div className="p-6 max-w-xl mx-auto bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm">
      <h2 className="text-xl font-medium text-slate-900 dark:text-white mb-6">
        {language === 'he' ? 'מתנד MACD' : 'MACD Calculator'}
      </h2>
      <p className="text-sm text-slate-500 mb-6">
        {language === 'he' ? 'אינדיקטור מומנטום העוקב אחר מגמות המראה את הקשר בין שני ממוצעים נעים.' : 'A trend-following momentum indicator that shows the relationship between two moving averages of a security\'s price.'}
      </p>

      <div className="grid grid-cols-2 gap-4 mb-6">
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
            {language === 'he' ? 'EMA 12 (מהיר)' : '12-Period EMA'}
          </label>
          <input type="number" step="0.01" value={ema12} onChange={(e) => setEma12(Number(e.target.value))} className="w-full px-3 py-2 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-sm" />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
            {language === 'he' ? 'EMA 26 (איטי)' : '26-Period EMA'}
          </label>
          <input type="number" step="0.01" value={ema26} onChange={(e) => setEma26(Number(e.target.value))} className="w-full px-3 py-2 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-sm" />
        </div>
        <div className="col-span-2">
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
            {language === 'he' ? 'קו איתות (Signal Line - EMA 9)' : 'Signal Line (9-Period EMA of MACD)'}
          </label>
          <input type="number" step="0.01" value={signalLineEma9} onChange={(e) => setSignalLineEma9(Number(e.target.value))} className="w-full px-3 py-2 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-sm" />
        </div>
      </div>

      <div className="pt-6 border-t border-slate-100 dark:border-slate-800 space-y-4">
         <div className="flex justify-between items-center text-sm text-slate-600 dark:text-slate-400 px-2">
          <span>{language === 'he' ? 'היסטוגרמה (MACD - Signal):' : 'Histogram:'}</span>
          <span className={`font-medium ${Number(results.histogram) > 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
            {results.histogram}
          </span>
        </div>
        
        <div className={`p-4 rounded-xl border flex justify-between items-center mt-4 ${Number(results.histogram) > 0 ? 'bg-emerald-50 dark:bg-emerald-900/10 border-emerald-100 dark:border-emerald-800/30' : 'bg-rose-50 dark:bg-rose-900/10 border-rose-100 dark:border-rose-800/30'}`}>
          <div>
            <p className={`text-sm font-medium mb-1 ${Number(results.histogram) > 0 ? 'text-emerald-800 dark:text-emerald-400' : 'text-rose-800 dark:text-rose-400'}`}>
              {language === 'he' ? 'קו MACD' : 'MACD Line'}
            </p>
            <p className="text-xs opacity-80">{results.status}</p>
          </div>
          <div className={`text-4xl font-bold ${Number(results.histogram) > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
            {results.macdLine}
          </div>
        </div>
      </div>
    </div>
  );
}
