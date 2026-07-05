import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Bill } from '../../types';
import { cn, formatCurrency } from '../../lib/utils';
import { Truck, Receipt, CheckCircle, GripVertical, AlertTriangle, Clock, Target, TrendingDown } from 'lucide-react';
import { format, differenceInDays } from 'date-fns';

interface PurchasePipelineProps {
  bills: Bill[];
  onUpdateBill: (id: string, updates: Partial<Bill>) => void;
}

const STAGES: any[] = [];

export default function PurchasePipeline({ bills, onUpdateBill }: PurchasePipelineProps) {
  const [draggedBillId, setDraggedBillId] = useState<string | null>(null);
  const [dragOverStage, setDragOverStage] = useState<string | null>(null);

  const handleDragStart = (e: React.DragEvent, billId: string) => {
    e.dataTransfer.setData('text/plain', billId);
    setDraggedBillId(billId);
  };

  const handleDragOver = (e: React.DragEvent, stageId: string) => {
    e.preventDefault();
    setDragOverStage(stageId);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOverStage(null);
  };

  const handleDrop = async (e: React.DragEvent, stageId: string) => {
    e.preventDefault();
    const billId = e.dataTransfer.getData('text');
    setDragOverStage(null);
    setDraggedBillId(null);

    const bill = bills.find(b => b.id === billId);
    if (!bill || bill.status === stageId) return;

    onUpdateBill(bill.id, { status: stageId as any });
  };

  const sortedBillsByStage = useMemo(() => {
    const map: Record<string, Bill[]> = {};
    STAGES.forEach(s => map[s.id] = []);
    
    bills.forEach(b => {
      if (map[b.status || 'pending']) {
        map[b.status || 'pending'].push(b);
      }
    });

    // Sort: due date ascending (closest to due first), then amount descending
    Object.keys(map).forEach(stageId => {
      map[stageId].sort((a, b) => {
        if (a.dueDate && b.dueDate) {
          const d1 = new Date(a.dueDate).getTime();
          const d2 = new Date(b.dueDate).getTime();
          if (d1 !== d2) return d1 - d2;
        }
        if (a.dueDate && !b.dueDate) return -1;
        if (!a.dueDate && b.dueDate) return 1;
        return (b.amountCents || 0) - (a.amountCents || 0);
      });
    });

    return map;
  }, [bills]);

  const pipelineStats = useMemo(() => {
    let totalExposure = 0;
    let overdueVal = 0;
    let settled = 0;
    
    bills.forEach(b => {
      const val = b.amountCents || 0;
      if (b.status === 'paid') {
        settled += val;
      } else {
        totalExposure += val;
        if (b.status === 'overdue') overdueVal += val;
      }
    });

    return { totalExposure, overdueVal, settled };
  }, [bills]);

  return (
    <div className="flex flex-col gap-6">
      {/* Top Level Pipeline Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="ledger-card p-6 rounded-[32px] bg-gradient-to-br from-amber-50 to-white">
          <div className="w-10 h-10 bg-amber-100 text-amber-600 rounded-[32px] flex items-center justify-center mb-4 border border-amber-200 shadow-sm">
            <Target size={20} />
          </div>
          <p className="text-xs font-medium uppercase tracking-wider text-amber-900/60 mb-1">Total Outstanding Liability</p>
          <div className="text-3xl font-black font-mono tracking-tighter text-amber-950">
            {formatCurrency(pipelineStats.totalExposure)}
          </div>
        </div>
        <div className="ledger-card p-6 rounded-[32px] bg-gradient-to-br from-rose-50 to-white">
          <div className="w-10 h-10 bg-rose-100 text-rose-600 rounded-[32px] flex items-center justify-center mb-4 border border-rose-200 shadow-sm">
            <AlertTriangle size={20} />
          </div>
          <p className="text-xs font-medium uppercase tracking-wider text-rose-900/60 mb-1">Total Overdue</p>
          <div className="text-3xl font-black font-mono tracking-tighter text-rose-950">
            {formatCurrency(pipelineStats.overdueVal)}
          </div>
        </div>
        <div className="ledger-card p-6 rounded-[32px] bg-gradient-to-br from-emerald-50 to-white">
          <div className="w-10 h-10 bg-emerald-100 text-emerald-600 rounded-[32px] flex items-center justify-center mb-4 border border-emerald-200 shadow-sm">
            <TrendingDown size={20} />
          </div>
          <p className="text-xs font-medium uppercase tracking-wider text-emerald-900/60 mb-1">Settled Value</p>
          <div className="text-3xl font-black font-mono tracking-tighter text-emerald-950">
            {formatCurrency(pipelineStats.settled)}
          </div>
        </div>
      </div>

      <div className="flex gap-4 overflow-x-auto min-h-[700px] pb-8 custom-scrollbar">
        {STAGES.map((stage) => {
          const stageBills = sortedBillsByStage[stage.id];
          const totalValue = stageBills.reduce((sum, b) => sum + (b.amountCents || 0), 0);
          
          return (
            <div 
              key={stage.id} 
              className={cn(
                "flex-1 min-w-[340px] max-w-[380px] flex flex-col h-full rounded-[32px] border p-4 transition-all duration-300 relative",
                dragOverStage === stage.id ? "bg-slate-100 border-indigo-300 ring-4 ring-indigo-50" : "bg-slate-50/50 border-slate-200/60"
              )}
              onDragOver={(e) => handleDragOver(e, stage.id)}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, stage.id)}
            >
              {/* Stage Header */}
              <div className="flex items-center justify-between mb-4 px-2">
                <div className="flex items-center gap-3">
                  <div className={cn("w-10 h-10 rounded-[32px] flex items-center justify-center border shadow-xs transition-transform hover:scale-105", stage.color, stage.borderColor)}>
                    <stage.icon size={18} className="opacity-90" />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-800 tracking-tight">{stage.label}</h3>
                    <p className="text-[10px] font-medium uppercase tracking-wider text-slate-400 mt-0.5">{stageBills.length} Bills</p>
                  </div>
                </div>
              </div>

              <div className="px-2 mb-4 space-y-1">
                <div className="flex justify-between items-end">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Total Value</span>
                  <span className="font-mono font-black text-slate-800 tracking-tighter">{formatCurrency(totalValue)}</span>
                </div>
              </div>

              {/* Cards Area */}
              <div className="flex-1 space-y-4 relative overflow-y-auto pr-2 custom-scrollbar pb-20">
                <AnimatePresence>
                  {stageBills.map((bill) => {
                    const daysOverdue = bill.dueDate ? Math.max(0, differenceInDays(new Date(), new Date(bill.dueDate))) : 0;

                    return (
                    <motion.div
                      layout
                      layoutId={bill.id}
                      key={bill.id}
                      draggable
                      onDragStart={(e: any) => handleDragStart(e, bill.id!)}
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.9 }}
                      className={cn(
                        "bg-white border rounded-[32px] p-5 cursor-grab active:cursor-grabbing hover:shadow-xl transition-all group relative overflow-hidden",
                        draggedBillId === bill.id ? "opacity-50 border-slate-300 border-dashed" : "border-slate-200/80 shadow-sm hover:border-slate-300"
                      )}
                    >
                      {stage.id === 'overdue' && daysOverdue > 0 && (
                        <div className="absolute top-0 right-0 bg-rose-500 text-white text-[9px] font-medium uppercase tracking-wider px-3 py-1 rounded-bl-xl shadow-xs">
                          {daysOverdue} Days Late
                        </div>
                      )}

                      <div className="flex items-start justify-between mb-4">
                        <div>
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">{bill.number}</p>
                          <h4 className="font-black text-slate-800 leading-tight">{bill.vendorName}</h4>
                        </div>
                        <GripVertical size={14} className="text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>

                      <div className="pt-4 border-t border-slate-100 flex items-end justify-between">
                        <div className="space-y-1 pl-1">
                          <p className="text-[8px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1">
                            <Clock size={10} />
                            Due
                          </p>
                          <p className={cn(
                            "text-[10px] font-bold",
                            stage.id === 'overdue' ? "text-rose-600" : "text-slate-600"
                          )}>
                            {bill.dueDate ? format(new Date(bill.dueDate), 'MMM dd, yyyy') : 'N/A'}
                          </p>
                        </div>
                        <div className="text-right">
                          <span className="text-lg font-black font-mono tracking-tighter text-slate-800">
                            {formatCurrency(bill.amountCents || 0)}
                          </span>
                        </div>
                      </div>
                    </motion.div>
                  )})}
                </AnimatePresence>

                {/* Empty state for the column */}
                {stageBills.length === 0 && (
                  <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 flex flex-col items-center justify-center text-center opacity-40 w-full h-full pointer-events-none">
                     <div className="w-12 h-12 bg-slate-100 rounded-[32px] border-2 border-slate-200 border-dashed flex items-center justify-center mb-3">
                       <stage.icon size={20} className="text-slate-400" />
                     </div>
                     <p className="text-[10px] font-medium uppercase tracking-wider text-slate-500">Drop Here</p>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
