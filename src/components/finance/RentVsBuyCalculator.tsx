import React, { useState } from 'react';
import { useUIStore } from '../../stores/useUIStore';

export default function RentVsBuyCalculator() {
  const language = useUIStore(s => s.language);
  
  // Rent
  const [monthlyRent, setMonthlyRent] = useState<number>(2000);
  const [rentIncrease, setRentIncrease] = useState<number>(3); // 3% annual
  
  // Buy
  const [homePrice, setHomePrice] = useState<number>(400000);
  const [downPaymentPercent, setDownPaymentPercent] = useState<number>(20);
  const [mortgageRate, setMortgageRate] = useState<number>(6.5);
  const [propertyTaxRate, setPropertyTaxRate] = useState<number>(1.2);
  const [maintenanceRate, setMaintenanceRate] = useState<number>(1);
  const [homeAppreciation, setHomeAppreciation] = useState<number>(4);
  
  // Shared
  const [years, setYears] = useState<number>(10);

  const calculateRentVsBuy = () => {
    // Renting cost over 'years'
    let totalRentPaid = 0;
    let currentRent = monthlyRent;
    for (let i = 0; i < years; i++) {
      totalRentPaid += currentRent * 12;
      currentRent *= (1 + (rentIncrease / 100));
    }

    // Buying cost & equity
    const downPayment = homePrice * (downPaymentPercent / 100);
    const loanAmount = homePrice - downPayment;
    const monthlyRate = mortgageRate / 100 / 12;
    const numPayments = 30 * 12; // Assuming 30 year fixed for simplicity
    
    // PMT
    let monthlyMortgage = 0;
    if (loanAmount > 0 && monthlyRate > 0) {
      const x = Math.pow(1 + monthlyRate, numPayments);
      monthlyMortgage = (loanAmount * x * monthlyRate) / (x - 1);
    }
    
    let balance = loanAmount;
    let totalInterestPaid = 0;
    for (let i = 0; i < years * 12; i++) {
      const interest = balance * monthlyRate;
      const principal = monthlyMortgage - interest;
      balance -= principal;
      totalInterestPaid += interest;
    }
    
    // Property tax & maintenance
    let totalTaxAndMaint = 0;
    let currentHomeValue = homePrice;
    for (let i = 0; i < years; i++) {
      totalTaxAndMaint += currentHomeValue * (propertyTaxRate / 100);
      totalTaxAndMaint += currentHomeValue * (maintenanceRate / 100);
      currentHomeValue *= (1 + (homeAppreciation / 100));
    }

    const totalBuyCost = totalInterestPaid + totalTaxAndMaint + (homePrice * 0.03); // Closing costs 3%
    const totalBuyEquity = currentHomeValue - balance;
    const netBuyCost = totalBuyCost - (totalBuyEquity - downPayment); // Total sunk costs minus equity gained

    return {
      totalRentPaid,
      totalBuyCost,
      totalBuyEquity,
      netBuyCost,
      isRentingBetter: totalRentPaid < netBuyCost
    };
  };

  const results = calculateRentVsBuy();

  return (
    <div className="p-6 max-w-xl mx-auto bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm">
      <h2 className="text-xl font-medium text-slate-900 dark:text-white mb-6">
        {language === 'he' ? 'מחשבון שכירות מול קנייה' : 'Rent vs. Buy Calculator'}
      </h2>

      <div className="grid gap-6 mb-6">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <h3 className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-3 border-b border-slate-200 dark:border-slate-800 pb-1">
              {language === 'he' ? 'נתוני שכירות' : 'Renting'}
            </h3>
            <div className="space-y-3">
              <div>
                <label className="block text-xs text-slate-600 dark:text-slate-400 mb-1">
                  {language === 'he' ? 'שכירות חודשית' : 'Monthly Rent'}
                </label>
                <input type="number" value={monthlyRent} onChange={(e) => setMonthlyRent(Number(e.target.value))} className="w-full px-3 py-1.5 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-sm" />
              </div>
              <div>
                <label className="block text-xs text-slate-600 dark:text-slate-400 mb-1">
                  {language === 'he' ? 'עליית שכר דירה שנתית (%)' : 'Annual Rent Increase (%)'}
                </label>
                <input type="number" value={rentIncrease} step="0.1" onChange={(e) => setRentIncrease(Number(e.target.value))} className="w-full px-3 py-1.5 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-sm" />
              </div>
            </div>
          </div>

          <div>
            <h3 className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-3 border-b border-slate-200 dark:border-slate-800 pb-1">
              {language === 'he' ? 'נתוני קנייה' : 'Buying'}
            </h3>
            <div className="space-y-3">
              <div>
                <label className="block text-xs text-slate-600 dark:text-slate-400 mb-1">
                  {language === 'he' ? 'מחיר הדירה' : 'Home Price'}
                </label>
                <input type="number" value={homePrice} onChange={(e) => setHomePrice(Number(e.target.value))} className="w-full px-3 py-1.5 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-sm" />
              </div>
              <div>
                <label className="block text-xs text-slate-600 dark:text-slate-400 mb-1">
                  {language === 'he' ? 'הון עצמי (%)' : 'Down Payment (%)'}
                </label>
                <input type="number" value={downPaymentPercent} onChange={(e) => setDownPaymentPercent(Number(e.target.value))} className="w-full px-3 py-1.5 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-sm" />
              </div>
            </div>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
            {language === 'he' ? 'תקופת השוואה (שנים)' : 'Comparison Horizon (Years)'}
          </label>
          <input type="number" value={years} onChange={(e) => setYears(Number(e.target.value))} className="w-full px-3 py-2 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-sm max-w-xs" />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-y-6 gap-x-4 pt-4 border-t border-slate-100 dark:border-slate-800 mt-2">
        <div className="col-span-2 text-center mb-2">
          <div className="text-xl font-medium text-slate-700 dark:text-slate-300">
            {language === 'he' ? 'לאחר' : 'After'} {years} {language === 'he' ? 'שנים, מבחינה פיננסית:' : 'years, financially it is better to:'}
          </div>
          <div className={`text-3xl font-bold mt-2 ${results.isRentingBetter ? 'text-rose-500' : 'text-emerald-500'}`}>
            {results.isRentingBetter ? (language === 'he' ? 'לשכור' : 'RENT') : (language === 'he' ? 'לקנות' : 'BUY')}
          </div>
        </div>

        <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-100 dark:border-slate-800">
          <p className="text-sm font-medium text-slate-900 dark:text-white mb-2">
            {language === 'he' ? 'שכירות (עלות נטו)' : 'Renting (Net Cost)'}
          </p>
          <div className="text-2xl font-bold text-slate-700 dark:text-slate-300">
            ${Number(results.totalRentPaid.toFixed(2)).toLocaleString()}
          </div>
        </div>

        <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-100 dark:border-slate-800">
          <p className="text-sm font-medium text-slate-900 dark:text-white mb-2">
            {language === 'he' ? 'קנייה (עלות נטו אחרי הון עצמי)' : 'Buying (Net Cost after Equity)'}
          </p>
          <div className="text-2xl font-bold text-slate-700 dark:text-slate-300">
            ${Number(results.netBuyCost.toFixed(2)).toLocaleString()}
          </div>
        </div>
      </div>
    </div>
  );
}
