import React, { useState } from 'react';
import { useLedgerStore } from '../../stores/useLedgerStore';
import { useAuthStore } from '../../stores/useAuthStore';
import { formatCurrency, getLocalDateISO } from '../../lib/utils';
import { Plus, ArrowRight, FileText, Eye, Download } from 'lucide-react';
import { collection, addDoc, doc, updateDoc } from '../../lib/db/firestore';
import { db, getIdToken } from '../../firebase';
import { toast } from 'sonner';
import PdfPreviewModal, { downloadDocumentPdf } from '../ui/PdfPreviewModal';
import { useLedgerCollections } from '../../hooks/useLedgerCollections';
import { LoadingState } from '../ui/LoadingState';
import { Labelled } from '../ui/Labelled';

export default function EstimatesView() {
  const user = useAuthStore(s => s.user);
  const currentWorkspaceId = useAuthStore(s => s.currentWorkspaceId);

  const estimates = useLedgerStore(s => s.estimates);
  const customers = useLedgerStore(s => s.customers);
  const { loading } = useLedgerCollections('customers', 'estimates');

  const [isCreating, setIsCreating] = useState(false);
  const [customerId, setCustomerId] = useState('');
  const [description, setDescription] = useState('');
  const [amountDollars, setAmountDollars] = useState('');
  const [expiryDate, setExpiryDate] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [previewEstimate, setPreviewEstimate] = useState<import("../../types").Estimate | null>(null);

  const handleCreateEstimate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentWorkspaceId || !user) return;
    const dollars = parseFloat(amountDollars);
    if (isNaN(dollars) || dollars <= 0) {
      toast.error('Please enter a valid amount');
      return;
    }
    if (!customerId) {
      toast.error('Please select a customer');
      return;
    }

    setIsSubmitting(true);
    try {
      const customerObj = customers.find(c => c.id === customerId);
      let allocatedEstNumber = `EST-${Math.floor(1000 + Math.random() * 9000)}`;
      try {
        const token = await getIdToken().catch(() => '');
        const res = await fetch(`/api/v1/workspaces/${currentWorkspaceId}/next-number`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { 'Authorization': `Bearer ${token}` } : {})
          },
          body: JSON.stringify({ type: 'estimate' })
        });
        if (res.ok) {
          const data = await res.json();
          if (data.number) allocatedEstNumber = data.number;
        }
      } catch (e) {
        console.error('Failed to fetch next estimate number', e);
      }

      const estData = {
        uid: user.uid,
        workspaceId: currentWorkspaceId,
        number: allocatedEstNumber,
        customerId,
        customerName: customerObj?.name || 'Customer',
        date: getLocalDateISO(),
        expiryDate: expiryDate || getLocalDateISO(),
        amountCents: Math.round(dollars * 100),
        currency: 'USD',
        status: 'draft' as const,
        description: description || 'Quote / Estimate',
        createdAt: new Date().toISOString()
      };

      await addDoc(collection(db, 'estimates'), estData);
      toast.success('Estimate created successfully');
      setIsCreating(false);
      setCustomerId('');
      setDescription('');
      setAmountDollars('');
    } catch (err) {
      toast.error((err as Error).message || 'Failed to create estimate');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleConvertToInvoice = async (est: import("../../types").Estimate & { currency?: string; description?: string }) => {
    if (!currentWorkspaceId || !user || est.status === 'converted') return;

    try {
      let allocatedInvNumber = `INV-${Math.floor(1000 + Math.random() * 9000)}`;
      try {
        const token = await getIdToken().catch(() => '');
        const res = await fetch(`/api/v1/workspaces/${currentWorkspaceId}/next-number`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { 'Authorization': `Bearer ${token}` } : {})
          },
          body: JSON.stringify({ type: 'invoice' })
        });
        if (res.ok) {
          const data = await res.json();
          if (data.number) allocatedInvNumber = data.number;
        }
      } catch (e) {
        console.error('Failed to fetch next invoice number', e);
      }

      const invData = {
        uid: user.uid,
        workspaceId: currentWorkspaceId,
        number: allocatedInvNumber,
        customerId: est.customerId,
        customerName: est.customerName,
        date: getLocalDateISO(),
        dueDate: getLocalDateISO(),
        amountCents: est.amountCents,
        totalCents: est.amountCents,
        amountPaidCents: 0,
        currency: est.currency || 'USD',
        status: 'sent' as const,
        description: `Converted from Estimate #${est.number}: ${est.description || ''}`,
        createdAt: new Date().toISOString()
      };

      const invRef = await addDoc(collection(db, 'invoices'), invData);

      // Update estimate
      await updateDoc(doc(db, 'estimates', est.id), {
        status: 'converted',
        convertedInvoiceId: invRef.id,
        updatedAt: new Date().toISOString()
      });

      toast.success(`Estimate converted to Invoice #${invData.number}!`);
    } catch (err) {
      toast.error((err as Error).message || 'Failed to convert estimate');
    }
  };

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-cyan-500/10 text-cyan-600 dark:text-cyan-400">
            <FileText className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900 dark:text-white">Estimates & Quotes</h1>
            <p className="text-xs text-[var(--muted)] dark:text-slate-400">
              Create proposals, track client approvals, and convert quotes directly into invoices
            </p>
          </div>
        </div>

        <button
          onClick={() => setIsCreating(true)}
          className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-colors"
        >
          <Plus className="w-4 h-4" />
          New Estimate
        </button>
      </div>

      {/* New Estimate Modal / Form */}
      {isCreating && (
        <form onSubmit={handleCreateEstimate} className="p-6 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl space-y-4">
          <h3 className="text-sm font-bold text-slate-900 dark:text-white">Create New Quote / Estimate</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Labelled labelClassName="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1" label="Customer *">
                <select
                  value={customerId}
                  onChange={e => setCustomerId(e.target.value)}
                  required
                  className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
                >
                  <option value="">Select Customer...</option>
                  {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </Labelled>
            </div>
            <div>
              <Labelled labelClassName="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1" label="Amount ($) *">
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  placeholder="0.00"
                  value={amountDollars}
                  onChange={e => setAmountDollars(e.target.value)}
                  required
                  className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white font-mono"
                />
              </Labelled>
            </div>
            <div>
              <Labelled labelClassName="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1" label="Expiration Date">
                <input
                  type="date"
                  value={expiryDate}
                  onChange={e => setExpiryDate(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
                />
              </Labelled>
            </div>
          </div>
          <div>
            <Labelled labelClassName="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1" label="Description / Project Scope">
              <input
                type="text"
                placeholder="e.g. Website Design & Custom ERP Development"
                value={description}
                onChange={e => setDescription(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
              />
            </Labelled>
          </div>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setIsCreating(false)}
              className="px-3 py-1.5 text-xs text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-lg"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-1.5 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg"
            >
              Save Estimate
            </button>
          </div>
        </form>
      )}

      {/* Estimates Table */}
      <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden bg-white dark:bg-slate-900 shadow-2xs">
        {loading ? <LoadingState what="estimates" /> : estimates.length === 0 ? (
          <div className="p-8 text-center text-xs text-[var(--muted)]">
            No estimates found. Click "New Estimate" to create one.
          </div>
        ) : (
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40 text-[var(--muted)] font-semibold uppercase text-[10px]">
                <th className="py-3 px-4">Estimate #</th>
                <th className="py-3 px-4">Customer</th>
                <th className="py-3 px-4">Date</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Amount</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
              {estimates.map(est => (
                <tr key={est.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30">
                  <td className="py-3 px-4 font-mono font-bold text-slate-900 dark:text-white">#{est.number}</td>
                  <td className="py-3 px-4 text-slate-800 dark:text-slate-200 font-medium">{est.customerName}</td>
                  <td className="py-3 px-4 text-[var(--muted)]">{est.date}</td>
                  <td className="py-3 px-4">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${est.status === 'converted' ? 'bg-emerald-500/10 text-emerald-600' : 'bg-amber-500/10 text-amber-600'}`}>
                      {est.status}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-right font-mono font-bold text-slate-900 dark:text-white">
                    {formatCurrency(est.amountCents)}
                  </td>
                  <td className="py-3 px-4 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      <button
                        onClick={() => setPreviewEstimate(est)}
                        className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md transition-colors"
                        title="Preview PDF"
                      >
                        <Eye className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => downloadDocumentPdf('estimate', est.id, currentWorkspaceId || 'default', `estimate_${est.number || est.id}.pdf`)}
                        className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md transition-colors"
                        title="Download PDF"
                      >
                        <Download className="w-3.5 h-3.5" />
                      </button>
                      {est.status !== 'converted' && (
                        <button
                          onClick={() => handleConvertToInvoice(est)}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white rounded-md transition-colors ml-1"
                        >
                          <span>Convert</span>
                          <ArrowRight className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {previewEstimate && (
        <PdfPreviewModal
          isOpen={!!previewEstimate}
          onClose={() => setPreviewEstimate(null)}
          title={`Estimate ${previewEstimate.number || previewEstimate.id}`}
          documentType="estimate"
          documentId={previewEstimate.id}
          workspaceId={currentWorkspaceId || 'default'}
          filename={`estimate_${previewEstimate.number || previewEstimate.id}.pdf`}
        />
      )}
    </div>
  );
}
