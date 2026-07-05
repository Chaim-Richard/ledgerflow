import React, { useState, useMemo } from 'react';
import { SendToBack, Truck, User, CheckCircle2, ArrowRight, Package, Clock, ShieldCheck, Search, Filter } from 'lucide-react';
import { cn } from '../../lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import { collection, onSnapshot, addDoc, updateDoc, deleteDoc, doc } from 'firebase/firestore';
import { db } from '../../firebase';



export default function DropShipping() {
  const [activeTab, setActiveTab] = useState<'orders' | 'vendors'>('orders');
  const [orders, setOrders] = useState<any[]>([]);
  React.useEffect(() => {
    const unsub = onSnapshot(collection(db, 'orders'), (snap) => {
      if (!snap.empty) {
        setOrders(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      } else {
        setOrders([]);
      }
    });
    return unsub;
  }, []);
  const [searchTerm, setSearchTerm] = useState('');

  const filteredOrders = useMemo(() => {
    return orders.filter(o => 
      o.id.toLowerCase().includes(searchTerm.toLowerCase()) || 
      o.item.toLowerCase().includes(searchTerm.toLowerCase()) ||
      o.customer.toLowerCase().includes(searchTerm.toLowerCase()) ||
      o.vendor.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [orders, searchTerm]);

  const totalValue = orders.reduce((sum, o) => sum + o.amount, 0);
  const pendingCount = orders.filter(o => o.status !== 'Delivered').length;

  return (
    <div className="h-full flex flex-col bg-slate-50">
      <div className="px-8 py-6 bg-slate-900 text-white flex flex-col md:flex-row md:justify-between md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-3">
            <SendToBack className="w-6 h-6 text-rose-400" />
            Drop Shipping Fulfillment
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Automate PO generation to vendors directly from Sales Orders.
          </p>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex flex-col items-end mr-4">
             <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Active Volume</span>
             <span className="text-lg font-mono font-bold text-emerald-400">${totalValue.toLocaleString()}</span>
           </div>
           <div className="flex flex-col items-end mr-4">
             <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">In Progress</span>
             <span className="text-lg font-mono font-bold text-amber-400">{pendingCount} Orders</span>
           </div>
           <button className="h-10 px-4 bg-rose-600 text-white rounded-xl text-sm font-bold flex items-center gap-2 hover:bg-rose-700 transition-colors shadow-sm">
             Configure Routing
           </button>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-6 md:p-8">
        
        {/* KPI Dashboard */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="p-5 bg-white rounded-2xl border border-slate-200 shadow-sm">
            <div className="flex items-center gap-3 text-slate-500 mb-2">
              <Package className="w-5 h-5" />
              <span className="text-xs font-bold uppercase tracking-wider">Total Orders</span>
            </div>
            <div className="text-3xl font-bold font-mono text-slate-900">{orders.length}</div>
          </div>
          <div className="p-5 bg-white rounded-2xl border border-slate-200 shadow-sm">
            <div className="flex items-center gap-3 text-emerald-500 mb-2">
              <ShieldCheck className="w-5 h-5" />
              <span className="text-xs font-bold uppercase tracking-wider">Fulfilled</span>
            </div>
            <div className="text-3xl font-bold font-mono text-emerald-600">{orders.filter(o => o.status === 'Delivered').length}</div>
          </div>
          <div className="p-5 bg-white rounded-2xl border border-slate-200 shadow-sm">
            <div className="flex items-center gap-3 text-sky-500 mb-2">
              <Truck className="w-5 h-5" />
              <span className="text-xs font-bold uppercase tracking-wider">In Transit</span>
            </div>
            <div className="text-3xl font-bold font-mono text-sky-600">{orders.filter(o => o.status === 'Shipped').length}</div>
          </div>
          <div className="p-5 bg-white rounded-2xl border border-slate-200 shadow-sm">
            <div className="flex items-center gap-3 text-amber-500 mb-2">
              <Clock className="w-5 h-5" />
              <span className="text-xs font-bold uppercase tracking-wider">Processing</span>
            </div>
            <div className="text-3xl font-bold font-mono text-amber-600">{orders.filter(o => o.status === 'Processing' || o.status === 'Pending Vendor').length}</div>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
          <div className="p-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
             <div className="flex space-x-1 p-1 bg-slate-100 rounded-lg w-max">
               {['orders', 'vendors'].map(tab => (
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
             
             <div className="relative max-w-sm w-full">
               <Search size={16} className="absolute left-3 top-2.5 text-slate-400" />
               <input 
                 type="text" 
                 placeholder="Search orders, clients, or vendors..." 
                 value={searchTerm}
                 onChange={e => setSearchTerm(e.target.value)}
                 className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-rose-500 focus:ring-1 focus:ring-rose-500 transition-all"
               />
             </div>
          </div>

          <div className="overflow-x-auto">
            <div className="grid grid-cols-12 p-4 bg-slate-50 border-b border-slate-200 text-[10px] font-bold text-slate-500 uppercase tracking-wider min-w-[800px]">
              <div className="col-span-3">Order Ref / Item</div>
              <div className="col-span-2">Customer</div>
              <div className="col-span-3 text-center">Fulfillment Routing</div>
              <div className="col-span-2 text-right">Order Value</div>
              <div className="col-span-2 text-right">Status</div>
            </div>
            
            <div className="divide-y divide-slate-100 min-w-[800px]">
              <AnimatePresence>
                {filteredOrders.map((o, i) => (
                  <motion.div 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.05 }}
                    key={o.id} 
                    className="grid grid-cols-12 p-4 items-center hover:bg-slate-50 transition-colors"
                  >
                    <div className="col-span-3">
                      <div className="font-bold text-slate-900 truncate pr-4">{o.item}</div>
                      <div className="text-[10px] font-mono text-slate-400 mt-0.5">{o.id} • {o.date}</div>
                    </div>
                    <div className="col-span-2 text-sm text-slate-700 font-bold truncate pr-2">
                      {o.customer}
                    </div>
                    
                    <div className="col-span-3 flex items-center justify-center gap-3 text-xs font-bold text-slate-500">
                       <User size={14} className="text-indigo-400" />
                       <ArrowRight size={14} className="text-slate-300" />
                       <span className="text-slate-700 bg-slate-100 px-2 py-1 rounded truncate max-w-[100px]">{o.vendor}</span>
                    </div>

                    <div className="col-span-2 text-right font-bold font-mono text-emerald-600">
                       ${o.amount.toLocaleString()}
                    </div>
                    <div className="col-span-2 flex justify-end">
                       <span className={cn(
                          "px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider border",
                          o.status === 'Delivered' ? "bg-emerald-50 text-emerald-700 border-emerald-200" :
                          o.status === 'Shipped' ? "bg-sky-50 text-sky-700 border-sky-200" :
                          "bg-amber-50 text-amber-700 border-amber-200"
                       )}>
                          {o.status}
                       </span>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
              {filteredOrders.length === 0 && (
                <div className="p-12 text-center text-slate-500">
                  <SendToBack size={32} className="mx-auto mb-3 text-slate-300" />
                  No orders found.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
