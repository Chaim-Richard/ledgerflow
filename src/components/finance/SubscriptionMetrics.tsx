import React, { useState } from 'react';
import { Repeat, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { cn } from '../../lib/utils';

export default function SubscriptionMetrics() {
  const [activeTab, setActiveTab] = useState<'mrr'>('mrr');

  const metrics: any[] = [];

  return (
    <div className="h-full flex flex-col bg-[#FAFAFA]">
      <div className="px-8 py-6 bg-slate-900 text-white flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-3">
            <Repeat className="w-6 h-6 text-emerald-400" />
            SaaS & Subscription Metrics
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Real-time tracking of MRR, ARR, Churn, and customer lifetime value.
          </p>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-8">
        <div className="grid grid-cols-2 gap-6">
           {metrics.map(m => (
              <div key={m.metric} className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col">
                 <div className="text-sm font-bold text-slate-500 mb-4">{m.metric}</div>
                 <div className="text-4xl font-black text-slate-900 tracking-tight mb-4">{m.value}</div>
                 <div className="flex items-center gap-2 mt-auto">
                    <div className={cn(
                       "flex items-center gap-1 text-xs font-bold px-2 py-1 rounded-md",
                       m.trend === 'up' && !m.metric.includes('Churn') ? "bg-emerald-50 text-emerald-700" :
                       m.trend === 'down' && m.metric.includes('Churn') ? "bg-emerald-50 text-emerald-700" :
                       "bg-rose-50 text-rose-700"
                    )}>
                       {m.trend === 'up' ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                       {m.growth}
                    </div>
                    <span className="text-xs text-slate-400 font-medium">vs last month</span>
                 </div>
              </div>
           ))}
        </div>
      </div>
    </div>
  );
}
