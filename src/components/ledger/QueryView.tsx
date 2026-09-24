import React, { useState, useMemo } from 'react';
import { useLedgerStore } from '../../stores/useLedgerStore';
import { useSavedViewsStore, SavedViewFilter } from '../../stores/useSavedViewsStore';
import { isPostable, isTransactionInDateRange, getAbsoluteTotal } from '../../lib/txFilters';
import { formatDecimal, getLocalDateISO } from '../../lib/utils';
import { TanStackDataGrid } from '../ui/TanStackDataGrid';
import { ColumnDef } from '@tanstack/react-table';
import { Filter, Download, Bookmark } from 'lucide-react';
import { toast } from 'sonner';
import { Transaction } from '../../types';

// Credit note for Fava (MIT License) inspiration:
// Inspired by Fava (beancount/fava - MIT License) ad-hoc ledger query engine architecture.

export default function QueryView() {
  const transactions = useLedgerStore(s => s.transactions);
  const { views, addSavedView } = useSavedViewsStore();

  const [queryFilter, setQueryFilter] = useState<SavedViewFilter>({
    searchTerm: '',
    startDate: '',
    endDate: '',
    minAmountCents: undefined,
    maxAmountCents: undefined,
    accountIds: [],
    status: 'all'
  });

  const [savedQueryName, setSavedQueryName] = useState('');
  const [showSaveModal, setShowSaveModal] = useState(false);

  // Execute query against transactions using txFilters primitives
  const queryResults = useMemo(() => {
    return transactions.filter(tx => {
      if (!isPostable(tx)) return false;

      // Date range filter
      if (queryFilter.startDate || queryFilter.endDate) {
        if (!isTransactionInDateRange(tx, queryFilter.startDate, queryFilter.endDate)) {
          return false;
        }
      }

      // Account filter
      if (queryFilter.accountIds && queryFilter.accountIds.length > 0) {
        const txAccountIds = (tx.lines || []).map(l => l.accountId);
        if (!queryFilter.accountIds.some(id => txAccountIds.includes(id))) {
          return false;
        }
      }

      // Amount Range
      const totalCents = getAbsoluteTotal(tx);
      if (queryFilter.minAmountCents !== undefined && totalCents < queryFilter.minAmountCents) {
        return false;
      }
      if (queryFilter.maxAmountCents !== undefined && totalCents > queryFilter.maxAmountCents) {
        return false;
      }

      // Text search
      if (queryFilter.searchTerm) {
        const term = queryFilter.searchTerm.toLowerCase();
        const matchesDesc = (tx.description || '').toLowerCase().includes(term);
        const matchesPayee = (tx.payee || '').toLowerCase().includes(term);
        const matchesLines = (tx.lines || []).some(l => 
          (l.accountName || '').toLowerCase().includes(term) || (l.description || '').toLowerCase().includes(term)
        );
        if (!matchesDesc && !matchesPayee && !matchesLines) {
          return false;
        }
      }

      return true;
    });
  }, [transactions, queryFilter]);

  // Define TanStack columns
  const columns = useMemo<ColumnDef<Transaction, any>[]>(() => [
    {
      accessorKey: 'date',
      header: 'Date',
      cell: (info: any) => <span className="font-mono text-slate-700">{info.getValue() as string}</span>
    },
    {
      accessorKey: 'id',
      header: 'Tx ID',
      cell: (info: any) => <span className="font-mono font-bold text-slate-900">{info.getValue() as string}</span>
    },
    {
      accessorKey: 'payee',
      header: 'Payee / Entity',
      cell: (info: any) => <span>{info.getValue() as string || info.row.original.description || 'N/A'}</span>
    },
    {
      accessorKey: 'lines',
      header: 'Accounts & Category',
      cell: (info: any) => {
        const lines = info.getValue() as any[];
        if (!lines || lines.length === 0) return <span className="text-slate-400">Uncategorized</span>;
        return (
          <div className="space-y-0.5">
            {lines.slice(0, 2).map((l, i) => (
              <div key={i} className="text-xs text-slate-600">
                <span className="font-semibold">{l.accountName}</span> ({formatDecimal(l.amountCents / 100)})
              </div>
            ))}
            {lines.length > 2 && <div className="text-[10px] text-slate-400">+{lines.length - 2} more lines</div>}
          </div>
        );
      }
    },
    {
      id: 'total',
      header: 'Amount',
      cell: (info: any) => {
        const total = getAbsoluteTotal(info.row.original) / 100;
        return <span className="font-mono font-bold text-slate-900">${formatDecimal(total)}</span>;
      }
    }
  ], []);

  // CSV Export
  const handleExportCSV = () => {
    if (queryResults.length === 0) {
      toast.error('No results to export');
      return;
    }

    const headers = ['Date', 'Transaction ID', 'Payee', 'Description', 'Amount'];
    const rows = queryResults.map(tx => [
      tx.date,
      tx.id,
      `"${(tx.payee || '').replace(/"/g, '""')}"`,
      `"${(tx.description || '').replace(/"/g, '""')}"`,
      (getAbsoluteTotal(tx) / 100).toFixed(2)
    ]);

    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `ledger_query_${getLocalDateISO()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('Query results exported to CSV');
  };

  const handleSaveQuery = () => {
    if (!savedQueryName.trim()) {
      toast.error('Please enter a query name');
      return;
    }

    addSavedView({
      name: savedQueryName,
      description: 'Saved custom ad-hoc ledger query',
      filter: queryFilter,
      targetTab: 'transactions'
    });

    toast.success('Query saved to your views library');
    setShowSaveModal(false);
    setSavedQueryName('');
  };

  return (
    <div className="p-6 md:p-8 space-y-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Ad-Hoc Deterministic Query Builder</h1>
            <span className="px-2.5 py-0.5 bg-indigo-50 border border-indigo-200 text-indigo-700 text-[10px] font-bold rounded-full uppercase">
              Fava BQL Spec
            </span>
          </div>
          <p className="text-xs text-slate-500 font-medium mt-1">
            Build repeatable ledger queries across date ranges, account codes, transaction totals, and metadata tags
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowSaveModal(true)}
            className="px-4 py-2 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-all flex items-center gap-1.5 shadow-2xs cursor-pointer"
          >
            <Bookmark size={14} className="text-indigo-600" />
            <span>Save Query</span>
          </button>
          <button
            onClick={handleExportCSV}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl transition-all flex items-center gap-1.5 shadow-2xs cursor-pointer"
          >
            <Download size={14} />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* Query Filter Controls Box */}
      <div className="p-6 bg-white border border-slate-200 rounded-2xl shadow-2xs space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-2">
            <Filter size={14} className="text-indigo-600" />
            <span>Query Filters & Criteria</span>
          </h3>
          <button
            onClick={() => setQueryFilter({ searchTerm: '', startDate: '', endDate: '', minAmountCents: undefined, maxAmountCents: undefined, accountIds: [], status: 'all' })}
            className="text-xs text-slate-400 hover:text-slate-600 font-medium"
          >
            Reset All
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Text Search</label>
            <input
              type="text"
              value={queryFilter.searchTerm || ''}
              onChange={e => setQueryFilter({ ...queryFilter, searchTerm: e.target.value })}
              placeholder="Search payee, memo, tx #..."
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Start Date</label>
            <input
              type="date"
              value={queryFilter.startDate || ''}
              onChange={e => setQueryFilter({ ...queryFilter, startDate: e.target.value })}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">End Date</label>
            <input
              type="date"
              value={queryFilter.endDate || ''}
              onChange={e => setQueryFilter({ ...queryFilter, endDate: e.target.value })}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Min Amount ($)</label>
            <input
              type="number"
              value={queryFilter.minAmountCents !== undefined ? queryFilter.minAmountCents / 100 : ''}
              onChange={e => setQueryFilter({ ...queryFilter, minAmountCents: e.target.value ? Number(e.target.value) * 100 : undefined })}
              placeholder="0.00"
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
        </div>
      </div>

      {/* Query Results Table */}
      <TanStackDataGrid
        data={queryResults}
        columns={columns}
        pageSize={15}
        searchPlaceholder="Filter executed query results..."
      />

      {/* Save Query Modal */}
      {showSaveModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 p-6 max-w-md w-full">
            <h3 className="text-base font-bold text-slate-900 mb-2">Save Custom Ledger Query</h3>
            <p className="text-xs text-slate-500 mb-4">Saved queries can be executed instantly at any time from your Saved Views drawer.</p>
            <input
              type="text"
              value={savedQueryName}
              onChange={e => setSavedQueryName(e.target.value)}
              placeholder="e.g. Transactions > $5k in Q3"
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 mb-6 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <div className="flex items-center justify-end gap-3">
              <button
                onClick={() => setShowSaveModal(false)}
                className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveQuery}
                className="px-4 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-500 rounded-xl shadow-xs"
              >
                Save Preset
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
