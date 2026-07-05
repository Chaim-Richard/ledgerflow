import React, { useState } from 'react';
import { useUIStore } from '../../stores/useUIStore';

export default function DupontAnalysisCalculator() {
  const language = useUIStore(s => s.language);
  
  const [netIncome, setNetIncome] = useState<number>(100000);
  const [revenue, setRevenue] = useState<number>(1000000);
  const [averageAssets, setAverageAssets] = useState<number>(500000);
  const [averageEquity, setAverageEquity] = useState<number>(250000);

  const calculateDupont = () => {
    if (revenue <= 0 || averageAssets <= 0 || averageEquity <= 0) 
      return { roe: 0, netMargin: 0, assetTurnover: 0, equityMultiplier: 0 };
    
    // Net Profit Margin = Net Income / Revenue
    const netMargin = (netIncome / revenue) * 100;
    // Asset Turnover = Revenue / Average Total Assets
    const assetTurnover = revenue / averageAssets;
    // Equity Multiplier = Average Total Assets / Average Equity
    const equityMultiplier = averageAssets / averageEquity;
    
    // ROE = Net Margin * Asset Turnover * Equity Multiplier
    const roe = (netMargin / 100) * assetTurnover * equityMultiplier * 100;
    
    return {
      roe: roe.toFixed(2),
      netMargin: netMargin.toFixed(2),
      assetTurnover: assetTurnover.toFixed(2),
      equityMultiplier: equityMultiplier.toFixed(2)
    };
  };

  const results = calculateDupont();

  return (
    <div className="p-6 max-w-xl mx-auto bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm">
      <h2 className="text-xl font-medium text-slate-900 dark:text-white mb-6">
        {language === 'he' ? 'ניתוח דופונט (DuPont Analysis)' : 'DuPont Analysis (3-Step)'}
      </h2>
      <p className="text-sm text-slate-500 mb-6">
        {language === 'he' ? 'מפרק את התשואה להון (ROE) לשלושה מרכיבים: רווחיות, יעילות נכסים ומינוף.' : 'Deconstructs Return on Equity (ROE) into three components: profit margin, asset turnover, and financial leverage.'}
      </p>

      <div className="grid gap-4 mb-6">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              {language === 'he' ? 'רווח נקי ($)' : 'Net Income ($)'}
            </label>
            <input type="number" value={netIncome} onChange={(e) => setNetIncome(Number(e.target.value))} className="w-full px-3 py-2 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-sm" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              {language === 'he' ? 'הכנסות / מכירות ($)' : 'Revenue / Sales ($)'}
            </label>
            <input type="number" value={revenue} onChange={(e) => setRevenue(Number(e.target.value))} className="w-full px-3 py-2 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-sm" />
          </div>
        </div>
        
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              {language === 'he' ? 'ממוצע סך נכסים ($)' : 'Average Total Assets ($)'}
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
      </div>

      <div className="pt-6 border-t border-slate-100 dark:border-slate-800 space-y-4">
        
        <div className="grid grid-cols-3 gap-2">
          <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-lg border border-slate-100 dark:border-slate-700 text-center">
            <p className="text-xs text-slate-500 mb-1">{language === 'he' ? 'שולי רווח נקי' : 'Net Margin'}</p>
            <p className="font-medium">{results.netMargin}%</p>
          </div>
          <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-lg border border-slate-100 dark:border-slate-700 text-center">
            <p className="text-xs text-slate-500 mb-1">{language === 'he' ? 'מחזור נכסים' : 'Asset Turnover'}</p>
            <p className="font-medium">{results.assetTurnover}x</p>
          </div>
          <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-lg border border-slate-100 dark:border-slate-700 text-center">
            <p className="text-xs text-slate-500 mb-1">{language === 'he' ? 'מכפיל הון' : 'Equity Multiplier'}</p>
            <p className="font-medium">{results.equityMultiplier}x</p>
          </div>
        </div>

        <div className="p-4 bg-sky-50 dark:bg-sky-900/10 rounded-xl border border-sky-100 dark:border-sky-800/30 flex justify-between items-center mt-4">
          <div>
            <p className="text-sm font-medium text-sky-800 dark:text-sky-400 mb-1">
              {language === 'he' ? 'תשואה להון (ROE)' : 'Return on Equity (ROE)'}
            </p>
          </div>
          <div className="text-4xl font-bold text-sky-600 dark:text-sky-400">
            {results.roe}%
          </div>
        </div>
      </div>
    </div>
  );
}
