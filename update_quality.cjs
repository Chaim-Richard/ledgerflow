const fs = require('fs');
const code = `import React, { useState, useMemo } from 'react';
import { CheckCircle2, AlertTriangle, ShieldAlert, Target, Search, Microscope, Crosshair, Plus } from 'lucide-react';
import { cn } from '../../lib/utils';
import { motion, AnimatePresence } from 'motion/react';

const MOCK_INSPECTIONS = [
  { id: 'QA-501', product: 'Logic Board v2', batch: 'B-26-06-A', inspector: 'John D.', date: '2026-07-04', defects: 0, sampleSize: 100, result: 'Pass' },
  { id: 'QA-502', product: 'Titanium Casing', batch: 'B-26-06-B', inspector: 'Sarah C.', date: '2026-07-04', defects: 5, sampleSize: 50, result: 'Fail' },
  { id: 'QA-503', product: 'Display Module', batch: 'B-26-06-C', inspector: 'Tony S.', date: '2026-07-03', defects: 1, sampleSize: 200, result: 'Conditional' },
  { id: 'QA-504', product: 'Power Supply', batch: 'B-26-06-D', inspector: 'Bruce W.', date: '2026-07-03', defects: 0, sampleSize: 75, result: 'Pass' },
  { id: 'QA-505', product: 'Cooling Fan', batch: 'B-26-06-E', inspector: 'Clark K.', date: '2026-07-02', defects: 12, sampleSize: 500, result: 'Conditional' },
];

const MOCK_ISSUES = [
  { id: 'DEF-101', product: 'Titanium Casing', description: 'Scratches on surface', severity: 'High', status: 'Open', date: '2026-07-04' },
  { id: 'DEF-102', product: 'Cooling Fan', description: 'Bearing noise > 40dB', severity: 'Medium', status: 'Investigating', date: '2026-07-02' },
  { id: 'DEF-103', product: 'Display Module', description: 'Dead pixel cluster', severity: 'Low', status: 'Resolved', date: '2026-07-03' },
];

export default function QualityControl() {
  const [activeTab, setActiveTab] = useState<'inspections' | 'issues'>('inspections');
  const [inspections] = useState(MOCK_INSPECTIONS);
  const [issues] = useState(MOCK_ISSUES);
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
      i.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
      i.id.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [issues, searchTerm]);

  const passCount = inspections.filter(i => i.result === 'Pass').length;
  const failCount = inspections.filter(i => i.result === 'Fail').length;
  const totalDefects = inspections.reduce((sum, i) => sum + i.defects, 0);
  const openIssuesCount = issues.filter(i => i.status !== 'Resolved').length;

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
             <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Pass Rate (7d)</span>
             <span className="text-lg font-mono font-bold text-emerald-400">
               {inspections.length > 0 ? ((passCount / inspections.length) * 100).toFixed(1) : 0}%
             </span>
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
              <Microscope className="w-5 h-5" />
              <span className="text-xs font-bold uppercase tracking-wider">Total Inspections</span>
            </div>
            <div className="text-3xl font-bold font-mono text-slate-900">{inspections.length}</div>
          </div>
          <div className="p-5 bg-emerald-50 rounded-2xl border border-emerald-200 shadow-sm">
            <div className="flex items-center gap-3 text-emerald-600 mb-2">
              <CheckCircle2 className="w-5 h-5" />
              <span className="text-xs font-bold uppercase tracking-wider">Passed Batches</span>
            </div>
            <div className="text-3xl font-bold font-mono text-emerald-700">{passCount}</div>
          </div>
          <div className="p-5 bg-rose-50 rounded-2xl border border-rose-200 shadow-sm">
            <div className="flex items-center gap-3 text-rose-500 mb-2">
              <ShieldAlert className="w-5 h-5" />
              <span className="text-xs font-bold uppercase tracking-wider">Failed / Rejected</span>
            </div>
            <div className="text-3xl font-bold font-mono text-rose-600">{failCount}</div>
          </div>
          <div className="p-5 bg-amber-50 rounded-2xl border border-amber-200 shadow-sm">
            <div className="flex items-center gap-3 text-amber-600 mb-2">
              <AlertTriangle className="w-5 h-5" />
              <span className="text-xs font-bold uppercase tracking-wider">Open Defect Reports</span>
            </div>
            <div className="text-3xl font-bold font-mono text-amber-700">{openIssuesCount}</div>
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
                  <div className="col-span-3">Product & Batch</div>
                  <div className="col-span-2">Inspector</div>
                  <div className="col-span-2 text-center">Date</div>
                  <div className="col-span-3 text-center">Sample Size & Defects</div>
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
                             <Microscope size={18} className="text-slate-400 group-hover:text-emerald-500 transition-colors" />
                          </div>
                          <div className="truncate pr-4">
                            <div className="font-bold text-slate-900 group-hover:text-emerald-600 transition-colors truncate">{insp.product}</div>
                            <div className="text-[10px] font-mono text-slate-500 mt-0.5">{insp.id} • {insp.batch}</div>
                          </div>
                        </div>
                        
                        <div className="col-span-2 text-sm font-bold text-slate-700">
                          {insp.inspector}
                        </div>
                        
                        <div className="col-span-2 text-center text-xs font-mono font-bold text-slate-600">
                           {insp.date}
                        </div>
                        
                        <div className="col-span-3 text-center">
                           <div className="flex items-center justify-center gap-3">
                             <span className="text-xs font-bold text-slate-500">n={insp.sampleSize}</span>
                             <span className={cn(
                               "text-sm font-bold font-mono px-2 py-0.5 rounded",
                               insp.defects > 0 ? "bg-rose-50 text-rose-600" : "text-slate-400"
                             )}>
                                {insp.defects} defects
                             </span>
                           </div>
                        </div>
                        
                        <div className="col-span-2 flex justify-end">
                          <span className={cn(
                            "px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider border whitespace-nowrap",
                            insp.result === 'Pass' ? "bg-emerald-50 text-emerald-700 border-emerald-200" :
                            insp.result === 'Conditional' ? "bg-amber-50 text-amber-700 border-amber-200" :
                            "bg-rose-50 text-rose-700 border-rose-200"
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
                      No inspection logs found.
                    </div>
                  )}
                </div>
              </>
            ) : (
              <>
                <div className="grid grid-cols-12 p-4 bg-slate-50 border-b border-slate-200 text-[10px] font-bold text-slate-500 uppercase tracking-wider min-w-[800px]">
                  <div className="col-span-2">Defect ID & Date</div>
                  <div className="col-span-3">Product</div>
                  <div className="col-span-4">Issue Description</div>
                  <div className="col-span-1 text-center">Severity</div>
                  <div className="col-span-2 text-right">Status</div>
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
                        <div className="col-span-2">
                           <div className="font-bold font-mono text-slate-900 group-hover:text-rose-600 transition-colors">{issue.id}</div>
                           <div className="text-[10px] font-mono text-slate-500 mt-0.5">{issue.date}</div>
                        </div>
                        
                        <div className="col-span-3 font-bold text-slate-700 truncate pr-4">
                          {issue.product}
                        </div>
                        
                        <div className="col-span-4 text-sm text-slate-600 pr-4 truncate">
                           {issue.description}
                        </div>
                        
                        <div className="col-span-1 flex justify-center">
                           <span className={cn(
                             "w-2 h-2 rounded-full",
                             issue.severity === 'High' ? "bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.5)]" :
                             issue.severity === 'Medium' ? "bg-amber-500" :
                             "bg-slate-300"
                           )} title={issue.severity} />
                        </div>
                        
                        <div className="col-span-2 flex justify-end">
                          <span className={cn(
                            "px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider border whitespace-nowrap",
                            issue.status === 'Resolved' ? "bg-slate-100 text-slate-500 border-slate-200" :
                            issue.status === 'Investigating' ? "bg-amber-50 text-amber-700 border-amber-200" :
                            "bg-rose-50 text-rose-700 border-rose-200 animate-pulse"
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
`;
fs.writeFileSync('src/components/operations/QualityControl.tsx', code);
