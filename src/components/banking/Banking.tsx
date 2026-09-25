import React, { useState } from 'react';
import { useLedgerStore } from '../../stores/useLedgerStore';
import { useAuthStore } from '../../stores/useAuthStore';
import { Building, AlertTriangle, CheckCircle2, Clock, RefreshCw, Landmark, ArrowRightLeft } from 'lucide-react';
import { toast } from 'sonner';
import { getIdToken } from '../../firebase';
import { cn } from '../../lib/utils';
import PlaidConnectButton from '../finance/PlaidConnectButton';
import { parseCamt053Statement } from '../../lib/camt053Parser';
import { scoreReceiptMatches } from '../../lib/receiptMatcher';
import { TransferModal } from './TransferModal';

export default function Banking() {
  const accounts = useLedgerStore(s => s.accounts).filter(a => 
    (a.type === 'asset' && a.subtype === 'bank') ||
    a.name.toLowerCase().includes('bank') ||
    a.name.toLowerCase().includes('checking') ||
    a.name.toLowerCase().includes('savings') ||
    a.category?.toLowerCase().includes('cash') ||
    a.category?.toLowerCase().includes('bank')
  );
  
  const [syncingAccountId, setSyncingAccountId] = useState<string | null>(null);
  const workspaceId = useAuthStore(s => s.currentWorkspaceId);
  const [needsReconnect, setNeedsReconnect] = useState<{ bankId: string; institutionName: string }[]>([]);
  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);

  const handleSyncNow = async (accountName: string, accountId: string) => {
    setSyncingAccountId(accountId);
    try {
      const token = await getIdToken();
      const res = await fetch('/api/v1/plaid/sync', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ workspaceId, accountId })
      });
      const data = await res.json();
      setNeedsReconnect(Array.isArray(data.needsReconnect) ? data.needsReconnect : []);
      if (res.ok && data.success) {
        toast.success(`Synchronized ${accountName} with bank feed.`);
      } else if (res.ok) {
        toast.info(data.message || 'Bank feed synced. No new transactions.');
      } else {
        toast.error(`Bank feed error: ${data.error || data.message || 'Failed to sync with institution.'}`);
      }
    } catch (err) {
      console.error('Error syncing bank feed:', err);
      toast.error(`Unable to sync bank feed for ${accountName}`);
    } finally {
      setSyncingAccountId(null);
    }
  };

  const handleSyncSuccess = () => {
    toast.success('Bank credentials saved. Transaction feed synchronized.');
  };

  return (
    <div className="h-full flex flex-col bg-[var(--color-ledger-bg)] p-6 md:p-8 overflow-auto">
      <div className="max-w-5xl mx-auto w-full space-y-8">
        
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-[var(--color-ledger-ink)] font-display tracking-tight flex items-center gap-3">
              <Landmark className="w-6 h-6 text-indigo-600" />
              Bank & Institution Connections
            </h1>
            <p className="text-sm text-[var(--color-ledger-muted)] mt-1">
              Manage your connected financial institutions, live feeds, and reconciliation pipelines.
            </p>
          </div>
          <div className="shrink-0 flex items-center gap-2">
            <button
              onClick={() => setIsTransferModalOpen(true)}
              className="px-4 py-2 bg-white hover:bg-neutral-50 text-neutral-800 text-xs font-bold rounded-xl border border-neutral-200 transition-all flex items-center gap-2 shadow-xs cursor-pointer"
            >
              <ArrowRightLeft className="w-4 h-4 text-indigo-600" />
              <span>Transfer Funds</span>
            </button>
            <PlaidConnectButton onSuccessSync={handleSyncSuccess} />
            {needsReconnect.map(b => (
              <div key={b.bankId} role="alert" className="flex items-center gap-3 rounded-xl border border-[var(--neg)] px-3 py-2 text-xs text-[var(--text)]">
                <span>{b.institutionName || 'A bank'} needs you to log in again.</span>
                <PlaidConnectButton bankId={b.bankId} label="Reconnect" onSuccessSync={() => setNeedsReconnect(list => list.filter(x => x.bankId !== b.bankId))} />
              </div>
            ))}
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {accounts.map(account => (
            <div key={account.id} className="bg-white border border-[var(--color-ledger-line)] rounded-2xl p-5 shadow-xs flex flex-col">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-indigo-50 border border-indigo-100 rounded-xl flex items-center justify-center text-indigo-600">
                    <Building className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-slate-900 text-sm leading-tight">{account.name}</h3>
                    <p className="text-xs text-slate-400 font-mono mt-0.5">{account.code ? `Acct ${account.code}` : 'Bank Account'}</p>
                  </div>
                </div>
                
                <div className="flex items-center gap-1 text-[11px] font-bold text-emerald-600 bg-emerald-50 border border-emerald-200/60 px-2 py-0.5 rounded-full">
                  <CheckCircle2 className="w-3 h-3" /> Ready
                </div>
              </div>
              
              <div className="mt-auto pt-4 border-t border-slate-100 space-y-4">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-500 font-medium">Type</span>
                  <span className="text-slate-800 font-mono font-bold uppercase">{account.subtype || account.type || 'Asset'}</span>
                </div>
                <div className="flex gap-2">
                  <button 
                    onClick={() => handleSyncNow(account.name, account.id)}
                    disabled={syncingAccountId === account.id}
                    className="flex-1 px-3 py-2 bg-slate-900 hover:bg-black text-white text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 shadow-xs disabled:opacity-50 cursor-pointer"
                  >
                    <RefreshCw className={cn("w-3.5 h-3.5", syncingAccountId === account.id && "animate-spin")} />
                    <span>{syncingAccountId === account.id ? 'Syncing...' : 'Sync Feed'}</span>
                  </button>
                </div>
              </div>
            </div>
          ))}

          {accounts.length === 0 && (
            <div className="col-span-full py-16 flex flex-col items-center justify-center text-center bg-white border border-[var(--color-ledger-line)] border-dashed rounded-3xl p-8">
              <div className="w-14 h-14 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center mb-4">
                <Landmark className="w-7 h-7" />
              </div>
              <h3 className="text-lg font-bold text-slate-900">No Bank Connections Found</h3>
              <p className="text-slate-500 mt-1 max-w-md text-sm leading-relaxed">
                Connect your checking accounts, credit cards, or cash repositories via secure Plaid link to stream transactions automatically into your ledger.
              </p>
              <div className="mt-6">
                <PlaidConnectButton onSuccessSync={handleSyncSuccess} />
              </div>
            </div>
          )}
        </div>
      </div>
      <TransferModal isOpen={isTransferModalOpen} onClose={() => setIsTransferModalOpen(false)} />
    </div>
  );
}
