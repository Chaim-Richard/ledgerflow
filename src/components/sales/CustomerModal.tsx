import React, { useState } from 'react';
import { X, Save, User } from 'lucide-react';
import { motion } from 'motion/react';
import { Customer } from '../../types';
import AsyncButton from '../ui/AsyncButton';

interface CustomerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (customer: Partial<Customer>) => void;
}

export default function CustomerModal({ isOpen, onClose, onSave }: CustomerModalProps) {
  const [customer, setCustomer] = useState<Partial<Customer>>({
    name: '',
    email: '',
    balanceCents: 0
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSave(customer);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[600] flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-zinc-900/40 backdrop-blur-sm"
      />
      
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="relative w-full max-w-lg bg-[var(--surface)] rounded-[40px] shadow-2xl border border-[var(--line)] overflow-hidden"
      >
        <div className="p-4 md:p-8 border-b border-[var(--line)] flex items-center justify-between bg-[var(--ink)]/50">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-zinc-900 text-white rounded-[32px] flex items-center justify-center shadow-xl shadow-zinc-900/20">
              <User size={24} />
            </div>
            <div>
              <h3 className="text-2xl font-black text-[var(--text)] tracking-tight">Add Customer</h3>
              <p className="text-xs text-zinc-500 font-bold uppercase tracking-widest">CRM & Relationships</p>
            </div>
          </div>
          <button aria-label="Close" onClick={onClose} className="p-2 hover:bg-zinc-100 rounded-full transition-colors text-zinc-400"><X size={24} /></button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 md:p-8 space-y-6 max-h-[80vh] overflow-y-auto custom-scrollbar">
          <div className="space-y-2">
            <label htmlFor="cust-name" className="micro-label">Customer Name</label>
            <input 
              id="cust-name"
              type="text"
              required
              value={customer.name}
              onChange={(e) => setCustomer({ ...customer, name: e.target.value })}
              placeholder="e.g. Acme Corp"
              className="w-full px-5 py-4 bg-[var(--ink)] border border-[var(--line)] rounded-[32px] focus:ring-2 focus:ring-zinc-900 outline-none font-bold"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label htmlFor="cust-email" className="micro-label">Email Address</label>
              <input 
                id="cust-email"
                type="email"
                value={customer.email}
                onChange={(e) => setCustomer({ ...customer, email: e.target.value })}
                placeholder="billing@acme.com"
                className="w-full px-5 py-4 bg-[var(--ink)] border border-[var(--line)] rounded-[32px] focus:ring-2 focus:ring-zinc-900 outline-none font-medium"
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="cust-phone" className="micro-label">Phone Number</label>
              <input 
                id="cust-phone"
                type="tel"
                value={customer.phone || ''}
                onChange={(e) => setCustomer({ ...customer, phone: e.target.value })}
                placeholder="+1 (555) 000-0000"
                className="w-full px-5 py-4 bg-[var(--ink)] border border-[var(--line)] rounded-[32px] focus:ring-2 focus:ring-zinc-900 outline-none font-medium"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label htmlFor="cust-stage" className="micro-label">Stage</label>
              <select 
                id="cust-stage"
                value={customer.pipelineStage || 'lead'}
                onChange={(e) => setCustomer({ ...customer, pipelineStage: e.target.value as any })}
                className="w-full px-5 py-4 bg-[var(--ink)] border border-[var(--line)] rounded-[32px] focus:ring-2 focus:ring-zinc-900 outline-none font-medium"
              >
                <option value="lead">Lead</option>
                <option value="prospect">Prospect</option>
                <option value="active">Active Customer</option>
                <option value="delinquent">Delinquent</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>
            <div className="space-y-2">
              <label htmlFor="cust-segment" className="micro-label">Segment</label>
              <select 
                id="cust-segment"
                value={customer.customerSegment || 'standard'}
                onChange={(e) => setCustomer({ ...customer, customerSegment: e.target.value as any })}
                className="w-full px-5 py-4 bg-[var(--ink)] border border-[var(--line)] rounded-[32px] focus:ring-2 focus:ring-zinc-900 outline-none font-medium"
              >
                <option value="standard">Standard</option>
                <option value="high-value">High Value</option>
                <option value="repeat">Repeat Buyer</option>
                <option value="service-tier">Service Tier</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label htmlFor="cust-score" className="micro-label">Lead Score (0-100)</label>
              <input 
                id="cust-score"
                type="number" min="0" max="100"
                value={customer.score || 0}
                onChange={(e) => setCustomer({ ...customer, score: parseInt(e.target.value, 10) || 0 })}
                className="w-full px-5 py-4 bg-[var(--ink)] border border-[var(--line)] rounded-[32px] focus:ring-2 focus:ring-zinc-900 outline-none font-medium"
              />
            </div>
            <div className="space-y-2 flex flex-col justify-center pt-6">
              <label htmlFor="cust-foreign" className="flex items-center gap-2 cursor-pointer">
                 <input id="cust-foreign" type="checkbox" checked={customer.isForeign || false} onChange={(e) => setCustomer({ ...customer, isForeign: e.target.checked })} className="w-5 h-5 rounded border-zinc-300" />
                 <span className="font-bold text-sm">International/Foreign Entity</span>
              </label>
            </div>
          </div>

          <div className="space-y-2">
            <label htmlFor="cust-notes" className="micro-label">Internal Notes / CRM Info</label>
            <textarea 
              id="cust-notes"
              value={customer.notes || ''}
              onChange={(e) => setCustomer({ ...customer, notes: e.target.value })}
              placeholder="e.g. Prefers email contact, introduced by..."
              className="w-full px-5 py-4 bg-[var(--ink)] border border-[var(--line)] rounded-[32px] focus:ring-2 focus:ring-zinc-900 outline-none font-medium resize-none min-h-[100px]"
            />
          </div>

          <div className="pt-6 flex gap-4">
            <button 
              type="button"
              onClick={onClose}
              className="flex-1 py-4 bg-[var(--surface)] border border-[var(--line)] text-zinc-600 rounded-[32px] font-medium uppercase tracking-wider text-xs hover:bg-[var(--ink)] transition-all"
            >
              Cancel
            </button>
            <AsyncButton 
              type="submit"
              loadingText="Saving..."
              className="flex-1 py-4 bg-zinc-900 text-white rounded-[32px] font-medium uppercase tracking-wider text-xs hover:bg-zinc-800 transition-all shadow-xl shadow-zinc-900/20 flex items-center justify-center gap-2"
            >
              <Save size={18} />
              Save Customer
            </AsyncButton>
          </div>
        </form>
      </motion.div>
    </div>
  );
}
