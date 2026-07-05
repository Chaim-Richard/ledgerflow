import React, { useState } from 'react';
import { useUIStore } from '../../stores/useUIStore';

export default function TipCalculator() {
  const language = useUIStore(s => s.language);
  const [billAmount, setBillAmount] = useState<number>(50);
  const [tipPercent, setTipPercent] = useState<number>(15);
  const [numberOfPeople, setNumberOfPeople] = useState<number>(1);

  const calculateTip = () => {
    if (billAmount <= 0 || tipPercent < 0 || numberOfPeople < 1) return { tipAmount: 0, totalBill: 0, perPerson: 0 };
    
    const tipAmount = billAmount * (tipPercent / 100);
    const totalBill = billAmount + tipAmount;
    const perPerson = totalBill / numberOfPeople;

    return {
      tipAmount: tipAmount.toFixed(2),
      totalBill: totalBill.toFixed(2),
      perPerson: perPerson.toFixed(2)
    };
  };

  const results = calculateTip();

  return (
    <div className="p-6 max-w-xl mx-auto bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm">
      <h2 className="text-xl font-medium text-slate-900 dark:text-white mb-6">
        {language === 'he' ? 'מחשבון טיפ' : 'Tip Calculator'}
      </h2>

      <div className="grid gap-4 mb-6">
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
            {language === 'he' ? 'סכום החשבון' : 'Bill Amount'}
          </label>
          <input
            type="number"
            value={billAmount}
            onChange={(e) => setBillAmount(Number(e.target.value))}
            className="w-full px-3 py-2 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-sm"
          />
        </div>
        
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              {language === 'he' ? 'טיפ (%)' : 'Tip (%)'}
            </label>
            <input
              type="number"
              value={tipPercent}
              onChange={(e) => setTipPercent(Number(e.target.value))}
              className="w-full px-3 py-2 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              {language === 'he' ? 'מספר סועדים' : 'Number of People'}
            </label>
            <input
              type="number"
              value={numberOfPeople}
              onChange={(e) => setNumberOfPeople(Number(e.target.value))}
              className="w-full px-3 py-2 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-sm"
            />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-y-6 gap-x-4 pt-4 border-t border-slate-100 dark:border-slate-800 mt-2">
        <div>
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-1">
            {language === 'he' ? 'סכום הטיפ' : 'Tip Amount'}
          </p>
          <div className="text-2xl font-medium text-slate-700 dark:text-slate-300">
            ${results.tipAmount}
          </div>
        </div>
        <div>
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-1">
            {language === 'he' ? 'סה״כ חשבון' : 'Total Bill'}
          </p>
          <div className="text-2xl font-medium text-indigo-600 dark:text-indigo-400">
            ${results.totalBill}
          </div>
        </div>
        <div>
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-1">
            {language === 'he' ? 'לכל סועד' : 'Per Person'}
          </p>
          <div className="text-2xl font-medium text-emerald-600 dark:text-emerald-400">
            ${results.perPerson}
          </div>
        </div>
      </div>
    </div>
  );
}
