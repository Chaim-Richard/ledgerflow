import React, { useState } from 'react';
import { useUIStore } from '../../stores/useUIStore';

export default function InventoryTurnoverCalculator() {
  const language = useUIStore(s => s.language);
  
  const [cogs, setCogs] = useState<number>(600000);
  const [averageInventory, setAverageInventory] = useState<number>(100000);

  const calculateRatio = () => {
    if (averageInventory <= 0) return { ratio: 0, days: 0 };
    const ratio = cogs / averageInventory;
    const days = 365 / ratio;
    
    return {
      ratio: ratio.toFixed(2),
      days: days.toFixed(1)
    };
  };

  const results = calculateRatio();

  return (
    <div className="p-6 max-w-xl mx-auto bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm">
      <h2 className="text-xl font-medium text-slate-900 dark:text-white mb-6">
        {language === 'he' ? 'מחזור מלאי (Inventory Turnover)' : 'Inventory Turnover Calculator'}
      </h2>
      <p className="text-sm text-slate-500 mb-6">
        {language === 'he' ? 'מודד כמה פעמים החברה מכרה והחליפה את המלאי שלה במהלך תקופה נתונה.' : 'A financial ratio showing how many times a company has sold and replaced inventory during a given period.'}
      </p>

      <div className="grid grid-cols-2 gap-4 mb-6">
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
            {language === 'he' ? 'עלות המכר (COGS) ($)' : 'Cost of Goods Sold ($)'}
          </label>
          <input type="number" value={cogs} onChange={(e) => setCogs(Number(e.target.value))} className="w-full px-3 py-2 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-sm" />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
            {language === 'he' ? 'ממוצע מלאי ($)' : 'Average Inventory ($)'}
          </label>
          <input type="number" value={averageInventory} onChange={(e) => setAverageInventory(Number(e.target.value))} className="w-full px-3 py-2 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-sm" />
        </div>
      </div>

      <div className="pt-6 border-t border-slate-100 dark:border-slate-800 space-y-4">
        <div className="flex justify-between items-center text-sm text-slate-600 dark:text-slate-400 px-2">
          <span>{language === 'he' ? 'ימי מלאי (DSI):' : 'Days Sales of Inventory (DSI):'}</span>
          <span className="font-medium">{results.days} {language === 'he' ? 'ימים' : 'Days'}</span>
        </div>

        <div className="p-4 bg-teal-50 dark:bg-teal-900/10 rounded-xl border border-teal-100 dark:border-teal-800/30 flex justify-between items-center mt-4">
          <div>
            <p className="text-sm font-medium text-teal-800 dark:text-teal-400 mb-1">
              {language === 'he' ? 'יחס מחזור מלאי' : 'Inventory Turnover'}
            </p>
          </div>
          <div className="text-4xl font-bold text-teal-600 dark:text-teal-400">
            {results.ratio}x
          </div>
        </div>
      </div>
    </div>
  );
}
