import React, { useState } from 'react';
import { useLedgerStore } from '../../stores/useLedgerStore';
import { useAuthStore } from '../../stores/useAuthStore';
import { CreditNote, VendorCredit } from '../../types';
import CreditActionDialog from './CreditActionDialog';
import type { CreditActionTarget } from './CreditActionDialog';
import { EmptyState } from '../ui/EmptyState';
import { Money } from '../ui/Money';
import { 
  FileText, 
  Plus, 
  Users, 
  Building2, 
  DollarSign, 
  Calendar, 
  Tag, 
  CheckCircle2, 
  RotateCcw, 
  ShieldAlert,
  ArrowRight,
  Eye,
  Download
} from 'lucide-react';
import { formatCurrency, getLocalDateISO } from '../../lib/utils';
import { toast } from 'sonner';
import PdfPreviewModal, { downloadDocumentPdf } from '../ui/PdfPreviewModal';
import { useEntityOperations } from '../../hooks/useEntityOperations';
import { creditTaxFrom } from '../../lib/taxCodes';
import { useLedgerCollections } from '../../hooks/useLedgerCollections';
import { LoadingState } from '../ui/LoadingState';

export default function CreditNotesView() {
  const [activeTab, setActiveTab] = useState<'customer' | 'vendor'>('customer');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const currentWorkspaceId = useAuthStore(s => s.currentWorkspaceId);
  const [previewCreditNote, setPreviewCreditNote] = useState<any | null>(null);

  const customers = useLedgerStore(s => s.customers);
  const vendors = useLedgerStore(s => s.vendors);
  const creditNotes = useLedgerStore(s => s.creditNotes || []);
  const vendorCredits = useLedgerStore(s => s.vendorCredits || []);
  const invoices = useLedgerStore(s => s.invoices || []);
  const bills = useLedgerStore(s => s.bills || []);
  const { loading } = useLedgerCollections('bills', 'creditNotes', 'customers', 'invoices', 'vendorCredits', 'vendors');
  const workspaceCurrency = useAuthStore(s => s.getCurrentWorkspace()?.currency) || 'USD';

  const { addEntity } = useEntityOperations();
  const [creditAction, setCreditAction] = useState<CreditActionTarget | null>(null);
  const usable = (c: CreditNote | VendorCredit) => (c.status === 'open' || c.status === 'partially_applied') && (c.remainingCents ?? c.amountCents) > 0;

  // Form State
  const [customerId, setCustomerId] = useState('');
  const [vendorId, setVendorId] = useState('');
  const [invoiceId, setInvoiceId] = useState('');
  const [billId, setBillId] = useState('');
  const [amountStr, setAmountStr] = useState('');
  const [reason, setReason] = useState('');
  const [dateStr, setDateStr] = useState(getLocalDateISO(new Date()));

  const handleCreateCustomerCreditNote = async (e: React.FormEvent) => {
    e.preventDefault();
    const amountCents = Math.round(parseFloat(amountStr || '0') * 100);
    if (!customerId) {
      toast.error('Please select a customer');
      return;
    }
    if (isNaN(amountCents) || amountCents <= 0) {
      toast.error('Please enter a valid positive amount');
      return;
    }

    const customer = customers.find(c => c.id === customerId);
    // A credit for an invoice is in its currency and reverses its share of the tax (L-118)
    const invoice = invoiceId ? invoices.find(i => i.id === invoiceId) : undefined;
    const newCreditNote: Partial<CreditNote> = {
      customerId,
      customerName: customer?.name || 'Customer',
      number: `CN-${Math.floor(1000 + Math.random() * 9000)}`,
      invoiceId: invoiceId || undefined,
      amountCents,
      remainingCents: amountCents,
      date: dateStr,
      reason: reason || 'Customer Refund / Return Credit',
      status: 'open',
      currency: invoice?.currency || workspaceCurrency,
      ...(invoice?.exchangeRate ? { exchangeRate: invoice.exchangeRate } : {}),
      ...(invoice ? creditTaxFrom(amountCents, invoice) : {}),
    };

    await addEntity('creditNotes', newCreditNote, `Credit Note ${newCreditNote.number} issued successfully!`);
    resetForm();
  };

  const handleCreateVendorCredit = async (e: React.FormEvent) => {
    e.preventDefault();
    const amountCents = Math.round(parseFloat(amountStr || '0') * 100);
    if (!vendorId) {
      toast.error('Please select a vendor');
      return;
    }
    if (isNaN(amountCents) || amountCents <= 0) {
      toast.error('Please enter a valid positive amount');
      return;
    }

    const vendor = vendors.find(v => v.id === vendorId);
    const bill = billId ? bills.find(b => b.id === billId) : undefined;
    const newVendorCredit: Partial<VendorCredit> = {
      vendorId,
      vendorName: vendor?.name || 'Vendor',
      number: `VC-${Math.floor(1000 + Math.random() * 9000)}`,
      billId: billId || undefined,
      amountCents,
      remainingCents: amountCents,
      date: dateStr,
      reason: reason || 'Vendor Rebate / Supplier Credit',
      status: 'open',
      currency: bill?.currency || workspaceCurrency,
      ...(bill?.exchangeRate ? { exchangeRate: bill.exchangeRate } : {}),
      ...(bill ? creditTaxFrom(amountCents, bill) : {}),
    };

    await addEntity('vendorCredits', newVendorCredit, `Vendor Credit ${newVendorCredit.number} logged successfully!`);
    resetForm();
  };

  const resetForm = () => {
    setCustomerId('');
    setVendorId('');
    setInvoiceId('');
    setBillId('');
    setAmountStr('');
    setReason('');
    setShowCreateModal(false);
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <RotateCcw className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
            Credit Notes & Vendor Credits
          </h1>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            Issue customer refunds and record supplier rebates without corrupting A/R and A/P aging buckets.
          </p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white font-medium text-sm rounded-lg hover:bg-indigo-700 transition shadow-sm"
        >
          <Plus className="w-4 h-4" />
          {activeTab === 'customer' ? 'New Credit Note' : 'New Vendor Credit'}
        </button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200 dark:border-gray-800">
        <button
          onClick={() => setActiveTab('customer')}
          className={`flex items-center gap-2 py-3 px-4 font-medium text-sm border-b-2 transition ${
            activeTab === 'customer'
              ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400 dark:border-indigo-400'
              : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400'
          }`}
        >
          <Users className="w-4 h-4" />
          Customer Credit Notes (A/R)
          <span className="ml-1 px-2 py-0.5 text-xs bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 rounded-full font-semibold">
            {creditNotes.length}
          </span>
        </button>
        <button
          onClick={() => setActiveTab('vendor')}
          className={`flex items-center gap-2 py-3 px-4 font-medium text-sm border-b-2 transition ${
            activeTab === 'vendor'
              ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400 dark:border-indigo-400'
              : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400'
          }`}
        >
          <Building2 className="w-4 h-4" />
          Vendor Credits (A/P)
          <span className="ml-1 px-2 py-0.5 text-xs bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 rounded-full font-semibold">
            {vendorCredits.length}
          </span>
        </button>
      </div>

      {/* Main List */}
      {activeTab === 'customer' ? (
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden shadow-sm">
          {loading ? <LoadingState what="credit notes" /> : creditNotes.length === 0 ? (
            <EmptyState
              title="No Customer Credit Notes"
              description="Issue credit notes for refunds or overbilling adjustments."
              actionLabel="New Credit Note"
              onAction={() => setShowCreateModal(true)}
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-gray-50 dark:bg-gray-800 text-gray-600 dark:text-gray-400 uppercase text-xs">
                  <tr>
                    <th className="p-3">Number</th>
                    <th className="p-3">Customer</th>
                    <th className="p-3">Date</th>
                    <th className="p-3">Reason</th>
                    <th className="p-3 text-right">Amount</th>
                    <th className="p-3 text-right">Remaining Credit</th>
                    <th className="p-3 text-center">Status</th>
                    <th className="p-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
                  {creditNotes.map((cn) => (
                    <tr key={cn.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                      <td className="p-3 font-mono font-medium text-indigo-600 dark:text-indigo-400">{cn.number}</td>
                      <td className="p-3 font-medium text-gray-900 dark:text-white">{cn.customerName}</td>
                      <td className="p-3 text-gray-600 dark:text-gray-400">{cn.date}</td>
                      <td className="p-3 text-gray-600 dark:text-gray-400">{cn.reason}</td>
                      <td className="p-3 text-right font-semibold text-gray-900 dark:text-white"><Money cents={cn.amountCents} colored /></td>
                      <td className="p-3 text-right font-medium text-indigo-600 dark:text-indigo-400"><Money cents={cn.remainingCents} colored /></td>
                      <td className="p-3 text-center">
                        <span className="px-2 py-1 text-xs rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300 font-semibold">
                          {cn.status.toUpperCase()}
                        </span>
                      </td>
                      <td className="p-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {usable(cn) && (
                            <>
                              <button type="button" onClick={() => setCreditAction({ kind: 'customer', mode: 'apply', id: cn.id, number: cn.number, partyId: cn.customerId, partyName: cn.customerName, remainingCents: cn.remainingCents, currency: cn.currency })} className="rounded-md border border-[var(--line)] px-2 py-1 text-xs font-bold hover:border-[var(--brass-line)]">Apply</button>
                              <button type="button" onClick={() => setCreditAction({ kind: 'customer', mode: 'refund', id: cn.id, number: cn.number, partyId: cn.customerId, partyName: cn.customerName, remainingCents: cn.remainingCents, currency: cn.currency })} className="rounded-md border border-[var(--line)] px-2 py-1 text-xs font-bold hover:border-[var(--brass-line)]">Refund</button>
                            </>
                          )}
                          <button
                            onClick={() => setPreviewCreditNote(cn)}
                            className="p-1.5 text-gray-500 hover:text-indigo-600 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-md transition-colors"
                            title="Preview PDF"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => downloadDocumentPdf('creditNote', cn.id, currentWorkspaceId || 'default', `credit_note_${cn.number || cn.id}.pdf`)}
                            className="p-1.5 text-gray-500 hover:text-indigo-600 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-md transition-colors"
                            title="Download PDF"
                          >
                            <Download className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : (
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden shadow-sm">
          {loading ? <LoadingState what="vendor credits" /> : vendorCredits.length === 0 ? (
            <EmptyState
              title="No Vendor Credits"
              description="Record rebates, returned goods, or price adjustments from suppliers."
              actionLabel="New Vendor Credit"
              onAction={() => setShowCreateModal(true)}
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-gray-50 dark:bg-gray-800 text-gray-600 dark:text-gray-400 uppercase text-xs">
                  <tr>
                    <th className="p-3">Number</th>
                    <th className="p-3">Vendor</th>
                    <th className="p-3">Date</th>
                    <th className="p-3">Reason</th>
                    <th className="p-3 text-right">Amount</th>
                    <th className="p-3 text-right">Remaining Credit</th>
                    <th className="p-3 text-center">Status</th>
                    <th className="p-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
                  {vendorCredits.map((vc) => (
                    <tr key={vc.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                      <td className="p-3 font-mono font-medium text-emerald-600 dark:text-emerald-400">{vc.number}</td>
                      <td className="p-3 font-medium text-gray-900 dark:text-white">{vc.vendorName}</td>
                      <td className="p-3 text-gray-600 dark:text-gray-400">{vc.date}</td>
                      <td className="p-3 text-gray-600 dark:text-gray-400">{vc.reason}</td>
                      <td className="p-3 text-right font-semibold text-gray-900 dark:text-white"><Money cents={vc.amountCents} colored /></td>
                      <td className="p-3 text-right font-medium text-emerald-600 dark:text-emerald-400"><Money cents={vc.remainingCents} colored /></td>
                      <td className="p-3 text-center">
                        <span className="px-2 py-1 text-xs rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300 font-semibold">
                          {vc.status.toUpperCase()}
                        </span>
                      </td>
                      <td className="p-3 text-right">
                        {usable(vc) && (
                          <div className="flex items-center justify-end gap-1.5">
                            <button type="button" onClick={() => setCreditAction({ kind: 'vendor', mode: 'apply', id: vc.id, number: vc.number, partyId: vc.vendorId, partyName: vc.vendorName, remainingCents: vc.remainingCents, currency: vc.currency })} className="rounded-md border border-[var(--line)] px-2 py-1 text-xs font-bold hover:border-[var(--brass-line)]">Apply</button>
                            <button type="button" onClick={() => setCreditAction({ kind: 'vendor', mode: 'refund', id: vc.id, number: vc.number, partyId: vc.vendorId, partyName: vc.vendorName, remainingCents: vc.remainingCents, currency: vc.currency })} className="rounded-md border border-[var(--line)] px-2 py-1 text-xs font-bold hover:border-[var(--brass-line)]">Refund</button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {creditAction && <CreditActionDialog target={creditAction} onClose={() => setCreditAction(null)} />}

      {/* Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-6 w-full max-w-lg shadow-xl space-y-4">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <RotateCcw className="w-5 h-5 text-indigo-600" />
              {activeTab === 'customer' ? 'Issue Customer Credit Note' : 'Record Vendor Credit'}
            </h2>

            <form onSubmit={activeTab === 'customer' ? handleCreateCustomerCreditNote : handleCreateVendorCredit} className="space-y-4">
              {activeTab === 'customer' ? (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Select Customer</label>
                  <select
                    value={customerId}
                    onChange={(e) => setCustomerId(e.target.value)}
                    required
                    className="w-full p-2.5 bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg text-sm text-gray-900 dark:text-white"
                  >
                    <option value="">-- Choose Customer --</option>
                    {customers.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
              ) : (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Select Vendor</label>
                  <select
                    value={vendorId}
                    onChange={(e) => setVendorId(e.target.value)}
                    required
                    className="w-full p-2.5 bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg text-sm text-gray-900 dark:text-white"
                  >
                    <option value="">-- Choose Vendor --</option>
                    {vendors.map(v => (
                      <option key={v.id} value={v.id}>{v.name}</option>
                    ))}
                  </select>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Amount ($)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={amountStr}
                    onChange={(e) => setAmountStr(e.target.value)}
                    placeholder="0.00"
                    required
                    className="w-full p-2.5 bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg text-sm text-gray-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Date</label>
                  <input
                    type="date"
                    value={dateStr}
                    onChange={(e) => setDateStr(e.target.value)}
                    required
                    className="w-full p-2.5 bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg text-sm text-gray-900 dark:text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Reason / Description</label>
                <input
                  type="text"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder={activeTab === 'customer' ? 'e.g. Returned merchandise / price adjustment' : 'e.g. Volume discount rebate'}
                  className="w-full p-2.5 bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg text-sm text-gray-900 dark:text-white"
                />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-600 text-white font-medium text-sm rounded-lg hover:bg-indigo-700 transition"
                >
                  Save & Post
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {previewCreditNote && (
        <PdfPreviewModal
          isOpen={!!previewCreditNote}
          onClose={() => setPreviewCreditNote(null)}
          title={`Credit Note ${previewCreditNote.number || previewCreditNote.id}`}
          documentType="creditNote"
          documentId={previewCreditNote.id}
          workspaceId={currentWorkspaceId || 'default'}
          filename={`credit_note_${previewCreditNote.number || previewCreditNote.id}.pdf`}
        />
      )}
    </div>
  );
}
