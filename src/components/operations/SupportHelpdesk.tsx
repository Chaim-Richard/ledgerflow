import React, { useState } from 'react';
import { LifeBuoy, Filter, Search, Clock, CheckCircle2, AlertCircle, MessageSquare, Ticket } from 'lucide-react';
import { motion } from 'motion/react';

export default function SupportHelpdesk() {
  const tickets: any[] = [];

  return (
    <div className="p-8 max-w-7xl mx-auto h-full overflow-y-auto">
      <div className="flex justify-between items-end mb-8">
        <div>
          <h1 className="text-3xl font-black text-slate-900 flex items-center gap-3">
            <LifeBuoy className="text-sky-500 w-8 h-8" />
            Support Helpdesk & SLAs
          </h1>
          <p className="text-slate-500 mt-2">Manage customer support tickets, SLAs, and link cases directly to invoices and CRM.</p>
        </div>
        <div className="flex gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-2.5 text-slate-400 w-4 h-4" />
            <input type="text" placeholder="Search tickets..." className="pl-9 pr-4 py-2 border border-slate-200 rounded-xl text-sm w-64 focus:outline-none focus:border-sky-500" />
          </div>
          <button className="flex items-center gap-2 bg-sky-500 text-white px-4 py-2 rounded-xl text-sm font-bold hover:bg-sky-600">
            <Ticket size={16} /> New Ticket
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        {[
          { label: 'Open Tickets', value: '24', icon: MessageSquare, color: 'text-slate-700', bg: 'bg-slate-100' },
          { label: 'SLA Breached', value: '3', icon: AlertCircle, color: 'text-rose-600', bg: 'bg-rose-50' },
          { label: 'Avg Resolution Time', value: '4.2 hrs', icon: Clock, color: 'text-sky-600', bg: 'bg-sky-50' },
          { label: 'Resolved (7d)', value: '142', icon: CheckCircle2, color: 'text-emerald-600', bg: 'bg-emerald-50' },
        ].map((stat, i) => (
          <div key={i} className="bg-white border border-slate-200 rounded-2xl p-5 flex items-center gap-4">
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${stat.bg} ${stat.color}`}>
              <stat.icon size={24} />
            </div>
            <div>
              <div className="text-2xl font-black text-slate-900">{stat.value}</div>
              <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">{stat.label}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200 text-xs uppercase tracking-wider text-slate-500 font-bold">
              <th className="p-4">Ticket</th>
              <th className="p-4">Subject</th>
              <th className="p-4">Customer</th>
              <th className="p-4">Priority</th>
              <th className="p-4">SLA Status</th>
              <th className="p-4">Status</th>
            </tr>
          </thead>
          <tbody className="text-sm">
            {tickets.map((t, i) => (
              <tr key={i} className="border-b border-slate-100 hover:bg-slate-50 cursor-pointer">
                <td className="p-4 font-mono font-medium text-sky-600">{t.id}</td>
                <td className="p-4">
                  <div className="font-bold text-slate-800">{t.subject}</div>
                  <div className="text-[10px] text-slate-400 font-mono mt-0.5">{t.type}</div>
                </td>
                <td className="p-4 font-medium text-slate-700">{t.customer}</td>
                <td className="p-4">
                  <span className={`flex items-center gap-1.5 text-xs font-bold ${
                    t.priority === 'Critical' ? 'text-rose-600' : 
                    t.priority === 'High' ? 'text-orange-500' : 'text-slate-600'
                  }`}>
                    {t.priority === 'Critical' && <AlertCircle size={14} />}
                    {t.priority}
                  </span>
                </td>
                <td className="p-4">
                  <span className={`text-xs font-bold ${
                    t.sla === 'Expired' ? 'text-rose-600 bg-rose-50 px-2 py-1 rounded' : 
                    t.sla === 'Met' ? 'text-emerald-600' : 'text-slate-600'
                  }`}>
                    {t.sla}
                  </span>
                </td>
                <td className="p-4">
                  <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider ${
                    t.status === 'Resolved' ? 'bg-emerald-50 text-emerald-700' :
                    t.status === 'In Progress' ? 'bg-amber-50 text-amber-700' : 'bg-slate-100 text-slate-600'
                  }`}>
                    {t.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
