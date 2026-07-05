import React, { useState } from 'react';
import { useUIStore } from '../../stores/useUIStore';

export default function VatCalculator() {
  const language = useUIStore(s => s.language);
  const [amount, setAmount] = useState<number>(100);
  const [vatRate, setVatRate] = useState<number>(17); // Israel default
  const [calculationMode, setCalculationMode] = useState<'add' | 'extract'>('add');

  const calculateVat = () => {
    if (amount <= 0 || vatRate < 0) return { netAmount: 0, vatAmount: 0, grossAmount: 0 };
    
    let netAmount = 0;
    let vatAmount = 0;
    let grossAmount = 0;

    if (calculationMode === 'add') {
      // Amount is NET, we want to add VAT
      netAmount = amount;
      vatAmount = amount * (vatRate / 100);
      grossAmount = netAmount + vatAmount;
    } else {
      // Amount is GROSS, we want to extract VAT
      grossAmount = amount;
      netAmount = amount / (1 + (vatRate / 100));
      vatAmount = grossAmount - netAmount;
    }

    return {
      netAmount: netAmount.toFixed(2),
      vatAmount: vatAmount.toFixed(2),
      grossAmount: grossAmount.toFixed(2)
    };
  };

  const results = calculateVat();

  return (
    <div className="p-6 max-w-xl mx-auto bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm">
      <h2 className="text-xl font-medium text-slate-900 dark:text-white mb-6">
        {language === 'he' ? 'מחשבון מע״מ / מס קנייה' : 'VAT / Sales Tax Calculator'}
      </h2>

      <div className="grid gap-4 mb-6">
        <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-lg">
          <button
            onClick={() => setCalculationMode('add')}
            className={`flex-1 py-1.5 text-sm font-medium rounded-md transition-colors ${calculationMode === 'add' ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
          >
            {language === 'he' ? 'הוספת מע״מ (סכום נטו)' : 'Add Tax (Net Amount)'}
          </button>
          <button
            onClick={() => setCalculationMode('extract')}
            className={`flex-1 py-1.5 text-sm font-medium rounded-md transition-colors ${calculationMode === 'extract' ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
          >
            {language === 'he' ? 'חילוץ מע״מ (סכום ברוטו)' : 'Extract Tax (Gross Amount)'}
          </button>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              {language === 'he' ? 'סכום' : 'Amount'}
            </label>
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(Number(e.target.value))}
              className="w-full px-3 py-2 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              {language === 'he' ? 'שיעור מס (%)' : 'Tax Rate (%)'}
            </label>
            <input
              type="number"
              value={vatRate}
              onChange={(e) => setVatRate(Number(e.target.value))}
              className="w-full px-3 py-2 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-sm"
            />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-y-6 gap-x-4 pt-4 border-t border-slate-100 dark:border-slate-800 mt-2">
        <div>
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-1">
            {language === 'he' ? 'סכום לפני מע״מ (נטו)' : 'Net Amount'}
          </p>
          <div className="text-2xl font-medium text-slate-700 dark:text-slate-300">
            ${results.netAmount}
          </div>
        </div>
        <div>
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-1">
            {language === 'he' ? 'סכום המס (מע״מ)' : 'Tax Amount'}
          </p>
          <div className="text-2xl font-medium text-rose-600 dark:text-rose-400">
            ${results.vatAmount}
          </div>
        </div>
        <div>
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-1">
            {language === 'he' ? 'סכום כולל (ברוטו)' : 'Gross Amount'}
          </p>
          <div className="text-2xl font-medium text-indigo-600 dark:text-indigo-400">
            ${results.grossAmount}
          </div>
        </div>
      </div>
    </div>
  );
}
