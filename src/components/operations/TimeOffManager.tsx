import React, { useState, useMemo } from 'react';
import { Calendar, Clock, CheckCircle2, XCircle, Search, Filter, Palmtree, UserMinus, Plus } from 'lucide-react';
import { cn } from '../../lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import { collection, onSnapshot, addDoc, updateDoc, deleteDoc, doc } from 'firebase/firestore';
import { db } from '../../firebase';



export default function TimeOffManager() {
  const [activeTab, setActiveTab] = useState<'requests' | 'calendar'>('requests');
  const [requests, setRequests] = useState<any[]>([]);
  React.useEffect(() => {
    const unsub = onSnapshot(collection(db, 'requests'), (snap) => {
      if (!snap.empty) {
        setRequests(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      } else {
        setRequests([]);
      }
    });
    return unsub;
  }, []);
  const [searchTerm, setSearchTerm] = useState('');

  const filteredRequests = useMemo(() => {
    return requests.filter(r => 
      r.employee.toLowerCase().includes(searchTerm.toLowerCase()) || 
      r.type.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.dept.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [requests, searchTerm]);

  const handleAction = (id: string, action: 'Approved' | 'Rejected') => {
    setRequests(prev => prev.map(r => r.id === id ? { ...r, status: action } : r));
  };

  const pendingCount = requests.filter(r => r.status === 'Pending').length;
  const approvedThisMonth = requests.filter(r => r.status === 'Approved').length;

  return (
    <div className="h-full flex flex-col bg-slate-50">
      <div className="px-8 py-6 bg-slate-900 text-white flex flex-col md:flex-row md:justify-between md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-3">
            <Palmtree className="w-6 h-6 text-emerald-400" />
            Time Off & PTO Management
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Manage employee absences, vacation requests, and leave balances.
          </p>
        </div>
        <div className="flex items-center gap-4">
           <div className="flex flex-col items-end mr-4">
             <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Pending Approvals</span>
             <span className="text-lg font-mono font-bold text-emerald-400">{pendingCount}</span>
           </div>
           <button className="h-10 px-4 bg-emerald-600 text-white rounded-xl text-sm font-bold flex items-center gap-2 hover:bg-emerald-700 transition-colors shadow-sm">
             <Plus className="w-4 h-4" /> Log Absence
           </button>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-6 md:p-8">
        
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="p-5 bg-white rounded-2xl border border-slate-200 shadow-sm">
            <div className="flex items-center gap-3 text-slate-500 mb-2">
              <Clock className="w-5 h-5" />
              <span className="text-xs font-bold uppercase tracking-wider">Total Requests</span>
            </div>
            <div className="text-3xl font-bold font-mono text-slate-900">{requests.length}</div>
          </div>
          <div className="p-5 bg-white rounded-2xl border border-slate-200 shadow-sm">
            <div className="flex items-center gap-3 text-emerald-500 mb-2">
              <CheckCircle2 className="w-5 h-5" />
              <span className="text-xs font-bold uppercase tracking-wider">Approved Leave</span>
            </div>
            <div className="text-3xl font-bold font-mono text-emerald-600">{approvedThisMonth} <span className="text-sm font-sans font-medium text-slate-500">requests</span></div>
          </div>
          <div className="p-5 bg-white rounded-2xl border border-slate-200 shadow-sm">
            <div className="flex items-center gap-3 text-amber-500 mb-2">
              <UserMinus className="w-5 h-5" />
              <span className="text-xs font-bold uppercase tracking-wider">Currently Absent</span>
            </div>
            <div className="text-3xl font-bold font-mono text-amber-600">3 <span className="text-sm font-sans font-medium text-slate-500">employees</span></div>
          </div>
          <div className="p-5 bg-white rounded-2xl border border-slate-200 shadow-sm">
            <div className="flex items-center gap-3 text-sky-500 mb-2">
              <Calendar className="w-5 h-5" />
              <span className="text-xs font-bold uppercase tracking-wider">Upcoming Scheduled</span>
            </div>
            <div className="text-3xl font-bold font-mono text-sky-600">14 <span className="text-sm font-sans font-medium text-slate-500">days</span></div>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
          <div className="p-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
             <div className="flex space-x-1 p-1 bg-slate-100 rounded-lg w-max">
               {['requests', 'calendar'].map(tab => (
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
             
             {activeTab === 'requests' && (
               <div className="relative max-w-sm w-full">
                 <Search size={16} className="absolute left-3 top-2.5 text-slate-400" />
                 <input 
                   type="text" 
                   placeholder="Search employees or leave type..." 
                   value={searchTerm}
                   onChange={e => setSearchTerm(e.target.value)}
                   className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all"
                 />
               </div>
             )}
          </div>

          {activeTab === 'requests' ? (
            <div className="overflow-x-auto">
              <div className="grid grid-cols-12 p-4 bg-slate-50 border-b border-slate-200 text-[10px] font-bold text-slate-500 uppercase tracking-wider min-w-[700px]">
                <div className="col-span-3">Employee / Dept</div>
                <div className="col-span-2 text-center">Leave Type</div>
                <div className="col-span-3 text-center">Dates</div>
                <div className="col-span-1 text-center">Days</div>
                <div className="col-span-3 text-right">Actions / Status</div>
              </div>
              
              <div className="divide-y divide-slate-100 min-w-[700px]">
                <AnimatePresence>
                  {filteredRequests.map((r, i) => (
                    <motion.div 
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.05 }}
                      key={r.id} 
                      className="grid grid-cols-12 p-4 items-center hover:bg-slate-50 transition-colors"
                    >
                      <div className="col-span-3 flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center text-xs font-bold text-slate-600 shrink-0">
                          {r.employee.split(' ').map(n => n[0]).join('')}
                        </div>
                        <div className="truncate">
                          <div className="font-bold text-slate-900 truncate">{r.employee}</div>
                          <div className="text-[10px] text-slate-500 mt-0.5 truncate">{r.dept} • {r.id}</div>
                        </div>
                      </div>
                      
                      <div className="col-span-2 flex justify-center">
                         <span className={cn(
                           "px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider border",
                           r.type === 'Vacation' ? "bg-sky-50 text-sky-700 border-sky-200" :
                           r.type === 'Sick Leave' ? "bg-rose-50 text-rose-700 border-rose-200" :
                           "bg-indigo-50 text-indigo-700 border-indigo-200"
                         )}>
                           {r.type}
                         </span>
                      </div>
                      
                      <div className="col-span-3 flex items-center justify-center gap-2">
                         <Calendar className="w-3.5 h-3.5 text-slate-400" />
                         <span className="text-xs font-mono font-bold text-slate-600 bg-slate-100 px-2 py-1 rounded-md border border-slate-200">
                           {r.start} <span className="text-slate-400 font-normal mx-1">to</span> {r.end}
                         </span>
                      </div>
                      
                      <div className="col-span-1 text-center font-bold font-mono text-slate-900 text-lg">
                        {r.days}
                      </div>
                      
                      <div className="col-span-3 flex justify-end gap-2">
                         {r.status === 'Pending' ? (
                           <>
                             <button onClick={() => handleAction(r.id, 'Rejected')} className="px-3 py-1.5 text-xs font-bold text-rose-600 bg-rose-50 rounded-lg hover:bg-rose-100 transition-colors flex items-center gap-1.5">
                                <XCircle className="w-4 h-4" /> Deny
                             </button>
                             <button onClick={() => handleAction(r.id, 'Approved')} className="px-3 py-1.5 text-xs font-bold text-emerald-600 bg-emerald-50 rounded-lg hover:bg-emerald-100 transition-colors flex items-center gap-1.5 shadow-sm">
                                <CheckCircle2 className="w-4 h-4" /> Approve
                             </button>
                           </>
                         ) : (
                           <span className={cn(
                             "px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1.5",
                             r.status === 'Approved' ? "bg-emerald-100 text-emerald-800" : "bg-rose-100 text-rose-800"
                           )}>
                             {r.status === 'Approved' ? <CheckCircle2 size={14} /> : <XCircle size={14} />}
                             {r.status}
                           </span>
                         )}
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
                {filteredRequests.length === 0 && (
                  <div className="p-12 text-center text-slate-500">
                    <Calendar size={32} className="mx-auto mb-3 text-slate-300" />
                    No PTO requests found.
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="p-16 flex flex-col items-center justify-center text-slate-500 bg-slate-50 min-h-[400px]">
               <Calendar size={48} className="text-slate-300 mb-4" />
               <h3 className="text-lg font-bold text-slate-700">Team Leave Calendar</h3>
               <p className="text-sm mt-2 max-w-md text-center">Visual timeline of all upcoming team absences and holidays will be displayed here.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
