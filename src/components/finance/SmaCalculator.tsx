import React, { useState } from 'react';
import { useUIStore } from '../../stores/useUIStore';

export default function SmaCalculator() {
  const language = useUIStore(s => s.language);
  
  const [dataPoints, setDataPoints] = useState<string>('120, 122, 121, 125, 124, 126, 128');
  
  const calculateSMA = () => {
    const points = dataPoints.split(',').map(p => parseFloat(p.trim())).filter(n => !isNaN(n));
    if (points.length === 0) return { sma: 0, count: 0 };
    
    const sum = points.reduce((a, b) => a + b, 0);
    const sma = sum / points.length;
    
    return {
      sma: sma.toFixed(2),
      count: points.length
    };
  };

  const results = calculateSMA();

  return (
    <div className="p-6 max-w-xl mx-auto bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm">
      <h2 className="text-xl font-medium text-slate-900 dark:text-white mb-6">
        {language === 'he' ? 'ממוצע נע פשוט (SMA)' : 'Simple Moving Average (SMA)'}
      </h2>
      <p className="text-sm text-slate-500 mb-6">
        {language === 'he' ? 'מחשב את הממוצע החשבוני הפשוט של רשימת מחירי נכס לתקופה מסוימת.' : 'Calculates the unweighted mean of a set of data points (e.g., closing prices).'}
      </p>

      <div className="mb-6">
        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
          {language === 'he' ? 'הכנס נתונים (מופרדים בפסיק)' : 'Enter Data Points (comma separated)'}
        </label>
        <textarea 
          value={dataPoints} 
          onChange={(e) => setDataPoints(e.target.value)} 
          className="w-full px-3 py-2 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-sm h-24" 
        />
      </div>

      <div className="pt-6 border-t border-slate-100 dark:border-slate-800 space-y-4">
        <div className="flex justify-between items-center text-sm text-slate-600 dark:text-slate-400 px-2">
          <span>{language === 'he' ? 'מספר נקודות נתונים:' : 'Data Points Count:'}</span>
          <span className="font-medium">{results.count}</span>
        </div>
        
        <div className="p-4 bg-emerald-50 dark:bg-emerald-900/10 rounded-xl border border-emerald-100 dark:border-emerald-800/30 flex justify-between items-center mt-4">
          <div>
            <p className="text-sm font-medium text-emerald-800 dark:text-emerald-400 mb-1">
              {language === 'he' ? 'ממוצע (SMA)' : 'SMA'}
            </p>
          </div>
          <div className="text-4xl font-bold text-emerald-600 dark:text-emerald-400">
            {results.sma}
          </div>
        </div>
      </div>
    </div>
  );
}
