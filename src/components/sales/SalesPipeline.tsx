import React, { useMemo, useState } from 'react';
import { Customer } from '../../types';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import { formatCurrency, cn } from '../../lib/utils';
import { User } from 'firebase/auth';
import { motion, AnimatePresence } from 'motion/react';
import { Building2, Mail, DollarSign, GripVertical, CheckCircle2, AlertCircle, CircleDashed, Target, Activity, TrendingUp, FileText } from 'lucide-react';
import { toast } from 'sonner';

interface SalesPipelineProps {
  customers: Customer[];
  user: User;
}

type PipelineStage = 'lead' | 'qualified' | 'proposal' | 'won' | 'lost';

const STAGES: { id: PipelineStage; label: string; color: string; icon: React.ElementType; defaultProb: number }[] = [
  { id: 'lead', label: 'New Lead', color: 'bg-slate-100 text-slate-700', icon: CircleDashed, defaultProb: 10 },
  { id: 'qualified', label: 'Qualified', color: 'bg-blue-50 text-blue-700', icon: Building2, defaultProb: 30 },
  { id: 'proposal', label: 'Proposal Sent', color: 'bg-amber-50 text-amber-700', icon: Mail, defaultProb: 60 },
  { id: 'won', label: 'Won', color: 'bg-emerald-50 text-emerald-700', icon: CheckCircle2, defaultProb: 100 },
  { id: 'lost', label: 'Lost', color: 'bg-rose-50 text-rose-700', icon: AlertCircle, defaultProb: 0 },
];

