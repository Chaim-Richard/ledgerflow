import React, { useMemo, useState } from 'react';
import { 
  RefreshCw, 
  Plus, 
  Search, 
  Calendar, 
  Clock, 
  Play, 
  Pause, 
  Trash2, 
  Edit2, 
  ArrowRight,
  MoreVertical,
  CheckCircle2,
  AlertCircle,
  FileText,
  DollarSign
} from 'lucide-react';
import { useLedgerStore } from '../../stores/useLedgerStore';
import { RecurringTransaction } from '../../types';
import { formatCurrency, resolveAccountName } from '../../lib/utils';
import { format, parseISO, addMonths, addDays, addWeeks } from 'date-fns';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../../lib/utils';
import { toast } from 'sonner';

export default function RecurringTransactionsView() {
  const recurring = useLedgerStore(s => s.recurring) || [];
  const accounts = useLedgerStore(s => s.accounts) || [];
  const [searchTerm, setSearchTerm] = useState('');
  const [isAdding, setIsAdding] = useState(false);

  const filteredRecurring = useMemo(() => {
    return recurring.filter(r => 
      r.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.payee?.toLowerCase().includes(searchTerm.toLowerCase())
    ).sort((a, b) => (a.nextOccurrence || '').localeCompare(b.nextOccurrence || ''));
  }, [recurring, searchTerm]);

  const getFrequencyLabel = (freq: string) => {
    switch (freq) {
      case 'daily': return 'Daily';
      case 'weekly': return 'Weekly';
      case 'monthly': return 'Monthly';
      case 'quarterly': return 'Quarterly';
      case 'yearly': return 'Yearly';
      default: return freq;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20';
      case 'paused': return 'text-amber-500 bg-amber-500/10 border-amber-500/20';
      case 'completed': return 'text-zinc-500 bg-zinc-500/10 border-zinc-500/20';
      default: return 'text-zinc-500 bg-zinc-500/10 border-zinc-500/20';
    }
  };

  return (
    <div className="flex flex-col h-full bg-[var(--bg)]">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between p-6 border-b border-[var(--line)] bg-[var(--surface)] gap-4">
        <div className="flex items-center gap-4">
          <div className="h-12 w-12 bg-indigo-500/10 text-indigo-500 rounded-xl flex items-center justify-center">
            <RefreshCw size={24} />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Recurring Transactions</h1>
            <p className="text-zinc-500 text-sm">Automate your regular invoices, bills, and journal entries</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative group">
            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 group-focus-within:text-indigo-500 transition-colors" />
            <input 
              type="text"
              placeholder="Search templates..."
              className="pl-10 pr-4 py-2 bg-[var(--bg)] border border-[var(--line)] rounded-lg text-sm w-full md:w-64 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          
          <button 
            onClick={() => setIsAdding(true)}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-500 hover:bg-indigo-600 text-white rounded-lg text-sm font-semibold transition-all shadow-lg shadow-indigo-500/20"
          >
            <Plus size={18} />
            New Recurring
          </button>
        </div>
      </div>

      {/* Stats Summary */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 p-6 bg-[var(--bg)]">
        <div className="bg-[var(--surface)] p-4 rounded-xl border border-[var(--line)]">
          <p className="text-xs text-zinc-500 uppercase font-bold tracking-wider mb-1">Active Rules</p>
          <p className="text-2xl font-bold text-[var(--text)]">{recurring.filter(r => r.status === 'active').length}</p>
        </div>
        <div className="bg-[var(--surface)] p-4 rounded-xl border border-[var(--line)]">
          <p className="text-xs text-zinc-500 uppercase font-bold tracking-wider mb-1">Monthly Volume</p>
          <p className="text-2xl font-bold text-emerald-500">
            {formatCurrency(recurring.filter(r => r.status === 'active' && r.frequency === 'monthly').reduce((acc, curr) => acc + (curr.template.totalAmountCents || 0), 0))}
          </p>
        </div>
        <div className="bg-[var(--surface)] p-4 rounded-xl border border-[var(--line)]">
          <p className="text-xs text-zinc-500 uppercase font-bold tracking-wider mb-1">Next 7 Days</p>
          <p className="text-2xl font-bold text-indigo-500">
            {recurring.filter(r => r.status === 'active' && r.nextOccurrence && new Date(r.nextOccurrence) <= addDays(new Date(), 7)).length}
          </p>
        </div>
        <div className="bg-[var(--surface)] p-4 rounded-xl border border-[var(--line)]">
          <p className="text-xs text-zinc-500 uppercase font-bold tracking-wider mb-1">Total Automated</p>
          <p className="text-2xl font-bold text-zinc-500">{recurring.length}</p>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-6 pt-0">
        <div className="bg-[var(--surface)] border border-[var(--line)] rounded-2xl overflow-hidden shadow-sm">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-[var(--bg)]/50 text-[10px] uppercase font-bold text-zinc-500 tracking-widest border-b border-[var(--line)]">
                <th className="px-6 py-4">Template Description</th>
                <th className="px-6 py-4">Frequency</th>
                <th className="px-6 py-4">Last Run</th>
                <th className="px-6 py-4">Next Occurrence</th>
                <th className="px-6 py-4 text-right">Amount</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4 w-20"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--line)]">
              {filteredRecurring.map((rule) => (
                <tr key={rule.id} className="hover:bg-zinc-500/5 transition-colors group">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 rounded-lg bg-zinc-500/10 text-zinc-500 flex items-center justify-center shrink-0">
                        {((rule.template?.type as any) === 'invoice' || (rule.template as any)?.metadata?.type === 'invoice') ? <FileText size={16} /> : <DollarSign size={16} />}
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-[var(--text)]">{rule.description}</p>
                        <p className="text-xs text-zinc-500">{rule.payee || 'Internal Transfer'}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2 text-sm text-[var(--text)]">
                      <Clock size={14} className="text-zinc-400" />
                      {getFrequencyLabel(rule.frequency)}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <p className="text-sm text-[var(--text)]">
                      {rule.lastOccurrence ? format(parseISO(rule.lastOccurrence), 'MMM dd, yyyy') : 'Never'}
                    </p>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2 text-sm font-medium text-indigo-500">
                      <Calendar size={14} />
                      {rule.nextOccurrence ? format(parseISO(rule.nextOccurrence), 'MMM dd, yyyy') : 'Not scheduled'}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <p className="text-sm font-bold text-[var(--text)]">
                      {formatCurrency(rule.template.totalAmountCents || 0)}
                    </p>
                  </td>
                  <td className="px-6 py-4">
                    <span className={cn(
                      "px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border",
                      getStatusColor(rule.status || 'paused')
                    )}>
                      {rule.status}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button className="p-1.5 text-zinc-400 hover:text-indigo-500 hover:bg-indigo-500/10 rounded-lg transition-all" title="Run Now">
                        <Play size={16} />
                      </button>
                      <button className="p-1.5 text-zinc-400 hover:text-rose-500 hover:bg-rose-500/10 rounded-lg transition-all" title="Delete">
                        <Trash2 size={16} />
                      </button>
                      <button className="p-1.5 text-zinc-400 hover:text-[var(--text)] hover:bg-[var(--bg)] rounded-lg transition-all">
                        <MoreVertical size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filteredRecurring.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-zinc-500">
                    <RefreshCw size={48} className="mx-auto mb-4 opacity-10" />
                    <p className="text-sm font-medium">No recurring transactions found</p>
                    <button 
                      onClick={() => setIsAdding(true)}
                      className="mt-4 text-indigo-500 hover:underline text-sm font-semibold"
                    >
                      Create your first automated rule
                    </button>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
