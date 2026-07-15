import React, { useMemo } from 'react';
import { motion } from 'motion/react';
import { 
  ArrowUpRight,
  ArrowDownRight,
  Clock,
  Layers,
  Sparkles,
  Wallet,
  Activity,
  Briefcase
} from 'lucide-react';
import { cn, formatCurrency } from '../lib/utils';
import { useLedgerStore } from '../stores/useLedgerStore';
import { useAuthStore } from '../stores/useAuthStore';
import { useUIStore } from '../stores/useUIStore';

export default function Dashboard() {
  const { transactions, accounts } = useLedgerStore();
  const { user } = useAuthStore();
  const setCommandPaletteOpen = useUIStore(state => state.setCommandPaletteOpen);

  const { totalCash, income, expenses } = useMemo(() => {
    const cashAccounts = accounts.filter(a => a.type === 'asset' && a.name.toLowerCase().includes('cash'));
    const totalCash = cashAccounts.reduce((sum, acc) => sum + (acc.balanceCents || 0), 0);
    
    // Simplistic last 30 days
    const income = accounts.filter(a => a.type === 'income').reduce((sum, a) => sum + Math.abs(a.balanceCents || 0), 0);
    const expenses = accounts.filter(a => a.type === 'expense').reduce((sum, a) => sum + Math.abs(a.balanceCents || 0), 0);

    return { totalCash, income, expenses };
  }, [accounts]);

  const recentTxs = useMemo(() => {
    return [...transactions].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 8);
  }, [transactions]);

  return (
    <div className="p-6 md:p-10 max-w-6xl mx-auto w-full h-full animate-fade-in pb-24">
      <div className="mb-10">
        <h1 className="text-3xl font-medium tracking-tight text-black mb-2">
          Good {new Date().getHours() < 12 ? 'morning' : new Date().getHours() < 18 ? 'afternoon' : 'evening'}, {user?.email?.split('@')[0] || 'there'}.
        </h1>
        <p className="text-gray-500">Here's what's happening with your finances today.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
        <div className="ledger-card p-6 flex flex-col justify-between">
          <div className="flex items-center justify-between mb-4">
            <span className="text-sm font-medium text-gray-500">Total Liquidity</span>
            <Wallet size={16} className="text-gray-400" />
          </div>
          <div>
            <h2 className="text-3xl font-semibold tracking-tight text-black">
              {formatCurrency(totalCash)}
            </h2>
            <div className="mt-2 flex items-center gap-2 text-sm text-green-600">
              <Activity size={14} />
              <span>Healthy</span>
            </div>
          </div>
        </div>

        <div className="ledger-card p-6 flex flex-col justify-between">
          <div className="flex items-center justify-between mb-4">
            <span className="text-sm font-medium text-gray-500">Total Income</span>
            <ArrowDownRight size={16} className="text-gray-400" />
          </div>
          <div>
            <h2 className="text-3xl font-semibold tracking-tight text-black">
              {formatCurrency(Math.abs(income))}
            </h2>
            <div className="mt-2 flex items-center gap-2 text-sm text-gray-500">
              <span>All time</span>
            </div>
          </div>
        </div>

        <div className="ledger-card p-6 flex flex-col justify-between">
          <div className="flex items-center justify-between mb-4">
            <span className="text-sm font-medium text-gray-500">Total Expenses</span>
            <ArrowUpRight size={16} className="text-gray-400" />
          </div>
          <div>
            <h2 className="text-3xl font-semibold tracking-tight text-black">
              {formatCurrency(Math.abs(expenses))}
            </h2>
            <div className="mt-2 flex items-center gap-2 text-sm text-gray-500">
              <span>All time</span>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 ledger-card p-0 overflow-hidden h-fit">
          <div className="px-6 py-4 border-b border-[#e5e5e5] flex items-center justify-between bg-gray-50/50">
            <h3 className="font-medium text-black">Recent Transactions</h3>
          </div>
          <div className="divide-y divide-[#e5e5e5]">
            {recentTxs.length === 0 ? (
              <div className="p-8 text-center text-gray-500 text-sm">No recent transactions.</div>
            ) : (
              recentTxs.map(tx => (
                <div key={tx.id} className="p-4 px-6 flex items-center justify-between hover:bg-gray-50 transition-colors cursor-default">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-full bg-black/5 flex items-center justify-center">
                      <Layers size={16} className="text-black" />
                    </div>
                    <div>
                      <div className="font-medium text-sm text-black">{tx.description}</div>
                      <div className="text-xs text-gray-500">{new Date(tx.date).toLocaleDateString()} &middot; {tx.id.substring(0,8)}</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-mono text-sm font-medium text-black">
                      {formatCurrency(tx.lines.reduce((s, l) => s + Math.abs(l.amountCents), 0) / 2)}
                    </div>
                    <div className="text-[11px] text-gray-400 uppercase tracking-wider mt-0.5">{tx.status || 'Posted'}</div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-black text-white rounded-xl shadow-md border border-black p-6">
            <div className="flex items-center gap-3 mb-4">
              <Sparkles size={20} className="text-gray-300" />
              <h3 className="font-medium text-lg">AI Copilot</h3>
            </div>
            <p className="text-sm text-gray-400 mb-6 leading-relaxed">
              Use Cmd+K to ask questions about your ledger, categorize anomalies, or forecast cash flow.
            </p>
            <button 
              onClick={() => setCommandPaletteOpen(true)}
              className="w-full py-2.5 bg-white text-black text-[13px] font-medium rounded-lg hover:bg-gray-100 transition-colors active:scale-[0.98]"
            >
              Open Copilot
            </button>
          </div>

          <div className="ledger-card p-6 h-fit">
            <h3 className="font-medium text-black mb-4">Quick Actions</h3>
            <div className="space-y-2">
              <button 
                onClick={() => setCommandPaletteOpen(true)}
                className="w-full flex items-center gap-3 p-3 text-[13px] font-medium text-gray-600 hover:bg-gray-50 hover:text-black rounded-lg transition-colors text-left"
              >
                <Briefcase size={16} className="text-gray-400" />
                <span>Create new invoice</span>
              </button>
              <button 
                onClick={() => setCommandPaletteOpen(true)}
                className="w-full flex items-center gap-3 p-3 text-[13px] font-medium text-gray-600 hover:bg-gray-50 hover:text-black rounded-lg transition-colors text-left"
              >
                <Clock size={16} className="text-gray-400" />
                <span>Reconcile bank feed</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
