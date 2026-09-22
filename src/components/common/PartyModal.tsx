import React, { useState, useMemo, useEffect } from 'react';
import { Save, Users, Zap, X } from 'lucide-react';
import { motion } from 'motion/react';
import { PartySide, PARTY_SIDE_CONFIGS } from '../../config/partySides';
import { useLedgerStore } from '../../stores/useLedgerStore';
import { MatchingEngine } from '../../lib/MatchingEngine';
import { toast } from 'sonner';
import AsyncButton from '../ui/AsyncButton';
import { RadixModal, FormLabel } from '../ui/RadixModal';

interface PartyModalProps {
  side: PartySide;
  isOpen: boolean;
  onClose: () => void;
  onSave: (party: any) => void;
  initialData?: any;
}

export default function PartyModal({ side, isOpen, onClose, onSave, initialData }: PartyModalProps) {
  const config = PARTY_SIDE_CONFIGS[side];
  const [party, setParty] = useState<any>({
    name: '',
    email: '',
    phone: '',
    category: '',
    type: side === 'vendor' ? 'supplier' : undefined,
    balanceCents: 0,
    ...initialData
  });

  useEffect(() => {
    if (isOpen) {
      setParty({
        name: '',
        email: '',
        phone: '',
        category: '',
        type: side === 'vendor' ? 'supplier' : undefined,
        balanceCents: 0,
        ...initialData
      });
    }
  }, [isOpen, initialData, side]);

  const transactions = useLedgerStore(s => s.transactions);
  const analyticalPatternCache = useLedgerStore(s => s.analyticalPatternCache);
  const autoRules = useLedgerStore(s => s.autoRules);
  const accounts = useLedgerStore(s => s.accounts);
  const matchingThreshold = useLedgerStore(s => s.matchingThreshold);
  const dimensionNodes = useLedgerStore(s => s.dimensionNodes);

  const engine = useMemo(() => {
    return new MatchingEngine(autoRules, analyticalPatternCache, undefined, matchingThreshold, transactions, dimensionNodes, accounts);
  }, [autoRules, analyticalPatternCache, transactions, matchingThreshold, dimensionNodes, accounts]);

  const handleNameChange = (name: string) => {
    setParty((prev: any) => ({ ...prev, name }));
    if (side === 'vendor' && name.length > 3) {
      const match = engine.resolveCategory(name);
      if (match && !party.category) {
        setParty((prev: any) => ({ ...prev, category: match.accountName }));
        toast.info(`Category match suggested for ${name}: Suggesting ${match.accountName}`, { 
          icon: <Zap size={14} className="text-amber-500" /> 
        });
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSave(party);
  };

  if (side === 'customer') {
    return (
      <RadixModal 
        isOpen={isOpen} 
        onClose={onClose} 
        title={`Add ${config.partySingular}`} 
        description={`Create a new ${config.partySingular.toLowerCase()} profile for invoicing and receivables`}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <FormLabel htmlFor="party-name" required>{config.partySingular} / Organization Name</FormLabel>
            <input
              id="party-name"
              type="text"
              required
              value={party.name || ''}
              onChange={e => handleNameChange(e.target.value)}
              placeholder="Acme Corp"
              className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div>
            <FormLabel htmlFor="party-email">Email Address</FormLabel>
            <input
              id="party-email"
              type="email"
              value={party.email || ''}
              onChange={e => setParty({ ...party, email: e.target.value })}
              placeholder="billing@acme.com"
              className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div>
            <FormLabel htmlFor="party-phone">Phone Number</FormLabel>
            <input
              id="party-phone"
              type="tel"
              value={party.phone || ''}
              onChange={e => setParty({ ...party, phone: e.target.value })}
              placeholder="+1 (555) 000-0000"
              className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div className="pt-4 flex items-center justify-end gap-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
            >
              Cancel
            </button>
            <AsyncButton
              type="submit"
              icon={Save as any}
              variant="primary"
              className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs px-4 py-2 rounded-xl"
            >
              Save {config.partySingular} Profile
            </AsyncButton>
          </div>
        </form>
      </RadixModal>
    );
  }

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
              <h3 className="text-2xl font-black text-[var(--text)] tracking-tight">Add {config.partySingular}</h3>
              <p className="text-xs text-zinc-500 font-bold uppercase tracking-widest">Supply Chain & Payables</p>
            </div>
          </div>
          <button aria-label="Close" onClick={onClose} className="p-2 hover:bg-zinc-100 rounded-full transition-colors text-zinc-400"><X size={24} /></button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 md:p-8 space-y-6 max-h-[80vh] overflow-y-auto custom-scrollbar">
          <div className="space-y-2">
            <label htmlFor="party-vend-name" className="micro-label">{config.partySingular} Name</label>
            <input 
              id="party-vend-name"
              type="text"
              required
              value={party.name || ''}
              onChange={(e) => handleNameChange(e.target.value)}
              placeholder="e.g. Amazon Web Services"
              className="w-full px-5 py-4 bg-[var(--ink)] border border-[var(--line)] rounded-[32px] focus:ring-2 focus:ring-zinc-900 outline-none font-bold"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label htmlFor="party-vend-cat" className="micro-label">Default GL Category</label>
              <input 
                id="party-vend-cat"
                type="text"
                value={party.category || ''}
                onChange={(e) => setParty({ ...party, category: e.target.value })}
                placeholder="e.g. Software, Utilities"
                className="w-full px-5 py-4 bg-[var(--ink)] border border-[var(--line)] rounded-[32px] focus:ring-2 focus:ring-zinc-900 outline-none font-medium"
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="party-vend-type" className="micro-label">{config.partySingular} Type</label>
              <select 
                id="party-vend-type"
                value={party.type || 'supplier'}
                onChange={(e) => setParty({ ...party, type: e.target.value })}
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
              <label htmlFor="party-vend-email" className="micro-label">Email Address</label>
              <input 
                id="party-vend-email"
                type="email"
                value={party.email || ''}
                onChange={(e) => setParty({ ...party, email: e.target.value })}
                placeholder="accounts@vendor.com"
                className="w-full px-5 py-4 bg-[var(--ink)] border border-[var(--line)] rounded-[32px] focus:ring-2 focus:ring-zinc-900 outline-none font-medium"
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="party-vend-phone" className="micro-label">Phone Number</label>
              <input 
                id="party-vend-phone"
                type="tel"
                value={party.phone || ''}
                onChange={(e) => setParty({ ...party, phone: e.target.value })}
                placeholder="+1 (555) 000-0000"
                className="w-full px-5 py-4 bg-[var(--ink)] border border-[var(--line)] rounded-[32px] focus:ring-2 focus:ring-zinc-900 outline-none font-medium"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label htmlFor="party-vend-status" className="micro-label">Status</label>
              <select 
                id="party-vend-status"
                value={party.status || 'active'}
                onChange={(e) => setParty({ ...party, status: e.target.value as any })}
                className="w-full px-5 py-4 bg-[var(--ink)] border border-[var(--line)] rounded-[32px] focus:ring-2 focus:ring-zinc-900 outline-none font-medium"
              >
                <option value="active">Active</option>
                <option value="approved">Approved Vendor</option>
                <option value="inactive">Inactive</option>
                <option value="blocked">Blocked</option>
              </select>
            </div>
            <div className="space-y-2 flex flex-col justify-center pt-6 gap-2">
              <label htmlFor="party-vend-1099" className="flex items-center gap-2 cursor-pointer">
                 <input id="party-vend-1099" type="checkbox" checked={party.is1099 || false} onChange={(e) => setParty({ ...party, is1099: e.target.checked })} className="w-5 h-5 rounded border-zinc-300" />
                 <span className="font-bold text-sm">1099 Tax-Reportable Contractor</span>
              </label>
              <label htmlFor="party-vend-foreign" className="flex items-center gap-2 cursor-pointer">
                 <input id="party-vend-foreign" type="checkbox" checked={party.isForeign || false} onChange={(e) => setParty({ ...party, isForeign: e.target.checked })} className="w-5 h-5 rounded border-zinc-300" />
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
              Save {config.partySingular}
            </AsyncButton>
          </div>
        </form>
      </motion.div>
    </div>
  );
}
