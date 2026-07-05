import React, { useState } from 'react';
import { useUIStore } from '../../stores/useUIStore';

export default function LeaseVsBuyCalculator() {
  const language = useUIStore(s => s.language);
  
  // Buy variables
  const [buyPrice, setBuyPrice] = useState<number>(30000);
  const [buyDownPayment, setBuyDownPayment] = useState<number>(5000);
  const [buyLoanTerm, setBuyLoanTerm] = useState<number>(60);
  const [buyInterestRate, setBuyInterestRate] = useState<number>(4.5);
  const [estimatedValueAtEnd, setEstimatedValueAtEnd] = useState<number>(12000);
  
  // Lease variables
  const [leaseDownPayment, setLeaseDownPayment] = useState<number>(3000);
  const [leaseMonthlyPayment, setLeaseMonthlyPayment] = useState<number>(350);
  const [leaseTerm, setLeaseTerm] = useState<number>(36);
  const [leaseFees, setLeaseFees] = useState<number>(500); // Acquisition, disposition, etc.

  const calculate = () => {
    // Buy cost
    const loanAmount = buyPrice - buyDownPayment;
    const ratePerMonth = (buyInterestRate / 100) / 12;
    let buyMonthlyPayment = 0;
    if (buyLoanTerm > 0) {
      buyMonthlyPayment = (loanAmount * ratePerMonth * Math.pow(1 + ratePerMonth, buyLoanTerm)) / (Math.pow(1 + ratePerMonth, buyLoanTerm) - 1);
    }
    const totalBuyPayments = buyMonthlyPayment * buyLoanTerm;
    const totalBuyCost = buyDownPayment + totalBuyPayments - estimatedValueAtEnd;

    // Lease cost
    const totalLeaseCost = leaseDownPayment + (leaseMonthlyPayment * leaseTerm) + leaseFees;

    return {
      buyMonthlyPayment: buyMonthlyPayment.toFixed(2),
      totalBuyCost: totalBuyCost.toFixed(2),
      totalLeaseCost: totalLeaseCost.toFixed(2),
      difference: Math.abs(totalBuyCost - totalLeaseCost).toFixed(2),
      betterOption: totalBuyCost < totalLeaseCost ? 'Buy' : 'Lease'
    };
  };

  const results = calculate();

  return (
    <div className="p-6 max-w-xl mx-auto bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm">
      <h2 className="text-xl font-medium text-slate-900 dark:text-white mb-6">
        {language === 'he' ? 'מחשבון ליסינג לעומת קנייה (רכב)' : 'Lease vs. Buy Calculator (Car)'}
      </h2>

      <div className="grid grid-cols-2 gap-8 mb-6">
        <div>
          <h3 className="font-medium text-indigo-600 dark:text-indigo-400 mb-4 pb-2 border-b border-indigo-100 dark:border-indigo-900/50">
            {language === 'he' ? 'קנייה (הלוואה)' : 'Buying (Loan)'}
          </h3>
          <div className="space-y-3">
            <div>
              <label className="block text-xs text-slate-600 dark:text-slate-400 mb-1">
                {language === 'he' ? 'מחיר רכב' : 'Car Price'}
              </label>
              <input type="number" value={buyPrice} onChange={(e) => setBuyPrice(Number(e.target.value))} className="w-full px-3 py-1.5 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-sm" />
            </div>
            <div>
              <label className="block text-xs text-slate-600 dark:text-slate-400 mb-1">
                {language === 'he' ? 'מקדמה' : 'Down Payment'}
              </label>
              <input type="number" value={buyDownPayment} onChange={(e) => setBuyDownPayment(Number(e.target.value))} className="w-full px-3 py-1.5 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-sm" />
            </div>
            <div>
              <label className="block text-xs text-slate-600 dark:text-slate-400 mb-1">
                {language === 'he' ? 'תקופה (חודשים)' : 'Term (Months)'}
              </label>
              <input type="number" value={buyLoanTerm} onChange={(e) => setBuyLoanTerm(Number(e.target.value))} className="w-full px-3 py-1.5 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-sm" />
            </div>
            <div>
              <label className="block text-xs text-slate-600 dark:text-slate-400 mb-1">
                {language === 'he' ? 'ריבית (%)' : 'Interest Rate (%)'}
              </label>
              <input type="number" value={buyInterestRate} onChange={(e) => setBuyInterestRate(Number(e.target.value))} className="w-full px-3 py-1.5 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-sm" />
            </div>
            <div>
              <label className="block text-xs text-slate-600 dark:text-slate-400 mb-1">
                {language === 'he' ? 'ערך סוף תקופה' : 'Est. Value at End'}
              </label>
              <input type="number" value={estimatedValueAtEnd} onChange={(e) => setEstimatedValueAtEnd(Number(e.target.value))} className="w-full px-3 py-1.5 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-sm" />
            </div>
          </div>
        </div>

        <div>
          <h3 className="font-medium text-emerald-600 dark:text-emerald-400 mb-4 pb-2 border-b border-emerald-100 dark:border-emerald-900/50">
            {language === 'he' ? 'ליסינג' : 'Leasing'}
          </h3>
          <div className="space-y-3">
            <div>
              <label className="block text-xs text-slate-600 dark:text-slate-400 mb-1">
                {language === 'he' ? 'מקדמה ליסינג' : 'Lease Down Payment'}
              </label>
              <input type="number" value={leaseDownPayment} onChange={(e) => setLeaseDownPayment(Number(e.target.value))} className="w-full px-3 py-1.5 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-sm" />
            </div>
            <div>
              <label className="block text-xs text-slate-600 dark:text-slate-400 mb-1">
                {language === 'he' ? 'תשלום חודשי' : 'Monthly Payment'}
              </label>
              <input type="number" value={leaseMonthlyPayment} onChange={(e) => setLeaseMonthlyPayment(Number(e.target.value))} className="w-full px-3 py-1.5 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-sm" />
            </div>
            <div>
              <label className="block text-xs text-slate-600 dark:text-slate-400 mb-1">
                {language === 'he' ? 'תקופה (חודשים)' : 'Term (Months)'}
              </label>
              <input type="number" value={leaseTerm} onChange={(e) => setLeaseTerm(Number(e.target.value))} className="w-full px-3 py-1.5 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-sm" />
            </div>
            <div>
              <label className="block text-xs text-slate-600 dark:text-slate-400 mb-1">
                {language === 'he' ? 'עמלות שונות (הקמה/סיום)' : 'Fees (Acquisition/Disp.)'}
              </label>
              <input type="number" value={leaseFees} onChange={(e) => setLeaseFees(Number(e.target.value))} className="w-full px-3 py-1.5 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-sm" />
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-y-6 gap-x-4 pt-4 border-t border-slate-100 dark:border-slate-800 mt-2">
        <div>
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-1">
            {language === 'he' ? 'עלות כוללת - קנייה' : 'Total Cost - Buying'}
          </p>
          <div className={`text-2xl font-medium ${results.betterOption === 'Buy' ? 'text-emerald-600' : 'text-slate-700 dark:text-slate-300'}`}>
            ${results.totalBuyCost}
          </div>
        </div>
        <div>
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-1">
            {language === 'he' ? 'עלות כוללת - ליסינג' : 'Total Cost - Leasing'}
          </p>
          <div className={`text-2xl font-medium ${results.betterOption === 'Lease' ? 'text-emerald-600' : 'text-slate-700 dark:text-slate-300'}`}>
            ${results.totalLeaseCost}
          </div>
        </div>
        <div className="col-span-2 bg-slate-50 dark:bg-slate-800/50 p-4 rounded-lg flex items-center justify-between">
          <div>
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-1">
              {language === 'he' ? 'האפשרות המשתלמת יותר' : 'Better Option'}
            </p>
            <div className="text-lg font-bold text-slate-900 dark:text-white">
              {results.betterOption === 'Buy' ? (language === 'he' ? 'קנייה משתלמת יותר ב-' : 'Buying is cheaper by ') : (language === 'he' ? 'ליסינג משתלם יותר ב-' : 'Leasing is cheaper by ')}
              <span className="text-emerald-600 ml-1">${results.difference}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
