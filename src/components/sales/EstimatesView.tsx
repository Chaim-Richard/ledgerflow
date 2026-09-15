import React, { useState } from 'react';
import { useLedgerStore } from '../../stores/useLedgerStore';
import { useAuthStore } from '../../stores/useAuthStore';
import { formatCurrency, getLocalDateISO } from '../../lib/utils';
import { Plus, ArrowRight, FileText, CheckCircle, Clock } from 'lucide-react';
import { collection, addDoc, doc, updateDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import { toast } from 'sonner';

export default function EstimatesView() {
  const user = useAuthStore(s => s.user);
  const currentWorkspaceId = useAuthStore(s => s.currentWorkspaceId);

  const estimates = useLedgerStore(s => s.estimates);
  const customers = useLedgerStore(s => s.customers);

  const [isCreating, setIsCreating] = useState(false);
  const [customerId, setCustomerId] = useState('');
  const [description, setDescription] = useState('');
  const [amountDollars, setAmountDollars] = useState('');
  const [expiryDate, setExpiryDate] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

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
      const estData = {
        uid: user.uid,
        workspaceId: currentWorkspaceId,
        number: `EST-${Math.floor(1000 + Math.random() * 9000)}`,
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
    } catch (err: any) {
      toast.error(err.message || 'Failed to create estimate');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleConvertToInvoice = async (est: any) => {
    if (!currentWorkspaceId || !user || est.status === 'converted') return;

    try {
      const invData = {
        uid: user.uid,
        workspaceId: currentWorkspaceId,
        number: `INV-${Math.floor(1000 + Math.random() * 9000)}`,
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
    } catch (err: any) {
      toast.error(err.message || 'Failed to convert estimate');
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
            <p className="text-xs text-slate-500 dark:text-slate-400">
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
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Customer *</label>
              <select
                value={customerId}
                onChange={e => setCustomerId(e.target.value)}
                required
                className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
              >
                <option value="">Select Customer...</option>
                {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Amount ($) *</label>
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
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Expiration Date</label>
              <input
                type="date"
                value={expiryDate}
                onChange={e => setExpiryDate(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Description / Project Scope</label>
            <input
              type="text"
              placeholder="e.g. Website Design & Custom ERP Development"
              value={description}
              onChange={e => setDescription(e.target.value)}
              className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
            />
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
        {estimates.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-500">
            No estimates found. Click "New Estimate" to create one.
          </div>
        ) : (
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40 text-slate-500 font-semibold uppercase text-[10px]">
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
                  <td className="py-3 px-4 text-slate-500">{est.date}</td>
                  <td className="py-3 px-4">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${est.status === 'converted' ? 'bg-emerald-500/10 text-emerald-600' : 'bg-amber-500/10 text-amber-600'}`}>
                      {est.status}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-right font-mono font-bold text-slate-900 dark:text-white">
                    {formatCurrency(est.amountCents / 100)}
                  </td>
                  <td className="py-3 px-4 text-right">
                    {est.status !== 'converted' && (
                      <button
                        onClick={() => handleConvertToInvoice(est)}
                        className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white rounded-md transition-colors"
                      >
                        <span>Convert to Invoice</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
