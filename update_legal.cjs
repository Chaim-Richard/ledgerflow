const fs = require('fs');
const code = `import React, { useState, useMemo } from 'react';
import { FileSignature, ShieldCheck, Clock, FileText, CheckCircle2, Search, Plus, AlertCircle, Calendar } from 'lucide-react';
import { cn } from '../../lib/utils';
import { motion, AnimatePresence } from 'motion/react';

const MOCK_CONTRACTS = [
  { id: 'CTR-2026-041', title: 'Master Services Agreement', party: 'Acme Corp', value: 250000, expires: '2027-12-31', status: 'Active', type: 'MSA' },
  { id: 'CTR-2026-042', title: 'Non-Disclosure Agreement', party: 'Globex Inc', value: 0, expires: '2028-06-30', status: 'Active', type: 'NDA' },
  { id: 'CTR-2026-043', title: 'Vendor Supply Contract', party: 'Stark Industries', value: 1200000, expires: '2026-08-15', status: 'Expiring Soon', type: 'Vendor' },
  { id: 'CTR-2026-044', title: 'Software License Agreement', party: 'Initech', value: 45000, expires: '2027-01-31', status: 'Active', type: 'SLA' },
  { id: 'CTR-2026-045', title: 'Commercial Lease', party: 'Vandelay Industries', value: 600000, expires: '2025-12-31', status: 'Expired', type: 'Lease' },
];

const MOCK_DRAFTS = [
  { id: 'DFT-101', title: 'Partnership Agreement', party: 'Wayne Enterprises', updated: '2026-07-01', status: 'In Review', author: 'Legal Dept' },
  { id: 'DFT-102', title: 'Employee NDA Template v4', party: 'Internal', updated: '2026-06-28', status: 'Drafting', author: 'HR Dept' },
  { id: 'DFT-103', title: 'Supplier Terms & Conditions', party: 'Multiple', updated: '2026-06-25', status: 'Pending Approval', author: 'Procurement' },
];

export default function LegalContracts() {
  const [activeTab, setActiveTab] = useState<'active' | 'drafts'>('active');
  const [contracts] = useState(MOCK_CONTRACTS);
  const [drafts] = useState(MOCK_DRAFTS);
  const [searchTerm, setSearchTerm] = useState('');

  const filteredContracts = useMemo(() => {
    return contracts.filter(c => 
      c.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
      c.party.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.id.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [contracts, searchTerm]);

  const filteredDrafts = useMemo(() => {
    return drafts.filter(d => 
      d.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
      d.party.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [drafts, searchTerm]);

  const totalValue = contracts.filter(c => c.status === 'Active').reduce((sum, c) => sum + c.value, 0);
  const expiringCount = contracts.filter(c => c.status === 'Expiring Soon').length;
  const draftCount = drafts.length;

  return (
    <div className="h-full flex flex-col bg-slate-50">
      <div className="px-8 py-6 bg-slate-900 text-white flex flex-col md:flex-row md:justify-between md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-3">
            <FileSignature className="w-6 h-6 text-indigo-400" />
            Legal & Contracts
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Manage corporate agreements, NDAs, supplier contracts, and expirations.
          </p>
        </div>
        <div className="flex items-center gap-4">
           <div className="flex flex-col items-end mr-4">
             <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Active Value</span>
             <span className="text-lg font-mono font-bold text-indigo-400">\${(totalValue / 1000000).toFixed(2)}M</span>
           </div>
           <button className="h-10 px-4 bg-indigo-600 text-white rounded-xl text-sm font-bold flex items-center gap-2 hover:bg-indigo-700 transition-colors shadow-sm">
             <Plus className="w-4 h-4" /> New Contract
           </button>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-6 md:p-8">
        
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="p-5 bg-white rounded-2xl border border-slate-200 shadow-sm">
            <div className="flex items-center gap-3 text-slate-500 mb-2">
              <ShieldCheck className="w-5 h-5" />
              <span className="text-xs font-bold uppercase tracking-wider">Active Contracts</span>
            </div>
            <div className="text-3xl font-bold font-mono text-slate-900">{contracts.filter(c => c.status === 'Active').length}</div>
          </div>
          <div className="p-5 bg-amber-50 rounded-2xl border border-amber-200 shadow-sm">
            <div className="flex items-center gap-3 text-amber-600 mb-2">
              <AlertCircle className="w-5 h-5" />
              <span className="text-xs font-bold uppercase tracking-wider">Expiring &lt; 90 Days</span>
            </div>
            <div className="text-3xl font-bold font-mono text-amber-700">{expiringCount}</div>
          </div>
          <div className="p-5 bg-blue-50 rounded-2xl border border-blue-200 shadow-sm">
            <div className="flex items-center gap-3 text-blue-500 mb-2">
              <FileText className="w-5 h-5" />
              <span className="text-xs font-bold uppercase tracking-wider">In Review / Draft</span>
            </div>
            <div className="text-3xl font-bold font-mono text-blue-600">{draftCount}</div>
          </div>
          <div className="p-5 bg-rose-50 rounded-2xl border border-rose-200 shadow-sm">
            <div className="flex items-center gap-3 text-rose-500 mb-2">
              <Clock className="w-5 h-5" />
              <span className="text-xs font-bold uppercase tracking-wider">Expired</span>
            </div>
            <div className="text-3xl font-bold font-mono text-rose-600">{contracts.filter(c => c.status === 'Expired').length}</div>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
          <div className="p-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
             <div className="flex space-x-1 p-1 bg-slate-100 rounded-lg w-max">
               {[
                 { id: 'active', label: 'Active Contracts', icon: ShieldCheck },
                 { id: 'drafts', label: 'Drafts & Review', icon: FileText }
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
                 placeholder={activeTab === 'active' ? "Search titles or parties..." : "Search drafts..."}
                 value={searchTerm}
                 onChange={e => setSearchTerm(e.target.value)}
                 className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all"
               />
             </div>
          </div>

          <div className="overflow-x-auto">
            {activeTab === 'active' ? (
              <>
                <div className="grid grid-cols-12 p-4 bg-slate-50 border-b border-slate-200 text-[10px] font-bold text-slate-500 uppercase tracking-wider min-w-[900px]">
                  <div className="col-span-4">Contract Title</div>
                  <div className="col-span-3">Counterparty</div>
                  <div className="col-span-2 text-right">Value</div>
                  <div className="col-span-2 text-center">Expiration</div>
                  <div className="col-span-1 text-right">Status</div>
                </div>
                
                <div className="divide-y divide-slate-100 min-w-[900px]">
                  <AnimatePresence>
                    {filteredContracts.map((contract, i) => (
                      <motion.div 
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.05 }}
                        key={contract.id} 
                        className="grid grid-cols-12 p-4 items-center hover:bg-slate-50 transition-colors group cursor-pointer"
                      >
                        <div className="col-span-4 flex items-center gap-3">
                          <div className="p-2.5 rounded-xl bg-indigo-50 text-indigo-600 border border-indigo-100 shrink-0">
                             <FileSignature className="w-4 h-4" />
                          </div>
                          <div className="truncate pr-4">
                            <div className="font-bold text-slate-900 group-hover:text-indigo-600 transition-colors truncate">{contract.title}</div>
                            <div className="text-[10px] font-mono text-slate-500 mt-0.5">{contract.id} • {contract.type}</div>
                          </div>
                        </div>
                        
                        <div className="col-span-3 text-sm font-bold text-slate-700 truncate pr-4">
                          {contract.party}
                        </div>
                        
                        <div className="col-span-2 text-right text-sm font-mono font-bold text-slate-600">
                           {contract.value > 0 ? \`\$\${contract.value.toLocaleString()}\` : '-'}
                        </div>
                        
                        <div className="col-span-2 flex justify-center items-center gap-1.5 text-xs font-mono font-medium text-slate-600">
                           <Calendar size={12} className="text-slate-400" />
                           {contract.expires}
                        </div>
                        
                        <div className="col-span-1 flex justify-end">
                          <span className={cn(
                            "px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider border whitespace-nowrap",
                            contract.status === 'Active' ? "bg-emerald-50 text-emerald-700 border-emerald-200" :
                            contract.status === 'Expiring Soon' ? "bg-amber-50 text-amber-700 border-amber-200 animate-pulse" :
                            "bg-rose-50 text-rose-700 border-rose-200"
                          )}>
                            {contract.status}
                          </span>
                        </div>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                  {filteredContracts.length === 0 && (
                    <div className="p-12 text-center text-slate-500">
                      <ShieldCheck size={32} className="mx-auto mb-3 text-slate-300" />
                      No contracts found.
                    </div>
                  )}
                </div>
              </>
            ) : (
              <>
                <div className="grid grid-cols-12 p-4 bg-slate-50 border-b border-slate-200 text-[10px] font-bold text-slate-500 uppercase tracking-wider min-w-[800px]">
                  <div className="col-span-4">Draft Title</div>
                  <div className="col-span-3">Counterparty</div>
                  <div className="col-span-2">Author / Dept</div>
                  <div className="col-span-1 text-center">Updated</div>
                  <div className="col-span-2 text-right">Status</div>
                </div>
                
                <div className="divide-y divide-slate-100 min-w-[800px]">
                  <AnimatePresence>
                    {filteredDrafts.map((draft, i) => (
                      <motion.div 
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.05 }}
                        key={draft.id} 
                        className="grid grid-cols-12 p-4 items-center hover:bg-slate-50 transition-colors group cursor-pointer"
                      >
                        <div className="col-span-4 flex items-center gap-3">
                          <div className="p-2.5 rounded-xl bg-slate-100 text-slate-500 border border-slate-200 shrink-0">
                             <FileText className="w-4 h-4" />
                          </div>
                          <div className="truncate pr-4">
                            <div className="font-bold text-slate-900 group-hover:text-indigo-600 transition-colors truncate">{draft.title}</div>
                            <div className="text-[10px] font-mono text-slate-500 mt-0.5">{draft.id}</div>
                          </div>
                        </div>
                        
                        <div className="col-span-3 text-sm font-bold text-slate-700 truncate pr-4">
                          {draft.party}
                        </div>
                        
                        <div className="col-span-2 text-xs font-medium text-slate-600">
                           {draft.author}
                        </div>
                        
                        <div className="col-span-1 flex justify-center text-xs font-mono text-slate-500">
                           {draft.updated}
                        </div>
                        
                        <div className="col-span-2 flex justify-end">
                          <span className={cn(
                            "px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider border whitespace-nowrap",
                            draft.status === 'Pending Approval' ? "bg-amber-50 text-amber-700 border-amber-200" :
                            "bg-blue-50 text-blue-700 border-blue-200"
                          )}>
                            {draft.status}
                          </span>
                        </div>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                  {filteredDrafts.length === 0 && (
                    <div className="p-12 text-center text-slate-500">
                      <FileText size={32} className="mx-auto mb-3 text-slate-300" />
                      No drafts found.
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
fs.writeFileSync('src/components/operations/LegalContracts.tsx', code);
