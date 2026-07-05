import React from 'react';
import { ChartAccount, PartnerSplit } from '../../types';
import { PieChart, ShieldCheck, Scale, ArrowRightLeft, History } from 'lucide-react';

interface FractionalViewProps {
  accounts: ChartAccount[];
  partners: PartnerSplit[];
  formatCurrency: (val: number) => string;
}

export default function FractionalView({ accounts, partners, formatCurrency }: FractionalViewProps) {
  const totalProfitCents = React.useMemo(() => {
    return accounts
      .filter(a => a.type === 'income' || a.type === 'expense')
      .reduce((sum, a) => a.type === 'income' ? sum + a.balanceCents : sum - a.balanceCents, 0);
  }, [accounts]);

  const fractionalData = React.useMemo(() => {
    return partners.map(p => {
      const profitAllocation = Math.floor((totalProfitCents * p.share) / 100);
      return {
        ...p,
        profitAllocation,
        currentCapital: p.initialCapitalCents + profitAllocation
      };
    });
  }, [partners, totalProfitCents]);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
      {/* Partner Capital Accounts */}
      <div className="bg-white rounded-[40px] border border-slate-200 shadow-sm p-4 md:p-10 relative group">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-ledger-accent via-ledger-google-blue to-ledger-accent opacity-30" />
        <div className="flex items-center justify-between mb-10">
          <h3 className="text-xl font-black text-slate-900 uppercase italic tracking-tighter">Partner Capital Flux</h3>
          <div className="flex items-center gap-2 px-4 py-1.5 bg-slate-50 border border-slate-200 text-indigo-600 rounded-xl text-[9px] font-black uppercase tracking-[0.2em] shadow-sm">
            <PieChart size={14} className="animate-pulse" /> Fractional Neural Core
          </div>
        </div>
        <div className="space-y-6">
          {fractionalData.map(partner => (
            <div key={partner.id} className="p-4 md:p-8 bg-slate-50/20 rounded-[32px] border border-slate-200 hover:border-indigo-600/30 hover:bg-slate-50/40 transition-all group/partner">
              <div className="flex items-center justify-between mb-8">
                <div>
                  <p className="font-black text-slate-900 text-xl uppercase italic tracking-tight">{partner.name}</p>
                  <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mt-1 opacity-40">Active Managing Partner</p>
                </div>
                <div className="px-5 py-2 bg-slate-900 text-white rounded-xl text-[10px] font-black uppercase tracking-[0.2em] shadow-lg shadow-ledger-ink/10 italic">
                  {partner.share}% Equity Vector
                </div>
              </div>
              <div className="grid grid-cols-2 gap-10">
                <div className="space-y-2">
                  <p className="text-[9px] font-black text-slate-500 uppercase tracking-[0.2em] italic">Current Capital Basis</p>
                  <p className="text-2xl font-black font-mono text-slate-900 italic tracking-tighter">{formatCurrency(partner.currentCapital)}</p>
                </div>
                <div className="space-y-2">
                  <p className="text-[9px] font-black text-slate-500 uppercase tracking-[0.2em] italic">Net Profit Allocation</p>
                  <p className="text-2xl font-black font-mono text-indigo-600 italic tracking-tighter">
                    +{formatCurrency(partner.profitAllocation)}
                  </p>
                </div>
              </div>
              <div className="mt-8 pt-6 border-t border-slate-200/50 flex justify-between items-center opacity-0 group-hover/partner:opacity-100 transition-all">
                <button className="text-[9px] font-black text-slate-500 uppercase tracking-[0.2em] hover:text-slate-900 flex items-center gap-2 transition-colors">
                   <History size={14} className="text-indigo-600" /> Alignment Log
                </button>
                <button className="text-[9px] font-black text-indigo-600 uppercase tracking-[0.2em] hover:brightness-110 flex items-center gap-2 italic">
                   Adjust Topological Basis
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* K-1 Generation & Tax Logic */}
      <div className="space-y-10">
        <div className="bg-slate-900 rounded-[40px] p-4 md:p-10 text-white relative overflow-hidden shadow-2xl">
          <div className="absolute top-0 right-0 p-4 md:p-10 opacity-10 pointer-events-none transform translate-x-1/4 -translate-y-1/4 scale-150 rotate-12">
            <ShieldCheck size={200} />
          </div>
          <h3 className="text-2xl font-black uppercase italic tracking-tighter mb-4">Neural K-1 Synthesis</h3>
          <p className="text-white opacity-60 text-[11px] mb-10 leading-relaxed font-bold italic tracking-tight max-w-[80%]">
            The fractional synthesis engine automatically calculates basis adjustments, distributions, and net income allocations based on the immutable quantum record of the ledger core.
          </p>
          <div className="space-y-4">
            <div className="p-4 md:p-8 bg-slate-50/10 rounded-[32px] border border-slate-50/10 backdrop-blur-md flex items-center justify-between group cursor-pointer hover:bg-slate-50/20 transition-all">
              <div>
                <p className="font-black text-lg uppercase italic tracking-tight">Tax Cycle {new Date().getFullYear()}</p>
                <p className="text-[9px] font-black uppercase tracking-[0.3em] opacity-40 mt-1">STATUS: BUFFER READY FOR COMPILATION</p>
              </div>
              <button className="px-8 py-3 bg-slate-50 text-slate-900 rounded-[32px] text-[10px] font-black uppercase tracking-[0.2em] hover:scale-105 transition-all shadow-xl shadow-ledger-bg/20 italic">
                Synthesize Drafts
              </button>
            </div>
            <div className="p-4 md:p-8 bg-slate-50/5 rounded-[32px] border border-slate-50/5 flex items-center justify-between opacity-30 grayscale group">
              <div>
                <p className="font-black text-lg uppercase italic tracking-tight">Tax Cycle {new Date().getFullYear() - 1}</p>
                <p className="text-[9px] font-black uppercase tracking-[0.3em] opacity-40 mt-1">STATUS: REGULATORY ARCHIVE LOCKED</p>
              </div>
              <button className="px-8 py-3 bg-slate-50/20 text-white/40 rounded-[32px] text-[10px] font-black uppercase tracking-[0.2em] cursor-not-allowed italic">
                Access Archive
              </button>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-[40px] border border-slate-200 shadow-sm p-4 md:p-10 group overflow-hidden relative">
          <div className="absolute bottom-0 right-0 p-4 md:p-10 opacity-5 pointer-events-none group-hover:scale-110 transition-transform">
             <Scale size={120} />
          </div>
          <h3 className="text-xl font-black text-slate-900 uppercase italic tracking-tighter mb-8">Fractional Topology Logic</h3>
          <div className="space-y-6">
            <div className="flex gap-6 p-6 rounded-[32px] bg-slate-50/30 border border-slate-200 hover:border-indigo-600/20 transition-all">
              <div className="w-14 h-14 rounded-[32px] bg-white border border-slate-200 flex items-center justify-center text-indigo-600 shadow-inner">
                <Scale size={24} />
              </div>
              <div className="flex-1">
                <p className="text-xs font-black text-slate-900 uppercase tracking-[0.1em] italic">Pro-Rata Equilibrium</p>
                <p className="text-[10px] text-slate-500 font-bold mt-2 opacity-60 leading-relaxed italic">Net income is partitioned according to temporal ownership vectors at the instant of transaction finality.</p>
              </div>
            </div>
            <div className="flex gap-6 p-6 rounded-[32px] bg-slate-50/30 border border-slate-200 hover:border-indigo-600/20 transition-all">
              <div className="w-14 h-14 rounded-[32px] bg-white border border-slate-200 flex items-center justify-center text-indigo-600 shadow-inner">
                <ArrowRightLeft size={24} />
              </div>
              <div className="flex-1">
                <p className="text-xs font-black text-slate-900 uppercase tracking-[0.1em] italic">Dynamic Basis Mapping</p>
                <p className="text-[10px] text-slate-500 font-bold mt-2 opacity-60 leading-relaxed italic">Autonomous tracking of internal vs external topological basis for all participating neural nodes.</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
