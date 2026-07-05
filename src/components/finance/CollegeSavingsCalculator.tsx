import React, { useState } from 'react';
import { useUIStore } from '../../stores/useUIStore';

export default function CollegeSavingsCalculator() {
  const language = useUIStore(s => s.language);
  const [childAge, setChildAge] = useState<number>(5);
  const [collegeAge, setCollegeAge] = useState<number>(18);
  const [currentCostPerYear, setCurrentCostPerYear] = useState<number>(25000);
  const [yearsInCollege, setYearsInCollege] = useState<number>(4);
  const [tuitionInflation, setTuitionInflation] = useState<number>(5);
  const [currentSavings, setCurrentSavings] = useState<number>(10000);
  const [expectedReturn, setExpectedReturn] = useState<number>(6);

  const calculateCollege = () => {
    const yearsUntilCollege = collegeAge - childAge;
    if (yearsUntilCollege <= 0) return { projectedCost: 0, requiredMonthly: 0, totalNeeded: 0 };
    
    // Project the future cost of ONE year of college when they start
    const futureCostFirstYear = currentCostPerYear * Math.pow(1 + (tuitionInflation / 100), yearsUntilCollege);
    
    // Project total cost for all years in college (assuming cost keeps inflating while they are in school)
    let totalFutureCost = 0;
    for (let i = 0; i < yearsInCollege; i++) {
      totalFutureCost += futureCostFirstYear * Math.pow(1 + (tuitionInflation / 100), i);
    }
    
    // Calculate how much current savings will grow to by the time college starts
    const futureValueOfCurrentSavings = currentSavings * Math.pow(1 + (expectedReturn / 100), yearsUntilCollege);
    
    // Calculate the shortfall (how much more we need to have saved by college age)
    const shortfall = Math.max(0, totalFutureCost - futureValueOfCurrentSavings);
    
    // Calculate required monthly contribution to reach the shortfall
    const ratePerMonth = (expectedReturn / 100) / 12;
    const months = yearsUntilCollege * 12;
    
    let requiredMonthly = 0;
    if (ratePerMonth > 0 && shortfall > 0) {
      requiredMonthly = (shortfall * ratePerMonth) / (Math.pow(1 + ratePerMonth, months) - 1);
    } else if (shortfall > 0) {
      requiredMonthly = shortfall / months;
    }

    return {
      projectedCost: futureCostFirstYear.toFixed(2),
      totalNeeded: totalFutureCost.toFixed(2),
      shortfall: shortfall.toFixed(2),
      requiredMonthly: requiredMonthly.toFixed(2)
    };
  };

  const results = calculateCollege();

  return (
    <div className="p-6 max-w-xl mx-auto bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm">
      <h2 className="text-xl font-medium text-slate-900 dark:text-white mb-6">
        {language === 'he' ? 'מחשבון חיסכון ללימודים אקדמיים' : 'College Savings Calculator'}
      </h2>

      <div className="grid gap-4 mb-6">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              {language === 'he' ? 'גיל הילד כיום' : 'Child\'s Current Age'}
            </label>
            <input type="number" value={childAge} onChange={(e) => setChildAge(Number(e.target.value))} className="w-full px-3 py-2 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-sm" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              {language === 'he' ? 'גיל תחילת לימודים' : 'College Age'}
            </label>
            <input type="number" value={collegeAge} onChange={(e) => setCollegeAge(Number(e.target.value))} className="w-full px-3 py-2 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-sm" />
          </div>
        </div>
        
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              {language === 'he' ? 'עלות שנתית כיום' : 'Current Annual Cost'}
            </label>
            <input type="number" value={currentCostPerYear} onChange={(e) => setCurrentCostPerYear(Number(e.target.value))} className="w-full px-3 py-2 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-sm" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              {language === 'he' ? 'שנות לימוד' : 'Years in College'}
            </label>
            <input type="number" value={yearsInCollege} onChange={(e) => setYearsInCollege(Number(e.target.value))} className="w-full px-3 py-2 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-sm" />
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              {language === 'he' ? 'אינפלציית שכר לימוד (%)' : 'Tuition Inflation (%)'}
            </label>
            <input type="number" value={tuitionInflation} onChange={(e) => setTuitionInflation(Number(e.target.value))} className="w-full px-3 py-2 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-sm" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              {language === 'he' ? 'חיסכון קיים' : 'Current Savings'}
            </label>
            <input type="number" value={currentSavings} onChange={(e) => setCurrentSavings(Number(e.target.value))} className="w-full px-3 py-2 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-sm" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              {language === 'he' ? 'תשואה שנתית (%)' : 'Expected Return (%)'}
            </label>
            <input type="number" value={expectedReturn} onChange={(e) => setExpectedReturn(Number(e.target.value))} className="w-full px-3 py-2 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-sm" />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-y-6 gap-x-4 pt-4 border-t border-slate-100 dark:border-slate-800 mt-2">
        <div className="col-span-2">
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-1">
            {language === 'he' ? 'עלות כוללת צפויה (לכל השנים)' : 'Total Projected Cost (All Years)'}
          </p>
          <div className="text-3xl font-bold text-slate-800 dark:text-slate-200">
            ${Number(results.totalNeeded).toLocaleString()}
          </div>
        </div>
        <div>
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-1">
            {language === 'he' ? 'חסר צפוי (Shortfall)' : 'Projected Shortfall'}
          </p>
          <div className="text-xl font-medium text-rose-600 dark:text-rose-400">
            ${Number(results.shortfall).toLocaleString()}
          </div>
        </div>
        <div className="bg-indigo-50 dark:bg-indigo-900/20 p-3 rounded-lg -my-3">
          <p className="text-sm text-indigo-700 dark:text-indigo-300 mb-1">
            {language === 'he' ? 'הפקדה חודשית נדרשת' : 'Required Monthly Saving'}
          </p>
          <div className="text-2xl font-bold text-indigo-700 dark:text-indigo-300">
            ${Number(results.requiredMonthly).toLocaleString()}
          </div>
        </div>
      </div>
    </div>
  );
}
