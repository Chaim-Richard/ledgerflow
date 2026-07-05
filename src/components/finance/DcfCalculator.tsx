import React, { useState } from 'react';
import { useUIStore } from '../../stores/useUIStore';

export default function DcfCalculator() {
  const language = useUIStore(s => s.language);
  
  const [cashFlow, setCashFlow] = useState<number>(100000);
  const [growthRate, setGrowthRate] = useState<number>(5);
  const [discountRate, setDiscountRate] = useState<number>(10);
  const [terminalGrowthRate, setTerminalGrowthRate] = useState<number>(2);
  const [years, setYears] = useState<number>(5);

  const calculateDCF = () => {
    let presentValue = 0;
    let currentCF = cashFlow;
    
    // Calculate PV of projected cash flows
    for (let i = 1; i <= years; i++) {
      currentCF = currentCF * (1 + growthRate / 100);
      presentValue += currentCF / Math.pow(1 + discountRate / 100, i);
    }
    
    // Calculate Terminal Value
    const terminalValue = (currentCF * (1 + terminalGrowthRate / 100)) / ((discountRate - terminalGrowthRate) / 100);
    const pvOfTerminalValue = terminalValue / Math.pow(1 + discountRate / 100, years);
    
    const enterpriseValue = presentValue + pvOfTerminalValue;

    return {
      pvOfCashFlows: presentValue.toFixed(2),
      pvOfTerminalValue: pvOfTerminalValue.toFixed(2),
      enterpriseValue: enterpriseValue.toFixed(2)
    };
  };

  const results = calculateDCF();

  return (
    <div className="p-6 max-w-xl mx-auto bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm">
      <h2 className="text-xl font-medium text-slate-900 dark:text-white mb-6">
        {language === 'he' ? 'היוון תזרימי מזומנים (DCF)' : 'Discounted Cash Flow (DCF)'}
      </h2>
      <p className="text-sm text-slate-500 mb-6">
        {language === 'he' ? 'הערכת שווי של השקעה מבוססת על תזרימי המזומנים העתידיים שלה.' : 'Valuation method used to estimate the value of an investment based on its expected future cash flows.'}
      </p>

      <div className="grid gap-4 mb-6">
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
            {language === 'he' ? 'תזרים מזומנים התחלתי (שנה 0)' : 'Initial Cash Flow (Year 0)'}
          </label>
          <input type="number" value={cashFlow} onChange={(e) => setCashFlow(Number(e.target.value))} className="w-full px-3 py-2 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-sm" />
        </div>
        
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              {language === 'he' ? 'קצב צמיחה (%)' : 'Growth Rate (%)'}
            </label>
            <input type="number" step="0.1" value={growthRate} onChange={(e) => setGrowthRate(Number(e.target.value))} className="w-full px-3 py-2 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-sm" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              {language === 'he' ? 'שיעור היוון (%)' : 'Discount Rate (%)'}
            </label>
            <input type="number" step="0.1" value={discountRate} onChange={(e) => setDiscountRate(Number(e.target.value))} className="w-full px-3 py-2 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-sm" />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              {language === 'he' ? 'צמיחה סופית (%)' : 'Terminal Growth Rate (%)'}
            </label>
            <input type="number" step="0.1" value={terminalGrowthRate} onChange={(e) => setTerminalGrowthRate(Number(e.target.value))} className="w-full px-3 py-2 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-sm" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              {language === 'he' ? 'תקופת תחזית (שנים)' : 'Forecast Period (Years)'}
            </label>
            <input type="number" value={years} onChange={(e) => setYears(Number(e.target.value))} className="w-full px-3 py-2 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-sm" />
          </div>
        </div>
      </div>

      <div className="pt-6 border-t border-slate-100 dark:border-slate-800 space-y-4">
        <div className="flex justify-between items-center text-sm text-slate-600 dark:text-slate-400 px-2">
          <span>{language === 'he' ? 'ערך נוכחי של תזרימים:' : 'PV of Cash Flows:'}</span>
          <span className="font-medium">${Number(results.pvOfCashFlows).toLocaleString()}</span>
        </div>
        <div className="flex justify-between items-center text-sm text-slate-600 dark:text-slate-400 px-2">
          <span>{language === 'he' ? 'ערך נוכחי של ערך סופי:' : 'PV of Terminal Value:'}</span>
          <span className="font-medium">${Number(results.pvOfTerminalValue).toLocaleString()}</span>
        </div>
        
        <div className="p-4 bg-emerald-50 dark:bg-emerald-900/10 rounded-xl border border-emerald-100 dark:border-emerald-800/30 mt-4">
          <p className="text-sm font-medium text-emerald-800 dark:text-emerald-400 mb-1">
            {language === 'he' ? 'שווי פעילות (Enterprise Value)' : 'Enterprise Value'}
          </p>
          <div className="text-3xl font-bold text-emerald-600 dark:text-emerald-400">
            ${Number(results.enterpriseValue).toLocaleString()}
          </div>
        </div>
      </div>
    </div>
  );
}
