import React, { useState } from 'react';
import { useUIStore } from '../../stores/useUIStore';

export default function WaccCalculator() {
  const language = useUIStore(s => s.language);
  
  const [equity, setEquity] = useState<number>(60000);
  const [debt, setDebt] = useState<number>(40000);
  const [costOfEquity, setCostOfEquity] = useState<number>(10);
  const [costOfDebt, setCostOfDebt] = useState<number>(5);
  const [taxRate, setTaxRate] = useState<number>(25);

  const calculateWACC = () => {
    const totalValue = equity + debt;
    if (totalValue === 0) return { wacc: 0 };
    
    const weightOfEquity = equity / totalValue;
    const weightOfDebt = debt / totalValue;
    
    const wacc = (weightOfEquity * (costOfEquity / 100)) + (weightOfDebt * (costOfDebt / 100) * (1 - (taxRate / 100)));
    
    return {
      wacc: (wacc * 100).toFixed(2),
      weightEquity: (weightOfEquity * 100).toFixed(1),
      weightDebt: (weightOfDebt * 100).toFixed(1)
    };
  };

  const results = calculateWACC();

  return (
    <div className="p-6 max-w-xl mx-auto bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm">
      <h2 className="text-xl font-medium text-slate-900 dark:text-white mb-6">
        {language === 'he' ? 'עלות הון ממוצעת משוקללת (WACC)' : 'Weighted Average Cost of Capital (WACC)'}
      </h2>
      <p className="text-sm text-slate-500 mb-6">
        {language === 'he' ? 'שיעור התשואה הממוצע שחברה צריכה לשלם לכל המשקיעים שלה (הון וחוב).' : 'The rate that a company is expected to pay on average to all its security holders to finance its assets.'}
      </p>

      <div className="grid grid-cols-2 gap-4 mb-6">
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
            {language === 'he' ? 'שווי הון עצמי ($)' : 'Market Value of Equity ($)'}
          </label>
          <input type="number" value={equity} onChange={(e) => setEquity(Number(e.target.value))} className="w-full px-3 py-2 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-sm" />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
            {language === 'he' ? 'שווי חוב ($)' : 'Market Value of Debt ($)'}
          </label>
          <input type="number" value={debt} onChange={(e) => setDebt(Number(e.target.value))} className="w-full px-3 py-2 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-sm" />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
            {language === 'he' ? 'עלות הון עצמי (%)' : 'Cost of Equity (%)'}
          </label>
          <input type="number" step="0.1" value={costOfEquity} onChange={(e) => setCostOfEquity(Number(e.target.value))} className="w-full px-3 py-2 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-sm" />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
            {language === 'he' ? 'עלות חוב (%)' : 'Cost of Debt (%)'}
          </label>
          <input type="number" step="0.1" value={costOfDebt} onChange={(e) => setCostOfDebt(Number(e.target.value))} className="w-full px-3 py-2 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-sm" />
        </div>
        <div className="col-span-2">
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
            {language === 'he' ? 'שיעור מס חברות (%)' : 'Corporate Tax Rate (%)'}
          </label>
          <input type="number" step="1" value={taxRate} onChange={(e) => setTaxRate(Number(e.target.value))} className="w-full px-3 py-2 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-sm" />
        </div>
      </div>

      <div className="pt-6 border-t border-slate-100 dark:border-slate-800 space-y-4">
        <div className="flex justify-between items-center text-sm text-slate-600 dark:text-slate-400 px-2">
          <span>{language === 'he' ? 'משקל הון / משקל חוב:' : 'Equity Weight / Debt Weight:'}</span>
          <span className="font-medium">{results.weightEquity}% / {results.weightDebt}%</span>
        </div>
        
        <div className="p-4 bg-indigo-50 dark:bg-indigo-900/10 rounded-xl border border-indigo-100 dark:border-indigo-800/30 flex justify-between items-center mt-4">
          <div>
            <p className="text-sm font-medium text-indigo-800 dark:text-indigo-400 mb-1">
              {language === 'he' ? 'WACC' : 'WACC'}
            </p>
          </div>
          <div className="text-4xl font-bold text-indigo-600 dark:text-indigo-400">
            {results.wacc}%
          </div>
        </div>
      </div>
    </div>
  );
}
