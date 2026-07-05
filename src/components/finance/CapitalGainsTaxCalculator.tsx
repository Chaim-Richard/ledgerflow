import React, { useState } from 'react';
import { useUIStore } from '../../stores/useUIStore';

export default function CapitalGainsTaxCalculator() {
  const language = useUIStore(s => s.language);
  
  const [purchasePrice, setPurchasePrice] = useState<number>(10000);
  const [salePrice, setSalePrice] = useState<number>(15000);
  const [taxRate, setTaxRate] = useState<number>(25); // Default 25% for Israel usually

  const calculateTax = () => {
    const gain = salePrice - purchasePrice;
    if (gain <= 0) return { gain: gain.toFixed(2), tax: 0, netProceeds: salePrice.toFixed(2) };
    
    const tax = gain * (taxRate / 100);
    const netProceeds = salePrice - tax;
    
    return {
      gain: gain.toFixed(2),
      tax: tax.toFixed(2),
      netProceeds: netProceeds.toFixed(2)
    };
  };

  const results = calculateTax();

  return (
    <div className="p-6 max-w-xl mx-auto bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm">
      <h2 className="text-xl font-medium text-slate-900 dark:text-white mb-6">
        {language === 'he' ? 'מס רווחי הון' : 'Capital Gains Tax Calculator'}
      </h2>
      <p className="text-sm text-slate-500 mb-6">
        {language === 'he' ? 'מחשב את המס לתשלום על רווח ממכירת נכס/מניות ואת התמורה נטו.' : 'Calculates the tax owed on the profit from selling an asset, and the net proceeds.'}
      </p>

      <div className="grid grid-cols-2 gap-4 mb-6">
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
            {language === 'he' ? 'עלות רכישה ($)' : 'Purchase Price ($)'}
          </label>
          <input type="number" value={purchasePrice} onChange={(e) => setPurchasePrice(Number(e.target.value))} className="w-full px-3 py-2 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-sm" />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
            {language === 'he' ? 'תמורת המכירה ($)' : 'Sale Price ($)'}
          </label>
          <input type="number" value={salePrice} onChange={(e) => setSalePrice(Number(e.target.value))} className="w-full px-3 py-2 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-sm" />
        </div>
        <div className="col-span-2">
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
            {language === 'he' ? 'שיעור מס (%)' : 'Tax Rate (%)'}
          </label>
          <input type="number" step="1" value={taxRate} onChange={(e) => setTaxRate(Number(e.target.value))} className="w-full px-3 py-2 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-sm" />
        </div>
      </div>

      <div className="pt-6 border-t border-slate-100 dark:border-slate-800 space-y-4">
        <div className="grid grid-cols-2 gap-4">
           <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-lg border border-slate-100 dark:border-slate-700 text-center">
            <p className="text-xs text-slate-500 mb-1">{language === 'he' ? 'רווח ברוטו' : 'Gross Gain'}</p>
            <p className={`font-medium ${Number(results.gain) >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>${Number(results.gain).toLocaleString()}</p>
          </div>
          <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-lg border border-slate-100 dark:border-slate-700 text-center">
            <p className="text-xs text-slate-500 mb-1">{language === 'he' ? 'חבות מס' : 'Tax Owed'}</p>
            <p className="font-medium text-rose-600">${Number(results.tax).toLocaleString()}</p>
          </div>
        </div>
        
        <div className="p-4 bg-sky-50 dark:bg-sky-900/10 rounded-xl border border-sky-100 dark:border-sky-800/30 flex justify-between items-center mt-4">
          <div>
            <p className="text-sm font-medium text-sky-800 dark:text-sky-400 mb-1">
              {language === 'he' ? 'תמורה נטו' : 'Net Proceeds'}
            </p>
          </div>
          <div className="text-4xl font-bold text-sky-600 dark:text-sky-400">
            ${Number(results.netProceeds).toLocaleString()}
          </div>
        </div>
      </div>
    </div>
  );
}
