import React, { useState, useMemo } from 'react';
import { Microscope, CheckSquare, XSquare, AlertCircle, Search, Filter, CheckCircle2, Factory, FileText, Settings } from 'lucide-react';
import { cn } from '../../lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import { collection, onSnapshot, addDoc, updateDoc, deleteDoc, doc } from 'firebase/firestore';
import { db } from '../../firebase';



export default function QualityInspections() {
  const [activeTab, setActiveTab] = useState<'inspections' | 'protocols'>('inspections');
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
  const [searchTerm, setSearchTerm] = useState('');

  const filteredInspections = useMemo(() => {
    return inspections.filter(ins => 
      ins.id.toLowerCase().includes(searchTerm.toLowerCase()) || 
      ins.item.toLowerCase().includes(searchTerm.toLowerCase()) ||
      ins.inspector.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [inspections, searchTerm]);

  const passedCount = inspections.filter(i => i.passRate >= 95).length;
  const failedCount = inspections.filter(i => i.passRate < 90).length;

  return (
    <div className="h-full flex flex-col bg-slate-50">
      <div className="px-8 py-6 bg-slate-900 text-white flex flex-col md:flex-row md:justify-between md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-3">
            <Microscope className="w-6 h-6 text-indigo-400" />
            Quality Control Inspections
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Record QA results on incoming shipments and manufactured goods.
          </p>
        </div>
        <div className="flex items-center gap-4">
           <div className="flex flex-col items-end mr-4">
             <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Avg Pass Rate</span>
             <span className="text-lg font-mono font-bold text-emerald-400">{(inspections.reduce((sum, i) => sum + i.passRate, 0) / inspections.length).toFixed(1)}%</span>
           </div>
           <button className="h-10 px-4 bg-indigo-600 text-white rounded-xl text-sm font-bold flex items-center gap-2 hover:bg-indigo-700 transition-colors shadow-sm">
             <CheckSquare className="w-4 h-4" /> New Inspection
           </button>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-6 md:p-8">
        
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="p-5 bg-white rounded-2xl border border-slate-200 shadow-sm">
            <div className="flex items-center gap-3 text-slate-500 mb-2">
              <FileText className="w-5 h-5" />
              <span className="text-xs font-bold uppercase tracking-wider">Total Inspections</span>
            </div>
            <div className="text-3xl font-bold font-mono text-slate-900">{inspections.length}</div>
          </div>
          <div className="p-5 bg-white rounded-2xl border border-slate-200 shadow-sm">
            <div className="flex items-center gap-3 text-emerald-500 mb-2">
              <CheckCircle2 className="w-5 h-5" />
              <span className="text-xs font-bold uppercase tracking-wider">Passed (&gt;95%)</span>
            </div>
            <div className="text-3xl font-bold font-mono text-emerald-600">{passedCount}</div>
          </div>
          <div className="p-5 bg-white rounded-2xl border border-slate-200 shadow-sm">
            <div className="flex items-center gap-3 text-rose-500 mb-2">
              <XSquare className="w-5 h-5" />
              <span className="text-xs font-bold uppercase tracking-wider">Failed (&lt;90%)</span>
            </div>
            <div className="text-3xl font-bold font-mono text-rose-600">{failedCount}</div>
          </div>
          <div className="p-5 bg-white rounded-2xl border border-slate-200 shadow-sm">
            <div className="flex items-center gap-3 text-amber-500 mb-2">
              <AlertCircle className="w-5 h-5" />
              <span className="text-xs font-bold uppercase tracking-wider">Marginal (90-94%)</span>
            </div>
            <div className="text-3xl font-bold font-mono text-amber-600">{inspections.length - passedCount - failedCount}</div>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
          <div className="p-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
             <div className="flex space-x-1 p-1 bg-slate-100 rounded-lg w-max">
               {['inspections', 'protocols'].map(tab => (
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
             
             {activeTab === 'inspections' && (
               <div className="relative max-w-sm w-full">
                 <Search size={16} className="absolute left-3 top-2.5 text-slate-400" />
                 <input 
                   type="text" 
                   placeholder="Search inspections, items, inspectors..." 
                   value={searchTerm}
                   onChange={e => setSearchTerm(e.target.value)}
                   className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all"
                 />
               </div>
             )}
          </div>

          {activeTab === 'inspections' ? (
            <div className="overflow-x-auto">
              <div className="grid grid-cols-12 p-4 bg-slate-50 border-b border-slate-200 text-[10px] font-bold text-slate-500 uppercase tracking-wider min-w-[800px]">
                <div className="col-span-3">Item / Lot</div>
                <div className="col-span-2 text-center">Source Ref</div>
                <div className="col-span-2 text-center">Inspector</div>
                <div className="col-span-2 text-center">Yield/Pass %</div>
                <div className="col-span-3 text-right">Result Status</div>
              </div>
              
              <div className="divide-y divide-slate-100 min-w-[800px]">
                <AnimatePresence>
                  {filteredInspections.map((ins, i) => (
                    <motion.div 
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.05 }}
                      key={ins.id} 
                      className="grid grid-cols-12 p-4 items-center hover:bg-slate-50 transition-colors"
                    >
                      <div className="col-span-3">
                        <div className="font-bold text-slate-900 truncate pr-4">{ins.item}</div>
                        <div className="text-[10px] font-mono text-slate-400 mt-0.5">{ins.id} • {ins.date}</div>
                      </div>
                      
                      <div className="col-span-2 flex justify-center">
                        <span className="px-2 py-1 bg-slate-100 text-slate-600 rounded text-[10px] font-bold font-mono border border-slate-200">
                          {ins.source}
                        </span>
                      </div>
                      
                      <div className="col-span-2 text-center text-sm font-bold text-slate-700">
                         {ins.inspector}
                      </div>
                      
                      <div className="col-span-2 flex flex-col items-center justify-center">
                         <div className={cn("font-bold font-mono mb-1.5", ins.passRate >= 95 ? "text-emerald-600" : ins.passRate >= 90 ? "text-amber-600" : "text-rose-600")}>
                           {ins.passRate}%
                         </div>
                         <div className="w-16 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                           <div 
                             className={cn("h-full rounded-full transition-all duration-500", 
                               ins.passRate >= 95 ? 'bg-emerald-500' : 
                               ins.passRate >= 90 ? 'bg-amber-500' : 'bg-rose-500'
                             )} 
                             style={{ width: `${ins.passRate}%` }} 
                           />
                         </div>
                      </div>
                      
                      <div className="col-span-3 flex justify-end">
                         <span className={cn(
                            "px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider border",
                            ins.status.includes('Passed') && !ins.status.includes('Remarks') ? "bg-emerald-50 text-emerald-700 border-emerald-200" :
                            ins.status.includes('Passed') ? "bg-amber-50 text-amber-700 border-amber-200" :
                            "bg-rose-50 text-rose-700 border-rose-200"
                         )}>
                            {ins.status}
                         </span>
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
                {filteredInspections.length === 0 && (
                  <div className="p-12 text-center text-slate-500">
                    <Microscope size={32} className="mx-auto mb-3 text-slate-300" />
                    No inspections found.
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="p-16 flex flex-col items-center justify-center text-slate-500 bg-slate-50 min-h-[400px]">
               <Settings size={48} className="text-slate-300 mb-4 animate-spin-slow" />
               <h3 className="text-lg font-bold text-slate-700">Inspection Protocols</h3>
               <p className="text-sm mt-2 max-w-md text-center">Manage standard operating procedures (SOPs) and compliance checklists for QA testing.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
