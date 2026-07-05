const fs = require('fs');

const crmCode = `import React, { useState, useMemo } from 'react';
import { Users, Filter, ArrowRight, DollarSign, Plus, Search, Calendar, ChevronRight, GripVertical, CheckCircle2 } from 'lucide-react';
import { cn } from '../../lib/utils';
import { motion, AnimatePresence } from 'motion/react';

// STAGES: Lead, Qualified, Proposal, Negotiation, Closed Won, Closed Lost
const PIPELINE_STAGES = [
  { id: 'lead', label: 'Lead', color: 'bg-slate-100 text-slate-700 border-slate-200' },
  { id: 'qualified', label: 'Qualified', color: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
  { id: 'proposal', label: 'Proposal', color: 'bg-sky-50 text-sky-700 border-sky-200' },
  { id: 'negotiation', label: 'Negotiation', color: 'bg-amber-50 text-amber-700 border-amber-200' },
  { id: 'won', label: 'Closed Won', color: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
];

const MOCK_DEALS = [
  { id: 'D-001', client: 'Acme Corp', stage: 'lead', amount: 45000, probability: 10, expectedClose: '2026-08-15', contact: 'john@acme.com' },
  { id: 'D-002', client: 'TechFlow Inc', stage: 'qualified', amount: 120000, probability: 30, expectedClose: '2026-09-01', contact: 'sarah@techflow.io' },
  { id: 'D-003', client: 'Global Industries', stage: 'proposal', amount: 250000, probability: 60, expectedClose: '2026-07-30', contact: 'mike@global.com' },
  { id: 'D-004', client: 'Stark Logistics', stage: 'negotiation', amount: 85000, probability: 80, expectedClose: '2026-07-20', contact: 'tony@stark.com' },
  { id: 'D-005', client: 'Wayne Enterprises', stage: 'won', amount: 500000, probability: 100, expectedClose: '2026-07-01', contact: 'bruce@wayne.com' },
  { id: 'D-006', client: 'Daily Planet', stage: 'lead', amount: 15000, probability: 20, expectedClose: '2026-08-20', contact: 'clark@dailyplanet.com' },
  { id: 'D-007', client: 'LexCorp', stage: 'proposal', amount: 1000000, probability: 50, expectedClose: '2026-10-15', contact: 'lex@lexcorp.com' },
];

export default function CrmPipeline() {
  const [deals, setDeals] = useState(MOCK_DEALS);
  const [searchTerm, setSearchTerm] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  
  const filteredDeals = useMemo(() => {
    return deals.filter(d => 
      d.client.toLowerCase().includes(searchTerm.toLowerCase()) || 
      d.id.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [deals, searchTerm]);

  const handleDragStart = (e: React.DragEvent, dealId: string) => {
    e.dataTransfer.setData('dealId', dealId);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent, stageId: string) => {
    e.preventDefault();
    const dealId = e.dataTransfer.getData('dealId');
    if (dealId) {
      setDeals(prev => prev.map(d => d.id === dealId ? { ...d, stage: stageId } : d));
    }
  };

  const totalValue = deals.reduce((sum, d) => sum + d.amount, 0);
  const weightedValue = deals.reduce((sum, d) => sum + (d.amount * (d.probability / 100)), 0);

  return (
    <div className="h-full flex flex-col bg-slate-50">
      <div className="px-8 py-6 bg-white border-b border-slate-200 flex flex-col md:flex-row md:justify-between md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-3 text-slate-900">
            <Filter className="w-6 h-6 text-indigo-500" />
            CRM & Sales Pipeline
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Track leads, opportunities, and deal stages to forecast future revenue.
          </p>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex flex-col items-end">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Pipeline</span>
            <span className="text-lg font-mono font-bold text-slate-900">${totalValue.toLocaleString()}</span>
          </div>
          <div className="w-px h-8 bg-slate-200"></div>
          <div className="flex flex-col items-end">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Weighted Value</span>
            <span className="text-lg font-mono font-bold text-emerald-600">${weightedValue.toLocaleString()}</span>
          </div>
          <button 
            onClick={() => setIsAdding(true)}
            className="ml-4 flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl font-medium transition-colors shadow-sm"
          >
            <Plus size={16} /> New Deal
          </button>
        </div>
      </div>
      
      <div className="px-8 py-4 border-b border-slate-200 bg-white">
        <div className="relative max-w-md">
          <Search size={16} className="absolute left-3 top-2.5 text-slate-400" />
          <input 
            type="text" 
            placeholder="Search deals or clients..." 
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all"
          />
        </div>
      </div>

      <div className="flex-1 overflow-x-auto overflow-y-hidden p-6 custom-scrollbar">
        <div className="flex gap-6 h-full min-w-max pb-4">
          {PIPELINE_STAGES.map(stage => {
            const stageDeals = filteredDeals.filter(d => d.stage === stage.id);
            const stageValue = stageDeals.reduce((sum, d) => sum + d.amount, 0);
            
            return (
              <div 
                key={stage.id} 
                className="w-80 flex flex-col bg-slate-100/50 rounded-2xl border border-slate-200/60 overflow-hidden flex-shrink-0"
                onDragOver={handleDragOver}
                onDrop={(e) => handleDrop(e, stage.id)}
              >
                <div className="p-4 border-b border-slate-200/60 bg-slate-50 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className={cn("px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider border", stage.color)}>
                      {stage.label}
                    </span>
                    <span className="text-xs font-mono font-bold text-slate-400 bg-slate-200/50 px-2 py-0.5 rounded-full">
                      {stageDeals.length}
                    </span>
                  </div>
                  <span className="text-sm font-mono font-bold text-slate-600">
                    ${(stageValue / 1000).toFixed(0)}k
                  </span>
                </div>
                
                <div className="flex-1 overflow-y-auto p-3 space-y-3 custom-scrollbar">
                  <AnimatePresence>
                    {stageDeals.map(deal => (
                      <motion.div
                        layout
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        key={deal.id}
                        draggable
                        onDragStart={(e: any) => handleDragStart(e, deal.id)}
                        className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm cursor-grab active:cursor-grabbing hover:border-indigo-300 hover:shadow-md transition-all group"
                      >
                        <div className="flex justify-between items-start mb-2">
                          <div>
                            <h3 className="font-bold text-slate-900 text-sm leading-tight group-hover:text-indigo-600 transition-colors">{deal.client}</h3>
                            <p className="text-[10px] font-mono text-slate-400 mt-0.5">{deal.id}</p>
                          </div>
                          <GripVertical size={14} className="text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity" />
                        </div>
                        
                        <div className="font-mono font-bold text-lg text-slate-800 mb-3">
                          ${deal.amount.toLocaleString()}
                        </div>
                        
                        <div className="flex items-center justify-between mt-4 pt-3 border-t border-slate-100">
                          <div className="flex items-center gap-1.5 text-slate-500">
                            <Calendar size={12} />
                            <span className="text-[10px] font-medium">{new Date(deal.expectedClose).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <CheckCircle2 size={12} className={cn("text-emerald-500", deal.probability < 50 ? 'text-amber-500' : deal.probability < 20 ? 'text-rose-500' : '')} />
                            <span className="text-[10px] font-mono font-bold text-slate-600">{deal.probability}%</span>
                          </div>
                        </div>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
`;

fs.writeFileSync('src/components/sales/CrmPipeline.tsx', crmCode);
