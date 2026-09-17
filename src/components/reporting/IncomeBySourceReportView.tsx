import React, { useMemo } from 'react';
import { useLedgerStore } from '../../stores/useLedgerStore';
import { formatCurrency } from '../../lib/utils';
import { computeIncomeBySource } from '../../lib/reportGenerators';
import { isPostable } from '../../lib/txFilters';
import { TrendingUp, Users, ArrowUpRight } from 'lucide-react';

interface Props {
  selectedYear?: number;
  startDate?: string;
  endDate?: string;
}

export const IncomeBySourceReportView: React.FC<Props> = ({
  selectedYear,
  startDate,
  endDate
}) => {
  const transactions = useLedgerStore(s => s.transactions.filter(isPostable));
  const accounts = useLedgerStore(s => s.accounts);

  const start = startDate || (selectedYear ? `${selectedYear}-01-01` : undefined);
  const end = endDate || (selectedYear ? `${selectedYear}-12-31` : undefined);

  const breakdowns = useMemo(() => {
    return computeIncomeBySource(accounts, transactions, start, end);
  }, [accounts, transactions, start, end]);

  const totalIncomeCents = useMemo(() => {
    return breakdowns.reduce((sum, b) => sum + b.totalAmountCents, 0);
  }, [breakdowns]);

  return (
    <div className="space-y-6 max-w-5xl mx-auto p-4 sm:p-6" id="income-by-source-report">
      <div className="flex items-center justify-between border-b border-neutral-200 pb-4">
        <div>
          <h2 className="text-lg font-bold text-neutral-900 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-emerald-600" />
            Income by Source & Customer
          </h2>
          <p className="text-xs text-neutral-500 mt-0.5">
            Concentration and revenue generation breakdown across clients, revenue channels, and payees.
          </p>
        </div>
        <div className="text-right">
          <div className="text-xs text-neutral-500 uppercase font-semibold">Total Revenue</div>
          <div className="text-lg font-mono font-bold text-emerald-600">
            {formatCurrency(totalIncomeCents)}
          </div>
        </div>
      </div>

      {breakdowns.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-lg border border-neutral-200 text-neutral-500 text-xs">
          No posted revenue transactions found for the selected period.
        </div>
      ) : (
        <div className="bg-white rounded-lg border border-neutral-200 overflow-hidden shadow-xs">
          <table className="w-full text-left text-xs">
            <thead className="bg-neutral-50 border-b border-neutral-200 text-neutral-600 font-semibold uppercase tracking-wider">
              <tr>
                <th className="py-3 px-4">Customer / Revenue Source</th>
                <th className="py-3 px-4 text-center">Invoices / Entries</th>
                <th className="py-3 px-4 text-right">Revenue Contribution</th>
                <th className="py-3 px-4 text-right">Total Inflow</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {breakdowns.map((item, idx) => (
                <tr key={idx} className="hover:bg-neutral-50/80 transition-colors">
                  <td className="py-3 px-4 font-medium text-neutral-900">
                    <div className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 shrink-0" />
                      <span>{item.source}</span>
                    </div>
                  </td>
                  <td className="py-3 px-4 text-center text-neutral-600 font-mono">
                    {item.transactionCount}
                  </td>
                  <td className="py-3 px-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <div className="w-24 bg-neutral-100 rounded-full h-1.5 overflow-hidden">
                        <div
                          className="bg-emerald-500 h-full rounded-full"
                          style={{ width: `${Math.min(100, item.percentage)}%` }}
                        />
                      </div>
                      <span className="font-mono text-neutral-700 w-12 text-right">
                        {item.percentage.toFixed(1)}%
                      </span>
                    </div>
                  </td>
                  <td className="py-3 px-4 text-right font-mono font-semibold text-emerald-600">
                    {formatCurrency(item.totalAmountCents)}
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

export default IncomeBySourceReportView;
