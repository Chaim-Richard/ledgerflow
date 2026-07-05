const fs = require('fs');
const code = `import React, { useState, useMemo } from 'react';
import { HardHat, Briefcase, FileText, CheckCircle2, ShieldAlert, FileCheck, Search, Filter, Plus, Activity } from 'lucide-react';
import { cn } from '../../lib/utils';
import { motion, AnimatePresence } from 'motion/react';

const MOCK_SUBS = [
  { id: 'SUB-991', name: 'Apex Electric Co.', project: 'Downtown Highrise', role: 'Electrical Installation', compliance: 'Verified', status: 'On Site', activeWorkers: 12 },
  { id: 'SUB-992', name: 'BuildRite Masonry', project: 'Retail Store Buildout', role: 'Brick & Stone Work', compliance: 'Verified', status: 'On Site', activeWorkers: 8 },
  { id: 'SUB-993', name: 'City Plumbing LLC', project: 'Downtown Highrise', role: 'HVAC & Plumbing', compliance: 'Missing W9', status: 'Off Site', activeWorkers: 0 },
  { id: 'SUB-994', name: 'Delta Structural', project: 'ERP Implementation', role: 'IT Infrastructure', compliance: 'Verified', status: 'On Site', activeWorkers: 4 },
  { id: 'SUB-995', name: 'Echo Security Services', project: 'Data Center Upgrade', role: 'Site Security', compliance: 'Expired Insurance', status: 'Suspended', activeWorkers: 0 },
];

export default function SubcontractorManagement() {
  const [activeTab, setActiveTab] = useState<'roster' | 'compliance'>('roster');
  const [subs] = useState(MOCK_SUBS);
  const [searchTerm, setSearchTerm] = useState('');

  const filteredSubs = useMemo(() => {
    return subs.filter(s => 
      s.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
      s.project.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.role.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [subs, searchTerm]);

  const activeOnSite = subs.filter(s => s.status === 'On Site').length;
  const totalWorkers = subs.reduce((sum, s) => sum + s.activeWorkers, 0);
  const complianceIssues = subs.filter(s => s.compliance !== 'Verified').length;

  return (
    <div className="h-full flex flex-col bg-slate-50">
      <div className="px-8 py-6 bg-slate-900 text-white flex flex-col md:flex-row md:justify-between md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-3">
            <HardHat className="w-6 h-6 text-orange-500" />
            Subcontractor Management
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Track third-party laborers, compliance documents (W9, Insurance), and site presence.
          </p>
        </div>
        <div className="flex items-center gap-4">
           <div className="flex flex-col items-end mr-4">
             <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Subcontractors On Site</span>
             <span className="text-lg font-mono font-bold text-orange-400">{activeOnSite}</span>
           </div>
           <button className="h-10 px-4 bg-orange-600 text-white rounded-xl text-sm font-bold flex items-center gap-2 hover:bg-orange-700 transition-colors shadow-sm">
             <Plus className="w-4 h-4" /> Add Vendor
           </button>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-6 md:p-8">
        
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="p-5 bg-white rounded-2xl border border-slate-200 shadow-sm">
            <div className="flex items-center gap-3 text-slate-500 mb-2">
              <Briefcase className="w-5 h-5" />
              <span className="text-xs font-bold uppercase tracking-wider">Total Subcontractors</span>
            </div>
            <div className="text-3xl font-bold font-mono text-slate-900">{subs.length}</div>
          </div>
          <div className="p-5 bg-blue-50 rounded-2xl border border-blue-200 shadow-sm">
            <div className="flex items-center gap-3 text-blue-600 mb-2">
              <Activity className="w-5 h-5" />
              <span className="text-xs font-bold uppercase tracking-wider">Active Workers (Est)</span>
            </div>
            <div className="text-3xl font-bold font-mono text-blue-700">{totalWorkers}</div>
          </div>
          <div className="p-5 bg-white rounded-2xl border border-slate-200 shadow-sm">
            <div className="flex items-center gap-3 text-emerald-500 mb-2">
              <FileCheck className="w-5 h-5" />
              <span className="text-xs font-bold uppercase tracking-wider">Fully Compliant</span>
            </div>
            <div className="text-3xl font-bold font-mono text-emerald-600">{subs.length - complianceIssues}</div>
          </div>
          <div className="p-5 bg-rose-50 rounded-2xl border border-rose-200 shadow-sm">
            <div className="flex items-center gap-3 text-rose-500 mb-2">
              <ShieldAlert className="w-5 h-5" />
              <span className="text-xs font-bold uppercase tracking-wider">Compliance Holds</span>
            </div>
            <div className="text-3xl font-bold font-mono text-rose-600">{complianceIssues}</div>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
          <div className="p-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
             <div className="flex space-x-1 p-1 bg-slate-100 rounded-lg w-max">
               {['roster', 'compliance'].map(tab => (
                 <button 
                   key={tab}
                   onClick={() => setActiveTab(tab as any)}
                   className={cn(
                     "px-4 py-1.5 rounded-md text-xs font-bold uppercase tracking-wider transition-all",
                     activeTab === tab ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"
                   )}
                 >
                   {tab === 'roster' ? 'Active Roster' : 'Compliance Vault'}
                 </button>
               ))}
             </div>
             
             {activeTab === 'roster' && (
               <div className="relative max-w-sm w-full">
                 <Search size={16} className="absolute left-3 top-2.5 text-slate-400" />
                 <input 
                   type="text" 
                   placeholder="Search vendors, projects..." 
                   value={searchTerm}
                   onChange={e => setSearchTerm(e.target.value)}
                   className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500 transition-all"
                 />
               </div>
             )}
          </div>

          {activeTab === 'roster' ? (
            <div className="overflow-x-auto">
              <div className="grid grid-cols-12 p-4 bg-slate-50 border-b border-slate-200 text-[10px] font-bold text-slate-500 uppercase tracking-wider min-w-[900px]">
                <div className="col-span-3">Subcontractor</div>
                <div className="col-span-2 text-center">Assigned Project</div>
                <div className="col-span-3 text-center">Role / Scope</div>
                <div className="col-span-2 text-center">Compliance</div>
                <div className="col-span-2 text-right">Status / Workers</div>
              </div>
              
              <div className="divide-y divide-slate-100 min-w-[900px]">
                <AnimatePresence>
                  {filteredSubs.map((s, i) => (
                    <motion.div 
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.05 }}
                      key={s.id} 
                      className="grid grid-cols-12 p-4 items-center hover:bg-slate-50 transition-colors group cursor-pointer"
                    >
                      <div className="col-span-3 flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center">
                           <HardHat size={18} className="text-slate-400 group-hover:text-orange-500 transition-colors" />
                        </div>
                        <div className="truncate">
                          <div className="font-bold text-slate-900 truncate group-hover:text-orange-600 transition-colors">{s.name}</div>
                          <div className="text-[10px] font-mono text-slate-500 mt-0.5">{s.id}</div>
                        </div>
                      </div>
                      
                      <div className="col-span-2 text-center text-xs font-mono font-bold text-slate-600 bg-slate-100 py-1 rounded-md mx-2 truncate px-2">
                        {s.project}
                      </div>
                      
                      <div className="col-span-3 text-center text-sm font-bold text-slate-700 truncate px-4">
                        {s.role}
                      </div>
                      
                      <div className="col-span-2 flex justify-center">
                         <span className={cn(
                            "px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider border flex items-center gap-1.5",
                            s.compliance === 'Verified' ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-rose-50 text-rose-700 border-rose-200"
                         )}>
                            {s.compliance === 'Verified' ? <CheckCircle2 size={12} /> : <ShieldAlert size={12} />}
                            {s.compliance}
                         </span>
                      </div>
                      
                      <div className="col-span-2 flex flex-col items-end justify-center">
                         <span className={cn(
                            "px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider border",
                            s.status === 'On Site' ? "bg-blue-50 text-blue-700 border-blue-200" :
                            s.status === 'Suspended' ? "bg-rose-50 text-rose-700 border-rose-200" :
                            "bg-amber-50 text-amber-700 border-amber-200"
                         )}>
                            {s.status}
                         </span>
                         {s.status === 'On Site' && (
                           <div className="text-[10px] font-bold text-slate-500 mt-1 flex items-center gap-1">
                             <Activity size={10} className="text-blue-500" /> {s.activeWorkers} Workers
                           </div>
                         )}
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
                {filteredSubs.length === 0 && (
                  <div className="p-12 text-center text-slate-500">
                    <HardHat size={32} className="mx-auto mb-3 text-slate-300" />
                    No subcontractors found.
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="p-16 flex flex-col items-center justify-center text-slate-500 bg-slate-50 min-h-[400px]">
               <FileCheck size={48} className="text-slate-300 mb-4" />
               <h3 className="text-lg font-bold text-slate-700">Compliance Document Vault</h3>
               <p className="text-sm mt-2 max-w-md text-center">Manage and verify W9s, Certificates of Insurance (COI), and safety certifications for all vendors.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
`;
fs.writeFileSync('src/components/operations/SubcontractorManagement.tsx', code);
