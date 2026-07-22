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
      <div className="ledger-card p-8 md:p-10 bg-[var(--surface)] border border-[var(--line)] shadow-sm rounded-2xl">
        <div className="flex items-center gap-5 mb-8">
          <div className="w-12 h-12 bg-[var(--brass)] text-black rounded-xl flex items-center justify-center shadow-md">
            <Lock size={24} />
          </div>
          <div>
            <h3 className="text-2xl font-black text-[var(--text)] uppercase tracking-wider">Fiscal Period Locking</h3>
            <p className="text-[10px] font-black text-[var(--muted)] uppercase tracking-widest mt-1">Immutable Ledger Storage Compliance</p>
          </div>
        </div>
        
        <div className="flex flex-col md:flex-row items-stretch md:items-center gap-6 p-6 bg-[var(--ink)]/50 rounded-xl border border-[var(--line)]">
          <div className="flex-1 space-y-1">
            <p className="text-sm font-bold text-[var(--text)] uppercase tracking-tight">Closed Period Lock Date</p>
            <p className="text-[10px] text-[var(--muted)] leading-relaxed font-bold uppercase tracking-widest">
              Transactions on or before this date cannot be modified without administrative override.
            </p>
          </div>
          <input 
            type="date" 
            value={lockDate || ''}
            onChange={(e) => handleLockDateChange(e.target.value || null)}
            className="bg-[var(--surface)] border border-[var(--line)] px-4 py-2.5 rounded-xl font-bold text-[var(--text)] outline-none focus:border-[var(--brass-line)] shadow-sm"
          />
        </div>
      </div>

      <div className="ledger-card p-8 md:p-10 bg-[var(--surface)] border border-[var(--line)] shadow-sm rounded-2xl">
        <div className="flex items-center gap-5 mb-8">
          <div className="w-12 h-12 bg-[var(--ink)] border border-[var(--line)] rounded-xl flex items-center justify-center shadow-sm">
            <ShieldCheck size={24} className="text-[var(--pos)]" />
          </div>
          <div>
            <h3 className="text-2xl font-black text-[var(--text)] uppercase tracking-wider">High-Integrity Firewall</h3>
            <p className="text-[10px] font-black text-[var(--muted)] uppercase tracking-widest mt-1">Zero-Trust Modal Configuration</p>
          </div>
        </div>
        
        <div className="flex flex-col gap-4">
          {[
            { label: 'Rule Encryption', status: 'AES-256 GCM', desc: 'Symmetric encryption for all stored rule keys and model context.', active: true },
            { label: 'Institutional Sync', status: 'Real-time', desc: 'Secure profile synchronization with Firestore Enterprise identity provider.', active: true },
            { label: 'Deterministic Fallback', status: 'Enabled', desc: 'Automatically switch to algorithmic logic if rule confidence drops below 0.65.', active: true },
            { label: 'Blockchain Hashing', status: 'Queued', desc: 'Optional: Commit ledger hashes to an immutable chain for public verification.', active: false }
          ].map((item, i) => (
            <div key={i} className="flex items-start gap-6 p-5 bg-[var(--ink)]/40 border border-[var(--line)] rounded-xl hover:border-[var(--brass-line)] transition-all group">
              <div className="flex-1">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-[10px] font-bold text-[var(--brass)] uppercase tracking-widest">{item.label}</p>
                  <span className={cn(
                    "px-2.5 py-0.5 rounded-md text-[9px] font-bold uppercase tracking-wider border",
                    item.active ? "bg-[var(--pos)]/10 text-[var(--pos)] border-[var(--pos)]/20" : "bg-[var(--surface)] text-[var(--muted)] border-[var(--line)]"
                  )}>
                    {item.status}
                  </span>
                </div>
                <p className="text-xs font-semibold text-[var(--text)] leading-relaxed">{item.desc}</p>
              </div>
            </div>
          ))}

          <div className="pt-6 mt-4 border-t border-[var(--line)]">
            <div className="p-6 bg-rose-500/5 border border-rose-500/20 rounded-xl flex flex-col md:flex-row items-center justify-between gap-6">
                <div className="space-y-1">
                  <h4 className="text-base font-black text-rose-500 uppercase tracking-tight">Institutional Purge System</h4>
                  <p className="text-xs font-medium text-[var(--muted)] leading-relaxed max-w-md">
                    CRITICAL: This protocol will permanently decommission all topological nodes, transactions, and audit logs within this workspace.
                  </p>
                </div>
                <button 
                  onClick={handleSystemPurge}
                  disabled={isResetting}
                  className="px-6 py-3 bg-rose-500 text-white rounded-xl text-[10px] font-bold uppercase tracking-wider hover:bg-rose-600 transition-all shadow-md flex items-center gap-2 disabled:opacity-50 cursor-pointer shrink-0"
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
