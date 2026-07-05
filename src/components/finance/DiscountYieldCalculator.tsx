import React, { useState } from 'react';
import { useUIStore } from '../../stores/useUIStore';

export default function DiscountYieldCalculator() {
  const language = useUIStore(s => s.language);
  
  const [faceValue, setFaceValue] = useState<number>(10000);
  const [purchasePrice, setPurchasePrice] = useState<number>(9800);
  const [daysToMaturity, setDaysToMaturity] = useState<number>(90);

  const calculateYield = () => {
    if (faceValue <= 0 || daysToMaturity <= 0) return { discountYield: 0, investmentYield: 0 };
    
    // Discount Yield (using 360 days)
    const discount = faceValue - purchasePrice;
    const discountYield = (discount / faceValue) * (360 / daysToMaturity) * 100;
    
    // Investment Yield (using 365 days)
    const investmentYield = (discount / purchasePrice) * (365 / daysToMaturity) * 100;
    
    return {
      discountYield: discountYield.toFixed(2),
      investmentYield: investmentYield.toFixed(2)
    };
  };

  const results = calculateYield();

  return (
    <div className="p-6 max-w-xl mx-auto bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm">
      <h2 className="text-xl font-medium text-slate-900 dark:text-white mb-6">
        {language === 'he' ? 'תשואת ניכיון (T-Bill)' : 'Discount Yield Calculator'}
      </h2>
      <p className="text-sm text-slate-500 mb-6">
        {language === 'he' ? 'מחשב את התשואה לאג"ח קצר מועד (כמו מק"מ) שנמכר בניכיון.' : 'Calculates the yield on a discount security, such as a Treasury bill, sold at a discount to its face value.'}
      </p>

      <div className="grid grid-cols-2 gap-4 mb-6">
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
            {language === 'he' ? 'ערך נקוב פדיון ($)' : 'Face Value ($)'}
          </label>
          <input type="number" value={faceValue} onChange={(e) => setFaceValue(Number(e.target.value))} className="w-full px-3 py-2 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-sm" />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
            {language === 'he' ? 'מחיר רכישה ($)' : 'Purchase Price ($)'}
          </label>
          <input type="number" value={purchasePrice} onChange={(e) => setPurchasePrice(Number(e.target.value))} className="w-full px-3 py-2 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-sm" />
        </div>
        <div className="col-span-2">
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
            {language === 'he' ? 'ימים עד לפדיון' : 'Days to Maturity'}
          </label>
          <input type="number" step="1" value={daysToMaturity} onChange={(e) => setDaysToMaturity(Number(e.target.value))} className="w-full px-3 py-2 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-sm" />
        </div>
      </div>

      <div className="pt-6 border-t border-slate-100 dark:border-slate-800 space-y-4">
        <div className="flex justify-between items-center text-sm text-slate-600 dark:text-slate-400 px-2">
          <span>{language === 'he' ? 'תשואת השקעה אמיתית (365 יום):' : 'True Investment Yield (365d):'}</span>
          <span className="font-medium">{results.investmentYield}%</span>
        </div>
        
        <div className="p-4 bg-emerald-50 dark:bg-emerald-900/10 rounded-xl border border-emerald-100 dark:border-emerald-800/30 flex justify-between items-center mt-4">
          <div>
            <p className="text-sm font-medium text-emerald-800 dark:text-emerald-400 mb-1">
              {language === 'he' ? 'תשואת ניכיון מנורמלת' : 'Bank Discount Yield'}
            </p>
          </div>
          <div className="text-4xl font-bold text-emerald-600 dark:text-emerald-400">
            {results.discountYield}%
          </div>
        </div>
      </div>
    </div>
  );
}
