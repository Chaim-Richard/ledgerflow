import React, { useState } from 'react';
import { useUIStore } from '../../stores/useUIStore';

export default function BondPriceCalculator() {
  const language = useUIStore(s => s.language);
  
  const [faceValue, setFaceValue] = useState<number>(1000);
  const [couponRate, setCouponRate] = useState<number>(5); // Annual %
  const [marketYield, setMarketYield] = useState<number>(6); // YTM %
  const [yearsToMaturity, setYearsToMaturity] = useState<number>(10);
  const [paymentsPerYear, setPaymentsPerYear] = useState<number>(2); // 1 = Annual, 2 = Semi-annual

  const calculateBondPrice = () => {
    if (marketYield <= 0 || yearsToMaturity <= 0) return 0;

    const r = (marketYield / 100) / paymentsPerYear; // periodic discount rate
    const n = yearsToMaturity * paymentsPerYear; // total number of periods
    const c = (faceValue * (couponRate / 100)) / paymentsPerYear; // periodic coupon payment

    // Present value of coupon payments (Annuity)
    const pvOfCoupons = c * ((1 - Math.pow(1 + r, -n)) / r);
    
    // Present value of face value (Lump sum)
    const pvOfFaceValue = faceValue / Math.pow(1 + r, n);

    const price = pvOfCoupons + pvOfFaceValue;
    return price;
  };

  const price = calculateBondPrice();
  
  let discountOrPremium = '';
  if (price < faceValue) {
    discountOrPremium = language === 'he' ? 'בניכיון (Discount)' : 'Trading at a Discount';
  } else if (price > faceValue) {
    discountOrPremium = language === 'he' ? 'בפרמיה (Premium)' : 'Trading at a Premium';
  } else {
    discountOrPremium = language === 'he' ? 'בערך הנקוב (Par)' : 'Trading at Par';
  }

  return (
    <div className="p-6 max-w-xl mx-auto bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm">
      <h2 className="text-xl font-medium text-slate-900 dark:text-white mb-6">
        {language === 'he' ? 'תמחור אגרות חוב (Bond Pricing)' : 'Bond Pricing Calculator'}
      </h2>

      <div className="grid gap-4 mb-6">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              {language === 'he' ? 'ערך נקוב (Face Value)' : 'Face Value / Par'}
            </label>
            <input type="number" value={faceValue} onChange={(e) => setFaceValue(Number(e.target.value))} className="w-full px-3 py-2 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-sm" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              {language === 'he' ? 'שנים לפדיון' : 'Years to Maturity'}
            </label>
            <input type="number" value={yearsToMaturity} onChange={(e) => setYearsToMaturity(Number(e.target.value))} className="w-full px-3 py-2 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-sm" />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              {language === 'he' ? 'ריבית קופון שנתית (%)' : 'Annual Coupon Rate (%)'}
            </label>
            <input type="number" step="0.1" value={couponRate} onChange={(e) => setCouponRate(Number(e.target.value))} className="w-full px-3 py-2 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-sm" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              {language === 'he' ? 'תשואת שוק נדרשת (YTM %)' : 'Market Yield (YTM %)'}
            </label>
            <input type="number" step="0.1" value={marketYield} onChange={(e) => setMarketYield(Number(e.target.value))} className="w-full px-3 py-2 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-sm" />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
            {language === 'he' ? 'תדירות תשלום' : 'Payment Frequency'}
          </label>
          <div className="flex space-x-4 space-x-reverse">
            <label className="flex items-center space-x-2 space-x-reverse text-sm">
              <input type="radio" checked={paymentsPerYear === 1} onChange={() => setPaymentsPerYear(1)} className="text-indigo-600" />
              <span>{language === 'he' ? 'פעם בשנה' : 'Annual'}</span>
            </label>
            <label className="flex items-center space-x-2 space-x-reverse text-sm">
              <input type="radio" checked={paymentsPerYear === 2} onChange={() => setPaymentsPerYear(2)} className="text-indigo-600" />
              <span>{language === 'he' ? 'חצי שנתי' : 'Semi-annual'}</span>
            </label>
          </div>
        </div>
      </div>

      <div className="pt-6 border-t border-slate-100 dark:border-slate-800">
        <div className="flex justify-between items-end">
          <div>
            <p className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-1">
              {language === 'he' ? 'מחיר מוערך לאג״ח (Present Value)' : 'Estimated Bond Price'}
            </p>
            <div className="text-4xl font-bold text-slate-900 dark:text-white">
              ${price.toFixed(2)}
            </div>
          </div>
          <div className="text-right pb-1">
            <span className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${price < faceValue ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400' : price > faceValue ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400' : 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300'}`}>
              {discountOrPremium}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
