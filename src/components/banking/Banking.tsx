import React, { useState } from 'react';
import { useLedgerStore } from '../../stores/useLedgerStore';
import { useAuthStore } from '../../stores/useAuthStore';
import { Building, Plus, AlertTriangle, CheckCircle2, Clock, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';

export default function Banking() {
  const accounts = useLedgerStore(s => s.accounts).filter(a => a.type === 'asset' && a.subType === 'bank');
  
  const [isConnecting, setIsConnecting] = useState(false);

  const handleConnect = () => {
    setIsConnecting(true);
    // Simulate connection flow
    setTimeout(() => {
      setIsConnecting(false);
      toast.success('Successfully connected to bank');
    }, 2000);
  };

  return (
    <div className="h-full flex flex-col bg-[var(--color-ledger-bg)] p-6 md:p-8 overflow-auto">
      <div className="max-w-5xl mx-auto w-full space-y-8">
        
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-[var(--color-ledger-ink)] font-display tracking-tight flex items-center gap-3">
              <Building className="w-6 h-6 text-indigo-600" />
              Bank Connections
            </h1>
            <p className="text-sm text-[var(--color-ledger-muted)] mt-1">
              Manage your connected bank accounts and sync status.
            </p>
          </div>
          <button 
            onClick={handleConnect}
            disabled={isConnecting}
            className="btn-primary flex items-center gap-2"
          >
            {isConnecting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            Connect Bank
          </button>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {accounts.map(account => (
            <div key={account.id} className="bg-white border border-[var(--color-ledger-line)] rounded-xl p-5 shadow-sm flex flex-col">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-slate-100 rounded-lg flex items-center justify-center">
                    <Building className="w-5 h-5 text-slate-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-slate-900">{account.name}</h3>
                    <p className="text-xs text-slate-500 font-mono">**** {Math.floor(Math.random() * 9000) + 1000}</p>
                  </div>
                </div>
                
                {/* Simulated status */}
                {Math.random() > 0.7 ? (
                  <div className="flex items-center gap-1 text-xs font-medium text-amber-600 bg-amber-50 px-2 py-1 rounded-full">
                    <AlertTriangle className="w-3 h-3" /> Needs Reconnect
                  </div>
                ) : (
                  <div className="flex items-center gap-1 text-xs font-medium text-emerald-600 bg-emerald-50 px-2 py-1 rounded-full">
                    <CheckCircle2 className="w-3 h-3" /> Connected
                  </div>
                )}
              </div>
              
              <div className="mt-auto space-y-4">
                <div className="flex justify-between items-center text-sm">
                  <span className="text-slate-500">Last Synced</span>
                  <span className="text-slate-900 font-medium flex items-center gap-1">
                    <Clock className="w-3 h-3" /> {Math.floor(Math.random() * 24)}h ago
                  </span>
                </div>
                <div className="flex gap-2">
                  <button className="flex-1 px-3 py-1.5 bg-slate-50 text-slate-700 text-xs font-medium rounded-lg border border-slate-200 hover:bg-slate-100 transition-colors">
                    Sync Now
                  </button>
                  <button className="flex-1 px-3 py-1.5 bg-white text-slate-600 text-xs font-medium rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors">
                    Settings
                  </button>
                </div>
              </div>
            </div>
          ))}

          {accounts.length === 0 && (
            <div className="col-span-full py-12 flex flex-col items-center justify-center text-center bg-white border border-[var(--color-ledger-line)] border-dashed rounded-2xl">
              <Building className="w-12 h-12 text-slate-300 mb-4" />
              <h3 className="text-lg font-medium text-slate-900">No Banks Connected</h3>
              <p className="text-slate-500 mt-1 max-w-sm">
                Connect your bank or credit card to automatically import transactions and reconcile your books.
              </p>
              <button onClick={handleConnect} className="mt-6 btn-secondary">
                Connect First Bank
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
