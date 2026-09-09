import React, { useState, useMemo } from 'react';
import { X, Save, Users, Zap } from 'lucide-react';
import { motion } from 'motion/react';
import { Vendor } from '../../types';
import { useLedgerStore } from '../../stores/useLedgerStore';
import { useAuthStore } from '../../stores/useAuthStore';
import { MatchingEngine } from '../../lib/MatchingEngine';
import { toast } from 'sonner';
import AsyncButton from '../ui/AsyncButton';

interface VendorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (vendor: Partial<Vendor>) => void;
}

export default function VendorModal({ isOpen, onClose, onSave }: VendorModalProps) {
  const [vendor, setVendor] = useState<Partial<Vendor>>({
    name: '',
    email: '',
    category: '',
    balanceCents: 0
  });

  const transactions = useLedgerStore(s => s.transactions);
  const analyticalPatternCache = useLedgerStore(s => s.analyticalPatternCache);
  const autoRules = useLedgerStore(s => s.autoRules);
  const accounts = useLedgerStore(s => s.accounts);
  const matchingThreshold = useLedgerStore(s => s.matchingThreshold);
  const workspace = useAuthStore(s => s.getCurrentWorkspace());
  const engine = useMemo(() => new MatchingEngine(autoRules, analyticalPatternCache, undefined, matchingThreshold, transactions, workspace?.dimensionNodes, accounts), [autoRules, analyticalPatternCache, transactions, matchingThreshold, workspace?.dimensionNodes, accounts]);

  const handleNameChange = (name: string) => {
    setVendor(prev => ({ ...prev, name }));
    if (name.length > 3) {
      const match = engine.resolveCategory(name);
      if (match && !vendor.category) {
        setVendor(prev => ({ ...prev, category: match.accountName }));
        toast.info(`Category match suggested for ${name}: Suggesting ${match.accountName}`, { icon: <Zap size={14} className="text-amber-500" /> });
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSave(vendor);
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
              <Users size={24} />
            </div>
            <div>
              <h3 className="text-2xl font-black text-[var(--text)] tracking-tight">Add Vendor</h3>
              <p className="text-xs text-zinc-500 font-bold uppercase tracking-widest">Supply Chain & Payables</p>
            </div>
          </div>
          <button aria-label="Close" onClick={onClose} className="p-2 hover:bg-zinc-100 rounded-full transition-colors text-zinc-400"><X size={24} /></button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 md:p-8 space-y-6 max-h-[80vh] overflow-y-auto custom-scrollbar">
          <div className="space-y-2">
            <label className="micro-label">Vendor Name</label>
            <input 
              type="text"
              required
              autoFocus
              value={vendor.name}
              onChange={(e) => handleNameChange(e.target.value)}
              placeholder="e.g. Amazon Web Services"
              className="w-full px-5 py-4 bg-[var(--ink)] border border-[var(--line)] rounded-[32px] focus:ring-2 focus:ring-zinc-900 outline-none font-bold"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="micro-label">Default GL Category</label>
              <div className="relative">
                <input 
                  type="text"
                  value={vendor.category}
                  onChange={(e) => setVendor({ ...vendor, category: e.target.value })}
                  placeholder="e.g. Software, Utilities"
                  className="w-full px-5 py-4 bg-[var(--ink)] border border-[var(--line)] rounded-[32px] focus:ring-2 focus:ring-zinc-900 outline-none font-medium"
                />
              </div>
            </div>
            <div className="space-y-2">
              <label className="micro-label">Vendor Type</label>
              <select 
                value={vendor.type || 'supplier'}
                onChange={(e) => setVendor({ ...vendor, type: e.target.value })}
                className="w-full px-5 py-4 bg-[var(--ink)] border border-[var(--line)] rounded-[32px] focus:ring-2 focus:ring-zinc-900 outline-none font-medium"
              >
                <option value="supplier">General Supplier</option>
                <option value="subcontractor">Subcontractor</option>
                <option value="service_provider">Service Provider</option>
                <option value="freight">Freight / Shipping</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="micro-label">Email Address</label>
              <input 
                type="email"
                value={vendor.email}
                onChange={(e) => setVendor({ ...vendor, email: e.target.value })}
                placeholder="accounts@vendor.com"
                className="w-full px-5 py-4 bg-[var(--ink)] border border-[var(--line)] rounded-[32px] focus:ring-2 focus:ring-zinc-900 outline-none font-medium"
              />
            </div>
            <div className="space-y-2">
              <label className="micro-label">Phone Number</label>
              <input 
                type="tel"
                value={vendor.phone || ''}
                onChange={(e) => setVendor({ ...vendor, phone: e.target.value })}
                placeholder="+1 (555) 000-0000"
                className="w-full px-5 py-4 bg-[var(--ink)] border border-[var(--line)] rounded-[32px] focus:ring-2 focus:ring-zinc-900 outline-none font-medium"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="micro-label">Status</label>
              <select 
                value={vendor.status || 'active'}
                onChange={(e) => setVendor({ ...vendor, status: e.target.value as any })}
                className="w-full px-5 py-4 bg-[var(--ink)] border border-[var(--line)] rounded-[32px] focus:ring-2 focus:ring-zinc-900 outline-none font-medium"
              >
                <option value="active">Active</option>
                <option value="approved">Approved Vendor</option>
                <option value="inactive">Inactive</option>
                <option value="blocked">Blocked</option>
              </select>
            </div>
            <div className="space-y-2 flex flex-col justify-center pt-6 gap-2">
              <label className="flex items-center gap-2 cursor-pointer">
                 <input type="checkbox" checked={vendor.is1099 || false} onChange={(e) => setVendor({ ...vendor, is1099: e.target.checked })} className="w-5 h-5 rounded border-zinc-300" />
                 <span className="font-bold text-sm">1099 Tax-Reportable Contractor</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                 <input type="checkbox" checked={vendor.isForeign || false} onChange={(e) => setVendor({ ...vendor, isForeign: e.target.checked })} className="w-5 h-5 rounded border-zinc-300" />
                 <span className="font-bold text-sm">Foreign Entity (Wire/FX)</span>
              </label>
            </div>
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
              Save Vendor
            </AsyncButton>
          </div>
        </form>
      </motion.div>
    </div>
  );
}
