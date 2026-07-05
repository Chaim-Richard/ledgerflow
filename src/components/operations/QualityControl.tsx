import React, { useState, useMemo } from 'react';
import { CheckCircle2, AlertTriangle, ShieldAlert, Target, Search, Plus, ThumbsUp, ThumbsDown, Package, ClipboardCheck } from 'lucide-react';
import { cn } from '../../lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import { collection, onSnapshot, addDoc, updateDoc, deleteDoc, doc } from 'firebase/firestore';
import { db } from '../../firebase';





export default function QualityControl() {
  const [activeTab, setActiveTab] = useState<'inspections' | 'issues'>('inspections');
  const [inspections, setInspections] = useState<any[]>([]);
  React.useEffect(() => {
    const unsub = onSnapshot(collection(db, 'inspections'), (snap) => {
      if (!snap.empty) {
        setInspections(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      } else {
        setInspections([]);
      }
    });
    return unsub;
  }, []);
  const [issues, setIssues] = useState<any[]>([]);
  React.useEffect(() => {
    const unsub = onSnapshot(collection(db, 'issues'), (snap) => {
      if (!snap.empty) {
        setIssues(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      } else {
        setIssues([]);
      }
    });
    return unsub;
  }, []);
  const [searchTerm, setSearchTerm] = useState('');

  const filteredInspections = useMemo(() => {
    return inspections.filter(i => 
      i.product.toLowerCase().includes(searchTerm.toLowerCase()) || 
      i.batch.toLowerCase().includes(searchTerm.toLowerCase()) ||
      i.id.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [inspections, searchTerm]);

  const filteredIssues = useMemo(() => {
    return issues.filter(i => 
      i.product.toLowerCase().includes(searchTerm.toLowerCase()) || 
      i.issue.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [issues, searchTerm]);

  const passRate = (inspections.filter(i => i.result === 'Pass').length / inspections.length) * 100;
  const failCount = inspections.filter(i => i.result === 'Fail').length;
  const openIssues = issues.filter(i => i.status !== 'Resolved').length;

  return (
    <div className="h-full flex flex-col bg-slate-50">
      <div className="px-8 py-6 bg-slate-900 text-white flex flex-col md:flex-row md:justify-between md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-3">
            <CheckCircle2 className="w-6 h-6 text-emerald-400" />
            Quality Control & Inspections
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Track product quality, inspection batches, defects, and compliance.
          </p>
        </div>
        <div className="flex items-center gap-4">
           <div className="flex flex-col items-end mr-4">
             <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Overall Pass Rate</span>
             <span className="text-lg font-mono font-bold text-emerald-400">{passRate.toFixed(1)}%</span>
           </div>
           <button className="h-10 px-4 bg-emerald-600 text-white rounded-xl text-sm font-bold flex items-center gap-2 hover:bg-emerald-700 transition-colors shadow-sm">
             <Plus className="w-4 h-4" /> Log Inspection
           </button>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-6 md:p-8">
        
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="p-5 bg-white rounded-2xl border border-slate-200 shadow-sm">
            <div className="flex items-center gap-3 text-slate-500 mb-2">
              <ClipboardCheck className="w-5 h-5" />
              <span className="text-xs font-bold uppercase tracking-wider">Total Inspections</span>
            </div>
            <div className="text-3xl font-bold font-mono text-slate-900">{inspections.length}</div>
          </div>
          <div className="p-5 bg-emerald-50 rounded-2xl border border-emerald-200 shadow-sm">
            <div className="flex items-center gap-3 text-emerald-600 mb-2">
              <ThumbsUp className="w-5 h-5" />
              <span className="text-xs font-bold uppercase tracking-wider">Passed Batches</span>
            </div>
            <div className="text-3xl font-bold font-mono text-emerald-700">{inspections.filter(i => i.result === 'Pass').length}</div>
          </div>
          <div className="p-5 bg-rose-50 rounded-2xl border border-rose-200 shadow-sm">
            <div className="flex items-center gap-3 text-rose-500 mb-2">
              <ThumbsDown className="w-5 h-5" />
              <span className="text-xs font-bold uppercase tracking-wider">Failed Batches</span>
            </div>
            <div className="text-3xl font-bold font-mono text-rose-600">{failCount}</div>
          </div>
          <div className="p-5 bg-amber-50 rounded-2xl border border-amber-200 shadow-sm">
            <div className="flex items-center gap-3 text-amber-600 mb-2">
              <ShieldAlert className="w-5 h-5" />
              <span className="text-xs font-bold uppercase tracking-wider">Open Defect Reports</span>
            </div>
            <div className="text-3xl font-bold font-mono text-amber-700">{openIssues}</div>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
          <div className="p-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
             <div className="flex space-x-1 p-1 bg-slate-100 rounded-lg w-max">
               {[
                 { id: 'inspections', label: 'Inspection Logs', icon: Target },
                 { id: 'issues', label: 'Defect Tracking', icon: AlertTriangle }
               ].map(tab => (
                 <button 
                   key={tab.id}
                   onClick={() => setActiveTab(tab.id as any)}
                   className={cn(
                     "px-4 py-1.5 rounded-md text-xs font-bold uppercase tracking-wider transition-all flex items-center gap-2",
                     activeTab === tab.id ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"
                   )}
                 >
                   <tab.icon className="w-3.5 h-3.5" />
                   {tab.label}
                 </button>
               ))}
             </div>
             
             <div className="relative max-w-sm w-full">
               <Search size={16} className="absolute left-3 top-2.5 text-slate-400" />
               <input 
                 type="text" 
                 placeholder={activeTab === 'inspections' ? "Search products or batches..." : "Search defects..."}
                 value={searchTerm}
                 onChange={e => setSearchTerm(e.target.value)}
                 className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all"
               />
             </div>
          </div>

          <div className="overflow-x-auto">
            {activeTab === 'inspections' ? (
              <>
                <div className="grid grid-cols-12 p-4 bg-slate-50 border-b border-slate-200 text-[10px] font-bold text-slate-500 uppercase tracking-wider min-w-[800px]">
                  <div className="col-span-3">Product / Batch</div>
                  <div className="col-span-2">Inspector</div>
                  <div className="col-span-2">Date</div>
                  <div className="col-span-3 text-center">Defects Found / Sample</div>
                  <div className="col-span-2 text-right">Result</div>
                </div>
                
                <div className="divide-y divide-slate-100 min-w-[800px]">
                  <AnimatePresence>
                    {filteredInspections.map((insp, i) => (
                      <motion.div 
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.05 }}
                        key={insp.id} 
                        className="grid grid-cols-12 p-4 items-center hover:bg-slate-50 transition-colors group cursor-pointer"
                      >
                        <div className="col-span-3 flex items-center gap-3">
                          <div className="w-10 h-10 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center shrink-0">
                             <Package size={18} className="text-slate-400 group-hover:text-emerald-500 transition-colors" />
                          </div>
                          <div className="truncate pr-4">
                            <div className="font-bold text-slate-900 group-hover:text-emerald-600 transition-colors truncate">{insp.product}</div>
                            <div className="text-[10px] font-mono text-slate-500 mt-0.5">{insp.id} • {insp.batch}</div>
                          </div>
                        </div>
                        
                        <div className="col-span-2 text-sm font-bold text-slate-700">
                          {insp.inspector}
                        </div>
                        
                        <div className="col-span-2 text-xs text-slate-600 font-mono font-bold">
                           {insp.date}
                        </div>
                        
                        <div className="col-span-3 flex justify-center items-center gap-2">
                           <span className={cn(
                             "text-sm font-bold font-mono px-2 py-1 rounded", 
                             insp.defects > 0 ? "text-rose-600 bg-rose-50" : "text-emerald-600 bg-emerald-50"
                           )}>
                              {insp.defects}
                           </span>
                           <span className="text-xs text-slate-400 font-mono">/ {insp.sampleSize}</span>
                        </div>
                        
                        <div className="col-span-2 flex justify-end">
                          <span className={cn(
                            "px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider border whitespace-nowrap",
                            insp.result === 'Pass' ? "bg-emerald-50 text-emerald-700 border-emerald-200" :
                            insp.result === 'Conditional' ? "bg-amber-50 text-amber-700 border-amber-200" :
                            "bg-rose-50 text-rose-700 border-rose-200 animate-pulse"
                          )}>
                            {insp.result}
                          </span>
                        </div>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                  {filteredInspections.length === 0 && (
                    <div className="p-12 text-center text-slate-500">
                      <Target size={32} className="mx-auto mb-3 text-slate-300" />
                      No inspections found.
                    </div>
                  )}
                </div>
              </>
            ) : (
              <>
                <div className="grid grid-cols-12 p-4 bg-slate-50 border-b border-slate-200 text-[10px] font-bold text-slate-500 uppercase tracking-wider min-w-[800px]">
                  <div className="col-span-3">Product / ID</div>
                  <div className="col-span-4">Issue Description</div>
                  <div className="col-span-2 text-center">Severity</div>
                  <div className="col-span-3 text-right">Status</div>
                </div>
                
                <div className="divide-y divide-slate-100 min-w-[800px]">
                  <AnimatePresence>
                    {filteredIssues.map((issue, i) => (
                      <motion.div 
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.05 }}
                        key={issue.id} 
                        className="grid grid-cols-12 p-4 items-center hover:bg-slate-50 transition-colors group cursor-pointer"
                      >
                        <div className="col-span-3">
                          <div className="font-bold text-slate-900 truncate">{issue.product}</div>
                          <div className="text-[10px] font-mono text-slate-500 mt-0.5">{issue.id}</div>
                        </div>
                        
                        <div className="col-span-4 text-sm text-slate-700 font-medium truncate pr-4">
                          {issue.issue}
                        </div>
                        
                        <div className="col-span-2 flex justify-center">
                           <span className={cn(
                             "px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border",
                             issue.severity === 'High' ? "bg-rose-100 text-rose-700 border-rose-200" :
                             issue.severity === 'Medium' ? "bg-amber-100 text-amber-700 border-amber-200" :
                             "bg-blue-100 text-blue-700 border-blue-200"
                           )}>
                             {issue.severity}
                           </span>
                        </div>
                        
                        <div className="col-span-3 flex justify-end">
                          <span className={cn(
                            "px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider border whitespace-nowrap",
                            issue.status === 'Resolved' ? "bg-emerald-50 text-emerald-700 border-emerald-200" :
                            issue.status === 'Investigating' ? "bg-amber-50 text-amber-700 border-amber-200" :
                            "bg-rose-50 text-rose-700 border-rose-200"
                          )}>
                            {issue.status}
                          </span>
                        </div>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                  {filteredIssues.length === 0 && (
                    <div className="p-12 text-center text-slate-500">
                      <AlertTriangle size={32} className="mx-auto mb-3 text-slate-300" />
                      No defect reports found.
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
