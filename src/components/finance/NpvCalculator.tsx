import React, { useState } from 'react';
import { useUIStore } from '../../stores/useUIStore';

export default function NpvCalculator() {
  const language = useUIStore(s => s.language);
  
  const [initialInvestment, setInitialInvestment] = useState<number>(10000);
  const [discountRate, setDiscountRate] = useState<number>(10);
  const [cashFlows, setCashFlows] = useState<string>('3000, 4000, 5000, 2000');

  const calculateNPV = () => {
    const rate = discountRate / 100;
    const flows = cashFlows.split(',').map(f => parseFloat(f.trim())).filter(n => !isNaN(n));
    
    let npv = -initialInvestment;
    
    flows.forEach((flow, index) => {
      npv += flow / Math.pow(1 + rate, index + 1);
    });
    
    let status = '';
    if (npv > 0) status = language === 'he' ? 'כדאי (NPV חיובי)' : 'Profitable (Positive NPV)';
    else if (npv < 0) status = language === 'he' ? 'לא כדאי (NPV שלילי)' : 'Unprofitable (Negative NPV)';
    else status = language === 'he' ? 'נקודת איזון' : 'Break-Even';

    return {
      npv: npv.toFixed(2),
      status
    };
  };

  const results = calculateNPV();

  return (
    <div className="p-6 max-w-xl mx-auto bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm">
      <h2 className="text-xl font-medium text-slate-900 dark:text-white mb-6">
        {language === 'he' ? 'ערך נוכחי נקי (NPV)' : 'Net Present Value (NPV)'}
      </h2>
      <p className="text-sm text-slate-500 mb-6">
        {language === 'he' ? 'מודד את כדאיות ההשקעה על ידי חישוב ההפרש בין הערך הנוכחי של תזרימי מזומנים נכנסים ליוצאים.' : 'Determines the value of a series of future cash flows in today\'s dollars, discounted at a specific rate.'}
      </p>

      <div className="grid grid-cols-2 gap-4 mb-6">
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
            {language === 'he' ? 'השקעה התחלתית ($)' : 'Initial Investment ($)'}
          </label>
          <input type="number" value={initialInvestment} onChange={(e) => setInitialInvestment(Number(e.target.value))} className="w-full px-3 py-2 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-sm" />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
            {language === 'he' ? 'שיעור היוון (Discount Rate %)' : 'Discount Rate (%)'}
          </label>
          <input type="number" step="0.1" value={discountRate} onChange={(e) => setDiscountRate(Number(e.target.value))} className="w-full px-3 py-2 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-sm" />
        </div>
        <div className="col-span-2">
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
            {language === 'he' ? 'תזרימי מזומנים (מופרדים בפסיק, החל משנה 1)' : 'Future Cash Flows (Comma separated, Year 1 onwards)'}
          </label>
          <textarea 
            value={cashFlows} 
            onChange={(e) => setCashFlows(e.target.value)} 
            className="w-full px-3 py-2 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-sm h-24" 
          />
        </div>
      </div>

      <div className="pt-6 border-t border-slate-100 dark:border-slate-800">
        <div className={`p-4 rounded-xl border flex justify-between items-center ${Number(results.npv) > 0 ? 'bg-emerald-50 dark:bg-emerald-900/10 border-emerald-100 dark:border-emerald-800/30' : Number(results.npv) < 0 ? 'bg-rose-50 dark:bg-rose-900/10 border-rose-100 dark:border-rose-800/30' : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700'}`}>
          <div>
            <p className={`text-sm font-medium mb-1 ${Number(results.npv) > 0 ? 'text-emerald-800 dark:text-emerald-400' : Number(results.npv) < 0 ? 'text-rose-800 dark:text-rose-400' : 'text-slate-800 dark:text-slate-300'}`}>
              {language === 'he' ? 'ערך נוכחי נקי (NPV)' : 'NPV'}
            </p>
            <p className="text-xs opacity-80">{results.status}</p>
          </div>
          <div className={`text-4xl font-bold ${Number(results.npv) > 0 ? 'text-emerald-600 dark:text-emerald-400' : Number(results.npv) < 0 ? 'text-rose-600 dark:text-rose-400' : 'text-slate-700 dark:text-slate-200'}`}>
             ${Number(results.npv).toLocaleString()}
          </div>
        </div>
      </div>
    </div>
  );
}
