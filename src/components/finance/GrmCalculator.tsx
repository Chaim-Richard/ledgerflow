import React, { useState } from 'react';
import { useUIStore } from '../../stores/useUIStore';

export default function GrmCalculator() {
  const language = useUIStore(s => s.language);
  
  const [propertyPrice, setPropertyPrice] = useState<number>(500000);
  const [grossAnnualRent, setGrossAnnualRent] = useState<number>(50000);

  const calculateGRM = () => {
    if (grossAnnualRent <= 0) return { grm: 0 };
    const grm = propertyPrice / grossAnnualRent;
    
    return {
      grm: grm.toFixed(2)
    };
  };

  const results = calculateGRM();

  return (
    <div className="p-6 max-w-xl mx-auto bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm">
      <h2 className="text-xl font-medium text-slate-900 dark:text-white mb-6">
        {language === 'he' ? 'מכפיל שכירות גולמי (GRM)' : 'Gross Rent Multiplier (GRM)'}
      </h2>
      <p className="text-sm text-slate-500 mb-6">
        {language === 'he' ? 'כלי בסיסי להערכת שווי נדל"ן המחשב פי כמה שווה הנכס מההכנסה השנתית השנתית הגולמית.' : 'A basic real estate valuation tool calculating how many times the annual gross rent the property price is.'}
      </p>

      <div className="grid grid-cols-2 gap-4 mb-6">
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
            {language === 'he' ? 'מחיר / שווי הנכס ($)' : 'Property Price / Value ($)'}
          </label>
          <input type="number" value={propertyPrice} onChange={(e) => setPropertyPrice(Number(e.target.value))} className="w-full px-3 py-2 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-sm" />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
            {language === 'he' ? 'שכר דירה שנתי גולמי ($)' : 'Gross Annual Rent ($)'}
          </label>
          <input type="number" value={grossAnnualRent} onChange={(e) => setGrossAnnualRent(Number(e.target.value))} className="w-full px-3 py-2 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-sm" />
        </div>
      </div>

      <div className="pt-6 border-t border-slate-100 dark:border-slate-800">
        <div className="p-4 bg-emerald-50 dark:bg-emerald-900/10 rounded-xl border border-emerald-100 dark:border-emerald-800/30 flex justify-between items-center mt-4">
          <div>
            <p className="text-sm font-medium text-emerald-800 dark:text-emerald-400 mb-1">
              {language === 'he' ? 'GRM' : 'GRM'}
            </p>
            <p className="text-xs opacity-80">{language === 'he' ? 'שנות שכירות לכיסוי הנכס' : 'Years of rent to pay for property'}</p>
          </div>
          <div className="text-4xl font-bold text-emerald-600 dark:text-emerald-400">
            {results.grm}
          </div>
        </div>
      </div>
    </div>
  );
}
