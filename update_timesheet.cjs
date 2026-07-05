const fs = require('fs');
const code = `import React, { useState, useMemo } from 'react';
import { Calendar, Clock, CheckSquare, XSquare, Users, Search, AlertTriangle, PlayCircle, ShieldCheck } from 'lucide-react';
import { cn } from '../../lib/utils';
import { motion, AnimatePresence } from 'motion/react';

const MOCK_TIMESHEETS = [
  { id: 'TS-104', employee: 'Alice Walker', department: 'Retail', period: 'Jun 15 - Jun 21', regular: 40, overtime: 5, status: 'Pending' },
  { id: 'TS-105', employee: 'Bob Smith', department: 'Logistics', period: 'Jun 15 - Jun 21', regular: 38, overtime: 0, status: 'Approved' },
  { id: 'TS-106', employee: 'Charlie Davis', department: 'Warehouse', period: 'Jun 15 - Jun 21', regular: 40, overtime: 12, status: 'Pending' },
  { id: 'TS-107', employee: 'Diana Prince', department: 'Support', period: 'Jun 15 - Jun 21', regular: 35, overtime: 0, status: 'Pending' },
  { id: 'TS-108', employee: 'Ethan Hunt', department: 'Security', period: 'Jun 15 - Jun 21', regular: 45, overtime: 15, status: 'Rejected' },
];

export default function TimesheetApprovals() {
  const [activeTab, setActiveTab] = useState<'pending' | 'history'>('pending');
  const [sheets, setSheets] = useState(MOCK_TIMESHEETS);
  const [searchTerm, setSearchTerm] = useState('');

  const filteredSheets = useMemo(() => {
    let filtered = sheets.filter(s => 
      s.employee.toLowerCase().includes(searchTerm.toLowerCase()) || 
      s.department.toLowerCase().includes(searchTerm.toLowerCase())
    );
    if (activeTab === 'pending') {
      filtered = filtered.filter(s => s.status === 'Pending');
    } else {
      filtered = filtered.filter(s => s.status !== 'Pending');
    }
    return filtered;
  }, [sheets, searchTerm, activeTab]);

  const handleAction = (id: string, action: 'Approved' | 'Rejected') => {
    setSheets(prev => prev.map(s => s.id === id ? { ...s, status: action } : s));
  };

  const totalPendingHours = sheets.filter(s => s.status === 'Pending').reduce((sum, s) => sum + s.regular + s.overtime, 0);
  const pendingCount = sheets.filter(s => s.status === 'Pending').length;
  const highOvertimeCount = sheets.filter(s => s.status === 'Pending' && s.overtime > 10).length;

  return (
    <div className="h-full flex flex-col bg-slate-50">
      <div className="px-8 py-6 bg-slate-900 text-white flex flex-col md:flex-row md:justify-between md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-3">
            <Clock className="w-6 h-6 text-teal-400" />
            Timesheet Approvals
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Manager review and approval of submitted employee hours for payroll processing.
          </p>
        </div>
        <div className="flex items-center gap-4">
           <div className="flex flex-col items-end mr-4">
             <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Pending Approvals</span>
             <span className="text-lg font-mono font-bold text-teal-400">{pendingCount}</span>
           </div>
           <button className="h-10 px-4 bg-teal-600 text-white rounded-xl text-sm font-bold flex items-center gap-2 hover:bg-teal-700 transition-colors shadow-sm">
             <ShieldCheck className="w-4 h-4" /> Approve All Pending
           </button>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-6 md:p-8">
        
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="p-5 bg-white rounded-2xl border border-slate-200 shadow-sm">
            <div className="flex items-center gap-3 text-slate-500 mb-2">
              <Users className="w-5 h-5" />
              <span className="text-xs font-bold uppercase tracking-wider">Total Submissions</span>
            </div>
            <div className="text-3xl font-bold font-mono text-slate-900">{sheets.length}</div>
          </div>
          <div className="p-5 bg-white rounded-2xl border border-slate-200 shadow-sm">
            <div className="flex items-center gap-3 text-emerald-500 mb-2">
              <Clock className="w-5 h-5" />
              <span className="text-xs font-bold uppercase tracking-wider">Total Reg Hours</span>
            </div>
            <div className="text-3xl font-bold font-mono text-emerald-600">{sheets.reduce((sum, s) => sum + s.regular, 0)}</div>
          </div>
          <div className="p-5 bg-white rounded-2xl border border-slate-200 shadow-sm">
            <div className="flex items-center gap-3 text-rose-500 mb-2">
              <PlayCircle className="w-5 h-5" />
              <span className="text-xs font-bold uppercase tracking-wider">Total OT Hours</span>
            </div>
            <div className="text-3xl font-bold font-mono text-rose-600">{sheets.reduce((sum, s) => sum + s.overtime, 0)}</div>
          </div>
          <div className="p-5 bg-amber-50 rounded-2xl border border-amber-200 shadow-sm">
            <div className="flex items-center gap-3 text-amber-600 mb-2">
              <AlertTriangle className="w-5 h-5" />
              <span className="text-xs font-bold uppercase tracking-wider">High OT Alerts</span>
            </div>
            <div className="text-3xl font-bold font-mono text-amber-700">{highOvertimeCount}</div>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
          <div className="p-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
             <div className="flex space-x-1 p-1 bg-slate-100 rounded-lg w-max">
               {['pending', 'history'].map(tab => (
                 <button 
                   key={tab}
                   onClick={() => setActiveTab(tab as any)}
                   className={cn(
                     "px-4 py-1.5 rounded-md text-xs font-bold uppercase tracking-wider transition-all",
                     activeTab === tab ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"
                   )}
                 >
                   {tab}
                 </button>
               ))}
             </div>
             
             <div className="relative max-w-sm w-full">
               <Search size={16} className="absolute left-3 top-2.5 text-slate-400" />
               <input 
                 type="text" 
                 placeholder="Search employees or departments..." 
                 value={searchTerm}
                 onChange={e => setSearchTerm(e.target.value)}
                 className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500 transition-all"
               />
             </div>
          </div>

          <div className="overflow-x-auto">
            <div className="grid grid-cols-12 p-4 bg-slate-50 border-b border-slate-200 text-[10px] font-bold text-slate-500 uppercase tracking-wider min-w-[700px]">
              <div className="col-span-3">Employee / Dept</div>
              <div className="col-span-2 text-center">Period</div>
              <div className="col-span-2 text-center">Regular Hours</div>
              <div className="col-span-2 text-center text-rose-600">Overtime</div>
              <div className="col-span-3 text-right">Actions / Status</div>
            </div>
            
            <div className="divide-y divide-slate-100 min-w-[700px]">
              <AnimatePresence>
                {filteredSheets.map((s, i) => (
                  <motion.div 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.05 }}
                    key={s.id} 
                    className="grid grid-cols-12 p-4 items-center hover:bg-slate-50 transition-colors"
                  >
                    <div className="col-span-3 flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center text-xs font-bold text-slate-600 shrink-0">
                        {s.employee.split(' ').map(n => n[0]).join('')}
                      </div>
                      <div className="truncate">
                        <div className="font-bold text-slate-900 truncate">{s.employee}</div>
                        <div className="text-[10px] text-slate-500 mt-0.5 truncate">{s.department} • {s.id}</div>
                      </div>
                    </div>
                    
                    <div className="col-span-2 text-center text-xs font-mono font-bold text-slate-600 bg-slate-100 py-1 rounded-md">
                      {s.period}
                    </div>
                    
                    <div className="col-span-2 text-center font-bold font-mono text-slate-700 text-lg">
                      {s.regular}h
                    </div>
                    
                    <div className="col-span-2 text-center font-bold font-mono text-rose-600 text-lg flex items-center justify-center gap-1.5">
                      {s.overtime > 0 ? (
                        <>
                           {s.overtime > 10 && <AlertTriangle size={14} className="text-rose-500 animate-pulse" />}
                           {s.overtime}h
                        </>
                      ) : (
                        <span className="text-slate-300">-</span>
                      )}
                    </div>
                    
                    <div className="col-span-3 flex justify-end gap-2">
                       {s.status === 'Pending' ? (
                         <>
                           <button onClick={() => handleAction(s.id, 'Rejected')} className="px-3 py-1.5 text-xs font-bold text-rose-600 bg-rose-50 rounded-lg hover:bg-rose-100 transition-colors flex items-center gap-1.5">
                              <XSquare className="w-4 h-4" /> Reject
                           </button>
                           <button onClick={() => handleAction(s.id, 'Approved')} className="px-3 py-1.5 text-xs font-bold text-emerald-600 bg-emerald-50 rounded-lg hover:bg-emerald-100 transition-colors flex items-center gap-1.5 shadow-sm">
                              <CheckSquare className="w-4 h-4" /> Approve
                           </button>
                         </>
                       ) : (
                         <span className={cn(
                           "px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1.5",
                           s.status === 'Approved' ? "bg-emerald-100 text-emerald-800" : "bg-rose-100 text-rose-800"
                         )}>
                           {s.status === 'Approved' ? <CheckSquare size={14} /> : <XSquare size={14} />}
                           {s.status}
                         </span>
                       )}
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
              {filteredSheets.length === 0 && (
                <div className="p-12 text-center text-slate-500">
                  <Clock size={32} className="mx-auto mb-3 text-slate-300" />
                  No {activeTab} timesheets found.
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
fs.writeFileSync('src/components/operations/TimesheetApprovals.tsx', code);
