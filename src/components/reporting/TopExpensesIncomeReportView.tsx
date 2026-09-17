import React, { useState, useMemo } from 'react';
import { useLedgerStore } from '../../stores/useLedgerStore';
import { formatCurrency, formatDate } from '../../lib/utils';
import { computeTopExpensesAndIncome } from '../../lib/reportGenerators';
import { BarChart3, TrendingDown, TrendingUp } from 'lucide-react';

interface Props {
  selectedYear?: number;
  startDate?: string;
  endDate?: string;
}

export const TopExpensesIncomeReportView: React.FC<Props> = ({
  selectedYear,
  startDate,
  endDate
}) => {
  const transactions = useLedgerStore(s => s.transactions);
  const accounts = useLedgerStore(s => s.accounts);
  const [activeTab, setActiveTab] = useState<'expenses' | 'income'>('expenses');

  const start = startDate || (selectedYear ? `${selectedYear}-01-01` : undefined);
  const end = endDate || (selectedYear ? `${selectedYear}-12-31` : undefined);

  const { topExpenses, topIncome } = useMemo(() => {
    return computeTopExpensesAndIncome(accounts, transactions, 25, start, end);
  }, [accounts, transactions, start, end]);

  const activeItems = activeTab === 'expenses' ? topExpenses : topIncome;

  return (
    <div className="space-y-6 max-w-5xl mx-auto p-4 sm:p-6" id="top-expenses-income-report">
      <div className="flex items-center justify-between border-b border-neutral-200 pb-4">
        <div>
          <h2 className="text-lg font-bold text-neutral-900 flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-neutral-800" />
            Top Financial Line Items
          </h2>
          <p className="text-xs text-neutral-500 mt-0.5">
            Identify the largest individual expenditure and revenue transactions across the ledger.
          </p>
        </div>
        <div className="flex bg-neutral-100 p-1 rounded-lg border border-neutral-200">
          <button
            onClick={() => setActiveTab('expenses')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors flex items-center gap-1.5 ${
              activeTab === 'expenses'
                ? 'bg-white text-rose-700 shadow-xs'
                : 'text-neutral-600 hover:text-neutral-900'
            }`}
          >
            <TrendingDown className="w-3.5 h-3.5" />
            Top 25 Expenses
          </button>
          <button
            onClick={() => setActiveTab('income')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors flex items-center gap-1.5 ${
              activeTab === 'income'
                ? 'bg-white text-emerald-700 shadow-xs'
                : 'text-neutral-600 hover:text-neutral-900'
            }`}
          >
            <TrendingUp className="w-3.5 h-3.5" />
            Top 25 Revenue
          </button>
        </div>
      </div>

      {activeItems.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-lg border border-neutral-200 text-neutral-500 text-xs">
          No records found for the selected view.
        </div>
      ) : (
        <div className="bg-white rounded-lg border border-neutral-200 overflow-hidden shadow-xs">
          <table className="w-full text-left text-xs">
            <thead className="bg-neutral-50 border-b border-neutral-200 text-neutral-600 font-semibold uppercase tracking-wider">
              <tr>
                <th className="py-3 px-4 w-12 text-center">#</th>
                <th className="py-3 px-4">Date</th>
                <th className="py-3 px-4">Description & Payee</th>
                <th className="py-3 px-4">Account / Category</th>
                <th className="py-3 px-4 text-right">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {activeItems.map((item, idx) => (
                <tr key={item.id} className="hover:bg-neutral-50/80 transition-colors">
                  <td className="py-3 px-4 text-center font-mono text-neutral-400 font-medium">
                    {idx + 1}
                  </td>
                  <td className="py-3 px-4 text-neutral-600 font-mono whitespace-nowrap">
                    {formatDate(item.date)}
                  </td>
                  <td className="py-3 px-4 font-medium text-neutral-900">
                    <div>{item.description}</div>
                    {item.payee && (
                      <div className="text-[11px] text-neutral-500 mt-0.5">{item.payee}</div>
                    )}
                  </td>
                  <td className="py-3 px-4 text-neutral-600">
                    <span className="bg-neutral-100 px-2 py-0.5 rounded-sm border border-neutral-200 text-[11px]">
                      {item.accountName}
                    </span>
                  </td>
                  <td className={`py-3 px-4 text-right font-mono font-bold ${activeTab === 'expenses' ? 'text-rose-600' : 'text-emerald-600'}`}>
                    {formatCurrency(item.amountCents)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default TopExpensesIncomeReportView;
