import React from 'react';
import { Building2, UploadCloud, PieChart, Sparkles, Plus, ArrowRight, Play, ServerCog } from 'lucide-react';
import { useUIStore } from '../../stores/useUIStore';
import { useAuthStore } from '../../stores/useAuthStore';
import { toast } from 'sonner';

export default function OnboardingView() {
  const setQuickEntryOpen = useUIStore(s => s.setQuickEntryOpen);
  const setActiveTab = useUIStore(s => s.setActiveTab);
  
  return (
    <div className="flex-1 bg-[var(--surface)] text-[var(--text)] flex flex-col items-center justify-center p-6 min-h-[100dvh]">
      <div className="max-w-2xl w-full text-center space-y-8 animate-in fade-in slide-in-from-bottom-8 duration-700">
        
        {/* Hero */}
        <div className="space-y-4">
          <div className="w-16 h-16 bg-gradient-to-br from-[var(--brass)] to-[#e5be6b] rounded-2xl mx-auto flex items-center justify-center shadow-lg">
            <ServerCog className="w-8 h-8 text-black" />
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-[var(--text)] font-display">
            Your Ledger is Ready.
          </h1>
          <p className="text-base text-[var(--muted)] max-w-lg mx-auto">
            The mathematical engine is online, but your ledger is empty. Complete these steps to initiate your financial command center.
          </p>
        </div>

        {/* Steps */}
        <div className="grid sm:grid-cols-3 gap-4 text-left max-w-3xl mx-auto mt-12">
          
          <div className="bg-[var(--panel)] border border-[var(--line)] rounded-2xl p-5 hover:border-[var(--brass-line)] transition-colors group cursor-pointer" onClick={() => setActiveTab('banking')}>
            <div className="w-10 h-10 bg-[var(--elevated)] rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
              <UploadCloud className="w-5 h-5 text-indigo-500" />
            </div>
            <h3 className="font-semibold text-sm mb-1">1. Import History</h3>
            <p className="text-xs text-[var(--muted)] leading-relaxed">
              Connect your bank or upload a CSV to seed the ledger. This makes the AI categorizer intelligent.
            </p>
          </div>

          <div className="bg-[var(--panel)] border border-[var(--line)] rounded-2xl p-5 hover:border-[var(--brass-line)] transition-colors group cursor-pointer" onClick={() => setActiveTab('reconciliation')}>
            <div className="w-10 h-10 bg-[var(--elevated)] rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
              <Sparkles className="w-5 h-5 text-amber-500" />
            </div>
            <h3 className="font-semibold text-sm mb-1">2. Train the AI</h3>
            <p className="text-xs text-[var(--muted)] leading-relaxed">
              Review your first batch of categorizations. The system learns your rules automatically.
            </p>
          </div>

          <div className="bg-[var(--panel)] border border-[var(--line)] rounded-2xl p-5 hover:border-[var(--brass-line)] transition-colors group cursor-pointer" onClick={() => setActiveTab('reports')}>
            <div className="w-10 h-10 bg-[var(--elevated)] rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
              <PieChart className="w-5 h-5 text-emerald-500" />
            </div>
            <h3 className="font-semibold text-sm mb-1">3. See Your P&L</h3>
            <p className="text-xs text-[var(--muted)] leading-relaxed">
              Experience the aha moment. Watch your raw data transform into a real-time Profit & Loss statement.
            </p>
          </div>
          
        </div>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mt-12 pt-8 border-t border-[var(--line)] max-w-2xl mx-auto">
          <button 
            onClick={() => setQuickEntryOpen(true)}
            className="w-full px-6 py-3 bg-[var(--brass)] text-black font-semibold rounded-xl hover:opacity-90 transition-opacity flex items-center justify-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Record First Entry Manually
          </button>
        </div>

      </div>
    </div>
  );
}
