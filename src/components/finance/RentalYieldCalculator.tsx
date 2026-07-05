import React, { useState } from 'react';
import { useUIStore } from '../../stores/useUIStore';

export default function RentalYieldCalculator() {
  const language = useUIStore(s => s.language);
  const [propertyValue, setPropertyValue] = useState<number>(500000);
  const [monthlyRent, setMonthlyRent] = useState<number>(2500);
  const [annualExpenses, setAnnualExpenses] = useState<number>(5000);

  const calculateYield = () => {
    if (propertyValue <= 0) return { grossYield: 0, netYield: 0, annualRent: 0 };
    
    const annualRent = monthlyRent * 12;
    const grossYield = (annualRent / propertyValue) * 100;
    const netOperatingIncome = annualRent - annualExpenses;
    const netYield = (netOperatingIncome / propertyValue) * 100;

    return {
      annualRent: annualRent.toFixed(2),
      grossYield: grossYield.toFixed(2),
      netYield: netYield.toFixed(2)
    };
  };

  const results = calculateYield();

  return (
    <div className="p-6 max-w-xl mx-auto bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm">
      <h2 className="text-xl font-medium text-slate-900 dark:text-white mb-6">
        {language === 'he' ? 'מחשבון תשואת נדל״ן (Rental Yield)' : 'Rental Yield Calculator'}
      </h2>

      <div className="grid gap-4 mb-6">
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
            {language === 'he' ? 'שווי הנכס / עלות רכישה' : 'Property Value / Purchase Price'}
          </label>
          <input
            type="number"
            value={propertyValue}
            onChange={(e) => setPropertyValue(Number(e.target.value))}
            className="w-full px-3 py-2 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-sm"
          />
        </div>
        
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              {language === 'he' ? 'שכר דירה חודשי משוער' : 'Expected Monthly Rent'}
            </label>
            <input
              type="number"
              value={monthlyRent}
              onChange={(e) => setMonthlyRent(Number(e.target.value))}
              className="w-full px-3 py-2 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              {language === 'he' ? 'הוצאות שנתיות (ניהול, ביטוח, מיסים)' : 'Annual Expenses (Maint, Ins, Taxes)'}
            </label>
            <input
              type="number"
              value={annualExpenses}
              onChange={(e) => setAnnualExpenses(Number(e.target.value))}
              className="w-full px-3 py-2 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-sm"
            />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-y-6 gap-x-4 pt-4 border-t border-slate-100 dark:border-slate-800 mt-2">
        <div>
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-1">
            {language === 'he' ? 'הכנסה שנתית (ברוטו)' : 'Annual Rental Income'}
          </p>
          <div className="text-2xl font-medium text-slate-700 dark:text-slate-300">
            ${results.annualRent}
          </div>
        </div>
        <div>
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-1">
            {language === 'he' ? 'תשואה גולמית (Gross Yield)' : 'Gross Yield'}
          </p>
          <div className="text-2xl font-medium text-emerald-600 dark:text-emerald-400">
            {results.grossYield}%
          </div>
        </div>
        <div>
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-1">
            {language === 'he' ? 'תשואה נקייה (Net Yield)' : 'Net Yield'}
          </p>
          <div className="text-2xl font-bold text-indigo-600 dark:text-indigo-400">
            {results.netYield}%
          </div>
        </div>
      </div>
    </div>
  );
}
