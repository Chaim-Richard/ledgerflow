import React, { useState } from 'react';
import { useUIStore } from '../../stores/useUIStore';

export default function ProfitMarginCalculator() {
  const language = useUIStore(s => s.language);
  const [revenue, setRevenue] = useState<number>(100000);
  const [cogs, setCogs] = useState<number>(40000);
  const [operatingExpenses, setOperatingExpenses] = useState<number>(30000);
  const [taxesAndInterest, setTaxesAndInterest] = useState<number>(5000);

  const calculateMargins = () => {
    const grossProfit = revenue - cogs;
    const grossMargin = revenue > 0 ? (grossProfit / revenue) * 100 : 0;

    const operatingProfit = grossProfit - operatingExpenses;
    const operatingMargin = revenue > 0 ? (operatingProfit / revenue) * 100 : 0;

    const netProfit = operatingProfit - taxesAndInterest;
    const netMargin = revenue > 0 ? (netProfit / revenue) * 100 : 0;

    return {
      grossProfit: grossProfit.toFixed(2),
      grossMargin: grossMargin.toFixed(2),
      operatingProfit: operatingProfit.toFixed(2),
      operatingMargin: operatingMargin.toFixed(2),
      netProfit: netProfit.toFixed(2),
      netMargin: netMargin.toFixed(2)
    };
  };

  const results = calculateMargins();

  return (
    <div className="p-6 max-w-xl mx-auto bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm">
      <h2 className="text-xl font-medium text-slate-900 dark:text-white mb-6">
        {language === 'he' ? 'מחשבון שולי רווח חברה' : 'Profit Margin Calculator'}
      </h2>

      <div className="grid gap-4 mb-6">
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
            {language === 'he' ? 'הכנסות (Total Revenue)' : 'Total Revenue'}
          </label>
          <input type="number" value={revenue} onChange={(e) => setRevenue(Number(e.target.value))} className="w-full px-3 py-2 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-sm" />
        </div>
        
        <div className="pl-4 border-l-2 border-slate-200 dark:border-slate-700">
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
            {language === 'he' ? 'פחות: עלות המכר (COGS)' : 'Minus: Cost of Goods Sold (COGS)'}
          </label>
          <input type="number" value={cogs} onChange={(e) => setCogs(Number(e.target.value))} className="w-full px-3 py-2 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-sm" />
        </div>

        <div className="pl-4 border-l-2 border-slate-200 dark:border-slate-700">
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
            {language === 'he' ? 'פחות: הוצאות תפעול (OpEx)' : 'Minus: Operating Expenses (OpEx)'}
          </label>
          <input type="number" value={operatingExpenses} onChange={(e) => setOperatingExpenses(Number(e.target.value))} className="w-full px-3 py-2 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-sm" />
        </div>

        <div className="pl-4 border-l-2 border-slate-200 dark:border-slate-700">
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
            {language === 'he' ? 'פחות: מיסים וריבית' : 'Minus: Taxes & Interest'}
          </label>
          <input type="number" value={taxesAndInterest} onChange={(e) => setTaxesAndInterest(Number(e.target.value))} className="w-full px-3 py-2 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-sm" />
        </div>
      </div>

      <div className="space-y-4 pt-4 border-t border-slate-100 dark:border-slate-800 mt-2">
        <div className="flex justify-between items-center p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-100 dark:border-slate-800">
          <div>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              {language === 'he' ? 'רווח גולמי' : 'Gross Profit'}
            </p>
            <div className="text-xl font-bold text-slate-700 dark:text-slate-300">
              ${Number(results.grossProfit).toLocaleString()}
            </div>
          </div>
          <div className="text-right">
            <p className="text-xs text-slate-500">{language === 'he' ? 'שולי רווח גולמי' : 'Gross Margin'}</p>
            <div className="text-lg font-bold text-indigo-600 dark:text-indigo-400">{results.grossMargin}%</div>
          </div>
        </div>

        <div className="flex justify-between items-center p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-100 dark:border-slate-800">
          <div>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              {language === 'he' ? 'רווח תפעולי' : 'Operating Profit'}
            </p>
            <div className="text-xl font-bold text-slate-700 dark:text-slate-300">
              ${Number(results.operatingProfit).toLocaleString()}
            </div>
          </div>
          <div className="text-right">
            <p className="text-xs text-slate-500">{language === 'he' ? 'שולי רווח תפעולי' : 'Operating Margin'}</p>
            <div className="text-lg font-bold text-sky-600 dark:text-sky-400">{results.operatingMargin}%</div>
          </div>
        </div>

        <div className="flex justify-between items-center p-4 bg-emerald-50 dark:bg-emerald-900/10 rounded-lg border border-emerald-100 dark:border-emerald-800/30">
          <div>
            <p className="text-sm text-emerald-800 dark:text-emerald-400">
              {language === 'he' ? 'רווח נקי (Net Profit)' : 'Net Profit'}
            </p>
            <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
              ${Number(results.netProfit).toLocaleString()}
            </div>
          </div>
          <div className="text-right">
            <p className="text-xs text-emerald-700 dark:text-emerald-500">{language === 'he' ? 'שולי רווח נקי' : 'Net Margin'}</p>
            <div className="text-xl font-bold text-emerald-700 dark:text-emerald-400">{results.netMargin}%</div>
          </div>
        </div>
      </div>
    </div>
  );
}
