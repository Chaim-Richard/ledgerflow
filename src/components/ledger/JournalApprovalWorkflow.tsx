import React, { useState } from 'react';
import { CheckCircle2, XCircle, ShieldCheck, User } from 'lucide-react';
import { cn } from '../../lib/utils';
import { useLedgerStore } from '../../stores/useLedgerStore';
import { useAuthStore } from '../../stores/useAuthStore';

export default function JournalApprovalWorkflow() {
  const { transactions } = useLedgerStore();
  const { user } = useAuthStore();
  const [activeTab, setActiveTab] = useState<'pending' | 'approved' | 'rejected'>('pending');

  // Filter pending transactions (requiring review)
  const pendingTxs = transactions.filter(t => t.status === 'pending');

  return (
    <div className="h-full flex flex-col bg-[#FAFAFA]">
      <div className="px-8 py-6 bg-white border-b border-[#E5E5E5] flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-bold text-[#0A0A0A] flex items-center gap-3">
            <ShieldCheck className="w-6 h-6 text-indigo-600" />
            Journal Approvals (Maker-Checker)
          </h1>
          <p className="text-sm text-[#525252] mt-1">Review and approve manual journal entries before they post to the general ledger.</p>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-8">
        <div className="flex items-center justify-between mb-6">
          <div className="flex p-1 bg-white border border-[#E5E5E5] rounded-xl shadow-sm">
            {['pending', 'approved', 'rejected'].map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab as any)}
                className={cn(
                  "px-6 py-2 rounded-lg text-sm font-bold capitalize transition-all flex items-center gap-2",
                  activeTab === tab ? "bg-[#0A0A0A] text-white" : "text-[#525252] hover:bg-[#F5F5F5]"
                )}
              >
                {tab}
                {tab === 'pending' && pendingTxs.length > 0 && (
                  <span className="w-5 h-5 rounded-full bg-rose-500 text-white text-[10px] flex items-center justify-center">
                    {pendingTxs.length}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        {activeTab === 'pending' ? (
          <div className="space-y-4">
            {pendingTxs.length === 0 ? (
              <div className="text-center p-12 bg-white rounded-2xl border border-[#E5E5E5] shadow-sm">
                <ShieldCheck className="w-12 h-12 text-[#A3A3A3] mx-auto mb-4" />
                <h3 className="text-lg font-bold text-[#0A0A0A]">All Caught Up</h3>
                <p className="text-[#525252]">There are no journal entries waiting for your approval.</p>
              </div>
            ) : (
              pendingTxs.map(tx => (
                <div key={tx.id} className="bg-white rounded-2xl border border-[#E5E5E5] p-6 shadow-sm">
                  <div className="flex justify-between items-start mb-6">
                    <div>
                      <div className="flex items-center gap-3 mb-2">
                        <span className="font-mono text-sm font-bold text-[#0A0A0A] bg-[#FAFAFA] px-2 py-1 rounded border border-[#E5E5E5]">
                          {tx.id}
                        </span>
                        <span className="text-sm text-[#525252]">{tx.date}</span>
                      </div>
                      <h3 className="text-lg font-bold text-[#0A0A0A]">{tx.description}</h3>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-2 text-sm text-[#525252] bg-[#FAFAFA] px-3 py-1.5 rounded-lg border border-[#E5E5E5]">
                        <User className="w-4 h-4" />
                        <span>Submitted by Staff Acct</span>
                      </div>
                      <button className="px-4 py-2 bg-emerald-50 text-emerald-700 rounded-lg text-sm font-bold hover:bg-emerald-100 transition-colors flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4" /> Approve
                      </button>
                      <button className="px-4 py-2 bg-rose-50 text-rose-700 rounded-lg text-sm font-bold hover:bg-rose-100 transition-colors flex items-center gap-2">
                        <XCircle className="w-4 h-4" /> Reject
                      </button>
                    </div>
                  </div>

                  <div className="bg-[#FAFAFA] rounded-xl border border-[#E5E5E5] overflow-hidden">
                    <div className="grid grid-cols-4 p-3 border-b border-[#E5E5E5] text-[10px] font-bold text-[#525252] uppercase tracking-wider">
                      <div className="col-span-2">Account</div>
                      <div className="text-right">Debit</div>
                      <div className="text-right">Credit</div>
                    </div>
                    {tx.lines.map((line, i) => (
                      <div key={i} className="grid grid-cols-4 p-3 text-sm border-b border-[#E5E5E5] last:border-0 bg-white">
                        <div className="col-span-2 font-medium text-[#0A0A0A]">{line.accountId}</div>
                        <div className="text-right font-mono">
                          {line.amountCents > 0 ? `$${(line.amountCents / 100).toLocaleString(undefined, { minimumFractionDigits: 2 })}` : '-'}
                        </div>
                        <div className="text-right font-mono">
                          {line.amountCents < 0 ? `$${(Math.abs(line.amountCents) / 100).toLocaleString(undefined, { minimumFractionDigits: 2 })}` : '-'}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>
        ) : (
          <div className="text-center p-12 bg-white rounded-2xl border border-[#E5E5E5] shadow-sm">
            <h3 className="text-lg font-bold text-[#0A0A0A]">History View</h3>
            <p className="text-[#525252]">Past approvals and rejections will appear here.</p>
          </div>
        )}
      </div>
    </div>
  );
}
