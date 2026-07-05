import React, { useState } from 'react';
import { ShieldAlert, Mail, Phone, DollarSign, Clock, FileText, Send, CheckCircle2, ChevronRight, AlertCircle, ArrowUpRight } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useLedgerStore } from '../../stores/useLedgerStore';
import { cn } from '../../lib/utils';

export default function CreditControlHub() {
  const { transactions } = useLedgerStore();
  const [selectedCustomer, setSelectedCustomer] = useState<string | null>(null);

  // Mock AR data for presentation
  const mockOverdueInvoices: any[] = [];

  const totalOverdue = mockOverdueInvoices.reduce((a, b) => a + b.amount, 0);

  return (
    <div className="h-full flex flex-col bg-white">
      {/* Header */}
      <div className="flex items-center justify-between px-8 py-6 border-b border-[#E5E5E5]">
        <div>
          <h1 className="text-2xl font-bold text-[#0A0A0A] flex items-center gap-3">
            <ShieldAlert className="w-6 h-6 text-rose-500" />
            Credit Control & Dunning
          </h1>
          <p className="text-sm text-[#525252] mt-1">Manage overdue receivables and automated collections</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex flex-col items-end">
            <span className="text-[10px] font-bold text-[#525252] uppercase tracking-wider">Total Overdue</span>
            <span className="text-xl font-bold text-rose-600">${(totalOverdue / 100).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
          </div>
          <button className="h-10 px-4 bg-[#0A0A0A] text-white rounded-xl text-sm font-bold flex items-center gap-2 hover:bg-[#1A1A1A] transition-colors">
            <Send className="w-4 h-4" />
            Run Dunning Batch
          </button>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Customer List */}
        <div className="w-1/3 border-r border-[#E5E5E5] flex flex-col bg-[#FAFAFA]">
          <div className="p-4 border-b border-[#E5E5E5]">
            <input 
              type="text"
              placeholder="Search customers..."
              className="w-full h-10 px-4 rounded-xl border border-[#E5E5E5] text-sm focus:outline-none focus:border-[#0A0A0A]"
            />
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {mockOverdueInvoices.map((inv) => (
              <button
                key={inv.id}
                onClick={() => setSelectedCustomer(inv.id)}
                className={cn(
                  "w-full text-left p-4 rounded-xl border transition-all",
                  selectedCustomer === inv.id 
                    ? "bg-white border-[#0A0A0A] shadow-sm ring-1 ring-[#0A0A0A]" 
                    : "bg-white border-[#E5E5E5] hover:border-[#A3A3A3]"
                )}
              >
                <div className="flex justify-between items-start mb-2">
                  <h3 className="font-bold text-[#0A0A0A]">{inv.customer}</h3>
                  <span className={cn(
                    "text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full",
                    inv.status === 'critical' ? "bg-rose-100 text-rose-700" :
                    inv.status === 'warning' ? "bg-amber-100 text-amber-700" :
                    "bg-blue-100 text-blue-700"
                  )}>
                    {inv.daysOverdue} Days
                  </span>
                </div>
                <div className="flex justify-between items-end">
                  <div className="text-sm text-[#525252]">{inv.id}</div>
                  <div className="font-bold text-[#0A0A0A]">${(inv.amount / 100).toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Detail View */}
        <div className="flex-1 flex flex-col bg-white overflow-hidden">
          {selectedCustomer ? (
            <div className="flex-1 overflow-y-auto">
              {mockOverdueInvoices.filter(i => i.id === selectedCustomer).map(inv => (
                <div key={inv.id} className="p-8">
                  {/* Detail Header */}
                  <div className="flex items-start justify-between mb-8">
                    <div>
                      <h2 className="text-3xl font-bold text-[#0A0A0A] mb-2">{inv.customer}</h2>
                      <div className="flex items-center gap-4 text-sm text-[#525252]">
                        <span className="flex items-center gap-1.5"><Mail className="w-4 h-4" /> {inv.contact}</span>
                        <span className="flex items-center gap-1.5"><Phone className="w-4 h-4" /> (555) 123-4567</span>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-4xl font-bold text-rose-600 mb-1">
                        ${(inv.amount / 100).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </div>
                      <div className="text-sm font-bold text-rose-600/70 uppercase tracking-wider">Total Outstanding</div>
                    </div>
                  </div>

                  {/* Action Bar */}
                  <div className="flex gap-3 mb-8 p-4 bg-[#FAFAFA] rounded-xl border border-[#E5E5E5]">
                    <button className="flex-1 h-10 bg-white border border-[#E5E5E5] rounded-lg text-sm font-bold text-[#0A0A0A] hover:border-[#0A0A0A] transition-colors flex items-center justify-center gap-2">
                      <Mail className="w-4 h-4" /> Send Reminder
                    </button>
                    <button className="flex-1 h-10 bg-white border border-[#E5E5E5] rounded-lg text-sm font-bold text-[#0A0A0A] hover:border-[#0A0A0A] transition-colors flex items-center justify-center gap-2">
                      <Phone className="w-4 h-4" /> Log Call
                    </button>
                    <button className="flex-1 h-10 bg-white border border-[#E5E5E5] rounded-lg text-sm font-bold text-[#0A0A0A] hover:border-[#0A0A0A] transition-colors flex items-center justify-center gap-2">
                      <FileText className="w-4 h-4" /> Generate Statement
                    </button>
                    <button className="flex-1 h-10 bg-rose-50 border border-rose-200 rounded-lg text-sm font-bold text-rose-700 hover:bg-rose-100 transition-colors flex items-center justify-center gap-2">
                      <AlertCircle className="w-4 h-4" /> Apply Late Fee
                    </button>
                  </div>

                  {/* Communication History */}
                  <div>
                    <h3 className="text-sm font-bold text-[#0A0A0A] uppercase tracking-wider mb-4 flex items-center gap-2">
                      <Clock className="w-4 h-4" /> Timeline
                    </h3>
                    <div className="space-y-4">
                      {inv.lastContact && (
                        <div className="flex gap-4 p-4 rounded-xl bg-[#FAFAFA] border border-[#E5E5E5]">
                          <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
                            <Mail className="w-4 h-4 text-blue-700" />
                          </div>
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <span className="font-bold text-[#0A0A0A]">Automated Dunning (Level 1)</span>
                              <span className="text-xs text-[#525252]">{inv.lastContact}</span>
                            </div>
                            <p className="text-sm text-[#525252]">System automatically sent the "15-day overdue" reminder template.</p>
                          </div>
                        </div>
                      )}
                      <div className="flex gap-4 p-4 rounded-xl bg-[#FAFAFA] border border-[#E5E5E5]">
                        <div className="w-8 h-8 rounded-full bg-rose-100 flex items-center justify-center shrink-0">
                          <AlertCircle className="w-4 h-4 text-rose-700" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-bold text-[#0A0A0A]">Invoice became overdue</span>
                            <span className="text-xs text-[#525252]">45 days ago</span>
                          </div>
                          <p className="text-sm text-[#525252]">Invoice {inv.id} passed its net-30 terms.</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-[#A3A3A3]">
              <ShieldAlert className="w-16 h-16 mb-4 opacity-20" />
              <p className="text-lg font-medium text-[#525252]">Select a customer to view credit details</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
