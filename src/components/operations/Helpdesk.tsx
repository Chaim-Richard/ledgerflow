import React, { useState } from 'react';
import { Headphones, Ticket, CheckCircle2, Clock, Search, Filter, Plus, User, AlertCircle, MessageSquare } from 'lucide-react';
import { cn } from '../../lib/utils';

export default function Helpdesk() {
  const [activeFilter, setActiveFilter] = useState<'all' | 'open' | 'urgent'>('all');
  
  const mockTickets: any[] = [];

  const filteredTickets = mockTickets.filter(t => {
    if (activeFilter === 'all') return t.status !== 'Closed';
    if (activeFilter === 'open') return t.status === 'Open';
    if (activeFilter === 'urgent') return t.status === 'Urgent';
    return true;
  });

  return (
    <div className="h-full flex flex-col bg-[#FAFAFA]">
      <div className="px-8 py-6 bg-white border-b border-[#E5E5E5] flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-bold text-[#0A0A0A] flex items-center gap-3">
            <Headphones className="w-6 h-6 text-cyan-600" />
            Helpdesk & Support
          </h1>
          <p className="text-sm text-[#525252] mt-1">Customer service ticketing and SLA tracking linked to financial accounts.</p>
        </div>
        <button className="h-10 px-4 bg-[#0A0A0A] text-white rounded-xl text-sm font-bold flex items-center gap-2 hover:bg-[#1A1A1A] transition-colors shadow-sm">
          <Plus className="w-4 h-4" /> New Ticket
        </button>
      </div>

      <div className="flex-1 overflow-auto p-8">
        {/* KPI Dashboard */}
        <div className="grid grid-cols-4 gap-6 mb-8">
          <div className="p-6 bg-white rounded-2xl border border-[#E5E5E5] shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <span className="text-[10px] font-bold text-[#525252] uppercase tracking-wider">Open Tickets</span>
              <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
                <Ticket className="w-4 h-4 text-blue-600" />
              </div>
            </div>
            <div className="text-3xl font-bold text-[#0A0A0A]">24</div>
          </div>

          <div className="p-6 bg-white rounded-2xl border border-[#E5E5E5] shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <span className="text-[10px] font-bold text-[#525252] uppercase tracking-wider">Unassigned</span>
              <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center">
                <User className="w-4 h-4 text-amber-600" />
              </div>
            </div>
            <div className="text-3xl font-bold text-[#0A0A0A]">8</div>
          </div>

          <div className="p-6 bg-white rounded-2xl border border-[#E5E5E5] shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <span className="text-[10px] font-bold text-[#525252] uppercase tracking-wider">SLA Breached</span>
              <div className="w-8 h-8 rounded-full bg-rose-100 flex items-center justify-center">
                <AlertCircle className="w-4 h-4 text-rose-600" />
              </div>
            </div>
            <div className="text-3xl font-bold text-rose-600">2</div>
          </div>

          <div className="p-6 bg-white rounded-2xl border border-[#E5E5E5] shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <span className="text-[10px] font-bold text-[#525252] uppercase tracking-wider">Avg Resolution</span>
              <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              </div>
            </div>
            <div className="text-3xl font-bold text-[#0A0A0A]">4.2h</div>
          </div>
        </div>

        {/* Tab & Filter Bar */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex p-1 bg-white border border-[#E5E5E5] rounded-xl shadow-sm">
            {[
              { id: 'all', label: 'All Active' },
              { id: 'open', label: 'Open' },
              { id: 'urgent', label: 'Urgent' }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveFilter(tab.id as any)}
                className={cn(
                  "px-6 py-2 rounded-lg text-sm font-bold transition-all",
                  activeFilter === tab.id ? "bg-[#0A0A0A] text-white" : "text-[#525252] hover:bg-[#F5F5F5]"
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-3">
            <div className="relative">
              <Search className="w-4 h-4 text-[#A3A3A3] absolute left-3 top-1/2 -translate-y-1/2" />
              <input 
                type="text"
                placeholder="Search tickets..."
                className="w-64 h-10 pl-9 pr-4 bg-white border border-[#E5E5E5] rounded-xl text-sm focus:outline-none focus:border-[#0A0A0A]"
              />
            </div>
            <button className="h-10 px-4 bg-white border border-[#E5E5E5] rounded-xl flex items-center gap-2 hover:bg-[#FAFAFA] text-sm font-medium">
              <Filter className="w-4 h-4" /> Filter
            </button>
          </div>
        </div>

        {/* Tickets List */}
        <div className="bg-white border border-[#E5E5E5] rounded-2xl overflow-hidden shadow-sm">
          <div className="grid grid-cols-12 p-4 bg-[#FAFAFA] border-b border-[#E5E5E5] text-[10px] font-bold text-[#525252] uppercase tracking-wider">
            <div className="col-span-2">Ticket #</div>
            <div className="col-span-4">Subject & Customer</div>
            <div className="col-span-2">Agent</div>
            <div className="col-span-2">Last Update</div>
            <div className="col-span-1">Status</div>
            <div className="col-span-1 text-right">Messages</div>
          </div>
          <div className="divide-y divide-[#E5E5E5]">
            {filteredTickets.map((ticket, i) => (
              <div key={i} className="grid grid-cols-12 p-4 items-center hover:bg-[#FAFAFA] cursor-pointer transition-colors">
                <div className="col-span-2 font-mono text-sm font-bold text-[#0A0A0A]">{ticket.id}</div>
                <div className="col-span-4 pr-4">
                  <div className="font-bold text-[#0A0A0A] truncate">{ticket.title}</div>
                  <div className="text-xs text-[#525252] mt-0.5">{ticket.customer}</div>
                </div>
                <div className="col-span-2">
                  <span className={cn(
                    "text-xs font-bold px-2 py-1 rounded border",
                    ticket.agent === 'Unassigned' 
                      ? "bg-amber-50 text-amber-700 border-amber-200" 
                      : "bg-[#FAFAFA] text-[#525252] border-[#E5E5E5]"
                  )}>
                    {ticket.agent}
                  </span>
                </div>
                <div className="col-span-2 text-sm text-[#525252] flex items-center gap-1.5">
                  <Clock className="w-3 h-3" /> {ticket.time}
                </div>
                <div className="col-span-1">
                  <span className={cn(
                    "px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider",
                    ticket.status === 'Urgent' ? "bg-rose-100 text-rose-700" :
                    ticket.status === 'Open' ? "bg-blue-100 text-blue-700" :
                    "bg-[#E5E5E5] text-[#525252]"
                  )}>
                    {ticket.status}
                  </span>
                </div>
                <div className="col-span-1 text-right flex items-center justify-end gap-1.5 text-sm font-bold text-[#0A0A0A]">
                  <MessageSquare className="w-4 h-4 text-[#A3A3A3]" /> {ticket.messages}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
