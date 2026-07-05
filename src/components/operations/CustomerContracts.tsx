import React, { useState, useMemo } from 'react';
import { FileSignature, ShieldCheck, DollarSign, Calendar, Search, AlertCircle, FileText, Plus } from 'lucide-react';
import { cn } from '../../lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import { collection, onSnapshot, addDoc, updateDoc, deleteDoc, doc } from 'firebase/firestore';
import { db } from '../../firebase';



export default function CustomerContracts() {
  const [activeTab, setActiveTab] = useState<'contracts'>('contracts');
  const [contracts, setContracts] = useState<any[]>([]);
  React.useEffect(() => {
    const unsub = onSnapshot(collection(db, 'contracts'), (snap) => {
      if (!snap.empty) {
        setContracts(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      } else {
        setContracts([]);
      }
    });
    return unsub;
  }, []);
  const [searchTerm, setSearchTerm] = useState('');

  const filteredContracts = useMemo(() => {
    return contracts.filter(c => 
      c.client.toLowerCase().includes(searchTerm.toLowerCase()) || 
      c.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.type.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [contracts, searchTerm]);

  const activeContracts = contracts.filter(c => c.status === 'Active').length;
  const expiringContracts = contracts.filter(c => c.status === 'Expiring Soon').length;
  const totalACV = contracts.reduce((sum, c) => sum + c.value, 0);

  return (
    <div className="h-full flex flex-col bg-slate-50">
      <div className="px-8 py-6 bg-slate-900 text-white flex flex-col md:flex-row md:justify-between md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-3">
            <FileSignature className="w-6 h-6 text-sky-400" />
            Customer Contracts & SLAs
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Manage long-term agreements, auto-renewals, and service level compliance.
          </p>
        </div>
        <div className="flex items-center gap-4">
           <div className="flex flex-col items-end mr-4">
             <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Contract Value (ACV)</span>
             <span className="text-lg font-mono font-bold text-sky-400">${totalACV.toLocaleString()}</span>
           </div>
           <button className="h-10 px-4 bg-sky-600 text-white rounded-xl text-sm font-bold flex items-center gap-2 hover:bg-sky-700 transition-colors shadow-sm">
             <Plus className="w-4 h-4" /> New Contract
           </button>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-6 md:p-8">
        
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="p-5 bg-white rounded-2xl border border-slate-200 shadow-sm">
            <div className="flex items-center gap-3 text-slate-500 mb-2">
              <FileText className="w-5 h-5" />
              <span className="text-xs font-bold uppercase tracking-wider">Total Contracts</span>
            </div>
            <div className="text-3xl font-bold font-mono text-slate-900">{contracts.length}</div>
          </div>
          <div className="p-5 bg-white rounded-2xl border border-slate-200 shadow-sm">
            <div className="flex items-center gap-3 text-emerald-500 mb-2">
              <ShieldCheck className="w-5 h-5" />
              <span className="text-xs font-bold uppercase tracking-wider">Active & Healthy</span>
            </div>
            <div className="text-3xl font-bold font-mono text-emerald-600">{activeContracts}</div>
          </div>
          <div className="p-5 bg-amber-50 rounded-2xl border border-amber-200 shadow-sm">
            <div className="flex items-center gap-3 text-amber-500 mb-2">
              <AlertCircle className="w-5 h-5" />
              <span className="text-xs font-bold uppercase tracking-wider">Expiring in 90 Days</span>
            </div>
            <div className="text-3xl font-bold font-mono text-amber-600">{expiringContracts}</div>
          </div>
          <div className="p-5 bg-white rounded-2xl border border-slate-200 shadow-sm">
            <div className="flex items-center gap-3 text-sky-500 mb-2">
              <DollarSign className="w-5 h-5" />
              <span className="text-xs font-bold uppercase tracking-wider">Avg Contract Value</span>
            </div>
            <div className="text-3xl font-bold font-mono text-sky-600">${Math.round(totalACV / contracts.length).toLocaleString()}</div>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
          <div className="p-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
             <div className="relative max-w-sm w-full">
               <Search size={16} className="absolute left-3 top-2.5 text-slate-400" />
               <input 
                 type="text" 
                 placeholder="Search clients or contracts..." 
                 value={searchTerm}
                 onChange={e => setSearchTerm(e.target.value)}
                 className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 transition-all"
               />
             </div>
          </div>

          <div className="overflow-x-auto">
            <div className="grid grid-cols-12 p-4 bg-slate-50 border-b border-slate-200 text-[10px] font-bold text-slate-500 uppercase tracking-wider min-w-[800px]">
              <div className="col-span-3">Client / Contract</div>
              <div className="col-span-2">Type</div>
              <div className="col-span-2 text-right">Annual Value</div>
              <div className="col-span-3 text-center">Duration & End Date</div>
              <div className="col-span-2 text-right">Status</div>
            </div>
            
            <div className="divide-y divide-slate-100 min-w-[800px]">
              <AnimatePresence>
                {filteredContracts.map((c, i) => (
                  <motion.div 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.05 }}
                    key={c.id} 
                    className="grid grid-cols-12 p-4 items-center hover:bg-slate-50 transition-colors cursor-pointer group"
                  >
                    <div className="col-span-3 flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-sky-100 flex items-center justify-center text-xs font-bold text-sky-700 shrink-0 border border-sky-200">
                        {c.client.split(' ').map(n => n[0]).join('').substring(0,2)}
                      </div>
                      <div className="truncate">
                        <div className="font-bold text-slate-900 truncate group-hover:text-sky-600 transition-colors">{c.client}</div>
                        <div className="text-[10px] font-mono text-slate-400 mt-0.5 truncate">{c.id}</div>
                      </div>
                    </div>
                    
                    <div className="col-span-2 text-sm text-slate-700 font-bold truncate pr-4">
                      {c.type}
                    </div>
                    
                    <div className="col-span-2 text-right font-mono font-bold text-emerald-600 text-lg">
                      ${c.value.toLocaleString()}
                    </div>
                    
                    <div className="col-span-3 flex items-center justify-center gap-2">
                       <Calendar className="w-3.5 h-3.5 text-slate-400" />
                       <span className="text-xs font-mono font-bold text-slate-600 bg-slate-100 px-2 py-1 rounded-md border border-slate-200">
                         {c.end}
                       </span>
                    </div>
                    
                    <div className="col-span-2 flex justify-end">
                       <span className={cn(
                          "px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider border",
                          c.status === 'Active' ? "bg-emerald-50 text-emerald-700 border-emerald-200" :
                          "bg-amber-50 text-amber-700 border-amber-200 animate-pulse"
                       )}>
                          {c.status}
                       </span>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
              {filteredContracts.length === 0 && (
                <div className="p-12 text-center text-slate-500">
                  <FileSignature size={32} className="mx-auto mb-3 text-slate-300" />
                  No contracts found.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
