import React, { useState } from 'react';
import { useLedgerStore } from '../../../stores/useLedgerStore';
import { Lock, ShieldCheck, AlertCircle, RefreshCw } from 'lucide-react';
import { cn } from '../../../lib/utils';
import { useAuthStore } from '../../../stores/useAuthStore';
import { useTransactionActions } from '../../../hooks/useTransactionActions';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../../../firebase';
import { toast } from 'sonner';

export default function SecuritySettings() {
  const lockDate = useLedgerStore(s => s.lockDate);
  const setLockDate = useLedgerStore(s => s.setLockDate);
  const [isResetting, setIsResetting] = useState(false);
  const currentWorkspaceId = useAuthStore(state => state.currentWorkspaceId);
  const txActions = useTransactionActions();

  const handleLockDateChange = async (dateStr: string | null) => {
    setLockDate(dateStr);
    if (currentWorkspaceId) {
      try {
        await updateDoc(doc(db, 'workspaces', currentWorkspaceId), {
          lockDate: dateStr
        });
        toast.success("Fiscal lock date synced safely on cloud workspace.");
      } catch (err: any) {
        console.error(err);
        toast.error("Failed to persist fiscal lock configuration.");
      }
    }
  };

  const handleSystemPurge = async () => {
    if (!currentWorkspaceId) return;
    
    setIsResetting(true);
    try {
        await txActions.handleResetWorkspace();
    } catch (err: any) {
        toast.error("Decommission protocol failed: " + err.message);
    } finally {
        setIsResetting(false);
    }
  };

  return (
    <div className="space-y-10">
      {/* Fiscal Period Locking */}
      <div className="ledger-card p-12 bg-[var(--surface)] border-[var(--line)] shadow-sm">
        <div className="flex items-center gap-5 mb-10">
          <div className="w-14 h-14 bg-slate-900 text-white rounded-[32px] flex items-center justify-center shadow-xl">
            <Lock size={28} />
          </div>
          <div>
            <h3 className="text-2xl font-black text-[var(--text)] tracking-tight uppercase tracking-widest">Fiscal Period Locking</h3>
            <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mt-1">Immutable Ledger Storage Compliance</p>
          </div>
        </div>
        
        <div className="flex items-center gap-8 p-4 md:p-8 bg-[var(--surface)] rounded-[32px] border border-[var(--line)]">
          <div className="flex-1 space-y-2">
            <p className="text-sm font-black text-[var(--text)] uppercase tracking-tight">Closed Period Lock Date</p>
            <p className="text-[10px] text-slate-500 leading-relaxed font-bold uppercase tracking-widest">
              Transactions on or before this date cannot be modified without administrative override.
            </p>
          </div>
          <input 
            type="date" 
            value={lockDate || ''}
            onChange={(e) => handleLockDateChange(e.target.value || null)}
            className="bg-[var(--surface)] border border-[var(--line)] px-5 py-3 rounded-xl font-bold text-[var(--text)] outline-none focus:ring-2 focus:ring-indigo-600 shadow-sm"
          />
        </div>
      </div>

      <div className="ledger-card p-12 bg-slate-900 text-white relative overflow-hidden">
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-indigo-600/10 rounded-full -mt-48 -mr-48 blur-[120px] opacity-50" />
        <div className="flex items-center gap-5 mb-12 relative z-10">
          <div className="w-14 h-14 bg-[var(--surface)]/5 border border-white/10 rounded-[32px] flex items-center justify-center shadow-2xl">
            <ShieldCheck size={28} className="text-emerald-400" />
          </div>
          <div>
            <h3 className="text-2xl font-black tracking-tight uppercase tracking-widest">High-Integrity Firewall</h3>
            <p className="text-[10px] font-black text-white/40 uppercase tracking-[0.2em] mt-1">Zero-Trust Modal Configuration</p>
          </div>
        </div>
        
        <div className="flex flex-col gap-8">
          {[
            { label: 'Rule Encryption', status: 'AES-256 GCM', desc: 'Symmetric encryption for all stored rule keys and model context.', active: true },
            { label: 'Institutional Sync', status: 'Real-time', desc: 'Secure profile synchronization with Firestore Enterprise identity provider.', active: true },
            { label: 'Deterministic Fallback', status: 'Enabled', desc: 'Automatically switch to algorithmic logic if rule confidence drops below 0.65.', active: true },
            { label: 'Blockchain Hashing', status: 'Queued', desc: 'Optional: Commit ledger hashes to an immutable chain for public verification.', active: false }
          ].map((item, i) => (
            <div key={i} className="flex items-start gap-6 p-6 bg-[var(--surface)]/5 border border-white/10 rounded-[32px] hover:bg-[var(--surface)]/10 transition-all group">
              <div className="flex-1">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-[10px] font-black text-indigo-600 uppercase tracking-widest">{item.label}</p>
                  <span className={cn(
                    "px-3 py-1 rounded-full text-[9px] font-medium uppercase tracking-wider border",
                    item.active ? "bg-emerald-500/20 text-emerald-400 border-emerald-400/20" : "bg-[var(--surface)]/5 text-slate-500 border-white/5"
                  )}>
                    {item.status}
                  </span>
                </div>
                <p className="text-sm font-bold text-slate-200 leading-relaxed">{item.desc}</p>
              </div>
            </div>
          ))}

          <div className="pt-8 border-t border-white/10">
            <div className="p-4 md:p-8 bg-rose-500/10 border border-rose-500/20 rounded-[32px] flex flex-col md:flex-row items-center justify-between gap-8">
                <div className="space-y-2">
                  <h4 className="text-lg font-black text-rose-500 tracking-tight uppercase italic">Institutional Purge System</h4>
                  <p className="text-xs font-bold text-white/40 leading-relaxed max-w-md">
                    CRITICAL: This protocol will permanently decommission all topological nodes, transactions, and audit logs within this workspace.
                  </p>
                </div>
                <button 
                  onClick={handleSystemPurge}
                  disabled={isResetting}
                  className="px-8 py-4 bg-rose-500 text-white rounded-[32px] text-[10px] font-medium uppercase tracking-wider hover:bg-rose-600 transition-all shadow-xl shadow-rose-500/20 flex items-center gap-3 disabled:opacity-50"
                >
                  {isResetting ? <RefreshCw size={14} className="animate-spin" /> : <AlertCircle size={14} />}
                  {isResetting ? 'DECOMMISSIONING...' : 'INITIATE PURGE'}
                </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
