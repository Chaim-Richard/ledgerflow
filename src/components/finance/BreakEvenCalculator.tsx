import React, { useState } from 'react';
import { useUIStore } from '../../stores/useUIStore';

export default function BreakEvenCalculator() {
  const language = useUIStore(s => s.language);
  
  const [fixedCosts, setFixedCosts] = useState<number>(50000);
  const [pricePerUnit, setPricePerUnit] = useState<number>(100);
  const [variableCostPerUnit, setVariableCostPerUnit] = useState<number>(40);

  const calculateBreakEven = () => {
    const contributionMarginPerUnit = pricePerUnit - variableCostPerUnit;
    const contributionMarginRatio = pricePerUnit > 0 ? contributionMarginPerUnit / pricePerUnit : 0;
    
    const breakEvenUnits = contributionMarginPerUnit > 0 ? fixedCosts / contributionMarginPerUnit : 0;
    const breakEvenRevenue = breakEvenUnits * pricePerUnit;

    return {
      contributionMarginPerUnit: contributionMarginPerUnit.toFixed(2),
      contributionMarginRatio: (contributionMarginRatio * 100).toFixed(2),
      breakEvenUnits: Math.ceil(breakEvenUnits),
      breakEvenRevenue: breakEvenRevenue.toFixed(2)
    };
  };

  const results = calculateBreakEven();

  return (
    <div className="p-6 max-w-xl mx-auto bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm">
      <h2 className="text-xl font-medium text-slate-900 dark:text-white mb-6">
        {language === 'he' ? 'נקודת איזון (Break-Even)' : 'Break-Even Calculator'}
      </h2>
      <p className="text-sm text-slate-500 mb-6">
        {language === 'he' ? 'מחשב כמה יחידות יש למכור כדי לכסות את כל ההוצאות.' : 'Calculates how many units must be sold to cover all fixed and variable costs.'}
      </p>

      <div className="grid gap-4 mb-6">
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
            {language === 'he' ? 'הוצאות קבועות ($)' : 'Fixed Costs ($)'}
          </label>
          <input type="number" value={fixedCosts} onChange={(e) => setFixedCosts(Number(e.target.value))} className="w-full px-3 py-2 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-sm" />
        </div>
        
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              {language === 'he' ? 'מחיר מכירה ליחידה ($)' : 'Selling Price per Unit ($)'}
            </label>
            <input type="number" step="0.01" value={pricePerUnit} onChange={(e) => setPricePerUnit(Number(e.target.value))} className="w-full px-3 py-2 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-sm" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              {language === 'he' ? 'עלות משתנה ליחידה ($)' : 'Variable Cost per Unit ($)'}
            </label>
            <input type="number" step="0.01" value={variableCostPerUnit} onChange={(e) => setVariableCostPerUnit(Number(e.target.value))} className="w-full px-3 py-2 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-sm" />
          </div>
        </div>
      </div>

      <div className="pt-6 border-t border-slate-100 dark:border-slate-800 space-y-4">
        <div className="flex justify-between items-center text-sm text-slate-600 dark:text-slate-400 px-2">
          <span>{language === 'he' ? 'רווח גולמי ליחידה (Contribution Margin):' : 'Contribution Margin per Unit:'}</span>
          <span className="font-medium">${results.contributionMarginPerUnit}</span>
        </div>
        
        <div className="grid grid-cols-2 gap-4 mt-4">
          <div className="p-4 bg-sky-50 dark:bg-sky-900/10 rounded-xl border border-sky-100 dark:border-sky-800/30">
            <p className="text-sm font-medium text-sky-800 dark:text-sky-400 mb-1">
              {language === 'he' ? 'נקודת איזון (יחידות)' : 'Break-Even Units'}
            </p>
            <div className="text-3xl font-bold text-sky-600 dark:text-sky-400">
              {results.breakEvenUnits.toLocaleString()}
            </div>
          </div>
          
          <div className="p-4 bg-emerald-50 dark:bg-emerald-900/10 rounded-xl border border-emerald-100 dark:border-emerald-800/30">
            <p className="text-sm font-medium text-emerald-800 dark:text-emerald-400 mb-1">
              {language === 'he' ? 'הכנסות באיזון ($)' : 'Break-Even Revenue ($)'}
            </p>
            <div className="text-3xl font-bold text-emerald-600 dark:text-emerald-400">
              ${Number(results.breakEvenRevenue).toLocaleString()}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
