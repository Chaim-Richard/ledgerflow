import React, { useState } from 'react';
import { useUIStore } from '../../stores/useUIStore';

export default function DuPontAnalysisCalculator() {
  const language = useUIStore(s => s.language);
  
  const [netIncome, setNetIncome] = useState<number>(100000);
  const [revenue, setRevenue] = useState<number>(1000000);
  const [averageAssets, setAverageAssets] = useState<number>(500000);
  const [averageEquity, setAverageEquity] = useState<number>(250000);

  const calculateDuPont = () => {
    if (revenue <= 0 || averageAssets <= 0 || averageEquity <= 0) {
       return { netProfitMargin: 0, assetTurnover: 0, equityMultiplier: 0, roe: 0 };
    }
    
    const netProfitMargin = netIncome / revenue;
    const assetTurnover = revenue / averageAssets;
    const equityMultiplier = averageAssets / averageEquity;
    const roe = netProfitMargin * assetTurnover * equityMultiplier;
    
    return {
      netProfitMargin: (netProfitMargin * 100).toFixed(2),
      assetTurnover: assetTurnover.toFixed(2),
      equityMultiplier: equityMultiplier.toFixed(2),
      roe: (roe * 100).toFixed(2)
    };
  };

  const results = calculateDuPont();

  return (
    <div className="p-6 max-w-xl mx-auto bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm">
      <h2 className="text-xl font-medium text-slate-900 dark:text-white mb-6">
        {language === 'he' ? 'ניתוח דופונט (DuPont ROE)' : 'DuPont Analysis Calculator'}
      </h2>
      <p className="text-sm text-slate-500 mb-6">
        {language === 'he' ? 'מפרקאת התשואה להון (ROE) לשלושה מרכיבים: רווחיות, יעילות תפעולית, ומינוף פיננסי.' : 'Breaks down Return on Equity (ROE) into three components: operating efficiency, asset use efficiency, and financial leverage.'}
      </p>

      <div className="grid grid-cols-2 gap-4 mb-6">
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
            {language === 'he' ? 'רווח נקי ($)' : 'Net Income ($)'}
          </label>
          <input type="number" value={netIncome} onChange={(e) => setNetIncome(Number(e.target.value))} className="w-full px-3 py-2 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-sm" />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
            {language === 'he' ? 'הכנסות / מכירות ($)' : 'Revenue ($)'}
          </label>
          <input type="number" value={revenue} onChange={(e) => setRevenue(Number(e.target.value))} className="w-full px-3 py-2 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-sm" />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
            {language === 'he' ? 'ממוצע נכסים ($)' : 'Average Assets ($)'}
          </label>
          <input type="number" value={averageAssets} onChange={(e) => setAverageAssets(Number(e.target.value))} className="w-full px-3 py-2 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-sm" />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
            {language === 'he' ? 'ממוצע הון עצמי ($)' : 'Average Equity ($)'}
          </label>
          <input type="number" value={averageEquity} onChange={(e) => setAverageEquity(Number(e.target.value))} className="w-full px-3 py-2 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-sm" />
        </div>
      </div>

      <div className="pt-6 border-t border-slate-100 dark:border-slate-800 space-y-4">
        <div className="grid grid-cols-3 gap-2 text-center text-sm">
           <div className="bg-slate-50 dark:bg-slate-800/50 p-2 rounded-lg">
             <div className="text-slate-500 mb-1">{language === 'he' ? 'שולי רווח' : 'Profit Margin'}</div>
             <div className="font-medium text-slate-900 dark:text-white">{results.netProfitMargin}%</div>
           </div>
           <div className="bg-slate-50 dark:bg-slate-800/50 p-2 rounded-lg">
             <div className="text-slate-500 mb-1">{language === 'he' ? 'מחזור נכסים' : 'Asset Turnover'}</div>
             <div className="font-medium text-slate-900 dark:text-white">{results.assetTurnover}</div>
           </div>
           <div className="bg-slate-50 dark:bg-slate-800/50 p-2 rounded-lg">
             <div className="text-slate-500 mb-1">{language === 'he' ? 'מכפיל הון' : 'Equity Multiplier'}</div>
             <div className="font-medium text-slate-900 dark:text-white">{results.equityMultiplier}</div>
           </div>
        </div>
        
        <div className="p-4 bg-indigo-50 dark:bg-indigo-900/10 rounded-xl border border-indigo-100 dark:border-indigo-800/30 flex justify-between items-center mt-4">
          <div>
            <p className="text-sm font-medium text-indigo-800 dark:text-indigo-400 mb-1">
              {language === 'he' ? 'תשואה להון (ROE)' : 'ROE (Return on Equity)'}
            </p>
          </div>
          <div className="text-4xl font-bold text-indigo-600 dark:text-indigo-400">
            {results.roe}%
          </div>
        </div>
      </div>
    </div>
  );
}
