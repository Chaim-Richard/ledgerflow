import React, { useState } from 'react';
import { useUIStore } from '../../stores/useUIStore';

export default function DioCalculator() {
  const language = useUIStore(s => s.language);
  
  const [averageInventory, setAverageInventory] = useState<number>(40000);
  const [cogs, setCogs] = useState<number>(200000);
  const [daysInPeriod, setDaysInPeriod] = useState<number>(365);

  const calculateDIO = () => {
    if (cogs <= 0) return { dio: 0 };
    const dio = (averageInventory / cogs) * daysInPeriod;
    
    return {
      dio: dio.toFixed(1)
    };
  };

  const results = calculateDIO();

  return (
    <div className="p-6 max-w-xl mx-auto bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm">
      <h2 className="text-xl font-medium text-slate-900 dark:text-white mb-6">
        {language === 'he' ? 'ימי מלאי (DIO)' : 'Days Inventory Outstanding (DIO)'}
      </h2>
      <p className="text-sm text-slate-500 mb-6">
        {language === 'he' ? 'מודד את מספר הימים הממוצע שלוקח לחברה להפוך את המלאי שלה למכירות.' : 'Indicates the average number of days that a company holds its inventory before selling it.'}
      </p>

      <div className="grid grid-cols-2 gap-4 mb-6">
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
            {language === 'he' ? 'ממוצע מלאי ($)' : 'Average Inventory ($)'}
          </label>
          <input type="number" value={averageInventory} onChange={(e) => setAverageInventory(Number(e.target.value))} className="w-full px-3 py-2 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-sm" />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
            {language === 'he' ? 'עלות המכר (COGS) ($)' : 'Cost of Goods Sold ($)'}
          </label>
          <input type="number" value={cogs} onChange={(e) => setCogs(Number(e.target.value))} className="w-full px-3 py-2 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-sm" />
        </div>
        <div className="col-span-2">
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
            {language === 'he' ? 'ימים בתקופה (לרוב 365)' : 'Number of Days in Period'}
          </label>
          <input type="number" value={daysInPeriod} onChange={(e) => setDaysInPeriod(Number(e.target.value))} className="w-full px-3 py-2 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-sm" />
        </div>
      </div>

      <div className="pt-6 border-t border-slate-100 dark:border-slate-800">
        <div className="p-4 bg-sky-50 dark:bg-sky-900/10 rounded-xl border border-sky-100 dark:border-sky-800/30 flex justify-between items-center mt-4">
          <div>
            <p className="text-sm font-medium text-sky-800 dark:text-sky-400 mb-1">
              {language === 'he' ? 'ימי מלאי (DIO)' : 'DIO'}
            </p>
          </div>
          <div className="text-4xl font-bold text-sky-600 dark:text-sky-400">
            {results.dio} {language === 'he' ? 'ימים' : 'Days'}
          </div>
        </div>
      </div>
    </div>
  );
}
