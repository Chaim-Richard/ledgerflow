import React, { useState, useMemo } from 'react';
import { useLedgerStore } from '../../stores/useLedgerStore';
import { useEntityOperations } from '../../hooks/useEntityOperations';
import { 
  ShoppingBag, 
  Users, 
  Clock, 
  Plus, 
  Search, 
  FileText, 
  Trash2, 
  CheckCircle,
  AlertCircle,
  DollarSign,
  Ban,
  Download
} from 'lucide-react';
import { formatCurrency } from '../../lib/utils';
import BillModal from './BillModal';
import VendorModal from './VendorModal';
import VendorDetailView from './VendorDetailView';
import ReceivePaymentModal from '../sales/ReceivePaymentModal';
import { toast } from 'sonner';

export default function Purchases() {
  const vendors = useLedgerStore(s => s.vendors) || [];
  const bills = useLedgerStore(s => s.bills) || [];
  const accounts = useLedgerStore(s => s.accounts) || [];
  const { addEntity, updateEntity, deleteEntity } = useEntityOperations();

  const [activeSubTab, setActiveSubTab] = useState<'bills' | 'vendors'>('bills');
  const [selectedVendorId, setSelectedVendorId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  const [isBillModalOpen, setIsBillModalOpen] = useState(false);
  const [isVendorModalOpen, setIsVendorModalOpen] = useState(false);

  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [paymentDocumentId, setPaymentDocumentId] = useState<string | null>(null);
  const [paymentContactId, setPaymentContactId] = useState<string | null>(null);

  // Filter bills based on search term (vendor name, number, etc.)
  const filteredBills = useMemo(() => {
    return bills.filter(b => {
      const vendorName = b.vendorName || '';
      const billNumber = b.number || '';
      const matchText = `${vendorName} ${billNumber}`.toLowerCase();
      return matchText.includes(searchTerm.toLowerCase());
    });
  }, [bills, searchTerm]);

  // Filter vendors based on search term
  const filteredVendors = useMemo(() => {
    return vendors.filter(v => {
      const matchText = `${v.name} ${v.email || ''} ${v.phone || ''} ${v.category || ''}`.toLowerCase();
      return matchText.includes(searchTerm.toLowerCase());
    });
  }, [vendors, searchTerm]);

  const handleAddVendor = async (data: any) => {
    await addEntity('vendors', data, 'Vendor successfully created');
    setIsVendorModalOpen(false);
  };

  const handleAddBill = async (data: any) => {
    await addEntity('bills', data, 'Bill successfully recorded');
    setIsBillModalOpen(false);
  };

  const handleDeleteBill = async (id: string) => {
    if (confirm('Are you sure you want to delete this bill?')) {
      await deleteEntity('bills', id, 'Bill deleted successfully');
    }
  };

  const handleVoidBill = async (id: string) => {
    await updateEntity('bills', id, { status: 'void' }, 'Bill voided successfully');
  };

  const exportBillsToCSV = () => {
    const headers = ['Vendor Name', 'Bill Number', 'Date', 'Due Date', 'Status', 'Amount Cents'];
    const rows = filteredBills.map(b => [
      `"${(b.vendorName || 'Unknown Vendor').replace(/"/g, '""')}"`,
      `"${(b.number || b.id).replace(/"/g, '""')}"`,
      b.date || '',
      b.dueDate || '',
      b.status || 'unpaid',
      b.amountCents || 0
    ]);
    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', 'bills_export.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('Bills exported successfully to CSV');
  };

  if (selectedVendorId) {
    return (
      <VendorDetailView 
        vendorId={selectedVendorId} 
        onBack={() => setSelectedVendorId(null)} 
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Purchases Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
            <ShoppingBag className="w-6 h-6 text-emerald-500" />
            Purchases & AP
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Manage vendor bills, purchase orders, vendors, and Accounts Payable accounts.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {activeSubTab === 'bills' && (
            <button
              onClick={exportBillsToCSV}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-semibold rounded-lg flex items-center gap-2 text-sm shadow-sm transition-colors border border-slate-200 dark:border-slate-800"
            >
              <Download className="w-4 h-4" />
              Export CSV
            </button>
          )}
          <button
            onClick={() => {
              if (activeSubTab === 'bills') {
                setIsBillModalOpen(true);
              } else {
                setIsVendorModalOpen(true);
              }
            }}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-lg flex items-center gap-2 text-sm shadow-sm transition-colors"
          >
            <Plus className="w-4 h-4" />
            {activeSubTab === 'bills' ? 'Record Bill' : 'Add Vendor'}
          </button>
        </div>
      </div>

      {/* Navigation Subtabs */}
      <div className="border-b border-slate-200 dark:border-slate-800 flex items-center gap-6">
        <button
          onClick={() => { setActiveSubTab('bills'); setSearchTerm(''); }}
          className={`pb-3 text-sm font-bold border-b-2 transition-all ${
            activeSubTab === 'bills'
              ? 'border-emerald-500 text-emerald-600 dark:text-emerald-400'
              : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700'
          }`}
        >
          Bills ({bills.length})
        </button>
        <button
          onClick={() => { setActiveSubTab('vendors'); setSearchTerm(''); }}
          className={`pb-3 text-sm font-bold border-b-2 transition-all ${
            activeSubTab === 'vendors'
              ? 'border-emerald-500 text-emerald-600 dark:text-emerald-400'
              : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700'
          }`}
        >
          Vendors ({vendors.length})
        </button>
      </div>

      {/* Search Input Bar */}
      <div className="relative max-w-xs">
        <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
          <Search className="h-4 w-4 text-slate-400" />
        </span>
        <input
          type="text"
          placeholder={activeSubTab === 'bills' ? 'Search bills...' : 'Search vendors...'}
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
          className="w-full pl-9 pr-4 py-2 text-sm bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white shadow-xs focus:ring-1 focus:ring-emerald-500"
        />
      </div>

      {/* Main Tables Container */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
        {activeSubTab === 'bills' ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                  <th className="p-4">Vendor</th>
                  <th className="p-4">Bill #</th>
                  <th className="p-4">Date</th>
                  <th className="p-4">Due Date</th>
                  <th className="p-4">Status</th>
                  <th className="p-4 text-right">Amount</th>
                  <th className="p-4 w-10"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-sm">
                {filteredBills.map(b => {
                  const isOverdue = b.dueDate && new Date(b.dueDate) < new Date() && b.status !== 'paid' && b.status !== 'void';
                  return (
                    <tr key={b.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                      <td className="p-4 font-semibold text-slate-900 dark:text-white">
                        {b.vendorName || 'Unknown Vendor'}
                      </td>
                      <td className="p-4 text-slate-600 dark:text-slate-400 font-mono text-xs">
                        {b.number || b.id.slice(0, 8).toUpperCase()}
                      </td>
                      <td className="p-4 text-slate-500 dark:text-slate-400">
                        {b.date?.slice(0, 10)}
                      </td>
                      <td className="p-4 text-slate-500 dark:text-slate-400">
                        {b.dueDate?.slice(0, 10)}
                      </td>
                      <td className="p-4">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                          b.status === 'paid'
                            ? 'bg-emerald-100 text-emerald-800'
                            : isOverdue
                            ? 'bg-rose-100 text-rose-800'
                            : 'bg-amber-100 text-amber-800'
                        }`}>
                          {b.status === 'paid' ? <CheckCircle size={10} /> : <AlertCircle size={10} />}
                          {b.status || 'Unpaid'}
                        </span>
                      </td>
                      <td className="p-4 text-right font-mono font-bold text-slate-900 dark:text-white">
                        {formatCurrency(b.amountCents || 0)}
                      </td>
                      <td className="p-4 text-right flex items-center justify-end gap-2">
                        {b.status !== 'paid' && b.status !== 'void' && (
                          <>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setPaymentDocumentId(b.id);
                                setPaymentContactId(b.vendorId || '');
                                setIsPaymentModalOpen(true);
                              }}
                              className="px-2 py-1 text-xs bg-emerald-100 hover:bg-emerald-200 text-emerald-800 font-semibold rounded-md flex items-center gap-1 shadow-xs transition-colors"
                            >
                              <DollarSign className="w-3.5 h-3.5" />
                              Pay
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleVoidBill(b.id);
                              }}
                              className="px-2 py-1 text-xs bg-amber-100 hover:bg-amber-200 text-amber-800 font-semibold rounded-md flex items-center gap-1 shadow-xs transition-colors"
                            >
                              <Ban className="w-3.5 h-3.5" />
                              Void
                            </button>
                          </>
                        )}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteBill(b.id);
                          }}
                          className="text-rose-500 hover:text-rose-700 p-1 rounded-lg"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })}

                {filteredBills.length === 0 && (
                  <tr>
                    <td colSpan={7} className="p-8 text-center text-slate-500 dark:text-slate-400">
                      No bills recorded yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                  <th className="p-4">Vendor Name</th>
                  <th className="p-4">Category</th>
                  <th className="p-4">Email</th>
                  <th className="p-4">Phone</th>
                  <th className="p-4 text-right">Outstanding balance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-sm">
                {filteredVendors.map(v => (
                  <tr 
                    key={v.id} 
                    onClick={() => setSelectedVendorId(v.id)}
                    className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors cursor-pointer"
                  >
                    <td className="p-4 font-semibold text-slate-900 dark:text-white">
                      {v.name}
                    </td>
                    <td className="p-4 text-slate-600 dark:text-slate-400">
                      {v.category || 'Standard'}
                    </td>
                    <td className="p-4 text-slate-500 dark:text-slate-400">
                      {v.email || 'N/A'}
                    </td>
                    <td className="p-4 text-slate-500 dark:text-slate-400">
                      {v.phone || 'N/A'}
                    </td>
                    <td className="p-4 text-right font-mono font-bold text-slate-900 dark:text-white">
                      {formatCurrency(v.balanceCents || 0)}
                    </td>
                  </tr>
                ))}

                {filteredVendors.length === 0 && (
                  <tr>
                    <td colSpan={5} className="p-8 text-center text-slate-500 dark:text-slate-400">
                      No vendors listed yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Bill creation modal */}
      <BillModal 
        isOpen={isBillModalOpen}
        onClose={() => setIsBillModalOpen(false)}
        onSave={handleAddBill}
        vendors={vendors}
        accounts={accounts}
      />

      {/* Vendor creation modal */}
      <VendorModal 
        isOpen={isVendorModalOpen}
        onClose={() => setIsVendorModalOpen(false)}
        onSave={handleAddVendor}
      />

      {isPaymentModalOpen && paymentDocumentId && paymentContactId && (
        <ReceivePaymentModal
          isOpen={isPaymentModalOpen}
          onClose={() => setIsPaymentModalOpen(false)}
          defaultDirection="made"
          defaultDocumentId={paymentDocumentId}
          defaultContactId={paymentContactId}
        />
      )}
    </div>
  );
}
