import React, { useState } from 'react';
import { useUIStore } from '../../stores/useUIStore';

export default function CccCalculator() {
  const language = useUIStore(s => s.language);
  
  const [dio, setDio] = useState<number>(45);
  const [dso, setDso] = useState<number>(30);
  const [dpo, setDpo] = useState<number>(35);

  const calculateCCC = () => {
    // CCC = DIO + DSO - DPO
    const ccc = dio + dso - dpo;
    
    let status = '';
    if (ccc < 0) status = language === 'he' ? 'מצוין (מחזור שלילי)' : 'Excellent (Negative Cycle)';
    else if (ccc < 45) status = language === 'he' ? 'תקין' : 'Healthy';
    else status = language === 'he' ? 'ארוך (עלול לפגוע בנזילות)' : 'Long (Potential liquidity drag)';

    return {
      ccc: ccc.toFixed(1),
      status
    };
  };

  const results = calculateCCC();

  return (
    <div className="p-6 max-w-xl mx-auto bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm">
      <h2 className="text-xl font-medium text-slate-900 dark:text-white mb-6">
        {language === 'he' ? 'מעגל המרה למזומן (CCC)' : 'Cash Conversion Cycle (CCC)'}
      </h2>
      <p className="text-sm text-slate-500 mb-6">
        {language === 'he' ? 'הזמן (בימים) שלוקח לחברה להמיר את ההשקעות שלה במלאי ומשאבים אחרים לתזרימי מזומנים ממכירות.' : 'A metric that expresses the time (in days) it takes for a company to convert its investments in inventory and other resources into cash flows from sales.'}
      </p>

      <div className="grid grid-cols-2 gap-4 mb-6">
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
            {language === 'he' ? 'ימי מלאי (DIO)' : 'Days Inventory Outstanding (DIO)'}
          </label>
          <input type="number" value={dio} onChange={(e) => setDio(Number(e.target.value))} className="w-full px-3 py-2 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-sm" />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
            {language === 'he' ? 'ימי לקוחות (DSO)' : 'Days Sales Outstanding (DSO)'}
          </label>
          <input type="number" value={dso} onChange={(e) => setDso(Number(e.target.value))} className="w-full px-3 py-2 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-sm" />
        </div>
        <div className="col-span-2">
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
            {language === 'he' ? 'ימי ספקים (DPO)' : 'Days Payable Outstanding (DPO)'}
          </label>
          <input type="number" value={dpo} onChange={(e) => setDpo(Number(e.target.value))} className="w-full px-3 py-2 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-sm" />
        </div>
      </div>

      <div className="pt-6 border-t border-slate-100 dark:border-slate-800">
        <div className={`p-4 rounded-xl border flex justify-between items-center ${Number(results.ccc) < 30 ? 'bg-emerald-50 dark:bg-emerald-900/10 border-emerald-100 dark:border-emerald-800/30' : Number(results.ccc) > 60 ? 'bg-amber-50 dark:bg-amber-900/10 border-amber-100 dark:border-amber-800/30' : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700'}`}>
          <div>
            <p className={`text-sm font-medium mb-1 ${Number(results.ccc) < 30 ? 'text-emerald-800 dark:text-emerald-400' : Number(results.ccc) > 60 ? 'text-amber-800 dark:text-amber-400' : 'text-slate-800 dark:text-slate-300'}`}>
              {language === 'he' ? 'מחזור המרה למזומן (CCC)' : 'Cash Conversion Cycle'}
            </p>
            <p className="text-xs opacity-80">{results.status}</p>
          </div>
          <div className={`text-4xl font-bold ${Number(results.ccc) < 30 ? 'text-emerald-600 dark:text-emerald-400' : Number(results.ccc) > 60 ? 'text-amber-600 dark:text-amber-400' : 'text-slate-700 dark:text-slate-200'}`}>
            {results.ccc} {language === 'he' ? 'ימים' : 'Days'}
          </div>
        </div>
      </div>
    </div>
  );
}
