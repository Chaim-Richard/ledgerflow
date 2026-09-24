import React, { useState } from 'react';
import { useLedgerStore } from '../../../stores/useLedgerStore';
import { Lock, ShieldCheck, AlertCircle, RefreshCw } from 'lucide-react';
import { cn } from '../../../lib/utils';
import { useAuthStore } from '../../../stores/useAuthStore';
import { useTransactionActions } from '../../../hooks/useTransactionActions';
import { doc, updateDoc } from '../../../lib/db/firestore';
import { db } from '../../../firebase';
import { multiFactor, TotpMultiFactorGenerator } from '../../../lib/db/auth';
import { auth } from '../../../firebase';
import { toast } from 'sonner';
import { RequireRole } from '../../ui/RequireRole';

export default function SecuritySettings() {
  const lockDate = useLedgerStore(s => s.lockDate);
  const setLockDate = useLedgerStore(s => s.setLockDate);
  const [isResetting, setIsResetting] = useState(false);
  const currentWorkspaceId = useAuthStore(state => state.currentWorkspaceId);
  const user = useAuthStore(state => state.user);
  const txActions = useTransactionActions();
  
  const [mfaSecret, setMfaSecret] = useState<any>(null);
  const [mfaCode, setMfaCode] = useState('');
  const [isEnrollingMfa, setIsEnrollingMfa] = useState(false);

  const startMfaEnrollment = async () => {
    if (!user) return;
    try {
      setIsEnrollingMfa(true);
      const mfaSession = await multiFactor(user).getSession();
      const secret = await TotpMultiFactorGenerator.generateSecret(mfaSession);
      setMfaSecret(secret);
    } catch (e: any) {
      toast.error('Failed to start MFA: ' + e.message);
      setIsEnrollingMfa(false);
    }
  };

  const completeMfaEnrollment = async () => {
    if (!user || !mfaSecret || !mfaCode) return;
    try {
      const assertion = TotpMultiFactorGenerator.assertionForEnrollment(mfaSecret, mfaCode);
      await multiFactor(user).enroll(assertion, 'Authenticator');
      toast.success('MFA Successfully Enrolled');
      setMfaSecret(null);
      setMfaCode('');
      setIsEnrollingMfa(false);
    } catch (e: any) {
      toast.error('Failed to enroll MFA: ' + e.message);
    }
  };

  const handleLockDateChange = async (dateStr: string | null) => {
    if (dateStr) {
      await txActions.handleCloseMonth(dateStr);
    } else {
      // If we want to allow clearing, we'd need a route for that, 
      // but for now we follow the audit which emphasizes close-month.
      setLockDate(null);
      toast.info("Lock date cleared locally. (Cloud sync requires administrative override)");
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

          <div className="pt-6 mt-4 border-t border-[var(--line)] space-y-6">
            <div className="p-6 bg-[var(--ink)] border border-[var(--line)] rounded-xl flex flex-col md:flex-row items-center justify-between gap-6">
                <div className="space-y-1">
                  <h4 className="text-base font-black text-[var(--text)] uppercase tracking-tight">Multi-Factor Authentication (MFA)</h4>
                  <p className="text-xs font-medium text-[var(--muted)] leading-relaxed max-w-md">
                    Secure your account using an authenticator app (TOTP). Required for administrative actions.
                  </p>
                  {mfaSecret && (
                    <div className="mt-4 p-4 bg-[var(--surface)] border border-[var(--line)] rounded-lg">
                      <p className="text-sm font-bold text-[var(--text)] mb-2">1. Scan or enter this secret in your Authenticator app:</p>
                      <code className="block bg-[var(--ink)] p-2 rounded text-indigo-400 font-mono text-sm break-all mb-4">
                        {mfaSecret.secretKey}
                      </code>
                      <p className="text-sm font-bold text-[var(--text)] mb-2">2. Enter the 6-digit code:</p>
                      <div className="flex gap-2">
                        <input 
                          type="text" 
                          value={mfaCode}
                          onChange={e => setMfaCode(e.target.value)}
                          placeholder="000000"
                          className="bg-[var(--ink)] border border-[var(--line)] px-4 py-2 rounded-lg text-[var(--text)] font-mono outline-none w-32"
                        />
                        <button 
                          onClick={completeMfaEnrollment}
                          className="px-4 py-2 bg-emerald-500 text-white rounded-lg font-bold uppercase tracking-wider text-[10px]"
                        >
                          Verify
                        </button>
                      </div>
                    </div>
                  )}
                </div>
                {!mfaSecret && (
                  <button 
                    onClick={startMfaEnrollment}
                    disabled={isEnrollingMfa}
                    className="px-6 py-3 bg-[var(--surface)] text-[var(--text)] border border-[var(--line)] rounded-xl text-[10px] font-bold uppercase tracking-wider hover:bg-[var(--ink)] transition-all flex items-center gap-2 cursor-pointer shrink-0"
                  >
                    <ShieldCheck size={14} />
                    {isEnrollingMfa ? 'ENROLLING...' : 'ENROLL TOTP'}
                  </button>
                )}
            </div>

            <div className="p-6 bg-[var(--ink)] border border-[var(--line)] rounded-xl flex flex-col md:flex-row items-center justify-between gap-6">
                <div className="space-y-1">
                  <h4 className="text-base font-black text-[var(--text)] uppercase tracking-tight">Active Sessions</h4>
                  <p className="text-xs font-medium text-[var(--muted)] leading-relaxed max-w-md">
                    Revoke all existing sessions and refresh tokens globally. You will be signed out on all devices.
                  </p>
                </div>
                <button 
                  onClick={async () => {
                    try {
                      const res = await fetch('/api/v1/auth/revoke-sessions', {
                        method: 'POST',
                        headers: {
                          'Authorization': `Bearer ${await useAuthStore.getState().user?.getIdToken()}`
                        }
                      });
                      if (!res.ok) throw new Error(await res.text());
                      toast.success('Sessions revoked. You will be signed out.');
                    } catch (err: any) {
                      toast.error('Failed to revoke sessions: ' + err.message);
                    }
                  }}
                  className="px-6 py-3 bg-[var(--surface)] text-[var(--text)] border border-[var(--line)] rounded-xl text-[10px] font-bold uppercase tracking-wider hover:bg-[var(--ink)] transition-all flex items-center gap-2 cursor-pointer shrink-0"
                >
                  <AlertCircle size={14} />
                  REVOKE ALL SESSIONS
                </button>
            </div>

            <div className="p-6 bg-rose-500/5 border border-rose-500/20 rounded-xl flex flex-col md:flex-row items-center justify-between gap-6">
                <div className="space-y-1">
                  <h4 className="text-base font-black text-rose-500 uppercase tracking-tight">Delete User Account</h4>
                  <p className="text-xs font-medium text-[var(--muted)] leading-relaxed max-w-md">
                    Permanently delete your user account and all personal data. Workspaces you own will be orphaned unless transferred.
                  </p>
                </div>
                <button 
                  onClick={async () => {
                    if (confirm('Are you absolutely sure you want to permanently delete your account? This action cannot be undone.')) {
                      try {
                        const res = await fetch('/api/v1/auth/delete-account', {
                          method: 'DELETE',
                          headers: {
                            'Authorization': `Bearer ${await useAuthStore.getState().user?.getIdToken()}`
                          }
                        });
                        if (!res.ok) throw new Error(await res.text());
                        toast.success('Account deleted successfully.');
                        auth.signOut();
                      } catch (err: any) {
                        toast.error('Failed to delete account: ' + err.message);
                      }
                    }
                  }}
                  className="px-6 py-3 bg-rose-500 text-white rounded-xl text-[10px] font-bold uppercase tracking-wider hover:bg-rose-600 transition-all shadow-md flex items-center gap-2 cursor-pointer shrink-0"
                >
                  <AlertCircle size={14} />
                  DELETE ACCOUNT
                </button>
            </div>

            <div className="p-6 bg-rose-500/5 border border-rose-500/20 rounded-xl flex flex-col md:flex-row items-center justify-between gap-6">
                <div className="space-y-1">
                  <h4 className="text-base font-black text-rose-500 uppercase tracking-tight">Institutional Purge System</h4>
                  <p className="text-xs font-medium text-[var(--muted)] leading-relaxed max-w-md">
                    CRITICAL: This protocol will permanently decommission all topological nodes, transactions, and audit logs within this workspace.
                  </p>
                </div>
                <RequireRole requiredRole="owner" disableOnly tooltip="Only the workspace owner can initiate a workspace purge">
                  <button 
                    onClick={handleSystemPurge}
                    disabled={isResetting}
                    className="px-6 py-3 bg-rose-500 text-white rounded-xl text-[10px] font-bold uppercase tracking-wider hover:bg-rose-600 transition-all shadow-md flex items-center gap-2 disabled:opacity-50 cursor-pointer shrink-0"
                  >
                    {isResetting ? <RefreshCw size={14} className="animate-spin" /> : <AlertCircle size={14} />}
                    {isResetting ? 'DECOMMISSIONING...' : 'INITIATE PURGE'}
                  </button>
                </RequireRole>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
