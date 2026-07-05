import React, { useState } from 'react';
import { useUIStore } from '../../stores/useUIStore';

export default function MacaulayDurationCalculator() {
  const language = useUIStore(s => s.language);
  
  const [faceValue, setFaceValue] = useState<number>(1000);
  const [couponRate, setCouponRate] = useState<number>(5);
  const [ytm, setYtm] = useState<number>(6);
  const [yearsToMaturity, setYearsToMaturity] = useState<number>(5);

  const calculateDuration = () => {
    const c = couponRate / 100;
    const y = ytm / 100;
    const t = yearsToMaturity;
    const fv = faceValue;

    if (y <= 0 || t <= 0) return { duration: 0 };

    let pvTotal = 0;
    let weightedTimePv = 0;
    const pmt = fv * c;

    for (let i = 1; i <= t; i++) {
      const cashFlow = i === t ? pmt + fv : pmt;
      const pvCashFlow = cashFlow / Math.pow(1 + y, i);
      pvTotal += pvCashFlow;
      weightedTimePv += i * pvCashFlow;
    }

    const duration = pvTotal > 0 ? weightedTimePv / pvTotal : 0;
    
    return {
      duration: duration.toFixed(2),
      bondPrice: pvTotal.toFixed(2)
    };
  };

  const results = calculateDuration();

  return (
    <div className="p-6 max-w-xl mx-auto bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm">
      <h2 className="text-xl font-medium text-slate-900 dark:text-white mb-6">
        {language === 'he' ? 'משך חיים ממוצע (Macaulay Duration)' : 'Macaulay Duration Calculator'}
      </h2>
      <p className="text-sm text-slate-500 mb-6">
        {language === 'he' ? 'מודד את הזמן הממוצע המשוקלל עד שמשקיע יקבל בחזרה את השקעתו באג״ח.' : 'Calculates the weighted average time until all the bond\'s cash flows are paid.'}
      </p>

      <div className="grid grid-cols-2 gap-4 mb-6">
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
            {language === 'he' ? 'ערך נקוב ($)' : 'Face Value ($)'}
          </label>
          <input type="number" value={faceValue} onChange={(e) => setFaceValue(Number(e.target.value))} className="w-full px-3 py-2 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-sm" />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
            {language === 'he' ? 'שיעור קופון (%)' : 'Coupon Rate (%)'}
          </label>
          <input type="number" step="0.1" value={couponRate} onChange={(e) => setCouponRate(Number(e.target.value))} className="w-full px-3 py-2 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-sm" />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
            {language === 'he' ? 'תשואה לפדיון (YTM %)' : 'Yield to Maturity (%)'}
          </label>
          <input type="number" step="0.1" value={ytm} onChange={(e) => setYtm(Number(e.target.value))} className="w-full px-3 py-2 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-sm" />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
            {language === 'he' ? 'שנים לפדיון (שלמות)' : 'Years to Maturity'}
          </label>
          <input type="number" step="1" value={yearsToMaturity} onChange={(e) => setYearsToMaturity(Number(e.target.value))} className="w-full px-3 py-2 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-sm" />
        </div>
      </div>

      <div className="pt-6 border-t border-slate-100 dark:border-slate-800 space-y-4">
        <div className="flex justify-between items-center text-sm text-slate-600 dark:text-slate-400 px-2">
          <span>{language === 'he' ? 'מחיר אג״ח מחושב (PV):' : 'Calculated Bond Price (PV):'}</span>
          <span className="font-medium">${Number(results.bondPrice).toLocaleString()}</span>
        </div>
        
        <div className="p-4 bg-emerald-50 dark:bg-emerald-900/10 rounded-xl border border-emerald-100 dark:border-emerald-800/30 flex justify-between items-center mt-4">
          <div>
            <p className="text-sm font-medium text-emerald-800 dark:text-emerald-400 mb-1">
              {language === 'he' ? 'Macaulay Duration' : 'Macaulay Duration'}
            </p>
          </div>
          <div className="text-4xl font-bold text-emerald-600 dark:text-emerald-400">
            {results.duration} {language === 'he' ? 'שנים' : 'Yrs'}
          </div>
        </div>
      </div>
    </div>
  );
}
