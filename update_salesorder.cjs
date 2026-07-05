const fs = require('fs');
const code = `import React, { useState, useMemo } from 'react';
import { PackageCheck, Truck, ScanLine, Box, Search, PlayCircle, Clock, AlertTriangle, ArrowRight } from 'lucide-react';
import { cn } from '../../lib/utils';
import { motion, AnimatePresence } from 'motion/react';

const MOCK_ORDERS = [
  { id: 'SO-10921', date: 'Today, 08:45 AM', customer: 'Nexus Corp', items: 14, priority: 'High', stage: 'Picking' },
  { id: 'SO-10922', date: 'Today, 09:12 AM', customer: 'Stark Industries', items: 3, priority: 'Normal', stage: 'Packed' },
  { id: 'SO-10923', date: 'Today, 10:05 AM', customer: 'Wayne Tech', items: 45, priority: 'High', stage: 'Ready to Ship' },
  { id: 'SO-10924', date: 'Yesterday', customer: 'Oscorp', items: 12, priority: 'Normal', stage: 'Shipped' },
  { id: 'SO-10925', date: 'Yesterday', customer: 'LexCorp', items: 2, priority: 'Normal', stage: 'Shipped' },
];

export default function SalesOrderFulfillment() {
  const [activeTab, setActiveTab] = useState<'pending' | 'shipped'>('pending');
  const [orders] = useState(MOCK_ORDERS);
  const [searchTerm, setSearchTerm] = useState('');

  const filteredOrders = useMemo(() => {
    let filtered = orders.filter(o => 
      o.id.toLowerCase().includes(searchTerm.toLowerCase()) || 
      o.customer.toLowerCase().includes(searchTerm.toLowerCase())
    );
    if (activeTab === 'pending') {
      filtered = filtered.filter(o => o.stage !== 'Shipped');
    } else {
      filtered = filtered.filter(o => o.stage === 'Shipped');
    }
    return filtered;
  }, [orders, searchTerm, activeTab]);

  const pendingCount = orders.filter(o => o.stage !== 'Shipped').length;
  const packedCount = orders.filter(o => o.stage === 'Packed' || o.stage === 'Ready to Ship').length;
  const highPriorityCount = orders.filter(o => o.stage !== 'Shipped' && o.priority === 'High').length;

  return (
    <div className="h-full flex flex-col bg-slate-50">
      <div className="px-8 py-6 bg-slate-900 text-white flex flex-col md:flex-row md:justify-between md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-3">
            <PackageCheck className="w-6 h-6 text-emerald-500" />
            Pick, Pack & Ship
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Fulfillment workflows for warehouse staff to process sales orders.
          </p>
        </div>
        <div className="flex items-center gap-4">
           <div className="flex flex-col items-end mr-4">
             <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Pending Orders</span>
             <span className="text-lg font-mono font-bold text-emerald-400">{pendingCount}</span>
           </div>
           <button className="h-10 px-4 bg-emerald-600 text-white rounded-xl text-sm font-bold flex items-center gap-2 hover:bg-emerald-700 transition-colors shadow-sm">
             <ScanLine className="w-4 h-4" /> Start Wave Pick
           </button>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-6 md:p-8">
        
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="p-5 bg-white rounded-2xl border border-slate-200 shadow-sm">
            <div className="flex items-center gap-3 text-slate-500 mb-2">
              <Box className="w-5 h-5" />
              <span className="text-xs font-bold uppercase tracking-wider">To Pick</span>
            </div>
            <div className="text-3xl font-bold font-mono text-slate-900">{orders.filter(o => o.stage === 'Picking').length}</div>
          </div>
          <div className="p-5 bg-white rounded-2xl border border-slate-200 shadow-sm">
            <div className="flex items-center gap-3 text-blue-500 mb-2">
              <PackageCheck className="w-5 h-5" />
              <span className="text-xs font-bold uppercase tracking-wider">Packed / Ready</span>
            </div>
            <div className="text-3xl font-bold font-mono text-blue-600">{packedCount}</div>
          </div>
          <div className="p-5 bg-rose-50 rounded-2xl border border-rose-200 shadow-sm">
            <div className="flex items-center gap-3 text-rose-500 mb-2">
              <AlertTriangle className="w-5 h-5" />
              <span className="text-xs font-bold uppercase tracking-wider">High Priority</span>
            </div>
            <div className="text-3xl font-bold font-mono text-rose-600">{highPriorityCount}</div>
          </div>
          <div className="p-5 bg-white rounded-2xl border border-slate-200 shadow-sm">
            <div className="flex items-center gap-3 text-emerald-500 mb-2">
              <Truck className="w-5 h-5" />
              <span className="text-xs font-bold uppercase tracking-wider">Shipped Today</span>
            </div>
            <div className="text-3xl font-bold font-mono text-emerald-600">24</div>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
          <div className="p-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
             <div className="flex space-x-1 p-1 bg-slate-100 rounded-lg w-max">
               {['pending', 'shipped'].map(tab => (
                 <button 
                   key={tab}
                   onClick={() => setActiveTab(tab as any)}
                   className={cn(
                     "px-4 py-1.5 rounded-md text-xs font-bold uppercase tracking-wider transition-all",
                     activeTab === tab ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"
                   )}
                 >
                   {tab === 'pending' ? 'Pending Fulfillment' : 'Shipped Log'}
                 </button>
               ))}
             </div>
             
             <div className="relative max-w-sm w-full">
               <Search size={16} className="absolute left-3 top-2.5 text-slate-400" />
               <input 
                 type="text" 
                 placeholder="Search order ID or customer..." 
                 value={searchTerm}
                 onChange={e => setSearchTerm(e.target.value)}
                 className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all"
               />
             </div>
          </div>

          <div className="overflow-x-auto">
            <div className="grid grid-cols-12 p-4 bg-slate-50 border-b border-slate-200 text-[10px] font-bold text-slate-500 uppercase tracking-wider min-w-[700px]">
              <div className="col-span-3">Order / Date</div>
              <div className="col-span-3">Customer</div>
              <div className="col-span-2 text-center">Items</div>
              <div className="col-span-2 text-center">Priority</div>
              <div className="col-span-2 text-right">Workflow Stage</div>
            </div>
            
            <div className="divide-y divide-slate-100 min-w-[700px]">
              <AnimatePresence>
                {filteredOrders.map((o, i) => (
                  <motion.div 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.05 }}
                    key={o.id} 
                    className="grid grid-cols-12 p-4 items-center hover:bg-slate-50 transition-colors group cursor-pointer"
                  >
                    <div className="col-span-3 flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center">
                         <Box size={18} className="text-slate-400 group-hover:text-emerald-500 transition-colors" />
                      </div>
                      <div>
                        <div className="font-bold font-mono text-slate-900 group-hover:text-emerald-600 transition-colors">{o.id}</div>
                        <div className="text-[10px] text-slate-500 mt-0.5 flex items-center gap-1"><Clock size={10}/> {o.date}</div>
                      </div>
                    </div>
                    
                    <div className="col-span-3 font-bold text-slate-700 truncate pr-4">
                      {o.customer}
                    </div>
                    
                    <div className="col-span-2 text-center font-bold font-mono text-slate-900 text-lg">
                      {o.items}
                    </div>
                    
                    <div className="col-span-2 flex justify-center">
                       <span className={cn(
                          "px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider border",
                          o.priority === 'High' ? "bg-rose-50 text-rose-700 border-rose-200" : "bg-slate-100 text-slate-600 border-slate-200"
                       )}>
                          {o.priority}
                       </span>
                    </div>
                    
                    <div className="col-span-2 flex justify-end">
                       <span className={cn(
                          "px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider border flex items-center gap-1.5",
                          o.stage === 'Picking' ? "bg-amber-50 text-amber-700 border-amber-200" :
                          o.stage === 'Packed' ? "bg-blue-50 text-blue-700 border-blue-200" :
                          "bg-emerald-50 text-emerald-700 border-emerald-200"
                       )}>
                          {o.stage === 'Shipped' && <Truck size={12} />}
                          {o.stage}
                       </span>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
              {filteredOrders.length === 0 && (
                <div className="p-12 text-center text-slate-500">
                  <PackageCheck size={32} className="mx-auto mb-3 text-slate-300" />
                  No {activeTab} orders found.
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
fs.writeFileSync('src/components/operations/SalesOrderFulfillment.tsx', code);
