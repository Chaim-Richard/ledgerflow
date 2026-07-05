import React, { useState } from 'react';
import { useUIStore } from '../../stores/useUIStore';

export default function CacLtvCalculator() {
  const language = useUIStore(s => s.language);
  
  // CAC inputs
  const [marketingSpend, setMarketingSpend] = useState<number>(10000);
  const [salesSpend, setSalesSpend] = useState<number>(5000);
  const [newCustomers, setNewCustomers] = useState<number>(150);
  
  // LTV inputs
  const [avgOrderValue, setAvgOrderValue] = useState<number>(50);
  const [purchaseFrequency, setPurchaseFrequency] = useState<number>(4); // times per year
  const [customerLifespan, setCustomerLifespan] = useState<number>(3); // years
  const [grossMargin, setGrossMargin] = useState<number>(70); // %

  const calculateMetrics = () => {
    // CAC
    const totalAcquisitionCost = marketingSpend + salesSpend;
    const cac = newCustomers > 0 ? totalAcquisitionCost / newCustomers : 0;
    
    // LTV
    const customerValue = avgOrderValue * purchaseFrequency; // per year
    const ltv = customerValue * customerLifespan * (grossMargin / 100);
    
    // LTV:CAC Ratio
    const ratio = cac > 0 ? ltv / cac : 0;

    return {
      cac: cac.toFixed(2),
      ltv: ltv.toFixed(2),
      ratio: ratio.toFixed(1)
    };
  };

  const results = calculateMetrics();

  return (
    <div className="p-6 max-w-2xl mx-auto bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm">
      <h2 className="text-xl font-medium text-slate-900 dark:text-white mb-6">
        {language === 'he' ? 'עלות רכישת לקוח וערך חיי לקוח (CAC / LTV)' : 'CAC & LTV Calculator'}
      </h2>

      <div className="grid md:grid-cols-2 gap-6 mb-6">
        <div className="space-y-4">
          <h3 className="text-sm font-medium text-indigo-700 dark:text-indigo-400 border-b border-slate-200 dark:border-slate-800 pb-1">
            {language === 'he' ? 'עלות רכישת לקוח (CAC)' : 'Customer Acquisition (CAC)'}
          </h3>
          
          <div>
            <label className="block text-xs text-slate-600 dark:text-slate-400 mb-1">
              {language === 'he' ? 'הוצאות שיווק' : 'Marketing Spend'}
            </label>
            <input type="number" value={marketingSpend} onChange={(e) => setMarketingSpend(Number(e.target.value))} className="w-full px-3 py-1.5 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-sm" />
          </div>
          <div>
            <label className="block text-xs text-slate-600 dark:text-slate-400 mb-1">
              {language === 'he' ? 'הוצאות מכירה' : 'Sales Spend'}
            </label>
            <input type="number" value={salesSpend} onChange={(e) => setSalesSpend(Number(e.target.value))} className="w-full px-3 py-1.5 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-sm" />
          </div>
          <div>
            <label className="block text-xs text-slate-600 dark:text-slate-400 mb-1">
              {language === 'he' ? 'לקוחות חדשים שגויסו' : 'New Customers Acquired'}
            </label>
            <input type="number" value={newCustomers} onChange={(e) => setNewCustomers(Number(e.target.value))} className="w-full px-3 py-1.5 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-sm" />
          </div>
        </div>

        <div className="space-y-4">
          <h3 className="text-sm font-medium text-emerald-700 dark:text-emerald-400 border-b border-slate-200 dark:border-slate-800 pb-1">
            {language === 'he' ? 'ערך חיי לקוח (LTV)' : 'Customer Lifetime Value (LTV)'}
          </h3>
          
          <div>
            <label className="block text-xs text-slate-600 dark:text-slate-400 mb-1">
              {language === 'he' ? 'שווי הזמנה ממוצעת' : 'Average Order Value (AOV)'}
            </label>
            <input type="number" value={avgOrderValue} onChange={(e) => setAvgOrderValue(Number(e.target.value))} className="w-full px-3 py-1.5 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-sm" />
          </div>
          <div>
            <label className="block text-xs text-slate-600 dark:text-slate-400 mb-1">
              {language === 'he' ? 'תדירות רכישה (בשנה)' : 'Purchase Frequency (per year)'}
            </label>
            <input type="number" value={purchaseFrequency} onChange={(e) => setPurchaseFrequency(Number(e.target.value))} className="w-full px-3 py-1.5 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-sm" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs text-slate-600 dark:text-slate-400 mb-1">
                {language === 'he' ? 'תוחלת חיים (שנים)' : 'Lifespan (Years)'}
              </label>
              <input type="number" value={customerLifespan} onChange={(e) => setCustomerLifespan(Number(e.target.value))} className="w-full px-3 py-1.5 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-sm" />
            </div>
            <div>
              <label className="block text-xs text-slate-600 dark:text-slate-400 mb-1">
                {language === 'he' ? 'שולי רווח (%)' : 'Gross Margin (%)'}
              </label>
              <input type="number" value={grossMargin} onChange={(e) => setGrossMargin(Number(e.target.value))} className="w-full px-3 py-1.5 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-sm" />
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4 pt-4 border-t border-slate-100 dark:border-slate-800 mt-2">
        <div className="p-4 bg-indigo-50 dark:bg-indigo-900/10 rounded-xl border border-indigo-100 dark:border-indigo-800/30 text-center">
          <p className="text-sm font-medium text-indigo-800 dark:text-indigo-400 mb-1">CAC</p>
          <div className="text-2xl font-bold text-indigo-600 dark:text-indigo-400">
            ${results.cac}
          </div>
        </div>
        
        <div className="p-4 bg-emerald-50 dark:bg-emerald-900/10 rounded-xl border border-emerald-100 dark:border-emerald-800/30 text-center">
          <p className="text-sm font-medium text-emerald-800 dark:text-emerald-400 mb-1">LTV</p>
          <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
            ${results.ltv}
          </div>
        </div>

        <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700 text-center">
          <p className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
            {language === 'he' ? 'יחס LTV:CAC' : 'LTV:CAC Ratio'}
          </p>
          <div className={`text-3xl font-bold ${Number(results.ratio) >= 3 ? 'text-emerald-600' : Number(results.ratio) >= 1 ? 'text-amber-500' : 'text-rose-600'}`}>
            {results.ratio}:1
          </div>
          <p className="text-[10px] text-slate-500 mt-1 uppercase tracking-wider">
            {language === 'he' ? 'האידיאל: 3:1 ומעלה' : 'Target: > 3:1'}
          </p>
        </div>
      </div>
    </div>
  );
}
