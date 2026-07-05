import React, { useState } from 'react';
import { useUIStore } from '../../stores/useUIStore';

export default function HouseFlipCalculator() {
  const language = useUIStore(s => s.language);
  const [purchasePrice, setPurchasePrice] = useState<number>(200000);
  const [repairCosts, setRepairCosts] = useState<number>(50000);
  const [holdingCosts, setHoldingCosts] = useState<number>(10000);
  const [sellingCosts, setSellingCosts] = useState<number>(25000); // Commissions, closing
  const [afterRepairValue, setAfterRepairValue] = useState<number>(350000); // ARV

  const calculateFlip = () => {
    const totalCosts = purchasePrice + repairCosts + holdingCosts + sellingCosts;
    const profit = afterRepairValue - totalCosts;
    const roi = totalCosts > 0 ? (profit / totalCosts) * 100 : 0;
    
    // 70% rule check (investor shouldn't pay more than 70% of ARV minus repairs)
    const maxPurchasePrice = (afterRepairValue * 0.7) - repairCosts;

    return {
      totalCosts,
      profit,
      roi: roi.toFixed(2),
      maxPurchasePrice: maxPurchasePrice.toFixed(2)
    };
  };

  const results = calculateFlip();

  return (
    <div className="p-6 max-w-xl mx-auto bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm">
      <h2 className="text-xl font-medium text-slate-900 dark:text-white mb-6">
        {language === 'he' ? 'מחשבון פליפ נדל״ן (House Flipping)' : 'House Flipping Calculator'}
      </h2>

      <div className="grid grid-cols-2 gap-8 mb-6">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              {language === 'he' ? 'מחיר רכישה' : 'Purchase Price'}
            </label>
            <input type="number" value={purchasePrice} onChange={(e) => setPurchasePrice(Number(e.target.value))} className="w-full px-3 py-2 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-sm" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              {language === 'he' ? 'עלויות שיפוץ (Repairs)' : 'Repair Costs'}
            </label>
            <input type="number" value={repairCosts} onChange={(e) => setRepairCosts(Number(e.target.value))} className="w-full px-3 py-2 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-sm" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              {language === 'he' ? 'עלויות החזקה (מימון, ביטוח, מיסים)' : 'Holding Costs (Financing, Taxes)'}
            </label>
            <input type="number" value={holdingCosts} onChange={(e) => setHoldingCosts(Number(e.target.value))} className="w-full px-3 py-2 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-sm" />
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              {language === 'he' ? 'עלויות מכירה (עמלות, סגירה)' : 'Selling Costs (Commissions)'}
            </label>
            <input type="number" value={sellingCosts} onChange={(e) => setSellingCosts(Number(e.target.value))} className="w-full px-3 py-2 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-sm" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              {language === 'he' ? 'שווי לאחר שיפוץ (ARV)' : 'After Repair Value (ARV)'}
            </label>
            <input type="number" value={afterRepairValue} onChange={(e) => setAfterRepairValue(Number(e.target.value))} className="w-full px-3 py-2 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-sm" />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-y-6 gap-x-4 pt-4 border-t border-slate-100 dark:border-slate-800 mt-2">
        <div>
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-1">
            {language === 'he' ? 'סך עלויות פרויקט' : 'Total Project Costs'}
          </p>
          <div className="text-2xl font-medium text-slate-700 dark:text-slate-300">
            ${results.totalCosts.toLocaleString()}
          </div>
        </div>
        <div>
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-1">
            {language === 'he' ? 'רווח צפוי' : 'Estimated Profit'}
          </p>
          <div className={`text-3xl font-bold ${results.profit >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
            ${results.profit.toLocaleString()}
          </div>
        </div>
        <div>
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-1">
            {language === 'he' ? 'תשואה (ROI)' : 'Return on Investment (ROI)'}
          </p>
          <div className="text-xl font-medium text-indigo-600 dark:text-indigo-400">
            {results.roi}%
          </div>
        </div>
        <div>
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-1">
            {language === 'he' ? 'מחיר רכישה מקסימלי (כלל 70%)' : 'Max Purchase Price (70% Rule)'}
          </p>
          <div className="text-xl font-medium text-slate-600 dark:text-slate-400">
            ${Number(results.maxPurchasePrice).toLocaleString()}
          </div>
        </div>
      </div>
    </div>
  );
}
