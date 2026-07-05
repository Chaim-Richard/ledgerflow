import React, { useState } from 'react';
import { useUIStore } from '../../stores/useUIStore';

export default function EvaCalculator() {
  const language = useUIStore(s => s.language);
  
  const [nopat, setNopat] = useState<number>(500000); // Net Operating Profit After Taxes
  const [investedCapital, setInvestedCapital] = useState<number>(3000000);
  const [wacc, setWacc] = useState<number>(10); // Weighted Average Cost of Capital %

  const calculateEVA = () => {
    const costOfCapital = investedCapital * (wacc / 100);
    const eva = nopat - costOfCapital;
    const roic = investedCapital > 0 ? (nopat / investedCapital) * 100 : 0;

    return {
      costOfCapital,
      eva,
      roic: roic.toFixed(2)
    };
  };

  const results = calculateEVA();

  return (
    <div className="p-6 max-w-xl mx-auto bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm">
      <h2 className="text-xl font-medium text-slate-900 dark:text-white mb-6">
        {language === 'he' ? 'ערך כלכלי מוסף (EVA)' : 'Economic Value Added (EVA)'}
      </h2>
      <p className="text-sm text-slate-500 mb-6">
        {language === 'he' ? 'מודד את הערך שהחברה יוצרת מעבר לתשואה הנדרשת על ידי המשקיעים (עלות ההון).' : 'Measures the value a company generates from funds invested into it, indicating true economic profit.'}
      </p>

      <div className="space-y-4 mb-6">
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
            {language === 'he' ? 'רווח תפעולי נקי לאחר מס (NOPAT)' : 'Net Operating Profit After Tax (NOPAT)'}
          </label>
          <input type="number" value={nopat} onChange={(e) => setNopat(Number(e.target.value))} className="w-full px-3 py-2 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-sm" />
        </div>
        
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              {language === 'he' ? 'סך הון מושקע' : 'Invested Capital'}
            </label>
            <input type="number" value={investedCapital} onChange={(e) => setInvestedCapital(Number(e.target.value))} className="w-full px-3 py-2 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-sm" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              {language === 'he' ? 'עלות ההון המוערכת (WACC %)' : 'Cost of Capital (WACC %)'}
            </label>
            <input type="number" step="0.1" value={wacc} onChange={(e) => setWacc(Number(e.target.value))} className="w-full px-3 py-2 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-sm" />
          </div>
        </div>
      </div>

      <div className="pt-6 border-t border-slate-100 dark:border-slate-800 space-y-4">
        <div className="flex justify-between items-center text-sm text-slate-600 dark:text-slate-400 px-2">
          <span>{language === 'he' ? 'עלות ההון (במטבע):' : 'Capital Charge (Cost):'}</span>
          <span className="font-medium">${results.costOfCapital.toLocaleString()}</span>
        </div>
        <div className="flex justify-between items-center text-sm text-slate-600 dark:text-slate-400 px-2">
          <span>{language === 'he' ? 'תשואה על ההון המושקע (ROIC):' : 'Return on Invested Capital (ROIC):'}</span>
          <span className="font-medium">{results.roic}%</span>
        </div>
        
        <div className={`p-4 rounded-xl border mt-4 ${results.eva > 0 ? 'bg-emerald-50 dark:bg-emerald-900/10 border-emerald-100 dark:border-emerald-800/30' : 'bg-rose-50 dark:bg-rose-900/10 border-rose-100 dark:border-rose-800/30'}`}>
          <div className="flex justify-between items-center">
            <div>
              <p className={`text-sm font-medium mb-1 ${results.eva > 0 ? 'text-emerald-800 dark:text-emerald-400' : 'text-rose-800 dark:text-rose-400'}`}>
                {language === 'he' ? 'ערך כלכלי מוסף (EVA)' : 'Economic Value Added (EVA)'}
              </p>
              <p className={`text-xs ${results.eva > 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                {language === 'he' ? 'NOPAT - עלות ההון' : 'NOPAT - Capital Charge'}
              </p>
            </div>
            <div className={`text-3xl font-bold ${results.eva > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
              ${results.eva.toLocaleString()}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
