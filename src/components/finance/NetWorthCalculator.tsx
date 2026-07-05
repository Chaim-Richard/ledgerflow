import React, { useState } from 'react';
import { useUIStore } from '../../stores/useUIStore';

export default function NetWorthCalculator() {
  const language = useUIStore(s => s.language);
  
  const [cash, setCash] = useState<number>(10000);
  const [investments, setInvestments] = useState<number>(50000);
  const [realEstate, setRealEstate] = useState<number>(300000);
  const [vehicles, setVehicles] = useState<number>(20000);
  
  const [mortgage, setMortgage] = useState<number>(200000);
  const [autoLoans, setAutoLoans] = useState<number>(15000);
  const [studentLoans, setStudentLoans] = useState<number>(25000);
  const [creditCards, setCreditCards] = useState<number>(5000);

  const calculateNetWorth = () => {
    const totalAssets = cash + investments + realEstate + vehicles;
    const totalLiabilities = mortgage + autoLoans + studentLoans + creditCards;
    const netWorth = totalAssets - totalLiabilities;

    return {
      totalAssets,
      totalLiabilities,
      netWorth
    };
  };

  const results = calculateNetWorth();

  return (
    <div className="p-6 max-w-xl mx-auto bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm">
      <h2 className="text-xl font-medium text-slate-900 dark:text-white mb-6">
        {language === 'he' ? 'מחשבון שווי נקי' : 'Net Worth Calculator'}
      </h2>

      <div className="grid grid-cols-2 gap-8 mb-6">
        <div>
          <h3 className="font-medium text-emerald-600 dark:text-emerald-400 mb-4 pb-2 border-b border-emerald-100 dark:border-emerald-900/50">
            {language === 'he' ? 'נכסים' : 'Assets'}
          </h3>
          <div className="space-y-3">
            <div>
              <label className="block text-sm text-slate-600 dark:text-slate-400 mb-1">
                {language === 'he' ? 'מזומן / עו״ש' : 'Cash / Bank Accounts'}
              </label>
              <input type="number" value={cash} onChange={(e) => setCash(Number(e.target.value))} className="w-full px-3 py-1.5 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-sm" />
            </div>
            <div>
              <label className="block text-sm text-slate-600 dark:text-slate-400 mb-1">
                {language === 'he' ? 'השקעות / פנסיה' : 'Investments / Retirement'}
              </label>
              <input type="number" value={investments} onChange={(e) => setInvestments(Number(e.target.value))} className="w-full px-3 py-1.5 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-sm" />
            </div>
            <div>
              <label className="block text-sm text-slate-600 dark:text-slate-400 mb-1">
                {language === 'he' ? 'נדל״ן' : 'Real Estate'}
              </label>
              <input type="number" value={realEstate} onChange={(e) => setRealEstate(Number(e.target.value))} className="w-full px-3 py-1.5 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-sm" />
            </div>
            <div>
              <label className="block text-sm text-slate-600 dark:text-slate-400 mb-1">
                {language === 'he' ? 'רכבים' : 'Vehicles'}
              </label>
              <input type="number" value={vehicles} onChange={(e) => setVehicles(Number(e.target.value))} className="w-full px-3 py-1.5 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-sm" />
            </div>
          </div>
        </div>

        <div>
          <h3 className="font-medium text-rose-600 dark:text-rose-400 mb-4 pb-2 border-b border-rose-100 dark:border-rose-900/50">
            {language === 'he' ? 'התחייבויות' : 'Liabilities'}
          </h3>
          <div className="space-y-3">
            <div>
              <label className="block text-sm text-slate-600 dark:text-slate-400 mb-1">
                {language === 'he' ? 'משכנתא' : 'Mortgages'}
              </label>
              <input type="number" value={mortgage} onChange={(e) => setMortgage(Number(e.target.value))} className="w-full px-3 py-1.5 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-sm" />
            </div>
            <div>
              <label className="block text-sm text-slate-600 dark:text-slate-400 mb-1">
                {language === 'he' ? 'הלוואות רכב' : 'Auto Loans'}
              </label>
              <input type="number" value={autoLoans} onChange={(e) => setAutoLoans(Number(e.target.value))} className="w-full px-3 py-1.5 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-sm" />
            </div>
            <div>
              <label className="block text-sm text-slate-600 dark:text-slate-400 mb-1">
                {language === 'he' ? 'הלוואות סטודנט' : 'Student Loans'}
              </label>
              <input type="number" value={studentLoans} onChange={(e) => setStudentLoans(Number(e.target.value))} className="w-full px-3 py-1.5 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-sm" />
            </div>
            <div>
              <label className="block text-sm text-slate-600 dark:text-slate-400 mb-1">
                {language === 'he' ? 'כרטיסי אשראי' : 'Credit Cards'}
              </label>
              <input type="number" value={creditCards} onChange={(e) => setCreditCards(Number(e.target.value))} className="w-full px-3 py-1.5 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-sm" />
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-y-6 gap-x-4 pt-4 border-t border-slate-100 dark:border-slate-800 mt-2">
        <div>
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-1">
            {language === 'he' ? 'סך נכסים' : 'Total Assets'}
          </p>
          <div className="text-xl font-medium text-emerald-600 dark:text-emerald-400">
            ${results.totalAssets.toLocaleString()}
          </div>
        </div>
        <div>
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-1">
            {language === 'he' ? 'סך התחייבויות' : 'Total Liabilities'}
          </p>
          <div className="text-xl font-medium text-rose-600 dark:text-rose-400">
            ${results.totalLiabilities.toLocaleString()}
          </div>
        </div>
        <div className="bg-slate-50 dark:bg-slate-800/50 -my-4 p-4 rounded-lg flex flex-col justify-center">
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-1">
            {language === 'he' ? 'שווי נקי' : 'Net Worth'}
          </p>
          <div className={`text-2xl font-bold ${results.netWorth >= 0 ? 'text-indigo-600 dark:text-indigo-400' : 'text-rose-600 dark:text-rose-400'}`}>
            ${results.netWorth.toLocaleString()}
          </div>
        </div>
      </div>
    </div>
  );
}
