import React, { useState } from 'react';
import { useUIStore } from '../../stores/useUIStore';

export default function YtmCalculator() {
  const language = useUIStore(s => s.language);
  
  const [faceValue, setFaceValue] = useState<number>(1000);
  const [currentPrice, setCurrentPrice] = useState<number>(950);
  const [couponRate, setCouponRate] = useState<number>(5);
  const [yearsToMaturity, setYearsToMaturity] = useState<number>(10);

  const calculateYTM = () => {
    if (currentPrice <= 0 || yearsToMaturity <= 0) return { ytm: 0 };
    
    // Approximate YTM formula
    const annualCoupon = faceValue * (couponRate / 100);
    const approximateYTM = (annualCoupon + ((faceValue - currentPrice) / yearsToMaturity)) / ((faceValue + currentPrice) / 2);
    
    return {
      ytm: (approximateYTM * 100).toFixed(2)
    };
  };

  const results = calculateYTM();

  return (
    <div className="p-6 max-w-xl mx-auto bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm">
      <h2 className="text-xl font-medium text-slate-900 dark:text-white mb-6">
        {language === 'he' ? 'תשואה לפדיון אג״ח (YTM)' : 'Bond Yield to Maturity (YTM)'}
      </h2>
      <p className="text-sm text-slate-500 mb-6">
        {language === 'he' ? 'חישוב מקורב של התשואה השנתית הכוללת של איגרת חוב אם מוחזקת עד לפדיון.' : 'Calculates the approximate total return anticipated on a bond if the bond is held until it matures.'}
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
            {language === 'he' ? 'מחיר נוכחי ($)' : 'Current Price ($)'}
          </label>
          <input type="number" value={currentPrice} onChange={(e) => setCurrentPrice(Number(e.target.value))} className="w-full px-3 py-2 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-sm" />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
            {language === 'he' ? 'שיעור קופון שנתי (%)' : 'Annual Coupon Rate (%)'}
          </label>
          <input type="number" step="0.1" value={couponRate} onChange={(e) => setCouponRate(Number(e.target.value))} className="w-full px-3 py-2 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-sm" />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
            {language === 'he' ? 'שנים לפדיון' : 'Years to Maturity'}
          </label>
          <input type="number" step="0.5" value={yearsToMaturity} onChange={(e) => setYearsToMaturity(Number(e.target.value))} className="w-full px-3 py-2 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-sm" />
        </div>
      </div>

      <div className="pt-6 border-t border-slate-100 dark:border-slate-800">
        <div className="p-4 bg-indigo-50 dark:bg-indigo-900/10 rounded-xl border border-indigo-100 dark:border-indigo-800/30 flex justify-between items-center mt-4">
          <div>
            <p className="text-sm font-medium text-indigo-800 dark:text-indigo-400 mb-1">
              {language === 'he' ? 'YTM (מקורב)' : 'Approximate YTM'}
            </p>
          </div>
          <div className="text-4xl font-bold text-indigo-600 dark:text-indigo-400">
            {results.ytm}%
          </div>
        </div>
      </div>
    </div>
  );
}
