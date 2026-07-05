import React, { useState, useMemo } from 'react';
import { Clock, Briefcase, FileText, CheckCircle2, Search, Target, CheckSquare, Plus, Ban } from 'lucide-react';
import { cn } from '../../lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import { collection, onSnapshot, addDoc, updateDoc, deleteDoc, doc } from 'firebase/firestore';
import { db } from '../../firebase';



export default function TimeAndBilling() {
  const [activeTab, setActiveTab] = useState<'unbilled' | 'billed'>('unbilled');
  const [entries, setEntries] = useState<any[]>([]);
  React.useEffect(() => {
    const unsub = onSnapshot(collection(db, 'entries'), (snap) => {
      if (!snap.empty) {
        setEntries(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      } else {
        setEntries([]);
      }
    });
    return unsub;
  }, []);
  const [searchTerm, setSearchTerm] = useState('');

  const filteredEntries = useMemo(() => {
    let filtered = entries.filter(e => 
      e.employee.toLowerCase().includes(searchTerm.toLowerCase()) || 
      e.client.toLowerCase().includes(searchTerm.toLowerCase()) ||
      e.project.toLowerCase().includes(searchTerm.toLowerCase())
    );
    if (activeTab === 'unbilled') {
      filtered = filtered.filter(e => e.status !== 'Billed');
    } else {
      filtered = filtered.filter(e => e.status === 'Billed');
    }
    return filtered;
  }, [entries, searchTerm, activeTab]);

  const handleAction = (id: string, action: 'Billed' | 'Rejected') => {
    setEntries(prev => prev.map(e => e.id === id ? { ...e, status: action } : e));
  };

  const unbilledTotal = entries.filter(e => e.status !== 'Billed' && e.status !== 'Rejected').reduce((sum, e) => sum + (e.hours * e.rate), 0);
  const billedTotal = entries.filter(e => e.status === 'Billed').reduce((sum, e) => sum + (e.hours * e.rate), 0);

  return (
    <div className="h-full flex flex-col bg-slate-50">
      <div className="px-8 py-6 bg-slate-900 text-white flex flex-col md:flex-row md:justify-between md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-3">
            <Clock className="w-6 h-6 text-sky-400" />
            Time & Billing
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Track billable hours against client projects and generate invoices.
          </p>
        </div>
        <div className="flex items-center gap-4">
           <div className="flex flex-col items-end mr-4">
             <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Unbilled WIP</span>
             <span className="text-lg font-mono font-bold text-emerald-400">${unbilledTotal.toLocaleString()}</span>
           </div>
           <button className="h-10 px-4 bg-sky-600 text-white rounded-xl text-sm font-bold flex items-center gap-2 hover:bg-sky-700 transition-colors shadow-sm">
             <FileText className="w-4 h-4" /> Generate Invoices
           </button>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-6 md:p-8">
        
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="p-5 bg-white rounded-2xl border border-slate-200 shadow-sm">
            <div className="flex items-center gap-3 text-slate-500 mb-2">
              <Clock className="w-5 h-5" />
              <span className="text-xs font-bold uppercase tracking-wider">Total Hours Logged</span>
            </div>
            <div className="text-3xl font-bold font-mono text-slate-900">{entries.reduce((sum, e) => sum + e.hours, 0).toFixed(1)}h</div>
          </div>
          <div className="p-5 bg-amber-50 rounded-2xl border border-amber-200 shadow-sm">
            <div className="flex items-center gap-3 text-amber-600 mb-2">
              <Briefcase className="w-5 h-5" />
              <span className="text-xs font-bold uppercase tracking-wider">Unbilled WIP</span>
            </div>
            <div className="text-3xl font-bold font-mono text-amber-700">${unbilledTotal.toLocaleString()}</div>
          </div>
          <div className="p-5 bg-white rounded-2xl border border-slate-200 shadow-sm">
            <div className="flex items-center gap-3 text-emerald-500 mb-2">
              <CheckCircle2 className="w-5 h-5" />
              <span className="text-xs font-bold uppercase tracking-wider">Billed (MTD)</span>
            </div>
            <div className="text-3xl font-bold font-mono text-emerald-600">${billedTotal.toLocaleString()}</div>
          </div>
          <div className="p-5 bg-white rounded-2xl border border-slate-200 shadow-sm">
            <div className="flex items-center gap-3 text-sky-500 mb-2">
              <Target className="w-5 h-5" />
              <span className="text-xs font-bold uppercase tracking-wider">Avg Blended Rate</span>
            </div>
            <div className="text-3xl font-bold font-mono text-sky-600">${Math.round(entries.reduce((sum, e) => sum + e.rate, 0) / entries.length)}/hr</div>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
          <div className="p-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
             <div className="flex space-x-1 p-1 bg-slate-100 rounded-lg w-max">
               {['unbilled', 'billed'].map(tab => (
                 <button 
                   key={tab}
                   onClick={() => setActiveTab(tab as any)}
                   className={cn(
                     "px-4 py-1.5 rounded-md text-xs font-bold uppercase tracking-wider transition-all",
                     activeTab === tab ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"
                   )}
                 >
                   {tab === 'unbilled' ? 'WIP & Unbilled' : 'Billed History'}
                 </button>
               ))}
             </div>
             
             <div className="relative max-w-sm w-full">
               <Search size={16} className="absolute left-3 top-2.5 text-slate-400" />
               <input 
                 type="text" 
                 placeholder="Search entries, clients..." 
                 value={searchTerm}
                 onChange={e => setSearchTerm(e.target.value)}
                 className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 transition-all"
               />
             </div>
          </div>

          <div className="overflow-x-auto">
            <div className="grid grid-cols-12 p-4 bg-slate-50 border-b border-slate-200 text-[10px] font-bold text-slate-500 uppercase tracking-wider min-w-[800px]">
              <div className="col-span-3">Employee / Ref</div>
              <div className="col-span-3">Client / Project</div>
              <div className="col-span-2 text-center">Hours & Rate</div>
              <div className="col-span-2 text-right">Billable Value</div>
              <div className="col-span-2 text-right">Actions / Status</div>
            </div>
            
            <div className="divide-y divide-slate-100 min-w-[800px]">
              <AnimatePresence>
                {filteredEntries.map((e, i) => (
                  <motion.div 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.05 }}
                    key={e.id} 
                    className="grid grid-cols-12 p-4 items-center hover:bg-slate-50 transition-colors group"
                  >
                    <div className="col-span-3 flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-sky-100 flex items-center justify-center text-xs font-bold text-sky-700 shrink-0 border border-sky-200">
                        {e.employee.split(' ').map(n => n[0]).join('')}
                      </div>
                      <div className="truncate">
                        <div className="font-bold text-slate-900 truncate">{e.employee}</div>
                        <div className="text-[10px] font-mono text-slate-500 mt-0.5 truncate">{e.id} • {e.date}</div>
                      </div>
                    </div>
                    
                    <div className="col-span-3">
                      <div className="font-bold text-slate-700 text-sm truncate">{e.client}</div>
                      <div className="text-[10px] font-bold text-slate-500 mt-0.5 bg-slate-100 px-2 py-0.5 rounded inline-block truncate max-w-full">{e.project}</div>
                    </div>
                    
                    <div className="col-span-2 flex flex-col items-center justify-center">
                       <span className="font-bold font-mono text-slate-900 text-lg">
                         {e.hours}h
                       </span>
                       <span className="text-[10px] font-mono font-bold text-slate-400">@ ${e.rate}/hr</span>
                    </div>
                    
                    <div className="col-span-2 text-right font-bold font-mono text-emerald-600 text-lg">
                      ${(e.hours * e.rate).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </div>
                    
                    <div className="col-span-2 flex justify-end gap-2">
                       {e.status === 'Pending Review' || e.status === 'Unbilled' ? (
                         <>
                           <button onClick={() => handleAction(e.id, 'Rejected')} className="px-3 py-1.5 text-xs font-bold text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors" title="Write-off / Reject">
                              <Ban className="w-4 h-4" />
                           </button>
                           <button onClick={() => handleAction(e.id, 'Billed')} className="px-3 py-1.5 text-[10px] uppercase tracking-wider font-bold text-emerald-600 bg-emerald-50 rounded-lg hover:bg-emerald-100 transition-colors shadow-sm border border-emerald-200 whitespace-nowrap">
                              Mark Billed
                           </button>
                         </>
                       ) : (
                         <span className={cn(
                           "px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5 border",
                           e.status === 'Billed' ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-rose-50 text-rose-700 border-rose-200"
                         )}>
                           {e.status === 'Billed' ? <CheckCircle2 size={12} /> : <Ban size={12} />}
                           {e.status}
                         </span>
                       )}
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
              {filteredEntries.length === 0 && (
                <div className="p-12 text-center text-slate-500">
                  <Clock size={32} className="mx-auto mb-3 text-slate-300" />
                  No {activeTab} time entries found.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
