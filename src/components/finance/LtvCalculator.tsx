import React, { useState } from 'react';
import { useUIStore } from '../../stores/useUIStore';

export default function LtvCalculator() {
  const language = useUIStore(s => s.language);
  
  const [loanAmount, setLoanAmount] = useState<number>(400000);
  const [propertyValue, setPropertyValue] = useState<number>(500000);

  const calculateLTV = () => {
    if (propertyValue <= 0) return { ltv: 0, status: '' };
    const ltv = (loanAmount / propertyValue) * 100;
    
    let status = '';
    if (ltv <= 80) status = language === 'he' ? 'סיכון נמוך/רגיל' : 'Standard / Low Risk (≤ 80%)';
    else if (ltv < 100) status = language === 'he' ? 'סיכון גבוה (דורש ביטוח משכנתא PMI)' : 'High Risk (May require PMI)';
    else status = language === 'he' ? 'נכס בגרעון (Underwater)' : 'Underwater (> 100%)';

    return {
      ltv: ltv.toFixed(2),
      status
    };
  };

  const results = calculateLTV();

  return (
    <div className="p-6 max-w-xl mx-auto bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm">
      <h2 className="text-xl font-medium text-slate-900 dark:text-white mb-6">
        {language === 'he' ? 'יחס הלוואה לשווי (LTV)' : 'Loan-to-Value (LTV) Ratio'}
      </h2>
      <p className="text-sm text-slate-500 mb-6">
        {language === 'he' ? 'הערכת סיכון הלוואות המושוות את סכום ההלוואה לשווי הנכס המוערך. משמש נפוץ במשכנתאות.' : 'An assessment of lending risk that financial institutions use before approving a mortgage.'}
      </p>

      <div className="grid grid-cols-2 gap-4 mb-6">
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
            {language === 'he' ? 'סכום הלוואה ($)' : 'Loan Amount ($)'}
          </label>
          <input type="number" value={loanAmount} onChange={(e) => setLoanAmount(Number(e.target.value))} className="w-full px-3 py-2 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-sm" />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
            {language === 'he' ? 'שווי נכס ($)' : 'Property Value ($)'}
          </label>
          <input type="number" value={propertyValue} onChange={(e) => setPropertyValue(Number(e.target.value))} className="w-full px-3 py-2 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-sm" />
        </div>
      </div>

      <div className="pt-6 border-t border-slate-100 dark:border-slate-800 space-y-4">
        <div className="flex justify-between items-center text-sm text-slate-600 dark:text-slate-400 px-2">
          <span>{language === 'he' ? 'הון עצמי (Equity):' : 'Down Payment / Equity:'}</span>
          <span className="font-medium">${Number(propertyValue - loanAmount).toLocaleString()}</span>
        </div>
        
        <div className={`p-4 rounded-xl border flex justify-between items-center mt-4 ${Number(results.ltv) <= 80 ? 'bg-emerald-50 dark:bg-emerald-900/10 border-emerald-100 dark:border-emerald-800/30' : Number(results.ltv) < 100 ? 'bg-amber-50 dark:bg-amber-900/10 border-amber-100 dark:border-amber-800/30' : 'bg-rose-50 dark:bg-rose-900/10 border-rose-100 dark:border-rose-800/30'}`}>
          <div>
            <p className={`text-sm font-medium mb-1 ${Number(results.ltv) <= 80 ? 'text-emerald-800 dark:text-emerald-400' : Number(results.ltv) < 100 ? 'text-amber-800 dark:text-amber-400' : 'text-rose-800 dark:text-rose-400'}`}>
              {language === 'he' ? 'יחס LTV' : 'LTV Ratio'}
            </p>
            <p className="text-xs opacity-80">{results.status}</p>
          </div>
          <div className={`text-4xl font-bold ${Number(results.ltv) <= 80 ? 'text-emerald-600 dark:text-emerald-400' : Number(results.ltv) < 100 ? 'text-amber-600 dark:text-amber-400' : 'text-rose-600 dark:text-rose-400'}`}>
            {results.ltv}%
          </div>
        </div>
      </div>
    </div>
  );
}
