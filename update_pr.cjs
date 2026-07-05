const fs = require('fs');
const code = `import React, { useState, useMemo } from 'react';
import { ShoppingCart, CheckCircle2, Clock, XCircle, Search, DollarSign, ArrowRight, User } from 'lucide-react';
import { cn } from '../../lib/utils';
import { motion, AnimatePresence } from 'motion/react';

const MOCK_REQS = [
  { id: 'PR-7021', employee: 'John Smith', department: 'IT', item: 'Dell XPS 15 (x3)', amount: 6500, status: 'Pending Approval', date: '2026-06-25' },
  { id: 'PR-7022', employee: 'Sarah Connor', department: 'Marketing', item: 'Adobe CC Licenses', amount: 1200, status: 'Approved', date: '2026-06-24' },
  { id: 'PR-7023', employee: 'Mike Johnson', department: 'Facilities', item: 'Office Chairs (x20)', amount: 4500, status: 'Pending Approval', date: '2026-06-23' },
  { id: 'PR-7024', employee: 'Emily Chen', department: 'Engineering', item: 'AWS Cloud Credits', amount: 15000, status: 'Rejected', date: '2026-06-20' },
  { id: 'PR-7025', employee: 'David Miller', department: 'HR', item: 'Team Building Catering', amount: 850, status: 'Pending Approval', date: '2026-06-26' },
];

export default function PurchaseRequisitions() {
  const [activeTab, setActiveTab] = useState<'requests' | 'history'>('requests');
  const [requests, setRequests] = useState(MOCK_REQS);
  const [searchTerm, setSearchTerm] = useState('');

  const filteredRequests = useMemo(() => {
    let filtered = requests.filter(r => 
      r.employee.toLowerCase().includes(searchTerm.toLowerCase()) || 
      r.item.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.department.toLowerCase().includes(searchTerm.toLowerCase())
    );
    if (activeTab === 'requests') {
      filtered = filtered.filter(r => r.status === 'Pending Approval');
    } else {
      filtered = filtered.filter(r => r.status !== 'Pending Approval');
    }
    return filtered;
  }, [requests, searchTerm, activeTab]);

  const handleAction = (id: string, action: 'Approved' | 'Rejected') => {
    setRequests(prev => prev.map(r => r.id === id ? { ...r, status: action } : r));
  };

  const pendingAmount = requests.filter(r => r.status === 'Pending Approval').reduce((sum, r) => sum + r.amount, 0);

  return (
    <div className="h-full flex flex-col bg-slate-50">
      <div className="px-8 py-6 bg-slate-900 text-white flex flex-col md:flex-row md:justify-between md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-3">
            <ShoppingCart className="w-6 h-6 text-pink-400" />
            Purchase Requisitions
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Internal approval workflows before official Purchase Orders are generated.
          </p>
        </div>
        <div className="flex items-center gap-4">
           <div className="flex flex-col items-end mr-4">
             <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Pending Review</span>
             <span className="text-lg font-mono font-bold text-pink-400">\${pendingAmount.toLocaleString()}</span>
           </div>
           <button className="h-10 px-4 bg-pink-600 text-white rounded-xl text-sm font-bold hover:bg-pink-700 transition-colors shadow-sm">
             Create Requisition
           </button>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-6 md:p-8">
        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
          <div className="p-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
             <div className="flex space-x-1 p-1 bg-slate-100 rounded-lg w-max">
               {['requests', 'history'].map(tab => (
                 <button 
                   key={tab}
                   onClick={() => setActiveTab(tab as any)}
                   className={cn(
                     "px-4 py-1.5 rounded-md text-xs font-bold uppercase tracking-wider transition-all",
                     activeTab === tab ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"
                   )}
                 >
                   {tab === 'requests' ? 'Pending Requests' : 'History'}
                 </button>
               ))}
             </div>
             
             <div className="relative max-w-sm w-full">
               <Search size={16} className="absolute left-3 top-2.5 text-slate-400" />
               <input 
                 type="text" 
                 placeholder="Search requests..." 
                 value={searchTerm}
                 onChange={e => setSearchTerm(e.target.value)}
                 className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-pink-500 focus:ring-1 focus:ring-pink-500 transition-all"
               />
             </div>
          </div>

          <div className="overflow-x-auto">
            <div className="grid grid-cols-12 p-4 bg-slate-50 border-b border-slate-200 text-[10px] font-bold text-slate-500 uppercase tracking-wider min-w-[700px]">
              <div className="col-span-3">Employee / Dept</div>
              <div className="col-span-3">Item Requested</div>
              <div className="col-span-2 text-right">Est. Amount</div>
              <div className="col-span-2 text-center">Date</div>
              <div className="col-span-2 text-right">Actions / Status</div>
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
                        <div className="text-[10px] font-mono text-slate-500 mt-0.5 truncate">{r.department} • {r.id}</div>
                      </div>
                    </div>
                    
                    <div className="col-span-3 text-sm text-slate-700 font-bold truncate pr-4">
                      {r.item}
                    </div>
                    
                    <div className="col-span-2 text-right font-mono font-bold text-slate-900 text-lg">
                      \${r.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </div>
                    
                    <div className="col-span-2 text-center text-xs font-mono font-bold text-slate-600 bg-slate-100 py-1 rounded-md mx-4">
                       {r.date}
                    </div>
                    
                    <div className="col-span-2 flex justify-end gap-2">
                       {r.status === 'Pending Approval' ? (
                         <>
                           <button onClick={() => handleAction(r.id, 'Rejected')} className="px-3 py-1.5 text-xs font-bold text-rose-600 bg-rose-50 rounded-lg hover:bg-rose-100 transition-colors">
                              Deny
                           </button>
                           <button onClick={() => handleAction(r.id, 'Approved')} className="px-3 py-1.5 text-xs font-bold text-emerald-600 bg-emerald-50 rounded-lg hover:bg-emerald-100 transition-colors shadow-sm">
                              Approve
                           </button>
                         </>
                       ) : (
                         <span className={cn(
                           "px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5 border",
                           r.status === 'Approved' ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-rose-50 text-rose-700 border-rose-200"
                         )}>
                           {r.status === 'Approved' ? <CheckCircle2 size={12} /> : <XCircle size={12} />}
                           {r.status}
                         </span>
                       )}
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
              {filteredRequests.length === 0 && (
                <div className="p-12 text-center text-slate-500">
                  <ShoppingCart size={32} className="mx-auto mb-3 text-slate-300" />
                  No {activeTab === 'requests' ? 'pending' : 'historical'} requisitions found.
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
fs.writeFileSync('src/components/operations/PurchaseRequisitions.tsx', code);
