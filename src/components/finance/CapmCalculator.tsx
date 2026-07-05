import React, { useState } from 'react';
import { useUIStore } from '../../stores/useUIStore';

export default function CapmCalculator() {
  const language = useUIStore(s => s.language);
  
  const [riskFreeRate, setRiskFreeRate] = useState<number>(4);
  const [beta, setBeta] = useState<number>(1.2);
  const [expectedMarketReturn, setExpectedMarketReturn] = useState<number>(10);

  const calculateCAPM = () => {
    // Expected Return = Risk Free Rate + Beta * (Expected Market Return - Risk Free Rate)
    const marketRiskPremium = expectedMarketReturn - riskFreeRate;
    const costOfEquity = riskFreeRate + beta * marketRiskPremium;
    
    return {
      costOfEquity: costOfEquity.toFixed(2),
      mrp: marketRiskPremium.toFixed(2)
    };
  };

  const results = calculateCAPM();

  return (
    <div className="p-6 max-w-xl mx-auto bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm">
      <h2 className="text-xl font-medium text-slate-900 dark:text-white mb-6">
        {language === 'he' ? 'מודל תמחור נכסי הון (CAPM)' : 'CAPM / Cost of Equity'}
      </h2>
      <p className="text-sm text-slate-500 mb-6">
        {language === 'he' ? 'מודל המתאר את הקשר בין סיכון שיטתי לתשואה הצפויה של נכס, בעיקר מניות.' : 'Describes the relationship between systematic risk and expected return for assets, particularly stocks.'}
      </p>

      <div className="grid grid-cols-2 gap-4 mb-6">
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
            {language === 'he' ? 'שיעור חסר סיכון (%)' : 'Risk-Free Rate (%)'}
          </label>
          <input type="number" step="0.1" value={riskFreeRate} onChange={(e) => setRiskFreeRate(Number(e.target.value))} className="w-full px-3 py-2 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-sm" />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
            {language === 'he' ? 'בטא (\u03B2)' : 'Beta (\u03B2)'}
          </label>
          <input type="number" step="0.1" value={beta} onChange={(e) => setBeta(Number(e.target.value))} className="w-full px-3 py-2 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-sm" />
        </div>
        <div className="col-span-2">
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
            {language === 'he' ? 'תשואת שוק צפויה (%)' : 'Expected Market Return (%)'}
          </label>
          <input type="number" step="0.1" value={expectedMarketReturn} onChange={(e) => setExpectedMarketReturn(Number(e.target.value))} className="w-full px-3 py-2 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-sm" />
        </div>
      </div>

      <div className="pt-6 border-t border-slate-100 dark:border-slate-800 space-y-4">
        <div className="flex justify-between items-center text-sm text-slate-600 dark:text-slate-400 px-2">
          <span>{language === 'he' ? 'פרמיית סיכון שוק:' : 'Market Risk Premium:'}</span>
          <span className="font-medium">{results.mrp}%</span>
        </div>

        <div className="p-4 bg-indigo-50 dark:bg-indigo-900/10 rounded-xl border border-indigo-100 dark:border-indigo-800/30 flex justify-between items-center mt-4">
          <div>
            <p className="text-sm font-medium text-indigo-800 dark:text-indigo-400 mb-1">
              {language === 'he' ? 'עלות הון עצמי (תשואה צפויה)' : 'Cost of Equity / Expected Return'}
            </p>
          </div>
          <div className="text-4xl font-bold text-indigo-600 dark:text-indigo-400">
            {results.costOfEquity}%
          </div>
        </div>
      </div>
    </div>
  );
}
