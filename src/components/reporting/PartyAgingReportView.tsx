import React, { useState } from 'react';
import { useLedgerStore } from '../../stores/useLedgerStore';
import { formatCurrency } from '../../lib/utils';
import { differenceInDays, parseISO } from 'date-fns';
import { 
  FileText, 
  ArrowLeft, 
  Calendar, 
  TrendingUp, 
  Download, 
  ChevronRight, 
  Users, 
  Clock, 
  Search,
  Filter
} from 'lucide-react';

interface PartyAgingReportViewProps {
  side: 'customer' | 'vendor';
}

interface AgingRow {
  partyId: string;
  partyName: string;
  current: number;       // 0 - 30 days
  thirtyToSixty: number; // 31 - 60 days
  sixtyToNinety: number; // 61 - 90 days
  overNinety: number;    // 91+ days
  total: number;
}

export default function PartyAgingReportView({ side }: PartyAgingReportViewProps) {
  const isCustomer = side === 'customer';
  
  // Get data from store
  const rawCustomers = useLedgerStore(s => s.customers) || [];
  const rawVendors = useLedgerStore(s => s.vendors) || [];
  const rawInvoices = useLedgerStore(s => s.invoices) || [];
  const rawBills = useLedgerStore(s => s.bills) || [];

  const parties = isCustomer ? rawCustomers : rawVendors;
  const documents = isCustomer ? rawInvoices : rawBills;

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedPartyId, setSelectedPartyId] = useState<string | null>(null);

  // Filter only outstanding documents (status not paid, void, draft)
  const outstandingDocs = documents.filter(doc => {
    const status = (doc.status || '').toLowerCase();
    return status !== 'paid' && status !== 'void' && status !== 'draft';
  });

  // Calculate aging for each party
  const agingRows: AgingRow[] = parties.map(party => {
    const partyDocs = outstandingDocs.filter(d => {
      const matchId = isCustomer ? (d as any).customerId : (d as any).vendorId;
      return matchId === party.id;
    });

    let current = 0;
    let thirtyToSixty = 0;
    let sixtyToNinety = 0;
    let overNinety = 0;
    let total = 0;

    partyDocs.forEach(doc => {
      const docDate = doc.date ? parseISO(doc.date.slice(0, 10)) : new Date();
      const ageDays = differenceInDays(new Date(), docDate);
      
      const docTotal = doc.amountCents || 0;
      const docPaid = (doc as any).amountPaidCents || 0;
      const outstandingAmount = Math.max(0, docTotal - docPaid);

      if (outstandingAmount > 0) {
        total += outstandingAmount;
        if (ageDays <= 30) {
          current += outstandingAmount;
        } else if (ageDays <= 60) {
          thirtyToSixty += outstandingAmount;
        } else if (ageDays <= 90) {
          sixtyToNinety += outstandingAmount;
        } else {
          overNinety += outstandingAmount;
        }
      }
    });

    return {
      partyId: party.id,
      partyName: party.name,
      current,
      thirtyToSixty,
      sixtyToNinety,
      overNinety,
      total
    };
  }).filter(row => row.total > 0); // Only show parties with outstanding balance

  // Search filter
  const filteredRows = agingRows.filter(row => 
    row.partyName.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Totals
  const totalCurrent = filteredRows.reduce((sum, r) => sum + r.current, 0);
  const total30to60 = filteredRows.reduce((sum, r) => sum + r.thirtyToSixty, 0);
  const total60to90 = filteredRows.reduce((sum, r) => sum + r.sixtyToNinety, 0);
  const total90plus = filteredRows.reduce((sum, r) => sum + r.overNinety, 0);
  const grandTotal = filteredRows.reduce((sum, r) => sum + r.total, 0);

  // Selected party documents for drill down
  const selectedParty = parties.find(p => p.id === selectedPartyId);
  const selectedPartyDocs = selectedPartyId
    ? outstandingDocs.filter(d => {
        const matchId = isCustomer ? (d as any).customerId : (d as any).vendorId;
        return matchId === selectedPartyId;
      })
    : [];

  return (
    <div className="space-y-6">
      {/* Title Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
            <Clock className="w-6 h-6 text-indigo-500" />
            {isCustomer ? 'Accounts Receivable (AR) Aging' : 'Accounts Payable (AP) Aging'}
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Aging schedule of outstanding {isCustomer ? 'customer invoices' : 'vendor bills'} grouped by outstanding duration.
          </p>
        </div>
      </div>

      {/* Visual Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Total Outstanding</span>
          <span className="text-xl font-mono font-black text-slate-900 dark:text-white tracking-tight block mt-1">
            {formatCurrency(grandTotal / 100)}
          </span>
        </div>
        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">0 - 30 Days</span>
          <span className="text-xl font-mono font-black text-emerald-600 dark:text-emerald-400 tracking-tight block mt-1">
            {formatCurrency(totalCurrent / 100)}
          </span>
        </div>
        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">31 - 60 Days</span>
          <span className="text-xl font-mono font-black text-amber-500 tracking-tight block mt-1">
            {formatCurrency(total30to60 / 100)}
          </span>
        </div>
        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">61 - 90 Days</span>
          <span className="text-xl font-mono font-black text-orange-500 tracking-tight block mt-1">
            {formatCurrency(total60to90 / 100)}
          </span>
        </div>
        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">91+ Days</span>
          <span className="text-xl font-mono font-black text-rose-600 dark:text-rose-400 tracking-tight block mt-1">
            {formatCurrency(total90plus / 100)}
          </span>
        </div>
      </div>

      {/* Main Filter & Table area */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="relative w-full sm:max-w-xs">
            <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
              <Search className="h-4 w-4 text-slate-400" />
            </span>
            <input
              type="text"
              placeholder={`Search by ${isCustomer ? 'customer' : 'vendor'}...`}
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                <th className="p-4">{isCustomer ? 'Customer' : 'Vendor'}</th>
                <th className="p-4 text-right">0-30 Days</th>
                <th className="p-4 text-right">31-60 Days</th>
                <th className="p-4 text-right">61-90 Days</th>
                <th className="p-4 text-right">91+ Days</th>
                <th className="p-4 text-right">Total Outstanding</th>
                <th className="p-4 w-10"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-sm">
              {filteredRows.map(row => (
                <tr 
                  key={row.partyId}
                  onClick={() => setSelectedPartyId(row.partyId)}
                  className="hover:bg-slate-50 dark:hover:bg-slate-800/40 cursor-pointer transition-colors group"
                >
                  <td className="p-4 font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                    <Users className="w-4 h-4 text-slate-400" />
                    {row.partyName}
                  </td>
                  <td className="p-4 text-right font-mono text-slate-600 dark:text-slate-400">
                    {row.current > 0 ? formatCurrency(row.current / 100) : '-'}
                  </td>
                  <td className="p-4 text-right font-mono text-slate-600 dark:text-slate-400">
                    {row.thirtyToSixty > 0 ? formatCurrency(row.thirtyToSixty / 100) : '-'}
                  </td>
                  <td className="p-4 text-right font-mono text-slate-600 dark:text-slate-400">
                    {row.sixtyToNinety > 0 ? formatCurrency(row.sixtyToNinety / 100) : '-'}
                  </td>
                  <td className="p-4 text-right font-mono text-slate-600 dark:text-slate-400">
                    {row.overNinety > 0 ? formatCurrency(row.overNinety / 100) : '-'}
                  </td>
                  <td className="p-4 text-right font-mono font-bold text-slate-900 dark:text-white">
                    {formatCurrency(row.total / 100)}
                  </td>
                  <td className="p-4 text-right">
                    <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-slate-600 dark:group-hover:text-white transition-colors" />
                  </td>
                </tr>
              ))}

              {filteredRows.length === 0 && (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-slate-500 dark:text-slate-400">
                    No outstanding {isCustomer ? 'receivables' : 'payables'} found matching criteria.
                  </td>
                </tr>
              )}
            </tbody>
            {filteredRows.length > 0 && (
              <tfoot>
                <tr className="bg-slate-50 dark:bg-slate-800/30 font-bold text-slate-900 dark:text-white border-t border-slate-200 dark:border-slate-800">
                  <td className="p-4">Grand Total</td>
                  <td className="p-4 text-right font-mono">{formatCurrency(totalCurrent / 100)}</td>
                  <td className="p-4 text-right font-mono">{formatCurrency(total30to60 / 100)}</td>
                  <td className="p-4 text-right font-mono">{formatCurrency(total60to90 / 100)}</td>
                  <td className="p-4 text-right font-mono">{formatCurrency(total90plus / 100)}</td>
                  <td className="p-4 text-right font-mono text-lg">{formatCurrency(grandTotal / 100)}</td>
                  <td></td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      {/* Drill-down DrillDownModal / Side Drawer */}
      {selectedPartyId && selectedParty && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/40 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 w-full max-w-2xl h-full shadow-2xl flex flex-col border-l border-slate-200 dark:border-slate-800">
            {/* Drawer Header */}
            <div className="p-6 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-800/50">
              <div>
                <button 
                  onClick={() => setSelectedPartyId(null)}
                  className="flex items-center gap-1 text-xs text-indigo-600 dark:text-indigo-400 hover:underline font-bold mb-1"
                >
                  <ArrowLeft className="w-3.h-3" /> Back to Aging Schedule
                </button>
                <h3 className="text-xl font-black text-slate-900 dark:text-white">
                  Outstanding Ledger: {selectedParty.name}
                </h3>
              </div>
              <button 
                onClick={() => setSelectedPartyId(null)}
                className="px-3 py-1.5 bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-semibold rounded-lg"
              >
                Close
              </button>
            </div>

            {/* Document list */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {selectedPartyDocs.map(doc => {
                const docTotal = doc.amountCents || 0;
                const docPaid = (doc as any).amountPaidCents || 0;
                const outstanding = Math.max(0, docTotal - docPaid);
                const docDate = doc.date ? parseISO(doc.date.slice(0, 10)) : new Date();
                const ageDays = differenceInDays(new Date(), docDate);

                return (
                  <div 
                    key={doc.id}
                    className="p-4 border border-slate-200 dark:border-slate-800 rounded-xl bg-slate-50 dark:bg-slate-800/30 flex items-center justify-between"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <FileText className="w-4 h-4 text-indigo-500" />
                        <span className="font-bold text-slate-900 dark:text-white">
                          #{doc.number || doc.id.slice(0, 8).toUpperCase()}
                        </span>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-700 uppercase tracking-wider">
                          {ageDays} Days Old
                        </span>
                      </div>
                      <div className="text-xs text-slate-500 dark:text-slate-400">
                        Date: {doc.date?.slice(0, 10)} | Due Date: {doc.dueDate || doc.date?.slice(0, 10)}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-lg font-mono font-black text-slate-900 dark:text-white">
                        {formatCurrency(outstanding / 100)}
                      </div>
                      <div className="text-xs text-slate-400">
                        Total {formatCurrency(docTotal / 100)} | Paid {formatCurrency(docPaid / 100)}
                      </div>
                    </div>
                  </div>
                );
              })}

              {selectedPartyDocs.length === 0 && (
                <div className="text-center py-12 text-slate-400">
                  No unpaid records found.
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
