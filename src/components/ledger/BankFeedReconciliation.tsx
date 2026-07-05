import React, { useState } from 'react';
import { RefreshCw, CheckCircle2, AlertCircle, FileText, Upload, Plus, Download, ChevronRight, Zap } from 'lucide-react';
import { cn } from '../../lib/utils';

export default function BankFeedReconciliation() {
  const [activeTab, setActiveTab] = useState<'feed' | 'rules'>('feed');

  const mockTransactions: any[] = [];

  return (
    <div className="h-full flex flex-col bg-[#FAFAFA]">
      <div className="px-8 py-6 bg-white border-b border-[#E5E5E5] flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-bold text-[#0A0A0A] flex items-center gap-3">
            <RefreshCw className="w-6 h-6 text-blue-600" />
            Bank Feeds & Smart Matching
          </h1>
          <p className="text-sm text-[#525252] mt-1">
            Connect your banks to automatically pull in transactions and reconcile them against ledger entries.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button className="h-10 px-4 bg-white border border-[#E5E5E5] text-[#0A0A0A] rounded-xl text-sm font-bold flex items-center gap-2 hover:bg-[#FAFAFA] transition-colors shadow-sm">
            <Upload className="w-4 h-4" /> Import Statement
          </button>
          <button className="h-10 px-4 bg-[#0A0A0A] text-white rounded-xl text-sm font-bold flex items-center gap-2 hover:bg-[#1A1A1A] transition-colors shadow-sm">
            <RefreshCw className="w-4 h-4" /> Sync Now
          </button>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar */}
        <div className="w-64 bg-white border-r border-[#E5E5E5] flex flex-col">
          <div className="p-4 border-b border-[#E5E5E5] bg-[#FAFAFA]">
            <h3 className="text-[10px] font-bold text-[#525252] uppercase tracking-wider">Connected Accounts</h3>
          </div>
          <div className="p-2 space-y-1 flex-1 overflow-y-auto">
            <div className="px-4 py-3 rounded-xl bg-blue-50 border border-blue-100 flex flex-col gap-1 cursor-pointer">
              <span className="font-bold text-sm text-blue-900">Chase Operating</span>
              <span className="font-mono text-xs text-blue-700">**** 4432</span>
              <div className="mt-2 flex items-center gap-2 text-[10px] font-bold uppercase text-blue-600 tracking-wider">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" /> Live Sync
              </div>
            </div>
            <div className="px-4 py-3 rounded-xl hover:bg-[#FAFAFA] flex flex-col gap-1 cursor-pointer text-[#525252]">
              <span className="font-bold text-sm">SVB Payroll</span>
              <span className="font-mono text-xs">**** 1120</span>
            </div>
            <div className="px-4 py-3 rounded-xl hover:bg-[#FAFAFA] flex flex-col gap-1 cursor-pointer text-[#525252]">
              <span className="font-bold text-sm">Amex Platinum</span>
              <span className="font-mono text-xs">**** 9004</span>
            </div>
          </div>
          <div className="p-4 border-t border-[#E5E5E5]">
            <button className="w-full h-10 bg-white border border-[#E5E5E5] border-dashed text-[#0A0A0A] rounded-xl text-sm font-bold flex items-center justify-center gap-2 hover:bg-[#FAFAFA] transition-colors">
              <Plus className="w-4 h-4" /> Link Account
            </button>
          </div>
        </div>

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col">
           {/* Tab Bar */}
           <div className="px-8 pt-6 pb-2">
            <div className="flex p-1 bg-white border border-[#E5E5E5] rounded-xl shadow-sm w-max">
              {[
                { id: 'feed', label: 'Transaction Feed', icon: FileText },
                { id: 'rules', label: 'Matching Rules Engine', icon: Zap }
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={cn(
                    "px-6 py-2 rounded-lg text-sm font-bold flex items-center gap-2 transition-all",
                    activeTab === tab.id ? "bg-[#0A0A0A] text-white" : "text-[#525252] hover:bg-[#F5F5F5]"
                  )}
                >
                  <tab.icon className="w-4 h-4" />
                  {tab.label}
                </button>
              ))}
            </div>
           </div>

           {activeTab === 'feed' && (
             <div className="flex-1 p-8 overflow-y-auto">
                <div className="bg-white border border-[#E5E5E5] rounded-2xl overflow-hidden shadow-sm">
                  <div className="grid grid-cols-12 p-4 bg-[#FAFAFA] border-b border-[#E5E5E5] text-[10px] font-bold text-[#525252] uppercase tracking-wider">
                    <div className="col-span-2">Date</div>
                    <div className="col-span-4">Bank Description</div>
                    <div className="col-span-2 text-right">Amount</div>
                    <div className="col-span-4 pl-8">Ledger Match</div>
                  </div>
                  <div className="divide-y divide-[#E5E5E5]">
                    {mockTransactions.map((tx) => (
                      <div key={tx.id} className="grid grid-cols-12 p-4 items-center hover:bg-[#FAFAFA] transition-colors group">
                        <div className="col-span-2 font-mono text-xs font-bold text-[#525252]">{tx.date}</div>
                        <div className="col-span-4 font-bold text-[#0A0A0A] pr-4 truncate">{tx.description}</div>
                        <div className="col-span-2 text-right font-mono text-sm font-bold">
                          <span className={tx.type === 'credit' ? 'text-emerald-600' : 'text-[#0A0A0A]'}>
                            {tx.type === 'credit' ? '+' : '-'}${(tx.amountCents / 100).toLocaleString()}
                          </span>
                        </div>
                        <div className="col-span-4 pl-8 flex items-center justify-between">
                          {tx.matchId ? (
                            <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-700">
                              <CheckCircle2 className="w-4 h-4" />
                              <span className="text-xs font-bold font-mono">{tx.matchId}</span>
                            </div>
                          ) : (
                            <div className="flex items-center gap-2 px-3 py-1.5 bg-amber-50 border border-amber-200 rounded-lg text-amber-700">
                              <AlertCircle className="w-4 h-4" />
                              <span className="text-xs font-bold">Unmatched</span>
                            </div>
                          )}
                          {!tx.matchId && (
                            <button className="px-4 py-1.5 bg-white border border-[#E5E5E5] rounded-lg text-xs font-bold hover:bg-[#0A0A0A] hover:text-white transition-colors opacity-0 group-hover:opacity-100">
                              Find Match
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
             </div>
           )}

           {activeTab === 'rules' && (
             <div className="flex-1 p-8">
               <div className="bg-white border border-[#E5E5E5] rounded-2xl p-12 text-center shadow-sm">
                 <Zap className="w-12 h-12 text-[#A3A3A3] mx-auto mb-4" />
                 <h3 className="text-xl font-bold text-[#0A0A0A]">Smart Rules Engine</h3>
                 <p className="text-[#525252] mt-2 max-w-md mx-auto">
                   Automatically categorize and match recurring bank transactions based on description text, amount, and dates.
                 </p>
                 <button className="mt-6 px-6 py-2 bg-[#0A0A0A] text-white rounded-xl text-sm font-bold hover:bg-[#1A1A1A] transition-colors">
                   Create Rule
                 </button>
               </div>
             </div>
           )}
        </div>
      </div>
    </div>
  );
}
