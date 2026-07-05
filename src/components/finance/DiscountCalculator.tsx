import React, { useState } from 'react';
import { useUIStore } from '../../stores/useUIStore';

export default function DiscountCalculator() {
  const language = useUIStore(s => s.language);
  const [originalPrice, setOriginalPrice] = useState<number>(100);
  const [discountPercent, setDiscountPercent] = useState<number>(20);

  const calculateDiscount = () => {
    if (originalPrice <= 0 || discountPercent < 0) return { finalPrice: 0, amountSaved: 0 };
    
    const amountSaved = originalPrice * (discountPercent / 100);
    const finalPrice = originalPrice - amountSaved;

    return {
      finalPrice: finalPrice.toFixed(2),
      amountSaved: amountSaved.toFixed(2)
    };
  };

  const results = calculateDiscount();

  return (
    <div className="p-6 max-w-xl mx-auto bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm">
      <h2 className="text-xl font-medium text-slate-900 dark:text-white mb-6">
        {language === 'he' ? 'מחשבון הנחה' : 'Discount Calculator'}
      </h2>

      <div className="grid gap-4 mb-6">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              {language === 'he' ? 'מחיר מקורי' : 'Original Price'}
            </label>
            <input
              type="number"
              value={originalPrice}
              onChange={(e) => setOriginalPrice(Number(e.target.value))}
              className="w-full px-3 py-2 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              {language === 'he' ? 'הנחה (%)' : 'Discount (%)'}
            </label>
            <input
              type="number"
              value={discountPercent}
              onChange={(e) => setDiscountPercent(Number(e.target.value))}
              className="w-full px-3 py-2 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-sm"
            />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-y-6 gap-x-4 pt-4 border-t border-slate-100 dark:border-slate-800 mt-2">
        <div>
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-1">
            {language === 'he' ? 'מחיר סופי' : 'Final Price'}
          </p>
          <div className="text-3xl font-medium text-indigo-600 dark:text-indigo-400">
            ${results.finalPrice}
          </div>
        </div>
        <div>
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-1">
            {language === 'he' ? 'נחסך' : 'Amount Saved'}
          </p>
          <div className="text-3xl font-medium text-emerald-600 dark:text-emerald-400">
            ${results.amountSaved}
          </div>
        </div>
      </div>
    </div>
  );
}
