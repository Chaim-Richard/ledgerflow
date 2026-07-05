import React, { useState } from 'react';
import { useUIStore } from '../../stores/useUIStore';

export default function AmortizationCalculator() {
  const language = useUIStore(s => s.language);
  const [loanAmount, setLoanAmount] = useState<number>(300000);
  const [interestRate, setInterestRate] = useState<number>(5.5);
  const [loanTermYears, setLoanTermYears] = useState<number>(30);

  const calculateAmortization = () => {
    if (loanAmount <= 0 || interestRate <= 0 || loanTermYears <= 0) return { monthlyPayment: 0, totalInterest: 0, schedule: [] };

    const principal = loanAmount;
    const calculatedInterest = interestRate / 100 / 12;
    const calculatedPayments = loanTermYears * 12;

    const x = Math.pow(1 + calculatedInterest, calculatedPayments);
    const monthlyPayment = (principal * x * calculatedInterest) / (x - 1);

    let balance = principal;
    let totalInterest = 0;
    const schedule = [];

    // Only generate first 12 months for brevity in UI, plus summary
    for (let i = 1; i <= Math.min(12, calculatedPayments); i++) {
      const interestPayment = balance * calculatedInterest;
      const principalPayment = monthlyPayment - interestPayment;
      balance -= principalPayment;
      totalInterest += interestPayment;

      schedule.push({
        month: i,
        payment: monthlyPayment.toFixed(2),
        principal: principalPayment.toFixed(2),
        interest: interestPayment.toFixed(2),
        balance: balance.toFixed(2)
      });
    }

    // Fast forward to end to get total interest
    let tempBalance = principal;
    let fullTotalInterest = 0;
    for (let i = 1; i <= calculatedPayments; i++) {
      const interestPayment = tempBalance * calculatedInterest;
      const principalPayment = monthlyPayment - interestPayment;
      tempBalance -= principalPayment;
      fullTotalInterest += interestPayment;
    }

    return {
      monthlyPayment: monthlyPayment.toFixed(2),
      totalInterest: fullTotalInterest.toFixed(2),
      totalPayment: (monthlyPayment * calculatedPayments).toFixed(2),
      schedule
    };
  };

  const results = calculateAmortization();

  return (
    <div className="p-6 max-w-2xl mx-auto bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm">
      <h2 className="text-xl font-medium text-slate-900 dark:text-white mb-6">
        {language === 'he' ? 'לוח סילוקין (שפיצר)' : 'Amortization Schedule'}
      </h2>

      <div className="grid grid-cols-3 gap-4 mb-6">
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
            {language === 'he' ? 'סכום הלוואה' : 'Loan Amount'}
          </label>
          <input type="number" value={loanAmount} onChange={(e) => setLoanAmount(Number(e.target.value))} className="w-full px-3 py-2 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-sm" />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
            {language === 'he' ? 'ריבית שנתית (%)' : 'Interest Rate (%)'}
          </label>
          <input type="number" value={interestRate} step="0.1" onChange={(e) => setInterestRate(Number(e.target.value))} className="w-full px-3 py-2 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-sm" />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
            {language === 'he' ? 'תקופה (שנים)' : 'Term (Years)'}
          </label>
          <input type="number" value={loanTermYears} onChange={(e) => setLoanTermYears(Number(e.target.value))} className="w-full px-3 py-2 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-sm" />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4 mb-6 p-4 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-100 dark:border-slate-800">
        <div>
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-1">
            {language === 'he' ? 'תשלום חודשי' : 'Monthly Payment'}
          </p>
          <div className="text-xl font-bold text-indigo-600 dark:text-indigo-400">
            ${Number(results.monthlyPayment).toLocaleString()}
          </div>
        </div>
        <div>
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-1">
            {language === 'he' ? 'סך הכל ריבית' : 'Total Interest'}
          </p>
          <div className="text-xl font-bold text-rose-600 dark:text-rose-400">
            ${Number(results.totalInterest).toLocaleString()}
          </div>
        </div>
        <div>
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-1">
            {language === 'he' ? 'סך הכל החזר' : 'Total Payment'}
          </p>
          <div className="text-xl font-bold text-slate-700 dark:text-slate-300">
            ${Number(results.totalPayment).toLocaleString()}
          </div>
        </div>
      </div>

      <div>
        <h3 className="font-medium text-slate-900 dark:text-white mb-3">
          {language === 'he' ? 'שנה ראשונה - פירוט' : 'First Year Schedule'}
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left text-slate-600 dark:text-slate-400">
            <thead className="text-xs text-slate-700 uppercase bg-slate-100 dark:bg-slate-800 dark:text-slate-300">
              <tr>
                <th className="px-4 py-2">{language === 'he' ? 'חודש' : 'Month'}</th>
                <th className="px-4 py-2">{language === 'he' ? 'קרן' : 'Principal'}</th>
                <th className="px-4 py-2">{language === 'he' ? 'ריבית' : 'Interest'}</th>
                <th className="px-4 py-2">{language === 'he' ? 'יתרה' : 'Balance'}</th>
              </tr>
            </thead>
            <tbody>
              {results.schedule.map((row, idx) => (
                <tr key={idx} className="border-b dark:border-slate-800 border-slate-100">
                  <td className="px-4 py-2">{row.month}</td>
                  <td className="px-4 py-2">${Number(row.principal).toLocaleString()}</td>
                  <td className="px-4 py-2 text-rose-500 dark:text-rose-400">${Number(row.interest).toLocaleString()}</td>
                  <td className="px-4 py-2 font-medium">${Number(row.balance).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
