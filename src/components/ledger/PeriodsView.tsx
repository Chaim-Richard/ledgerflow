import React from 'react';
import { format } from 'date-fns';
import { Lock, Unlock } from 'lucide-react';

interface PeriodsViewProps {
  onClosePeriod: () => void;
}

export default function PeriodsView({ onClosePeriod }: PeriodsViewProps) {
  return (
    <div className="bg-[var(--surface)] rounded-[40px] border border-[var(--line)] shadow-sm overflow-hidden">
      <div className="p-4 md:p-8 border-b border-[var(--line)] flex items-center justify-between">
        <div>
          <h3 className="text-xl font-black text-[var(--text)]">Accounting Periods</h3>
          <p className="text-sm text-zinc-500">Manage fiscal periods and closing procedures.</p>
        </div>
        <button 
          onClick={onClosePeriod}
          className="flex items-center gap-2 px-5 py-2.5 bg-zinc-900 text-white rounded-xl text-sm font-bold hover:bg-zinc-800 transition-all"
        >
          <Lock size={18} />
          Close Current Period
        </button>
      </div>
      <div className="p-4 md:p-8">
        <div className="space-y-4">
          <div className="flex items-center justify-between p-6 bg-emerald-50 border border-emerald-100 rounded-[32px]">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-[var(--surface)] rounded-[32px] flex items-center justify-center text-emerald-500 shadow-sm">
                <Unlock size={24} />
              </div>
              <div>
                <p className="text-sm font-bold text-emerald-900">Current Period (Open)</p>
                <p className="text-xs text-emerald-600">{format(new Date(), 'MMMM yyyy')}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 px-3 py-1 bg-[var(--surface)] rounded-full text-[10px] font-bold text-emerald-600 uppercase tracking-widest border border-emerald-100">
              Active
            </div>
          </div>
          
          <div className="pt-8">
            <h4 className="text-xs font-bold text-zinc-400 uppercase tracking-widest mb-4">Closed Periods</h4>
            <div className="space-y-3">
              {[1, 2, 3].map(i => (
                <div key={i} className="flex items-center justify-between p-4 bg-[var(--ink)] rounded-[32px] border border-[var(--line)] opacity-60">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-[var(--surface)] rounded-xl flex items-center justify-center text-zinc-400">
                      <Lock size={18} />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-[var(--text)]">{format(new Date(2025, 12-i, 1), 'MMMM yyyy')}</p>
                      <p className="text-[10px] text-zinc-500 uppercase tracking-widest">Closed on {format(new Date(2025, 12-i, 28), 'MMM dd, yyyy')}</p>
                    </div>
                  </div>
                  <button className="text-xs font-bold text-zinc-400 hover:text-[var(--text)] transition-colors">View Report</button>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
