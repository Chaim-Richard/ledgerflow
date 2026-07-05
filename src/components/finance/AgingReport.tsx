
import React, { useMemo } from 'react';
import { 
  History,
  AlertCircle,
  Calendar,
  DollarSign
} from 'lucide-react';
import { cn, formatCurrency } from '../../lib/utils';
import { motion } from 'motion/react';

interface AgingItem {
  id: string;
  entity: string;
  amountCents: number;
  dueDate: string;
  invoiceNumber: string;
}

interface AgingReportProps {
  type: 'AP' | 'AR';
  items: AgingItem[];
}

export default function AgingReport({ type, items = [] }: AgingReportProps) {
  const safeItems = Array.isArray(items) ? items : [];

  const buckets = useMemo(() => {
    const now = new Date();
    const result = {
      current: 0,
      '1-30': 0,
      '31-60': 0,
      '61-90': 0,
      '90+': 0,
    };

    safeItems.forEach(item => {
      const dueDate = new Date(item.dueDate);
      const diffTime = now.getTime() - dueDate.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      if (diffDays <= 0) result.current += item.amountCents;
      else if (diffDays <= 30) result['1-30'] += item.amountCents;
      else if (diffDays <= 60) result['31-60'] += item.amountCents;
      else if (diffDays <= 90) result['61-90'] += item.amountCents;
      else result['90+'] += item.amountCents;
    });

    return result;
  }, [safeItems]);

  const total = safeItems.reduce((acc, i) => acc + i.amountCents, 0);

  return (
    <div className="flex flex-col h-full bg-white border border-slate-200 rounded-[32px] overflow-hidden shadow-2xl">
      <div className="p-4 md:p-10 border-b border-slate-200">
         <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-4">
               <div className={cn(
                 "w-12 h-12 rounded-[32px] flex items-center justify-center text-white shadow-xl",
                 type === 'AP' ? "bg-rose-500" : "bg-emerald-500"
               )}>
                  <History size={24} />
               </div>
               <div className="flex flex-col">
                  <h2 className="text-2xl font-black italic tracking-tighter uppercase leading-none text-slate-900">
                    {type === 'AP' ? 'Accounts Payable' : 'Accounts Receivable'} Aging
                  </h2>
                  <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest truncate mt-2 opacity-50">
                    {type === 'AP' ? 'Liability' : 'Asset'} Liquidity Maturity
                  </p>
               </div>
            </div>
            <div className="flex items-center gap-4">
               <div className="text-right">
                  <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Total Outstanding</p>
                  <p className="text-2xl font-black text-slate-900 italic tracking-tighter">{formatCurrency(total)}</p>
               </div>
            </div>
         </div>

         <div className="grid grid-cols-5 gap-4">
            {Object.entries(buckets).map(([range, amount], idx) => (
              <div key={range} className="p-4 bg-slate-50/30 rounded-[32px] border border-slate-200 text-center group hover:bg-white hover:border-slate-800 transition-all">
                 <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-2">{range} Days</p>
                 <p className={cn(
                   "text-sm font-black tabular-nums tracking-tight",
                   amount > 0 ? (idx > 1 ? "text-rose-600" : "text-slate-900") : "text-slate-500 opacity-30"
                 )}>
                   {formatCurrency(amount)}
                 </p>
                 <div className="h-1 bg-slate-200 rounded-full mt-3 overflow-hidden">
                    <motion.div 
                      initial={{ width: 0 }}
                      animate={{ width: `${total > 0 ? (amount / total) * 100 : 0}%` }}
                      className={cn("h-full", idx > 1 ? "bg-rose-500" : "bg-slate-900")} 
                    />
                 </div>
              </div>
            ))}
         </div>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar">
         <table className="w-full text-left border-collapse">
            <thead className="sticky top-0 bg-white border-b border-slate-200 z-10">
               <tr>
                  <th className="px-10 py-5 text-[10px] font-black text-slate-500 uppercase tracking-widest">Entity</th>
                  <th className="px-10 py-5 text-[10px] font-black text-slate-500 uppercase tracking-widest">Invoice</th>
                  <th className="px-10 py-5 text-[10px] font-black text-slate-500 uppercase tracking-widest">Due Date</th>
                  <th className="px-10 py-5 text-[10px] font-black text-slate-500 uppercase tracking-widest text-right">Balance</th>
               </tr>
            </thead>
            <tbody className="divide-y divide-ledger-line/30">
               {(([] as typeof safeItems).concat(safeItems)).sort((a,b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime()).map(item => {
                 const isOverdue = new Date(item.dueDate) < new Date();
                 return (
                   <tr key={item.id} className="hover:bg-slate-50/20 group transition-colors">
                      <td className="px-10 py-5">
                         <p className="text-xs font-black text-slate-900 uppercase tracking-tight">{item.entity}</p>
                      </td>
                      <td className="px-10 py-5 text-[10px] font-mono text-slate-500 uppercase tracking-widest">ID: {item.invoiceNumber}</td>
                      <td className="px-10 py-5">
                         <div className="flex items-center gap-2">
                            <span className={cn(
                              "text-[10px] font-bold font-mono",
                              isOverdue ? "text-rose-600" : "text-slate-900"
                            )}>
                               {item.dueDate}
                            </span>
                            {isOverdue && <AlertCircle size={10} className="text-rose-500" />}
                         </div>
                      </td>
                      <td className="px-10 py-5 text-right">
                         <span className="text-sm font-black tabular-nums tracking-tighter text-slate-900">
                            {formatCurrency(item.amountCents)}
                         </span>
                      </td>
                   </tr>
                 );
               })}
            </tbody>
         </table>
      </div>

      <div className="p-4 md:p-8 bg-slate-50/40 border-t border-slate-200 flex items-center justify-between">
         <div className="flex items-center gap-4">
            <Calendar size={16} className="text-slate-500" />
            <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">As of today: {new Date().toLocaleDateString()}</p>
         </div>
         <button className="flex items-center gap-2 text-[10px] font-black text-slate-900 uppercase tracking-widest hover:underline">
            <DollarSign size={14} /> Send Payment Reminders
         </button>
      </div>
    </div>
  );
}
