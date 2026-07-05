import React, { useState } from 'react';
import { useUIStore } from '../../stores/useUIStore';

export default function InflationCalculator() {
  const language = useUIStore(s => s.language);
  const [initialAmount, setInitialAmount] = useState<number>(1000);
  const [inflationRate, setInflationRate] = useState<number>(3);
  const [years, setYears] = useState<number>(10);

  const calculateInflation = () => {
    if (years < 0) return { futureValue: 0, purchasingPower: 0 };
    const rate = inflationRate / 100;
    
    // Future cost of the same basket of goods
    const futureValue = initialAmount * Math.pow(1 + rate, years);
    
    // Future purchasing power of today's amount
    const purchasingPower = initialAmount / Math.pow(1 + rate, years);

    return {
      futureValue: futureValue.toFixed(2),
      purchasingPower: purchasingPower.toFixed(2)
    };
  };

  const results = calculateInflation();

  return (
    <div className="p-6 max-w-xl mx-auto bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm">
      <h2 className="text-xl font-medium text-slate-900 dark:text-white mb-6">
        {language === 'he' ? 'מחשבון אינפלציה' : 'Inflation Calculator'}
      </h2>

      <div className="grid gap-4 mb-6">
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
            {language === 'he' ? 'סכום התחלתי' : 'Initial Amount'}
          </label>
          <input
            type="number"
            value={initialAmount}
            onChange={(e) => setInitialAmount(Number(e.target.value))}
            className="w-full px-3 py-2 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-sm"
          />
        </div>
        
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              {language === 'he' ? 'שיעור אינפלציה ממוצע (%)' : 'Average Inflation Rate (%)'}
            </label>
            <input
              type="number"
              value={inflationRate}
              onChange={(e) => setInflationRate(Number(e.target.value))}
              className="w-full px-3 py-2 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              {language === 'he' ? 'שנים' : 'Years'}
            </label>
            <input
              type="number"
              value={years}
              onChange={(e) => setYears(Number(e.target.value))}
              className="w-full px-3 py-2 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-sm"
            />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 pt-4 border-t border-slate-100 dark:border-slate-800 mt-2">
        <div>
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-1">
            {language === 'he' ? 'ערך עתידי נדרש' : 'Future Value Required'}
          </p>
          <div className="text-3xl font-medium text-indigo-600 dark:text-indigo-400">
            ${results.futureValue}
          </div>
          <p className="text-xs text-slate-500 mt-1">
             {language === 'he' ? 'כדי לשמור על כוח הקנייה' : 'To maintain purchasing power'}
          </p>
        </div>
        <div>
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-1">
            {language === 'he' ? 'כוח קנייה עתידי' : 'Future Purchasing Power'}
          </p>
          <div className="text-3xl font-medium text-rose-600 dark:text-rose-400">
            ${results.purchasingPower}
          </div>
          <p className="text-xs text-slate-500 mt-1">
             {language === 'he' ? 'ערך הכסף היום בעתיד' : 'Value of today\'s money in the future'}
          </p>
        </div>
      </div>
    </div>
  );
}
