import React, { useState } from 'react';
import { useUIStore } from '../../stores/useUIStore';

export default function ApyCalculator() {
  const language = useUIStore(s => s.language);
  const [nominalRate, setNominalRate] = useState<number>(5);
  const [compoundingFrequency, setCompoundingFrequency] = useState<number>(12); // monthly

  const calculateApy = () => {
    if (compoundingFrequency <= 0) return 0;
    const rate = nominalRate / 100;
    const apy = Math.pow(1 + rate / compoundingFrequency, compoundingFrequency) - 1;
    return (apy * 100).toFixed(2);
  };

  return (
    <div className="p-6 max-w-xl mx-auto bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm">
      <h2 className="text-xl font-medium text-slate-900 dark:text-white mb-6">
        {language === 'he' ? 'מחשבון תשואה שנתית (APY)' : 'APY Calculator (Annual Percentage Yield)'}
      </h2>

      <div className="grid gap-4 mb-6">
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
            {language === 'he' ? 'ריבית נומינלית (%)' : 'Nominal Interest Rate (%)'}
          </label>
          <input
            type="number"
            value={nominalRate}
            onChange={(e) => setNominalRate(Number(e.target.value))}
            className="w-full px-3 py-2 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-sm"
          />
        </div>
        
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
            {language === 'he' ? 'תדירות חישוב ריבית (פעמים בשנה)' : 'Compounding Frequency (Per Year)'}
          </label>
          <select
            value={compoundingFrequency}
            onChange={(e) => setCompoundingFrequency(Number(e.target.value))}
            className="w-full px-3 py-2 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-sm"
          >
            <option value={1}>{language === 'he' ? 'שנתי (1)' : 'Annually (1)'}</option>
            <option value={2}>{language === 'he' ? 'חצי-שנתי (2)' : 'Semi-Annually (2)'}</option>
            <option value={4}>{language === 'he' ? 'רבעוני (4)' : 'Quarterly (4)'}</option>
            <option value={12}>{language === 'he' ? 'חודשי (12)' : 'Monthly (12)'}</option>
            <option value={365}>{language === 'he' ? 'יומי (365)' : 'Daily (365)'}</option>
          </select>
        </div>
      </div>

      <div className="pt-4 border-t border-slate-100 dark:border-slate-800 mt-2">
        <p className="text-sm text-slate-500 dark:text-slate-400 mb-1">
          {language === 'he' ? 'תשואה שנתית אפקטיבית (APY)' : 'Annual Percentage Yield (APY)'}
        </p>
        <div className="text-3xl font-medium text-indigo-600 dark:text-indigo-400">
          {calculateApy()}%
        </div>
      </div>
    </div>
  );
}
