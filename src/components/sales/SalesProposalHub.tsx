import React, { useState } from 'react';
import { FileSignature, Send, User, Calendar, Plus, Search, Filter, FileText, CheckCircle2, AlertCircle, ArrowRight } from 'lucide-react';
import { cn } from '../../lib/utils';
import { motion } from 'motion/react';

export default function SalesProposalHub() {
  const [activeTab, setActiveTab] = useState<'active' | 'templates'>('active');

  const mockProposals: any[] = [];

  return (
    <div className="h-full flex flex-col bg-[#FAFAFA]">
      <div className="px-8 py-6 bg-white border-b border-[#E5E5E5] flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-bold text-[#0A0A0A] flex items-center gap-3">
            <FileSignature className="w-6 h-6 text-amber-600" />
            Proposals & Quotes
          </h1>
          <p className="text-sm text-[#525252] mt-1">
            Create professional estimates, track customer approvals, and instantly convert accepted quotes into sales invoices.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="w-4 h-4 text-[#A3A3A3] absolute left-3 top-1/2 -translate-y-1/2" />
            <input 
              type="text"
              placeholder="Search proposals..."
              className="w-64 h-10 pl-9 pr-4 bg-[#FAFAFA] border border-[#E5E5E5] rounded-xl text-sm focus:outline-none focus:border-[#0A0A0A]"
            />
          </div>
          <button className="h-10 px-4 bg-[#0A0A0A] text-white rounded-xl text-sm font-bold flex items-center gap-2 hover:bg-[#1A1A1A] transition-colors shadow-sm">
            <Plus className="w-4 h-4" /> New Proposal
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-8">
        {/* KPI Dashboard */}
        <div className="grid grid-cols-4 gap-6 mb-8">
          <div className="p-6 bg-white rounded-2xl border border-[#E5E5E5] shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <span className="text-[10px] font-bold text-[#525252] uppercase tracking-wider">Drafts</span>
              <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center">
                <FileText className="w-4 h-4 text-[#525252]" />
              </div>
            </div>
            <div className="text-3xl font-bold text-[#0A0A0A]">
              {mockProposals.filter(p => p.status === 'Draft').length}
            </div>
          </div>

          <div className="p-6 bg-white rounded-2xl border border-[#E5E5E5] shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <span className="text-[10px] font-bold text-[#525252] uppercase tracking-wider">Awaiting Approval</span>
              <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
                <Send className="w-4 h-4 text-blue-600" />
              </div>
            </div>
            <div className="text-3xl font-bold text-[#0A0A0A]">
              {mockProposals.filter(p => p.status === 'Sent').length}
            </div>
          </div>

          <div className="p-6 bg-white rounded-2xl border border-[#E5E5E5] shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <span className="text-[10px] font-bold text-[#525252] uppercase tracking-wider">Accepted (YTD)</span>
              <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              </div>
            </div>
            <div className="text-3xl font-bold text-emerald-600">
              {mockProposals.filter(p => p.status === 'Accepted').length}
            </div>
          </div>

          <div className="p-6 bg-white rounded-2xl border border-[#E5E5E5] shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <span className="text-[10px] font-bold text-[#525252] uppercase tracking-wider">Win Rate</span>
              <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center">
                <AlertCircle className="w-4 h-4 text-amber-600" />
              </div>
            </div>
            <div className="text-3xl font-bold text-[#0A0A0A]">
              75%
            </div>
          </div>
        </div>

        {/* Tab Bar */}
        <div className="flex p-1 bg-white border border-[#E5E5E5] rounded-xl shadow-sm mb-6 w-max">
          {[
            { id: 'active', label: 'Proposals & Quotes', icon: FileSignature },
            { id: 'templates', label: 'Document Templates', icon: FileText }
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

        {activeTab === 'active' && (
          <div className="bg-white border border-[#E5E5E5] rounded-2xl overflow-hidden shadow-sm">
            <div className="grid grid-cols-12 p-4 bg-[#FAFAFA] border-b border-[#E5E5E5] text-[10px] font-bold text-[#525252] uppercase tracking-wider">
              <div className="col-span-2">Quote #</div>
              <div className="col-span-4">Title & Client</div>
              <div className="col-span-2">Date Issued</div>
              <div className="col-span-2 text-right">Value</div>
              <div className="col-span-2 text-right">Status</div>
            </div>
            <div className="divide-y divide-[#E5E5E5]">
              {mockProposals.map((prop) => (
                <div key={prop.id} className="grid grid-cols-12 p-4 items-center hover:bg-[#FAFAFA] transition-colors cursor-pointer group">
                  <div className="col-span-2 font-mono text-sm font-bold text-[#0A0A0A]">{prop.id}</div>
                  <div className="col-span-4 pr-4">
                    <div className="font-bold text-[#0A0A0A] truncate">{prop.title}</div>
                    <div className="text-xs text-[#525252] mt-0.5 flex items-center gap-1">
                      <User className="w-3 h-3" /> {prop.client}
                    </div>
                  </div>
                  <div className="col-span-2 text-sm text-[#525252] flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5" /> {prop.date}
                  </div>
                  <div className="col-span-2 text-right font-mono font-bold text-[#0A0A0A]">
                    ${(prop.valueCents / 100).toLocaleString()}
                  </div>
                  <div className="col-span-2 flex justify-end">
                    <span className={cn(
                      "px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider",
                      prop.status === 'Draft' ? "bg-[#FAFAFA] text-[#525252] border border-[#E5E5E5]" :
                      prop.status === 'Sent' ? "bg-blue-100 text-blue-700" :
                      prop.status === 'Accepted' ? "bg-emerald-100 text-emerald-700" :
                      "bg-rose-100 text-rose-700"
                    )}>
                      {prop.status}
                    </span>
                    {prop.status === 'Accepted' && (
                       <button className="ml-3 px-3 py-1 bg-[#0A0A0A] text-white rounded text-[10px] font-bold uppercase tracking-wider opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                         To Invoice <ArrowRight className="w-3 h-3 inline-block ml-1" />
                       </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'templates' && (
           <div className="bg-white border border-[#E5E5E5] rounded-2xl p-12 text-center shadow-sm">
             <FileText className="w-12 h-12 text-[#A3A3A3] mx-auto mb-4" />
             <h3 className="text-xl font-bold text-[#0A0A0A]">Proposal Templates</h3>
             <p className="text-[#525252] mt-2 max-w-md mx-auto">
               Design beautiful, branded quotes and estimates. Add standard service line items to speed up your sales workflow.
             </p>
           </div>
        )}
      </div>
    </div>
  );
}
