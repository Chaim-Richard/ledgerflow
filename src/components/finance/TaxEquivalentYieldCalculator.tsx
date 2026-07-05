import React, { useState } from 'react';
import { useUIStore } from '../../stores/useUIStore';

export default function TaxEquivalentYieldCalculator() {
  const language = useUIStore(s => s.language);
  
  const [taxFreeYield, setTaxFreeYield] = useState<number>(3.5);
  const [marginalTaxRate, setMarginalTaxRate] = useState<number>(32); // e.g. 32% Federal tax bracket
  const [stateTaxRate, setStateTaxRate] = useState<number>(5); // e.g. 5% state tax

  const calculateYield = () => {
    // Total tax rate (simplified additive, assumes state is also exempt)
    // Note: Actual calculation might need (Fed + State) or (Fed + State * (1 - Fed)) depending on deductibility,
    // we use simple additive here for the basic educational calculator.
    const totalTaxRate = (marginalTaxRate + stateTaxRate) / 100;
    
    // Check to avoid division by zero or negative
    if (totalTaxRate >= 1) return { taxEquivalent: 0, multiplier: 0 };
    
    const equivalentYield = taxFreeYield / (1 - totalTaxRate);
    
    return {
      taxEquivalent: equivalentYield.toFixed(2),
      multiplier: (1 / (1 - totalTaxRate)).toFixed(2)
    };
  };

  const results = calculateYield();

  return (
    <div className="p-6 max-w-xl mx-auto bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm">
      <h2 className="text-xl font-medium text-slate-900 dark:text-white mb-6">
        {language === 'he' ? 'תשואה שקולת-מס (Tax-Equivalent Yield)' : 'Tax-Equivalent Yield Calculator'}
      </h2>
      <p className="text-sm text-slate-500 mb-6">
        {language === 'he' ? 'משווה תשואה של אגרות חוב פטורות ממס (כמו אג״ח מוניציפלי) לאגרות חוב חייבות במס, כדי לראות מה משתלם יותר לפי מדרגת המס שלך.' : 'Compares the yield of a tax-exempt municipal bond to a taxable corporate bond to see which gives you a better after-tax return.'}
      </p>

      <div className="grid gap-4 mb-6">
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
            {language === 'he' ? 'תשואת אג״ח פטור ממס (%)' : 'Tax-Free Bond Yield (%)'}
          </label>
          <input type="number" step="0.1" value={taxFreeYield} onChange={(e) => setTaxFreeYield(Number(e.target.value))} className="w-full px-3 py-2 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-sm" />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              {language === 'he' ? 'מדרגת מס פדרלי / מס הכנסה (%)' : 'Federal Marginal Tax Rate (%)'}
            </label>
            <input type="number" step="0.1" value={marginalTaxRate} onChange={(e) => setMarginalTaxRate(Number(e.target.value))} className="w-full px-3 py-2 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-sm" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              {language === 'he' ? 'מס מדינה / מס נוסף (%)' : 'State Tax Rate (%)'}
            </label>
            <input type="number" step="0.1" value={stateTaxRate} onChange={(e) => setStateTaxRate(Number(e.target.value))} className="w-full px-3 py-2 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-sm" />
          </div>
        </div>
      </div>

      <div className="p-6 bg-indigo-50 dark:bg-indigo-900/10 rounded-xl border border-indigo-100 dark:border-indigo-800 text-center mt-2">
        <p className="text-sm font-medium text-indigo-800 dark:text-indigo-400 mb-2">
          {language === 'he' ? 'תשואה נדרשת מאג״ח חייב במס (Tax-Equivalent Yield)' : 'Taxable Bond Yield Required to Match'}
        </p>
        <div className="text-4xl font-bold text-indigo-600 dark:text-indigo-400 mb-4 flex justify-center items-baseline space-x-1">
          <span>{results.taxEquivalent}</span>
          <span className="text-2xl font-medium text-indigo-400 dark:text-indigo-500">%</span>
        </div>
        
        <p className="text-sm text-indigo-700 dark:text-indigo-400/80">
          {language === 'he' 
            ? `כדי להשוות לתשואה של הפטור ממס, תצטרך למצוא אג״ח רגיל שנותן לפחות ${results.taxEquivalent}%.` 
            : `To get the same after-tax return as this tax-free bond, a taxable bond must yield at least ${results.taxEquivalent}%.`}
        </p>
      </div>
    </div>
  );
}