export default function SalesPipeline({ customers, user }: SalesPipelineProps) {
  const [draggedCustomerId, setDraggedCustomerId] = useState<string | null>(null);
  const [dragOverStage, setDragOverStage] = useState<string | null>(null);

  const moveCustomer = async (customerId: string, newStage: PipelineStage) => {
    try {
      const ref = doc(db, 'customers', customerId);
      const stageInfo = STAGES.find(s => s.id === newStage);
      await updateDoc(ref, { 
        pipelineStage: newStage,
        probability: stageInfo ? stageInfo.defaultProb : undefined 
      });
      toast.success('Pipeline stage updated');
    } catch (err) {
      console.error(err);
      toast.error('Failed to update stage');
    }
  };

  const handleDragStart = (e: React.DragEvent, customerId: string) => {
    e.dataTransfer.setData('text/plain', customerId);
    setDraggedCustomerId(customerId);
  };

  const handleDragOver = (e: React.DragEvent, stageId: string) => {
    e.preventDefault();
    setDragOverStage(stageId);
  };

  const handleDrop = (e: React.DragEvent, stageId: string) => {
    e.preventDefault();
    setDragOverStage(null);
    setDraggedCustomerId(null);
    const customerId = e.dataTransfer.getData('text');
    const customer = customers.find(c => c.id === customerId);
    if (!customer || customer.pipelineStage === stageId) return;
    moveCustomer(customerId, stageId as PipelineStage);
  };

  const grouped = useMemo(() => {
    const map: Record<PipelineStage, Customer[]> = {
      lead: [],
      qualified: [],
      proposal: [],
      won: [],
      lost: []
    };
    customers.forEach(c => {
      const stage = (c.pipelineStage as PipelineStage) || 'lead';
      if (map[stage]) map[stage].push(c);
      else map['lead'].push(c);
    });

    Object.keys(map).forEach(key => {
      map[key as PipelineStage].sort((a, b) => {
        const valA = a.expectedRevenueCents || a.balanceCents || 0;
        const valB = b.expectedRevenueCents || b.balanceCents || 0;
        return valB - valA;
      });
    });

    return map;
  }, [customers]);

  const pipelineStats = useMemo(() => {
    let totalPipeline = 0;
    let weightedPipeline = 0;
    let won = 0;
    
    customers.forEach(c => {
      const stage = c.pipelineStage || 'lead';
      const val = c.expectedRevenueCents || c.balanceCents || 0;
      if (stage !== 'lost') {
        const prob = c.probability ?? STAGES.find(s => s.id === stage)?.defaultProb ?? 0;
        totalPipeline += val;
        weightedPipeline += val * (prob / 100);
      }
      if (stage === 'won') won += val;
    });

    return { totalPipeline, weightedPipeline, won };
  }, [customers]);

  return (
    <div className="flex flex-col gap-6">
      {/* Top Level Pipeline Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="ledger-card p-6 rounded-[32px] bg-gradient-to-br from-indigo-50 to-white">
          <div className="w-10 h-10 bg-indigo-100 text-indigo-600 rounded-[32px] flex items-center justify-center mb-4 border border-indigo-200 shadow-sm">
            <Target size={20} />
          </div>
          <p className="text-xs font-medium uppercase tracking-wider text-indigo-900/60 mb-1">Total Pipeline Value</p>
          <div className="text-3xl font-black font-mono tracking-tighter text-indigo-950">
            {formatCurrency(pipelineStats.totalPipeline)}
          </div>
        </div>
        <div className="ledger-card p-6 rounded-[32px] bg-gradient-to-br from-amber-50 to-white">
          <div className="w-10 h-10 bg-amber-100 text-amber-600 rounded-[32px] flex items-center justify-center mb-4 border border-amber-200 shadow-sm">
            <Activity size={20} />
          </div>
          <p className="text-xs font-medium uppercase tracking-wider text-amber-900/60 mb-1">Weighted Pipeline (Expected)</p>
          <div className="text-3xl font-black font-mono tracking-tighter text-amber-950">
            {formatCurrency(pipelineStats.weightedPipeline)}
          </div>
        </div>
        <div className="ledger-card p-6 rounded-[32px] bg-gradient-to-br from-emerald-50 to-white">
          <div className="w-10 h-10 bg-emerald-100 text-emerald-600 rounded-[32px] flex items-center justify-center mb-4 border border-emerald-200 shadow-sm">
            <TrendingUp size={20} />
          </div>
          <p className="text-xs font-medium uppercase tracking-wider text-emerald-900/60 mb-1">Closed Won (All Time)</p>
          <div className="text-3xl font-black font-mono tracking-tighter text-emerald-950">
            {formatCurrency(pipelineStats.won)}
          </div>
        </div>
      </div>

      <div className="flex gap-4 overflow-x-auto pb-8 min-h-[700px] custom-scrollbar">
        {STAGES.map((stage) => {
          const matchingCustomers = grouped[stage.id];
          const stageValueCents = matchingCustomers.reduce((acc, c) => acc + (c.expectedRevenueCents || c.balanceCents || 0), 0);
          const stageWeightedCents = matchingCustomers.reduce((acc, c) => acc + ((c.expectedRevenueCents || c.balanceCents || 0) * ((c.probability ?? stage.defaultProb) / 100)), 0);
          const Icon = stage.icon;

          return (
            <div 
              key={stage.id} 
              className={cn(
                "flex-1 min-w-[340px] max-w-[380px] flex flex-col h-full rounded-[32px] border p-4 transition-all duration-300 relative",
                dragOverStage === stage.id ? "bg-slate-100 border-indigo-300 ring-4 ring-indigo-50" : "bg-slate-50/50 border-slate-200/60"
              )}
              onDragOver={(e) => handleDragOver(e, stage.id)}
              onDragLeave={() => setDragOverStage(null)}
              onDrop={(e) => handleDrop(e, stage.id)}
            >
              <div className="flex items-center justify-between mb-4 px-2">
                <div className="flex items-center gap-3">
                  <div className={cn("w-10 h-10 rounded-[32px] flex items-center justify-center border shadow-xs transition-transform hover:scale-105", stage.color, stage.color.replace('text-', 'border-').replace('bg-', 'border-').concat('/30'))}>
                    <Icon size={18} className="opacity-90" />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-800 tracking-tight">{stage.label}</h3>
                    <p className="text-[10px] font-medium uppercase tracking-wider text-slate-400 mt-0.5">{matchingCustomers.length} Deals</p>
                  </div>
                </div>
              </div>

              <div className="px-2 mb-4 space-y-1">
                <div className="flex justify-between items-end">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Total Value</span>
                  <span className="font-mono font-black text-slate-800 tracking-tighter">{formatCurrency(stageValueCents)}</span>
                </div>
                {['lead', 'qualified', 'proposal'].includes(stage.id) && (
                  <div className="flex justify-between items-end">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Weighted</span>
                    <span className="font-mono text-xs font-bold text-slate-600 tracking-tighter">{formatCurrency(stageWeightedCents)}</span>
                  </div>
                )}
              </div>

              <div className="flex-1 flex flex-col gap-3 overflow-y-auto pr-2 custom-scrollbar pb-20">
                <AnimatePresence>
                  {matchingCustomers.map((customer) => {
                    const prob = customer.probability ?? stage.defaultProb;
                    const val = customer.expectedRevenueCents || customer.balanceCents || 0;
                    
                    return (
                      <motion.div
                        key={customer.id}
                        layoutId={customer.id}
                        draggable
                        onDragStart={(e: any) => handleDragStart(e, customer.id!)}
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        className={cn(
                          "bg-white p-5 rounded-[32px] border shadow-sm cursor-grab active:cursor-grabbing hover:shadow-md transition-all group relative overflow-hidden",
                          draggedCustomerId === customer.id ? "opacity-40 border-slate-300 border-dashed" : "border-slate-200/80 hover:border-slate-300"
                        )}
                      >
                        <div 
                          className="absolute bottom-0 left-0 h-1 bg-gradient-to-r from-emerald-400 to-emerald-500" 
                          style={{ width: `${prob}%` }}
                        />

                        <div className="flex items-center justify-between mb-4">
                          <div className="flex items-center gap-3">
                            <GripVertical size={16} className="text-slate-300 cursor-grab opacity-0 group-hover:opacity-100 transition-opacity" />
                            <div className="w-10 h-10 bg-slate-50 flex-shrink-0 rounded-xl flex items-center justify-center font-black text-slate-600 text-sm border border-slate-200 shadow-xs">
                              {(customer.name || 'C').slice(0, 2).toUpperCase()}
                            </div>
                            <span className="font-black text-slate-800 tracking-tight leading-tight line-clamp-2">{customer.name}</span>
                          </div>
                        </div>
                        
                        <div className="space-y-2 mb-4 pl-1">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2 text-xs font-semibold text-slate-500">
                              <DollarSign size={14} className="opacity-50" />
                              <span className="font-mono text-slate-800 font-bold text-lg">{formatCurrency(val)}</span>
                            </div>
                            <div className={cn(
                              "px-2 py-0.5 rounded-md text-[10px] font-black w-fit border",
                              prob >= 60 ? "bg-emerald-50 text-emerald-700 border-emerald-200/50" : 
                              prob >= 30 ? "bg-amber-50 text-amber-700 border-amber-200/50" : 
                              "bg-slate-50 text-slate-500 border-slate-200"
                            )}>
                              {prob}% PROB
                            </div>
                          </div>
                        </div>

                        {/* Stage Actions Mobile Fallback (Hidden on drag) */}
                        <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          {STAGES.slice(0, 3).map((s) => (
                            <button
                              key={s.id}
                              onClick={() => moveCustomer(customer.id, s.id)}
                              title={`Move to ${s.label}`}
                              className={cn(
                                "flex-1 h-8 flex items-center justify-center rounded-lg transition-all",
                                s.id === stage.id 
                                  ? cn(s.color, "opacity-100 shadow-sm font-black") 
                                  : "bg-slate-50 text-slate-300 hover:bg-slate-200 hover:text-slate-600"
                              )}
                            >
                              <s.icon size={12} />
                            </button>
                          ))}
                          <div className="flex-1 flex gap-1 justify-end">
                            <button onClick={()=>alert(`Generated contract for ${customer.name}`)} className="h-8 w-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center hover:bg-indigo-100" title="Convert to Contract"><FileText size={12}/></button>
                            <button onClick={()=>alert(`Sent proposal to ${customer.name}`)} className="h-8 w-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center hover:bg-emerald-100" title="Email Proposal"><Mail size={12}/></button>
                          </div>
                        </div>
                      </motion.div>
                    );
                  })}
                  {matchingCustomers.length === 0 && (
                    <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 flex flex-col items-center justify-center text-center opacity-40 w-full">
                       <div className="w-12 h-12 bg-slate-100 rounded-[32px] border-2 border-slate-200 border-dashed flex items-center justify-center mb-3">
                         <Icon size={20} className="text-slate-400" />
                       </div>
                       <p className="text-[10px] font-medium uppercase tracking-wider text-slate-500">Drop Deals Here</p>
                    </div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
