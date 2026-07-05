import React, { useState } from 'react';
import { useUIStore } from '../../stores/useUIStore';

export default function SalaryHourlyCalculator() {
  const language = useUIStore(s => s.language);
  const [annualSalary, setAnnualSalary] = useState<number>(60000);
  const [hoursPerWeek, setHoursPerWeek] = useState<number>(40);
  const [weeksPerYear, setWeeksPerYear] = useState<number>(52);

  const calculateHourly = () => {
    if (hoursPerWeek <= 0 || weeksPerYear <= 0) return { hourlyRate: 0, monthlyRate: 0, weeklyRate: 0, dailyRate: 0 };
    
    const totalHours = hoursPerWeek * weeksPerYear;
    const hourlyRate = annualSalary / totalHours;
    const weeklyRate = annualSalary / weeksPerYear;
    const monthlyRate = annualSalary / 12;
    const dailyRate = weeklyRate / 5; // Assumes 5 working days per week

    return {
      hourlyRate: hourlyRate.toFixed(2),
      dailyRate: dailyRate.toFixed(2),
      weeklyRate: weeklyRate.toFixed(2),
      monthlyRate: monthlyRate.toFixed(2)
    };
  };

  const results = calculateHourly();

  return (
    <div className="p-6 max-w-xl mx-auto bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm">
      <h2 className="text-xl font-medium text-slate-900 dark:text-white mb-6">
        {language === 'he' ? 'המרת שכר שעתי / חודשי / שנתי' : 'Salary vs Hourly Calculator'}
      </h2>

      <div className="grid gap-4 mb-6">
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
            {language === 'he' ? 'שכר שנתי (ברוטו)' : 'Annual Salary (Gross)'}
          </label>
          <input
            type="number"
            value={annualSalary}
            onChange={(e) => setAnnualSalary(Number(e.target.value))}
            className="w-full px-3 py-2 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-sm"
          />
        </div>
        
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              {language === 'he' ? 'שעות עבודה בשבוע' : 'Hours Per Week'}
            </label>
            <input
              type="number"
              value={hoursPerWeek}
              onChange={(e) => setHoursPerWeek(Number(e.target.value))}
              className="w-full px-3 py-2 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              {language === 'he' ? 'שבועות עבודה בשנה' : 'Weeks Per Year'}
            </label>
            <input
              type="number"
              value={weeksPerYear}
              onChange={(e) => setWeeksPerYear(Number(e.target.value))}
              className="w-full px-3 py-2 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-sm"
            />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-y-6 gap-x-4 pt-4 border-t border-slate-100 dark:border-slate-800 mt-2">
        <div>
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-1">
            {language === 'he' ? 'תעריף שעתי' : 'Hourly Rate'}
          </p>
          <div className="text-2xl font-medium text-indigo-600 dark:text-indigo-400">
            ${results.hourlyRate}
          </div>
        </div>
        <div>
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-1">
            {language === 'he' ? 'שכר יומי' : 'Daily Rate'}
          </p>
          <div className="text-2xl font-medium text-slate-700 dark:text-slate-300">
            ${results.dailyRate}
          </div>
        </div>
        <div>
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-1">
            {language === 'he' ? 'שכר שבועי' : 'Weekly Rate'}
          </p>
          <div className="text-2xl font-medium text-slate-700 dark:text-slate-300">
            ${results.weeklyRate}
          </div>
        </div>
        <div>
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-1">
            {language === 'he' ? 'שכר חודשי' : 'Monthly Rate'}
          </p>
          <div className="text-2xl font-medium text-slate-700 dark:text-slate-300">
            ${results.monthlyRate}
          </div>
        </div>
      </div>
    </div>
  );
}
