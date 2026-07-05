import React, { useState, useMemo } from 'react';
import { CheckCircle, DollarSign, Percent, TrendingUp, Award, Calendar, Search, Users, Settings, Plus } from 'lucide-react';
import { cn } from '../../lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import { collection, onSnapshot, addDoc, updateDoc, deleteDoc, doc } from 'firebase/firestore';
import { db } from '../../firebase';





export default function Commissions() {
  const [activeTab, setActiveTab] = useState<'payouts' | 'plans'>('payouts');
  const [payouts, setPayouts] = useState<any[]>([]);
  React.useEffect(() => {
    const unsub = onSnapshot(collection(db, 'payouts'), (snap) => {
      if (!snap.empty) {
        setPayouts(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      } else {
        setPayouts([]);
      }
    });
    return unsub;
  }, []);
  const [plans, setPlans] = useState<any[]>([]);
  React.useEffect(() => {
    const unsub = onSnapshot(collection(db, 'plans'), (snap) => {
      if (!snap.empty) {
        setPlans(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      } else {
        setPlans([]);
      }
    });
    return unsub;
  }, []);
  const [searchTerm, setSearchTerm] = useState('');

  const filteredPayouts = useMemo(() => {
    return payouts.filter(p => 
      p.rep.toLowerCase().includes(searchTerm.toLowerCase()) || 
      p.plan.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.id.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [payouts, searchTerm]);

  const filteredPlans = useMemo(() => {
    return plans.filter(p => 
      p.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
      p.type.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [plans, searchTerm]);

  const totalPending = payouts.filter(p => p.status === 'Pending').reduce((sum, p) => sum + p.commission, 0);
  const totalVolume = payouts.reduce((sum, p) => sum + p.volume, 0);
  const activePlansCount = plans.filter(p => p.status === 'Active').length;

  return (
    <div className="h-full flex flex-col bg-slate-50">
      <div className="px-8 py-6 bg-slate-900 text-white flex flex-col md:flex-row md:justify-between md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-3">
            <Award className="w-6 h-6 text-amber-400" />
            Sales Commissions
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Manage commission plans, calculate agent payouts, and track quotas.
          </p>
        </div>
        <div className="flex items-center gap-4">
           <div className="flex flex-col items-end mr-4">
             <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Pending Payouts</span>
             <span className="text-lg font-mono font-bold text-amber-400">${totalPending.toLocaleString()}</span>
           </div>
           <button className="h-10 px-4 bg-amber-600 text-white rounded-xl text-sm font-bold flex items-center gap-2 hover:bg-amber-700 transition-colors shadow-sm">
             <Plus className="w-4 h-4" /> Run Calculation
           </button>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-6 md:p-8">
        
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="p-5 bg-white rounded-2xl border border-slate-200 shadow-sm">
            <div className="flex items-center gap-3 text-slate-500 mb-2">
              <DollarSign className="w-5 h-5" />
              <span className="text-xs font-bold uppercase tracking-wider">Total Sales Volume</span>
            </div>
            <div className="text-3xl font-bold font-mono text-slate-900">${totalVolume.toLocaleString()}</div>
          </div>
          <div className="p-5 bg-amber-50 rounded-2xl border border-amber-200 shadow-sm">
            <div className="flex items-center gap-3 text-amber-600 mb-2">
              <TrendingUp className="w-5 h-5" />
              <span className="text-xs font-bold uppercase tracking-wider">Pending Review</span>
            </div>
            <div className="text-3xl font-bold font-mono text-amber-700">{payouts.filter(p => p.status === 'Pending').length}</div>
          </div>
          <div className="p-5 bg-emerald-50 rounded-2xl border border-emerald-200 shadow-sm">
            <div className="flex items-center gap-3 text-emerald-600 mb-2">
              <CheckCircle className="w-5 h-5" />
              <span className="text-xs font-bold uppercase tracking-wider">Approved / Paid</span>
            </div>
            <div className="text-3xl font-bold font-mono text-emerald-700">{payouts.filter(p => p.status === 'Approved' || p.status === 'Paid').length}</div>
          </div>
          <div className="p-5 bg-blue-50 rounded-2xl border border-blue-200 shadow-sm">
            <div className="flex items-center gap-3 text-blue-500 mb-2">
              <Percent className="w-5 h-5" />
              <span className="text-xs font-bold uppercase tracking-wider">Active Comp Plans</span>
            </div>
            <div className="text-3xl font-bold font-mono text-blue-600">{activePlansCount}</div>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
          <div className="p-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
             <div className="flex space-x-1 p-1 bg-slate-100 rounded-lg w-max">
               {[
                 { id: 'payouts', label: 'Commission Payouts', icon: DollarSign },
                 { id: 'plans', label: 'Compensation Plans', icon: Percent }
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
                 placeholder={activeTab === 'payouts' ? "Search reps or plans..." : "Search plans..."}
                 value={searchTerm}
                 onChange={e => setSearchTerm(e.target.value)}
                 className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition-all"
               />
             </div>
          </div>

          <div className="overflow-x-auto">
            {activeTab === 'payouts' ? (
              <>
                <div className="grid grid-cols-12 p-4 bg-slate-50 border-b border-slate-200 text-[10px] font-bold text-slate-500 uppercase tracking-wider min-w-[900px]">
                  <div className="col-span-3">Sales Rep / Plan</div>
                  <div className="col-span-2">Period</div>
                  <div className="col-span-3 text-right">Eligible Sales Volume</div>
                  <div className="col-span-2 text-right">Calculated Commission</div>
                  <div className="col-span-2 text-right">Status</div>
                </div>
                
                <div className="divide-y divide-slate-100 min-w-[900px]">
                  <AnimatePresence>
                    {filteredPayouts.map((pay, i) => (
                      <motion.div 
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.05 }}
                        key={pay.id} 
                        className="grid grid-cols-12 p-4 items-center hover:bg-slate-50 transition-colors group cursor-pointer"
                      >
                        <div className="col-span-3 flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-slate-200 flex items-center justify-center text-xs font-bold text-slate-700 shrink-0 border border-slate-300">
                             {pay.rep.split(' ').map(n => n[0]).join('')}
                          </div>
                          <div className="truncate pr-4">
                            <div className="font-bold text-slate-900 group-hover:text-amber-600 transition-colors truncate">{pay.rep}</div>
                            <div className="text-[10px] font-mono text-slate-500 mt-0.5">{pay.plan}</div>
                          </div>
                        </div>
                        
                        <div className="col-span-2 text-sm font-bold text-slate-700">
                          {pay.period}
                        </div>
                        
                        <div className="col-span-3 text-right text-sm font-bold text-slate-600">
                           ${pay.volume.toLocaleString()}
                        </div>
                        
                        <div className="col-span-2 text-right font-mono font-bold text-emerald-600 text-base">
                           ${pay.commission.toLocaleString()}
                        </div>
                        
                        <div className="col-span-2 flex justify-end">
                          <span className={cn(
                            "px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider border whitespace-nowrap",
                            pay.status === 'Approved' ? "bg-emerald-50 text-emerald-700 border-emerald-200" :
                            pay.status === 'Paid' ? "bg-slate-100 text-slate-600 border-slate-200" :
                            "bg-amber-50 text-amber-700 border-amber-200 animate-pulse"
                          )}>
                            {pay.status}
                          </span>
                        </div>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                  {filteredPayouts.length === 0 && (
                    <div className="p-12 text-center text-slate-500">
                      <Award size={32} className="mx-auto mb-3 text-slate-300" />
                      No payouts found.
                    </div>
                  )}
                </div>
              </>
            ) : (
              <>
                <div className="grid grid-cols-12 p-4 bg-slate-50 border-b border-slate-200 text-[10px] font-bold text-slate-500 uppercase tracking-wider min-w-[800px]">
                  <div className="col-span-4">Plan Name</div>
                  <div className="col-span-3">Structure Type</div>
                  <div className="col-span-3 text-center">Assigned Reps</div>
                  <div className="col-span-2 text-right">Status</div>
                </div>
                
                <div className="divide-y divide-slate-100 min-w-[800px]">
                  <AnimatePresence>
                    {filteredPlans.map((plan, i) => (
                      <motion.div 
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.05 }}
                        key={plan.id} 
                        className="grid grid-cols-12 p-4 items-center hover:bg-slate-50 transition-colors group cursor-pointer"
                      >
                        <div className="col-span-4 flex items-center gap-3">
                          <div className="w-10 h-10 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center shrink-0">
                             <Percent size={18} className="text-slate-400 group-hover:text-amber-500 transition-colors" />
                          </div>
                          <div className="truncate pr-4">
                            <div className="font-bold text-slate-900 group-hover:text-amber-600 transition-colors truncate">{plan.name}</div>
                            <div className="text-[10px] font-mono text-slate-500 mt-0.5">{plan.id}</div>
                          </div>
                        </div>
                        
                        <div className="col-span-3 text-sm font-bold text-slate-700">
                          {plan.type}
                        </div>
                        
                        <div className="col-span-3 flex justify-center">
                           <div className="flex items-center gap-2 text-slate-600 font-bold px-3 py-1 bg-slate-100 rounded-full text-xs">
                             <Users size={14} className="text-slate-400" /> {plan.reps}
                           </div>
                        </div>
                        
                        <div className="col-span-2 flex justify-end">
                          <span className={cn(
                            "px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider border whitespace-nowrap",
                            plan.status === 'Active' ? "bg-emerald-50 text-emerald-700 border-emerald-200" :
                            "bg-slate-100 text-slate-500 border-slate-200"
                          )}>
                            {plan.status}
                          </span>
                        </div>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                  {filteredPlans.length === 0 && (
                    <div className="p-12 text-center text-slate-500">
                      <Percent size={32} className="mx-auto mb-3 text-slate-300" />
                      No plans found.
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
