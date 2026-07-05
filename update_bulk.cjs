const fs = require('fs');
const code = `import React, { useState, useMemo } from 'react';
import { Layers, Replace, CheckSquare, Search, AlertCircle, FileSpreadsheet, ArrowRight, Filter, Settings2 } from 'lucide-react';
import { cn } from '../../lib/utils';
import { motion, AnimatePresence } from 'motion/react';

const MOCK_RESULTS = [
  { id: 'TRX-991', date: '2026-06-25', payee: 'Amazon Web Services', amount: 1450.00, currentAccount: 'Uncategorized Expense', currentClass: 'Unassigned', selected: true },
  { id: 'TRX-992', date: '2026-06-24', payee: 'AWS Cloud', amount: 320.50, currentAccount: 'Uncategorized Expense', currentClass: 'Unassigned', selected: true },
  { id: 'TRX-993', date: '2026-06-20', payee: 'Staples', amount: 155.99, currentAccount: 'Uncategorized Expense', currentClass: 'Unassigned', selected: false },
  { id: 'TRX-994', date: '2026-06-15', payee: 'GitHub Inc', amount: 450.00, currentAccount: 'Uncategorized Expense', currentClass: 'Unassigned', selected: true },
  { id: 'TRX-995', date: '2026-06-10', payee: 'Slack', amount: 890.00, currentAccount: 'Uncategorized Expense', currentClass: 'Unassigned', selected: false },
];

export default function BulkReclassify() {
  const [activeTab, setActiveTab] = useState<'tool'>('tool');
  const [results, setResults] = useState(MOCK_RESULTS);
  const [hasSearched, setHasSearched] = useState(false);

  const toggleSelect = (id: string) => {
    setResults(prev => prev.map(r => r.id === id ? { ...r, selected: !r.selected } : r));
  };

  const toggleAll = () => {
    const allSelected = results.every(r => r.selected);
    setResults(prev => prev.map(r => ({ ...r, selected: !allSelected })));
  };

  const handleSearch = () => {
    setHasSearched(true);
  };

  const selectedCount = results.filter(r => r.selected).length;

  return (
    <div className="h-full flex flex-col bg-slate-50">
      <div className="px-8 py-6 bg-slate-900 text-white flex flex-col md:flex-row md:justify-between md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-3">
            <Replace className="w-6 h-6 text-rose-400" />
            Bulk Reclassify Tool
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Rapidly correct coding errors by moving multiple transactions to new accounts, classes, or locations.
          </p>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-6 md:p-8">
        <div className="max-w-6xl mx-auto space-y-6">
          
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
             <div className="flex items-center gap-3 mb-6 text-amber-600 bg-amber-50 p-4 rounded-xl border border-amber-200">
                <AlertCircle className="w-5 h-5 shrink-0" />
                <p className="text-sm font-bold">Warning: Changes made using this tool are immediate and affect historical reporting.</p>
             </div>
             
             <div className="space-y-6">
                <div>
                   <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2 mb-4">
                     <Filter className="w-4 h-4 text-slate-400" />
                     1. Find Transactions
                   </h3>
                   <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                      <div className="col-span-1 md:col-span-2">
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Criteria</label>
                        <select className="w-full h-10 px-3 rounded-lg border border-slate-200 text-sm focus:border-rose-500 outline-none transition-colors">
                           <option>Account is: Uncategorized Expense</option>
                           <option>Class is: Unassigned</option>
                           <option>Date is before: 2026-01-01</option>
                        </select>
                      </div>
                      <div className="col-span-1 md:col-span-1">
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Date Range</label>
                        <select className="w-full h-10 px-3 rounded-lg border border-slate-200 text-sm focus:border-rose-500 outline-none transition-colors">
                           <option>Last 30 Days</option>
                           <option>This Year</option>
                           <option>All Time</option>
                        </select>
                      </div>
                      <div className="col-span-1 md:col-span-1">
                        <button 
                          onClick={handleSearch}
                          className="w-full h-10 px-4 bg-slate-900 text-white rounded-lg text-sm font-bold shadow-sm hover:bg-slate-800 transition-colors flex items-center justify-center gap-2"
                        >
                           <Search className="w-4 h-4" /> Find
                        </button>
                      </div>
                   </div>
                </div>

                {hasSearched && (
                  <AnimatePresence>
                    <motion.div 
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      className="border-t border-slate-200 pt-6"
                    >
                       <div className="flex items-center justify-between mb-4">
                         <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                           <FileSpreadsheet className="w-4 h-4 text-slate-400" />
                           2. Select Transactions ({results.length} found)
                         </h3>
                         <div className="text-xs font-bold text-slate-500">
                           {selectedCount} selected
                         </div>
                       </div>
                       
                       <div className="border border-slate-200 rounded-xl overflow-hidden mb-6">
                         <div className="grid grid-cols-12 p-3 bg-slate-50 border-b border-slate-200 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                           <div className="col-span-1 flex items-center justify-center">
                             <button onClick={toggleAll} className={cn("w-4 h-4 rounded flex items-center justify-center border", results.every(r => r.selected) ? "bg-rose-500 border-rose-500 text-white" : "bg-white border-slate-300")}>
                               {results.every(r => r.selected) && <CheckSquare className="w-3 h-3" />}
                             </button>
                           </div>
                           <div className="col-span-2">Date</div>
                           <div className="col-span-4">Payee / Description</div>
                           <div className="col-span-3">Current Account</div>
                           <div className="col-span-2 text-right">Amount</div>
                         </div>
                         <div className="divide-y divide-slate-100 max-h-[300px] overflow-y-auto">
                           {results.map(r => (
                             <div key={r.id} className={cn("grid grid-cols-12 p-3 items-center hover:bg-slate-50 transition-colors cursor-pointer", r.selected && "bg-rose-50/50")} onClick={() => toggleSelect(r.id)}>
                               <div className="col-span-1 flex items-center justify-center">
                                 <div className={cn("w-4 h-4 rounded flex items-center justify-center border", r.selected ? "bg-rose-500 border-rose-500 text-white" : "bg-white border-slate-300")}>
                                   {r.selected && <CheckSquare className="w-3 h-3" />}
                                 </div>
                               </div>
                               <div className="col-span-2 text-xs font-mono text-slate-500">{r.date}</div>
                               <div className="col-span-4 font-bold text-slate-700 text-sm truncate pr-4">{r.payee}</div>
                               <div className="col-span-3 text-xs font-bold text-slate-500 bg-slate-100 px-2 py-1 rounded truncate mr-4">{r.currentAccount}</div>
                               <div className="col-span-2 text-right font-mono font-bold text-slate-900">\${r.amount.toFixed(2)}</div>
                             </div>
                           ))}
                         </div>
                       </div>

                       <div className="border-t border-slate-200 pt-6">
                          <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2 mb-4">
                            <Settings2 className="w-4 h-4 text-slate-400" />
                            3. Apply New Coding
                          </h3>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                             <div>
                                <div className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">New Account</div>
                                <select className="w-full h-10 px-3 rounded-lg border border-slate-200 text-sm focus:border-rose-500 outline-none transition-colors">
                                   <option>-- Do Not Change --</option>
                                   <option>Software Subscriptions</option>
                                   <option>Office Supplies</option>
                                   <option>IT Equipment</option>
                                </select>
                             </div>
                             <div>
                                <div className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">New Class</div>
                                <select className="w-full h-10 px-3 rounded-lg border border-slate-200 text-sm focus:border-rose-500 outline-none transition-colors">
                                   <option>-- Do Not Change --</option>
                                   <option>Engineering</option>
                                   <option>Sales Dept</option>
                                   <option>HQ</option>
                                </select>
                             </div>
                          </div>
                       </div>
                       
                       <div className="pt-8 flex items-center justify-between">
                          <div className="text-sm text-slate-500">
                            Ready to reclassify <strong className="text-slate-900">{selectedCount}</strong> transactions.
                          </div>
                          <button 
                            disabled={selectedCount === 0}
                            className={cn(
                              "px-6 py-2.5 rounded-xl text-sm font-bold shadow-sm transition-all flex items-center gap-2",
                              selectedCount > 0 ? "bg-rose-600 text-white hover:bg-rose-700" : "bg-slate-100 text-slate-400 cursor-not-allowed"
                            )}
                          >
                             Apply Changes <ArrowRight className="w-4 h-4" />
                          </button>
                       </div>
                    </motion.div>
                  </AnimatePresence>
                )}
             </div>
          </div>
        </div>
      </div>
    </div>
  );
}
`;
fs.writeFileSync('src/components/operations/BulkReclassify.tsx', code);
