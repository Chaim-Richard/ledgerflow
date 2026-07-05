import React, { useState, useMemo } from 'react';
import { Users, FileText, CheckCircle2, Search, Plus, AlertTriangle, Filter, Download, Mail, Phone, ToggleLeft, ToggleRight } from 'lucide-react';
import { cn } from '../../lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import { collection, onSnapshot, addDoc, updateDoc, deleteDoc, doc } from 'firebase/firestore';
import { db } from '../../firebase';



export default function ContractorCompliance() {
  const [contractors, setContractors] = useState<any[]>([]);
  React.useEffect(() => {
    const unsub = onSnapshot(collection(db, 'contractors'), (snap) => {
      if (!snap.empty) {
        setContractors(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      } else {
        setContractors([]);
      }
    });
    return unsub;
  }, []);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | '1099' | 'approaching' | 'missing-w9'>('all');

  const filteredContractors = useMemo(() => {
    return contractors.filter(c => {
      const matchesSearch = c.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                            c.category.toLowerCase().includes(searchTerm.toLowerCase());
                            
      const paid = c.totalPaidCents / 100;
      let matchesFilter = true;
      
      if (statusFilter === '1099') matchesFilter = c.is1099Eligible && paid > 600;
      if (statusFilter === 'approaching') matchesFilter = c.is1099Eligible && paid > 500 && paid <= 600;
      if (statusFilter === 'missing-w9') matchesFilter = c.is1099Eligible && c.w9Status !== 'submitted';
      
      return matchesSearch && matchesFilter;
    }).map(c => {
      const paid = c.totalPaidCents / 100;
      let complianceLevel = 'ok';
      if (c.is1099Eligible) {
        if (paid > 600) complianceLevel = 'exceeded';
        else if (paid > 500) complianceLevel = 'approaching';
      }
      return { ...c, complianceLevel };
    });
  }, [contractors, searchTerm, statusFilter]);

  const total1099Eligible = contractors.filter(c => c.is1099Eligible && (c.totalPaidCents / 100) > 600).length;
  const missingW9 = contractors.filter(c => c.is1099Eligible && c.w9Status !== 'submitted').length;
  const approachingLimit = contractors.filter(c => c.is1099Eligible && (c.totalPaidCents / 100) > 500 && (c.totalPaidCents / 100) <= 600).length;

  const formatCurrency = (cents: number) => {
    return `$${(cents / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  return (
    <div className="h-full flex flex-col bg-slate-50">
      <div className="px-8 py-6 bg-slate-900 text-white flex flex-col md:flex-row md:justify-between md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-3">
            <Users className="w-6 h-6 text-indigo-400" />
            1099 & Contractor Compliance
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Monitor vendor payments, W-9 status, and 1099-NEC eligibility tracking.
          </p>
        </div>
        <div className="flex items-center gap-4">
           <button className="h-10 px-4 bg-slate-800 text-slate-300 rounded-xl text-sm font-bold flex items-center gap-2 hover:bg-slate-700 hover:text-white transition-colors border border-slate-700">
             <Download className="w-4 h-4" /> Export 1099 Data
           </button>
           <button className="h-10 px-4 bg-indigo-600 text-white rounded-xl text-sm font-bold flex items-center gap-2 hover:bg-indigo-700 transition-colors shadow-sm">
             <Plus className="w-4 h-4" /> Add Vendor
           </button>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-6 md:p-8">
        
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="p-5 bg-white rounded-2xl border border-slate-200 shadow-sm">
            <div className="flex items-center gap-3 text-slate-500 mb-2">
              <Users className="w-5 h-5" />
              <span className="text-xs font-bold uppercase tracking-wider">Total Tracked Vendors</span>
            </div>
            <div className="text-3xl font-bold font-mono text-slate-900">{contractors.length}</div>
          </div>
          <div className="p-5 bg-rose-50 rounded-2xl border border-rose-200 shadow-sm">
            <div className="flex items-center gap-3 text-rose-600 mb-2">
              <FileText className="w-5 h-5" />
              <span className="text-xs font-bold uppercase tracking-wider">1099-NEC Required (&gt;$600)</span>
            </div>
            <div className="text-3xl font-bold font-mono text-rose-700">{total1099Eligible}</div>
          </div>
          <div className="p-5 bg-amber-50 rounded-2xl border border-amber-200 shadow-sm">
            <div className="flex items-center gap-3 text-amber-600 mb-2">
              <AlertTriangle className="w-5 h-5" />
              <span className="text-xs font-bold uppercase tracking-wider">Approaching Limit</span>
            </div>
            <div className="text-3xl font-bold font-mono text-amber-700">{approachingLimit}</div>
          </div>
          <div className="p-5 bg-blue-50 rounded-2xl border border-blue-200 shadow-sm">
            <div className="flex items-center gap-3 text-blue-500 mb-2">
              <AlertTriangle className="w-5 h-5" />
              <span className="text-xs font-bold uppercase tracking-wider">Missing W-9 Forms</span>
            </div>
            <div className="text-3xl font-bold font-mono text-blue-600">{missingW9}</div>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm flex flex-col h-[calc(100%-140px)]">
          <div className="p-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-50">
             
             <div className="relative max-w-sm w-full">
               <Search size={16} className="absolute left-3 top-2.5 text-slate-400" />
               <input 
                 type="text" 
                 placeholder="Search vendors or categories..."
                 value={searchTerm}
                 onChange={e => setSearchTerm(e.target.value)}
                 className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all shadow-sm"
               />
             </div>

             <div className="flex flex-wrap items-center gap-2">
                <button 
                  onClick={() => setStatusFilter('all')}
                  className={cn(
                    "px-4 py-1.5 rounded-md text-[10px] font-bold uppercase tracking-wider transition-all border",
                    statusFilter === 'all' ? "bg-slate-900 text-white border-slate-800" : "bg-white text-slate-500 border-slate-200 hover:text-slate-700"
                  )}
                >
                  All Vendors
                </button>
                <button 
                  onClick={() => setStatusFilter('1099')}
                  className={cn(
                    "px-4 py-1.5 rounded-md text-[10px] font-bold uppercase tracking-wider transition-all border",
                    statusFilter === '1099' ? "bg-rose-50 text-rose-700 border-rose-200" : "bg-white text-slate-500 border-slate-200 hover:text-slate-700"
                  )}
                >
                  1099 Required
                </button>
                <button 
                  onClick={() => setStatusFilter('approaching')}
                  className={cn(
                    "px-4 py-1.5 rounded-md text-[10px] font-bold uppercase tracking-wider transition-all border",
                    statusFilter === 'approaching' ? "bg-amber-50 text-amber-700 border-amber-200" : "bg-white text-slate-500 border-slate-200 hover:text-slate-700"
                  )}
                >
                  Approaching
                </button>
                <button 
                  onClick={() => setStatusFilter('missing-w9')}
                  className={cn(
                    "px-4 py-1.5 rounded-md text-[10px] font-bold uppercase tracking-wider transition-all border",
                    statusFilter === 'missing-w9' ? "bg-blue-50 text-blue-700 border-blue-200" : "bg-white text-slate-500 border-slate-200 hover:text-slate-700"
                  )}
                >
                  Missing W-9
                </button>
             </div>
          </div>

          <div className="overflow-x-auto flex-1">
             <div className="grid grid-cols-12 p-4 bg-slate-50 border-b border-slate-200 text-[10px] font-bold text-slate-500 uppercase tracking-wider min-w-[1000px]">
               <div className="col-span-3">Vendor / Entity</div>
               <div className="col-span-2">Contact Details</div>
               <div className="col-span-2 text-center">1099 Eligible</div>
               <div className="col-span-2 text-center">W-9 Status</div>
               <div className="col-span-2 text-right">Total Paid YTD</div>
               <div className="col-span-1 text-center">Alerts</div>
             </div>
             
             <div className="divide-y divide-slate-100 min-w-[1000px]">
               <AnimatePresence>
                 {filteredContractors.map((c, i) => (
                   <motion.div 
                     initial={{ opacity: 0, y: 10 }}
                     animate={{ opacity: 1, y: 0 }}
                     transition={{ delay: i * 0.05 }}
                     key={c.id} 
                     className="grid grid-cols-12 p-4 items-center hover:bg-slate-50 transition-colors group cursor-pointer"
                   >
                     <div className="col-span-3 flex items-center gap-3">
                       <div className="p-2.5 rounded-xl bg-slate-100 text-slate-500 border border-slate-200 shrink-0">
                          <Users className="w-4 h-4" />
                       </div>
                       <div className="truncate pr-4">
                         <div className="font-bold text-slate-900 group-hover:text-indigo-600 transition-colors truncate">{c.name}</div>
                         <div className="text-[10px] font-mono text-slate-500 mt-0.5">{c.category}</div>
                       </div>
                     </div>
                     
                     <div className="col-span-2 text-xs text-slate-600 truncate pr-4 space-y-1">
                        {c.email && (
                          <div className="flex items-center gap-1.5"><Mail size={12} className="text-slate-400" /> <span className="truncate">{c.email}</span></div>
                        )}
                        {c.phone && (
                          <div className="flex items-center gap-1.5"><Phone size={12} className="text-slate-400" /> {c.phone}</div>
                        )}
                     </div>
                     
                     <div className="col-span-2 flex justify-center">
                        {c.is1099Eligible ? (
                          <ToggleRight size={24} className="text-indigo-600" />
                        ) : (
                          <ToggleLeft size={24} className="text-slate-300" />
                        )}
                     </div>
                     
                     <div className="col-span-2 flex justify-center">
                       <span className={cn(
                         "px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider border whitespace-nowrap",
                         c.w9Status === 'submitted' ? "bg-emerald-50 text-emerald-700 border-emerald-200" :
                         "bg-rose-50 text-rose-700 border-rose-200 animate-pulse"
                       )}>
                         {c.w9Status === 'submitted' ? 'Active W-9' : 'Missing W-9'}
                       </span>
                     </div>
                     
                     <div className="col-span-2 text-right text-sm font-mono font-bold text-slate-700">
                        {formatCurrency(c.totalPaidCents)}
                     </div>
                     
                     <div className="col-span-1 flex justify-center">
                       <span className={cn(
                         "px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border whitespace-nowrap",
                         c.complianceLevel === 'exceeded' ? "bg-rose-50 text-rose-700 border-rose-200 animate-pulse" :
                         c.complianceLevel === 'approaching' ? "bg-amber-50 text-amber-700 border-amber-200" :
                         c.totalPaidCents === 0 ? "bg-slate-100 text-slate-500 border-slate-200" :
                         "bg-emerald-50 text-emerald-700 border-emerald-200"
                       )}>
                         {c.complianceLevel === 'exceeded' ? '1099 Req!' :
                          c.complianceLevel === 'approaching' ? 'Warning' : 
                          c.totalPaidCents === 0 ? 'No Pay' : 'OK'}
                       </span>
                     </div>
                   </motion.div>
                 ))}
               </AnimatePresence>
               {filteredContractors.length === 0 && (
                 <div className="p-12 text-center text-slate-500">
                   <Users size={32} className="mx-auto mb-3 text-slate-300" />
                   No vendors found.
                 </div>
               )}
             </div>
          </div>
        </div>
      </div>
    </div>
  );
}
