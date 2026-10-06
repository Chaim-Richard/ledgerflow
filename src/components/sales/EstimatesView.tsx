import { RecordInlineField } from '../ui/RecordInlineField';
import React, { useState } from 'react';
import { useLedgerStore } from '../../stores/useLedgerStore';
import { useAuthStore } from '../../stores/useAuthStore';
import { formatCurrency, getLocalDateISO } from '../../lib/utils';
import { Plus, ArrowRight, FileText, Eye, Download } from 'lucide-react';
import { collection, addDoc, doc, updateDoc } from '../../lib/db/firestore';
import { db, getIdToken } from '../../firebase';
import { nextDocumentNumber } from '../../services/documentNumbers';
import { toast } from 'sonner';
import PdfPreviewModal, { downloadDocumentPdf } from '../ui/PdfPreviewModal';
import { useLedgerCollections } from '../../hooks/useLedgerCollections';
import { LoadingState } from '../ui/LoadingState';
import { Labelled } from '../ui/Labelled';
import { useEntityOperations } from '../../hooks/useEntityOperations';
import { convertEstimateToInvoice } from '../../lib/estimateConverter';
import { estimateDeposits } from '../../lib/advancePayments';
import { useCurrentRole } from '../../hooks/useCurrentRole';
import EstimateDepositDialog from './EstimateDepositDialog';

export default function EstimatesView() {
  const user = useAuthStore(s => s.user);
  const currentWorkspaceId = useAuthStore(s => s.currentWorkspaceId);
  const { addEntity } = useEntityOperations();

  const estimates = useLedgerStore(s => s.estimates);
  const customers = useLedgerStore(s => s.customers);
  const payments = useLedgerStore(s => s.payments);
  const { loading } = useLedgerCollections('customers', 'estimates', 'payments');
  const role = useCurrentRole();
  const canTakeDeposit = role === 'owner' || role === 'accountant' || role === 'bookkeeper';
  const [depositFor, setDepositFor] = useState<import("../../types").Estimate | null>(null);

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
      // the next number of the estimate series; never a random one, which could repeat (L-189)
      let allocatedEstNumber: string;
      try {
        allocatedEstNumber = await nextDocumentNumber(currentWorkspaceId, 'estimate');
      } catch (e) {
        toast.error('Not saved: no estimate number', { description: e instanceof Error ? e.message : String(e) });
        return;
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

  // L-163: the invoice goes through the posting path (useEntityOperations), as a draft to review
  // and send, with the estimate's lines; it was written straight to the database as "sent" with
  // no ledger posting (so no receivable or revenue), a dropped totalCents field and no lines.
  const handleConvertToInvoice = async (est: import("../../types").Estimate & { currency?: string; description?: string }) => {
    if (!currentWorkspaceId || !user || est.status === 'converted') return;

    try {
      let invoiceNumber: string | undefined;
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
        if (res.ok) invoiceNumber = (await res.json()).number;
      } catch (e) {
        console.error('Failed to fetch next invoice number', e);
      }
      // no made-up number (a random one could repeat an existing invoice's)
      if (!invoiceNumber) {
        toast.error('Could not get the next invoice number. Please try again.');
        return;
      }

      // the draft invoice (src/lib/estimateConverter.ts, tested); addEntity sets id, uid and workspace
      const { id: _id, uid: _uid, workspaceId: _workspaceId, ...draft } = convertEstimateToInvoice(est);
      const invData = {
        ...draft,
        number: invoiceNumber,
        currency: est.currency || 'USD',
        metadata: { convertedFromEstimateId: est.id, convertedFromEstimateNumber: est.number || est.id },
      };

      const invRef = await addEntity('invoices', invData);
      if (!invRef) return; // addEntity already showed what went wrong

      await updateDoc(doc(db, 'estimates', est.id), {
        status: 'converted',
        convertedInvoiceId: invRef.id,
        updatedAt: new Date().toISOString()
      });

      const deposit = estimateDeposits(payments || [], est.id);
      toast.success(`Estimate converted to draft invoice ${invoiceNumber}. Review it in Sales, then send it.${deposit.unappliedCents > 0 ? ` Its deposit of ${formatCurrency(deposit.unappliedCents)} is applied with "Apply deposit" once it is sent.` : ''}`);
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
          <h2 className="text-sm font-bold text-slate-900 dark:text-white">Create New Quote / Estimate</h2>
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
            <caption className="sr-only">Estimates</caption>
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40 text-[var(--muted)] font-semibold uppercase text-[10px]">
                <th scope="col" className="py-3 px-4">Estimate #</th>
                <th scope="col" className="py-3 px-4">Customer</th>
                <th scope="col" className="py-3 px-4">Date</th>
                <th scope="col" className="py-3 px-4">Status</th>
                <th scope="col" className="py-3 px-4 text-right">Amount</th>
                <th scope="col" className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
              {estimates.map(est => (
                <tr key={est.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30">
                  <td className="py-3 px-4 font-mono font-bold text-slate-900 dark:text-white"><RecordInlineField collection="estimates" record={est} field="number" label={`Reference of estimate ${est.number}`} display={`#${est.number}`} canEdit={est.status === 'draft'} /><div><RecordInlineField collection="estimates" record={est} field="notes" kind="textarea" label={`Notes of estimate ${est.number}`} canEdit={est.status === 'draft'} placeholder="Add notes" /></div></td>
                  <td className="py-3 px-4 text-slate-800 dark:text-slate-200 font-medium">{est.customerName}</td>
                  <td className="py-3 px-4 text-[var(--muted)]"><RecordInlineField collection="estimates" record={est} field="date" kind="date" label={`Date of estimate ${est.number}`} canEdit={est.status === 'draft'} /><div>Expires: <RecordInlineField collection="estimates" record={est} field="expiryDate" kind="date" label={`Expiry of estimate ${est.number}`} canEdit={est.status === 'draft'} placeholder="Add expiry" /></div></td>
                  <td className="py-3 px-4">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${est.status === 'converted' ? 'bg-emerald-500/10 text-emerald-600' : 'bg-amber-500/10 text-amber-600'}`}>
                      {est.status}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-right font-mono font-bold text-slate-900 dark:text-white">
                    {formatCurrency(est.amountCents)}
                    {(() => {
                      const deposit = estimateDeposits(payments || [], est.id);
                      return deposit.receivedCents > 0 ? (
                        <div className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
                          Deposit received {formatCurrency(deposit.receivedCents)}{deposit.unappliedCents > 0 && est.status === 'converted' ? ' · apply it on the invoice' : ''}
                        </div>
                      ) : null;
                    })()}
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
                      {canTakeDeposit && !['converted', 'declined', 'expired'].includes(est.status) && (
                        <button type="button" onClick={() => setDepositFor(est)}
                          className="px-2.5 py-1 text-xs font-semibold border border-[var(--line)] text-[var(--text)] rounded-md hover:bg-slate-100 dark:hover:bg-slate-800"
                          aria-label={`Take a deposit for estimate ${est.number || ''}`.trim()}>
                          Deposit
                        </button>
                      )}
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

      {depositFor && <EstimateDepositDialog estimate={depositFor} onClose={() => setDepositFor(null)} />}
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
