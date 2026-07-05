const fs = require('fs');
const code = `import React, { useState, useMemo } from 'react';
import { Headphones, AlertCircle, CheckCircle2, Clock, Search, Filter, HelpCircle, ShieldAlert, Zap } from 'lucide-react';
import { cn } from '../../lib/utils';
import { motion, AnimatePresence } from 'motion/react';

const MOCK_TICKETS = [
  { id: 'IT-5120', subject: 'Laptop battery not charging', requester: 'Sarah Connor', priority: 'High', status: 'Open', age: '2h', date: 'Today' },
  { id: 'IT-5121', subject: 'Need access to Financial DB', requester: 'Bob Smith', priority: 'Normal', status: 'Pending Approval', age: '4h', date: 'Today' },
  { id: 'IT-5122', subject: 'VPN keeps disconnecting', requester: 'Alice Walker', priority: 'High', status: 'In Progress', age: '1d', date: 'Yesterday' },
  { id: 'IT-5123', subject: 'Monitor replacement', requester: 'Diana Prince', priority: 'Low', status: 'Resolved', age: '2d', date: 'Jun 25' },
  { id: 'IT-5124', subject: 'Cannot print to 3rd floor printer', requester: 'Ethan Hunt', priority: 'Normal', status: 'Resolved', age: '3d', date: 'Jun 24' },
];

export default function HelpdeskTicketing() {
  const [activeTab, setActiveTab] = useState<'open' | 'resolved'>('open');
  const [tickets] = useState(MOCK_TICKETS);
  const [searchTerm, setSearchTerm] = useState('');

  const filteredTickets = useMemo(() => {
    let filtered = tickets.filter(t => 
      t.subject.toLowerCase().includes(searchTerm.toLowerCase()) || 
      t.requester.toLowerCase().includes(searchTerm.toLowerCase()) ||
      t.id.toLowerCase().includes(searchTerm.toLowerCase())
    );
    if (activeTab === 'open') {
      filtered = filtered.filter(t => t.status !== 'Resolved');
    } else {
      filtered = filtered.filter(t => t.status === 'Resolved');
    }
    return filtered;
  }, [tickets, searchTerm, activeTab]);

  const openCount = tickets.filter(t => t.status !== 'Resolved').length;
  const highPriorityCount = tickets.filter(t => t.status !== 'Resolved' && t.priority === 'High').length;

  return (
    <div className="h-full flex flex-col bg-slate-50">
      <div className="px-8 py-6 bg-slate-900 text-white flex flex-col md:flex-row md:justify-between md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-3">
            <Headphones className="w-6 h-6 text-purple-500" />
            Internal IT Helpdesk
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Manage employee support requests, IT assets, and access provisioning.
          </p>
        </div>
        <div className="flex items-center gap-4">
           <div className="flex flex-col items-end mr-4">
             <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Open Tickets</span>
             <span className="text-lg font-mono font-bold text-purple-400">{openCount}</span>
           </div>
           <button className="h-10 px-4 bg-purple-600 text-white rounded-xl text-sm font-bold flex items-center gap-2 hover:bg-purple-700 transition-colors shadow-sm">
             Create Ticket
           </button>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-6 md:p-8">
        
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="p-5 bg-white rounded-2xl border border-slate-200 shadow-sm">
            <div className="flex items-center gap-3 text-slate-500 mb-2">
              <HelpCircle className="w-5 h-5" />
              <span className="text-xs font-bold uppercase tracking-wider">Unassigned</span>
            </div>
            <div className="text-3xl font-bold font-mono text-slate-900">1</div>
          </div>
          <div className="p-5 bg-rose-50 rounded-2xl border border-rose-200 shadow-sm">
            <div className="flex items-center gap-3 text-rose-500 mb-2">
              <ShieldAlert className="w-5 h-5" />
              <span className="text-xs font-bold uppercase tracking-wider">High Priority</span>
            </div>
            <div className="text-3xl font-bold font-mono text-rose-600">{highPriorityCount}</div>
          </div>
          <div className="p-5 bg-white rounded-2xl border border-slate-200 shadow-sm">
            <div className="flex items-center gap-3 text-blue-500 mb-2">
              <Clock className="w-5 h-5" />
              <span className="text-xs font-bold uppercase tracking-wider">Avg Resolution Time</span>
            </div>
            <div className="text-3xl font-bold font-mono text-blue-600">4.2h</div>
          </div>
          <div className="p-5 bg-white rounded-2xl border border-slate-200 shadow-sm">
            <div className="flex items-center gap-3 text-emerald-500 mb-2">
              <CheckCircle2 className="w-5 h-5" />
              <span className="text-xs font-bold uppercase tracking-wider">Resolved Today</span>
            </div>
            <div className="text-3xl font-bold font-mono text-emerald-600">8</div>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
          <div className="p-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
             <div className="flex space-x-1 p-1 bg-slate-100 rounded-lg w-max">
               {['open', 'resolved'].map(tab => (
                 <button 
                   key={tab}
                   onClick={() => setActiveTab(tab as any)}
                   className={cn(
                     "px-4 py-1.5 rounded-md text-xs font-bold uppercase tracking-wider transition-all",
                     activeTab === tab ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"
                   )}
                 >
                   {tab === 'open' ? 'Open Tickets' : 'Resolved'}
                 </button>
               ))}
             </div>
             
             <div className="relative max-w-sm w-full">
               <Search size={16} className="absolute left-3 top-2.5 text-slate-400" />
               <input 
                 type="text" 
                 placeholder="Search tickets..." 
                 value={searchTerm}
                 onChange={e => setSearchTerm(e.target.value)}
                 className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition-all"
               />
             </div>
          </div>

          <div className="overflow-x-auto">
            <div className="grid grid-cols-12 p-4 bg-slate-50 border-b border-slate-200 text-[10px] font-bold text-slate-500 uppercase tracking-wider min-w-[700px]">
              <div className="col-span-4">Ticket / Subject</div>
              <div className="col-span-3">Requester</div>
              <div className="col-span-2 text-center">Priority</div>
              <div className="col-span-1 text-center">Age</div>
              <div className="col-span-2 text-right">Status</div>
            </div>
            
            <div className="divide-y divide-slate-100 min-w-[700px]">
              <AnimatePresence>
                {filteredTickets.map((t, i) => (
                  <motion.div 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.05 }}
                    key={t.id} 
                    className="grid grid-cols-12 p-4 items-center hover:bg-slate-50 transition-colors group cursor-pointer"
                  >
                    <div className="col-span-4 flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center shrink-0">
                         {t.priority === 'High' ? <Zap size={18} className="text-rose-500" /> : <Headphones size={18} className="text-slate-400" />}
                      </div>
                      <div className="truncate pr-4">
                        <div className="font-bold text-slate-900 group-hover:text-purple-600 transition-colors truncate">{t.subject}</div>
                        <div className="text-[10px] font-mono text-slate-500 mt-0.5">{t.id} • {t.date}</div>
                      </div>
                    </div>
                    
                    <div className="col-span-3 flex items-center gap-2 font-bold text-slate-700 text-sm truncate pr-4">
                      <div className="w-6 h-6 rounded-full bg-slate-200 flex items-center justify-center text-[10px] text-slate-600 shrink-0">
                        {t.requester.split(' ').map(n => n[0]).join('')}
                      </div>
                      {t.requester}
                    </div>
                    
                    <div className="col-span-2 flex justify-center">
                       <span className={cn(
                          "px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider border",
                          t.priority === 'High' ? "bg-rose-50 text-rose-700 border-rose-200" :
                          t.priority === 'Low' ? "bg-slate-50 text-slate-600 border-slate-200" :
                          "bg-amber-50 text-amber-700 border-amber-200"
                       )}>
                          {t.priority}
                       </span>
                    </div>
                    
                    <div className="col-span-1 text-center font-mono text-xs font-bold text-slate-500">
                       {t.age}
                    </div>
                    
                    <div className="col-span-2 flex justify-end">
                       <span className={cn(
                          "px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider border flex items-center gap-1.5",
                          t.status === 'Resolved' ? "bg-emerald-50 text-emerald-700 border-emerald-200" :
                          t.status === 'In Progress' ? "bg-blue-50 text-blue-700 border-blue-200" :
                          t.status === 'Pending Approval' ? "bg-amber-50 text-amber-700 border-amber-200" :
                          "bg-slate-100 text-slate-700 border-slate-200"
                       )}>
                          {t.status === 'Resolved' && <CheckCircle2 className="w-3.5 h-3.5" />}
                          {t.status}
                       </span>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
              {filteredTickets.length === 0 && (
                <div className="p-12 text-center text-slate-500">
                  <Headphones size={32} className="mx-auto mb-3 text-slate-300" />
                  No {activeTab} tickets found.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
`;
fs.writeFileSync('src/components/operations/HelpdeskTicketing.tsx', code);
