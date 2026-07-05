import React, { useState } from 'react';
import { useUIStore } from '../../stores/useUIStore';

export default function RsiCalculator() {
  const language = useUIStore(s => s.language);
  
  const [avgGain, setAvgGain] = useState<number>(1.5);
  const [avgLoss, setAvgLoss] = useState<number>(0.8);

  const calculateRSI = () => {
    if (avgLoss === 0) return { rsi: 100, status: 'Overbought' };
    
    const rs = avgGain / avgLoss;
    const rsi = 100 - (100 / (1 + rs));
    
    let status = '';
    if (rsi >= 70) status = language === 'he' ? 'קניית יתר (Overbought)' : 'Overbought (≥ 70)';
    else if (rsi <= 30) status = language === 'he' ? 'מכירת יתר (Oversold)' : 'Oversold (≤ 30)';
    else status = language === 'he' ? 'ניטרלי' : 'Neutral';
    
    return {
      rsi: rsi.toFixed(2),
      status
    };
  };

  const results = calculateRSI();

  return (
    <div className="p-6 max-w-xl mx-auto bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm">
      <h2 className="text-xl font-medium text-slate-900 dark:text-white mb-6">
        {language === 'he' ? 'מדד העוצמה היחסית (RSI)' : 'Relative Strength Index (RSI)'}
      </h2>
      <p className="text-sm text-slate-500 mb-6">
        {language === 'he' ? 'מתנד תנע המודד את המהירות והשינוי של תנועות מחירים (ערך 0-100).' : 'A momentum oscillator that measures the speed and change of price movements.'}
      </p>

      <div className="grid grid-cols-2 gap-4 mb-6">
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
            {language === 'he' ? 'ממוצע רווחים' : 'Average Gain'}
          </label>
          <input type="number" step="0.01" value={avgGain} onChange={(e) => setAvgGain(Number(e.target.value))} className="w-full px-3 py-2 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-sm" />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
            {language === 'he' ? 'ממוצע הפסדים (חיובי)' : 'Average Loss (Absolute)'}
          </label>
          <input type="number" step="0.01" value={avgLoss} onChange={(e) => setAvgLoss(Number(e.target.value))} className="w-full px-3 py-2 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-sm" />
        </div>
      </div>

      <div className="pt-6 border-t border-slate-100 dark:border-slate-800">
        <div className={`p-4 rounded-xl border flex justify-between items-center ${Number(results.rsi) >= 70 ? 'bg-rose-50 dark:bg-rose-900/10 border-rose-100 dark:border-rose-800/30' : Number(results.rsi) <= 30 ? 'bg-emerald-50 dark:bg-emerald-900/10 border-emerald-100 dark:border-emerald-800/30' : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700'}`}>
          <div>
            <p className={`text-sm font-medium mb-1 ${Number(results.rsi) >= 70 ? 'text-rose-800 dark:text-rose-400' : Number(results.rsi) <= 30 ? 'text-emerald-800 dark:text-emerald-400' : 'text-slate-800 dark:text-slate-300'}`}>
              {language === 'he' ? 'RSI' : 'RSI Value'}
            </p>
            <p className="text-xs opacity-80">{results.status}</p>
          </div>
          <div className={`text-4xl font-bold ${Number(results.rsi) >= 70 ? 'text-rose-600 dark:text-rose-400' : Number(results.rsi) <= 30 ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-700 dark:text-slate-200'}`}>
            {results.rsi}
          </div>
        </div>
      </div>
    </div>
  );
}
