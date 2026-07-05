import React, { useState } from 'react';
import { useUIStore } from '../../stores/useUIStore';

export default function DebtToCapitalCalculator() {
  const language = useUIStore(s => s.language);
  
  const [totalDebt, setTotalDebt] = useState<number>(400000);
  const [shareholdersEquity, setShareholdersEquity] = useState<number>(600000);

  const calculateRatio = () => {
    const totalCapital = totalDebt + shareholdersEquity;
    if (totalCapital <= 0) return { ratio: 0 };
    
    const ratio = (totalDebt / totalCapital) * 100;
    
    return {
      ratio: ratio.toFixed(2),
      totalCapital: totalCapital.toLocaleString()
    };
  };

  const results = calculateRatio();

  return (
    <div className="p-6 max-w-xl mx-auto bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm">
      <h2 className="text-xl font-medium text-slate-900 dark:text-white mb-6">
        {language === 'he' ? 'יחס חוב להון הכולל (Debt-to-Capital)' : 'Debt-to-Capital Ratio Calculator'}
      </h2>
      <p className="text-sm text-slate-500 mb-6">
        {language === 'he' ? 'מודד את שיעור המימון של החברה באמצעות חוב ביחס לסך ההון שלה (חוב + הון עצמי).' : 'A measurement of a company\'s financial leverage, calculated as the company\'s debt divided by its total capital.'}
      </p>

      <div className="grid grid-cols-2 gap-4 mb-6">
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
            {language === 'he' ? 'סך חוב (נושא ריבית) ($)' : 'Total Debt ($)'}
          </label>
          <input type="number" value={totalDebt} onChange={(e) => setTotalDebt(Number(e.target.value))} className="w-full px-3 py-2 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-sm" />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
            {language === 'he' ? 'הון עצמי ($)' : 'Shareholders\' Equity ($)'}
          </label>
          <input type="number" value={shareholdersEquity} onChange={(e) => setShareholdersEquity(Number(e.target.value))} className="w-full px-3 py-2 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-sm" />
        </div>
      </div>

      <div className="pt-6 border-t border-slate-100 dark:border-slate-800 space-y-4">
        <div className="flex justify-between items-center text-sm text-slate-600 dark:text-slate-400 px-2">
          <span>{language === 'he' ? 'סך הון (חוב + הון עצמי):' : 'Total Capital:'}</span>
          <span className="font-medium">${results.totalCapital}</span>
        </div>

        <div className="p-4 bg-sky-50 dark:bg-sky-900/10 rounded-xl border border-sky-100 dark:border-sky-800/30 flex justify-between items-center mt-4">
          <div>
            <p className="text-sm font-medium text-sky-800 dark:text-sky-400 mb-1">
              {language === 'he' ? 'יחס חוב להון' : 'Debt-to-Capital Ratio'}
            </p>
          </div>
          <div className="text-4xl font-bold text-sky-600 dark:text-sky-400">
            {results.ratio}%
          </div>
        </div>
      </div>
    </div>
  );
}
