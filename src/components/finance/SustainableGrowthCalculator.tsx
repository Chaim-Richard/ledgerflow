import React, { useState } from 'react';
import { useUIStore } from '../../stores/useUIStore';

export default function SustainableGrowthCalculator() {
  const language = useUIStore(s => s.language);
  
  const [roe, setRoe] = useState<number>(15);
  const [retentionRatio, setRetentionRatio] = useState<number>(60);

  const calculateSGR = () => {
    // SGR = ROE * Retention Ratio
    const sgr = (roe / 100) * (retentionRatio / 100) * 100;
    
    return {
      sgr: sgr.toFixed(2)
    };
  };

  const results = calculateSGR();

  return (
    <div className="p-6 max-w-xl mx-auto bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm">
      <h2 className="text-xl font-medium text-slate-900 dark:text-white mb-6">
        {language === 'he' ? 'שיעור צמיחה בר קיימא (SGR)' : 'Sustainable Growth Rate (SGR)'}
      </h2>
      <p className="text-sm text-slate-500 mb-6">
        {language === 'he' ? 'הקצב המרבי שבו חברה יכולה לגדול מבלי לממן את הצמיחה בעזרת הון עצמי נוסף או חוב.' : 'The maximum rate of growth that a company or social enterprise can sustain without having to finance growth with additional equity or debt.'}
      </p>

      <div className="grid grid-cols-2 gap-4 mb-6">
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
            {language === 'he' ? 'תשואה להון (ROE %)' : 'Return on Equity (ROE %)'}
          </label>
          <input type="number" step="0.1" value={roe} onChange={(e) => setRoe(Number(e.target.value))} className="w-full px-3 py-2 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-sm" />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
            {language === 'he' ? 'יחס שימור (Retention Ratio %)' : 'Retention Ratio (%)'}
          </label>
          <input type="number" step="0.1" value={retentionRatio} onChange={(e) => setRetentionRatio(Number(e.target.value))} className="w-full px-3 py-2 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-sm" />
        </div>
      </div>

      <div className="pt-6 border-t border-slate-100 dark:border-slate-800">
        <div className="p-4 bg-sky-50 dark:bg-sky-900/10 rounded-xl border border-sky-100 dark:border-sky-800/30 flex justify-between items-center mt-4">
          <div>
            <p className="text-sm font-medium text-sky-800 dark:text-sky-400 mb-1">
              {language === 'he' ? 'צמיחה ברת קיימא (SGR)' : 'Sustainable Growth Rate'}
            </p>
          </div>
          <div className="text-4xl font-bold text-sky-600 dark:text-sky-400">
            {results.sgr}%
          </div>
        </div>
      </div>
    </div>
  );
}
