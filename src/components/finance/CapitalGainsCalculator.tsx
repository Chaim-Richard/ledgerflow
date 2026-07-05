import React, { useState } from 'react';
import { useUIStore } from '../../stores/useUIStore';

export default function CapitalGainsCalculator() {
  const language = useUIStore(s => s.language);
  const [purchasePrice, setPurchasePrice] = useState<number>(10000);
  const [salePrice, setSalePrice] = useState<number>(15000);
  const [taxRate, setTaxRate] = useState<number>(25); // e.g. 25% in Israel for standard capital gains
  const [expenses, setExpenses] = useState<number>(100);

  const calculateGains = () => {
    const costBasis = purchasePrice + expenses;
    const profit = salePrice - costBasis;
    const taxAmount = profit > 0 ? profit * (taxRate / 100) : 0;
    const netProfit = profit - taxAmount;
    
    return {
      profit: profit.toFixed(2),
      taxAmount: taxAmount.toFixed(2),
      netProfit: netProfit.toFixed(2)
    };
  };

  const results = calculateGains();

  return (
    <div className="p-6 max-w-xl mx-auto bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm">
      <h2 className="text-xl font-medium text-slate-900 dark:text-white mb-6">
        {language === 'he' ? 'מחשבון מס רווחי הון' : 'Capital Gains Tax Calculator'}
      </h2>

      <div className="grid gap-4 mb-6">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              {language === 'he' ? 'מחיר קנייה / השקעה' : 'Purchase Price / Investment'}
            </label>
            <input type="number" value={purchasePrice} onChange={(e) => setPurchasePrice(Number(e.target.value))} className="w-full px-3 py-2 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-sm" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              {language === 'he' ? 'מחיר מכירה' : 'Sale Price'}
            </label>
            <input type="number" value={salePrice} onChange={(e) => setSalePrice(Number(e.target.value))} className="w-full px-3 py-2 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-sm" />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              {language === 'he' ? 'הוצאות קנייה ומכירה' : 'Buy/Sell Expenses & Fees'}
            </label>
            <input type="number" value={expenses} onChange={(e) => setExpenses(Number(e.target.value))} className="w-full px-3 py-2 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-sm" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              {language === 'he' ? 'שיעור מס (%)' : 'Tax Rate (%)'}
            </label>
            <input type="number" value={taxRate} onChange={(e) => setTaxRate(Number(e.target.value))} className="w-full px-3 py-2 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-sm" />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-y-6 gap-x-4 pt-4 border-t border-slate-100 dark:border-slate-800 mt-2">
        <div>
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-1">
            {language === 'he' ? 'רווח ברוטו' : 'Gross Profit'}
          </p>
          <div className="text-2xl font-medium text-slate-700 dark:text-slate-300">
            ${Number(results.profit).toLocaleString()}
          </div>
        </div>
        <div>
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-1">
            {language === 'he' ? 'מס לתשלום' : 'Tax Amount'}
          </p>
          <div className="text-2xl font-medium text-rose-600 dark:text-rose-400">
            ${Number(results.taxAmount).toLocaleString()}
          </div>
        </div>
        <div>
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-1">
            {language === 'he' ? 'רווח נטו' : 'Net Profit'}
          </p>
          <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
            ${Number(results.netProfit).toLocaleString()}
          </div>
        </div>
      </div>
    </div>
  );
}
