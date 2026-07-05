import React, { useState } from 'react';
import { Target, Users, PhoneCall, Mail, DollarSign, Plus, Search, Filter, Briefcase, Calendar, BarChart3, GripVertical } from 'lucide-react';
import { cn } from '../../lib/utils';
import { motion } from 'motion/react';

export default function SalesCRM() {
  const [deals, setDeals] = useState<any[]>([
    { id: '1', title: 'Q3 Enterprise Licensing', company: 'Acme Corp', contact: 'John Smith', value: 12500000, stage: 'negotiation', date: '2024-07-15' },
    { id: '2', title: 'SaaS Platform Implementation', company: 'Globex Inc', contact: 'Sarah Connor', value: 4500000, stage: 'proposal', date: '2024-07-22' },
    { id: '3', title: 'Data Migration Project', company: 'Initech', contact: 'Bill Lumbergh', value: 850000, stage: 'contacted', date: '2024-08-01' },
    { id: '4', title: 'Annual Support Contract', company: 'Soylent Corp', contact: 'Bob', value: 2400000, stage: 'new', date: '2024-07-10' },
    { id: '5', title: 'Security Audit & Compliance', company: 'Massive Dynamic', contact: 'William Bell', value: 6500000, stage: 'closed', date: '2024-06-30' },
  ]);

  const columns: any[] = [];

  const totalPipeline = deals.filter(d => d.stage !== 'closed').reduce((sum, d) => sum + d.value, 0);

  return (
    <div className="h-full flex flex-col bg-white">
      <div className="px-8 py-6 border-b border-[#E5E5E5] flex justify-between items-start bg-white z-10 sticky top-0">
        <div>
          <h1 className="text-2xl font-bold text-[#0A0A0A] flex items-center gap-3">
            <Target className="w-6 h-6 text-rose-600" />
            Sales CRM & Pipeline
          </h1>
          <p className="text-sm text-[#525252] mt-1">
            Track leads, manage opportunities, and forecast revenue.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="w-4 h-4 text-[#A3A3A3] absolute left-3 top-1/2 -translate-y-1/2" />
            <input 
              type="text"
              placeholder="Search deals..."
              className="w-64 h-10 pl-9 pr-4 bg-[#FAFAFA] border border-[#E5E5E5] rounded-xl text-sm focus:outline-none focus:border-[#0A0A0A]"
            />
          </div>
          <button className="h-10 px-4 bg-white border border-[#E5E5E5] text-[#0A0A0A] rounded-xl text-sm font-bold flex items-center gap-2 hover:bg-[#FAFAFA] transition-colors shadow-sm">
            <Filter className="w-4 h-4" /> Filter
          </button>
          <button className="h-10 px-4 bg-[#0A0A0A] text-white rounded-xl text-sm font-bold flex items-center gap-2 hover:bg-[#1A1A1A] transition-colors shadow-sm">
            <Plus className="w-4 h-4" /> New Deal
          </button>
        </div>
      </div>

      {/* Mini Dashboard */}
      <div className="px-8 py-4 border-b border-[#E5E5E5] bg-[#FAFAFA] flex items-center justify-between">
        <div className="flex items-center gap-8">
           <div className="flex items-center gap-3">
             <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center text-blue-700">
               <BarChart3 className="w-5 h-5" />
             </div>
             <div>
               <div className="text-[10px] font-bold text-[#525252] uppercase tracking-wider">Active Pipeline</div>
               <div className="text-xl font-bold text-[#0A0A0A]">${(totalPipeline / 100).toLocaleString()}</div>
             </div>
           </div>
           <div className="h-8 w-px bg-[#E5E5E5]"></div>
           <div className="flex items-center gap-3">
             <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center text-emerald-700">
               <DollarSign className="w-5 h-5" />
             </div>
             <div>
               <div className="text-[10px] font-bold text-[#525252] uppercase tracking-wider">Closed Won (YTD)</div>
               <div className="text-xl font-bold text-[#0A0A0A]">$65,000.00</div>
             </div>
           </div>
        </div>
      </div>

      <div className="flex-1 overflow-x-auto p-6 bg-[#FAFAFA]">
        <div className="flex gap-6 h-full min-w-max pb-4">
          {/* Kanban Board Columns */}
          {columns.map((column, idx) => {
            const columnDeals = deals.filter(d => d.stage === column.id);
            const columnValue = columnDeals.reduce((sum, d) => sum + d.value, 0);
            
            return (
              <div key={idx} className={cn("flex-shrink-0 w-80 rounded-2xl border flex flex-col h-full bg-white", column.color)}>
                <div className={cn("p-4 border-b border-inherit flex items-center justify-between rounded-t-2xl", column.headerColor)}>
                  <div className="flex items-center gap-2">
                    <column.icon className="w-4 h-4 text-[#525252]" />
                    <h3 className="text-sm font-bold text-[#0A0A0A]">{column.title}</h3>
                  </div>
                  <span className="px-2 py-0.5 bg-white rounded-full text-xs font-bold text-[#525252] shadow-sm border border-[#E5E5E5]">
                    {columnDeals.length}
                  </span>
                </div>
                
                <div className="p-3 border-b border-inherit bg-white/50">
                  <div className="flex justify-between items-center text-xs font-bold text-[#525252]">
                    <span className="uppercase tracking-wider">Stage Value</span>
                    <span className="font-mono text-[#0A0A0A]">${(columnValue / 100).toLocaleString()}</span>
                  </div>
                </div>

                <div className="flex-1 p-3 space-y-3 overflow-y-auto">
                  {columnDeals.length === 0 ? (
                     <div className="text-center p-6 border border-dashed border-inherit rounded-xl bg-white/50">
                       <p className="text-xs text-[#525252]">Drop deals here</p>
                     </div>
                  ) : (
                    columnDeals.map(deal => (
                      <motion.div 
                        layoutId={deal.id}
                        key={deal.id} 
                        className="bg-white border border-[#E5E5E5] rounded-xl p-4 shadow-sm cursor-grab active:cursor-grabbing hover:border-[#0A0A0A] hover:shadow-md transition-all group"
                      >
                        <div className="flex justify-between items-start mb-2">
                          <span className="text-[10px] font-bold text-[#525252] uppercase tracking-wider">{deal.company}</span>
                          <GripVertical className="w-4 h-4 text-[#E5E5E5] group-hover:text-[#A3A3A3] transition-colors opacity-0 group-hover:opacity-100" />
                        </div>
                        <h4 className="text-sm font-bold text-[#0A0A0A] leading-tight mb-3">{deal.title}</h4>
                        
                        <div className="flex items-center justify-between pt-3 border-t border-[#E5E5E5]">
                          <div className="flex items-center gap-1.5 text-xs text-[#525252]">
                            <Users className="w-3.5 h-3.5" />
                            <span className="truncate max-w-[100px]">{deal.contact}</span>
                          </div>
                          <div className="font-mono text-sm font-bold text-[#0A0A0A]">
                            ${(deal.value / 100).toLocaleString()}
                          </div>
                        </div>
                      </motion.div>
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
