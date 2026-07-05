import React, { useState } from 'react';
import { useUIStore } from '../../stores/useUIStore';

export default function CacCalculator() {
  const language = useUIStore(s => s.language);
  const [salesExpense, setSalesExpense] = useState<number>(50000);
  const [marketingExpense, setMarketingExpense] = useState<number>(30000);
  const [newCustomers, setNewCustomers] = useState<number>(500);

  const calculateCac = () => {
    if (newCustomers <= 0) return 0;
    const cac = (salesExpense + marketingExpense) / newCustomers;
    return cac.toFixed(2);
  };

  return (
    <div className="p-6 max-w-xl mx-auto bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm">
      <h2 className="text-xl font-medium text-slate-900 dark:text-white mb-6">
        {language === 'he' ? 'מחשבון עלות רכישת לקוח (CAC)' : 'Customer Acquisition Cost (CAC) Calculator'}
      </h2>

      <div className="grid gap-4 mb-6">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              {language === 'he' ? 'הוצאות מכירה' : 'Sales Expense'}
            </label>
            <input
              type="number"
              value={salesExpense}
              onChange={(e) => setSalesExpense(Number(e.target.value))}
              className="w-full px-3 py-2 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              {language === 'he' ? 'הוצאות שיווק' : 'Marketing Expense'}
            </label>
            <input
              type="number"
              value={marketingExpense}
              onChange={(e) => setMarketingExpense(Number(e.target.value))}
              className="w-full px-3 py-2 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-sm"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
            {language === 'he' ? 'לקוחות חדשים שנרכשו' : 'New Customers Acquired'}
          </label>
          <input
            type="number"
            value={newCustomers}
            onChange={(e) => setNewCustomers(Number(e.target.value))}
            className="w-full px-3 py-2 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-sm"
          />
        </div>
      </div>

      <div className="pt-4 border-t border-slate-100 dark:border-slate-800 mt-2">
        <p className="text-sm text-slate-500 dark:text-slate-400 mb-1">
          {language === 'he' ? 'עלות רכישת לקוח (CAC)' : 'Customer Acquisition Cost (CAC)'}
        </p>
        <div className="text-3xl font-medium text-indigo-600 dark:text-indigo-400">
          ${calculateCac()}
        </div>
      </div>
    </div>
  );
}
