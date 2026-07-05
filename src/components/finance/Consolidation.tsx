import React, { useState } from 'react';
import { Layers, Building, Download, BarChart3, TrendingUp } from 'lucide-react';
import { cn } from '../../lib/utils';

export default function Consolidation() {
  const [activeTab, setActiveTab] = useState<'matrix' | 'adjustments'>('matrix');

  return (
    <div className="h-full flex flex-col bg-[#FAFAFA]">
      <div className="px-8 py-6 bg-slate-900 text-white flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-3">
            <Layers className="w-6 h-6 text-purple-400" />
            Group Consolidation
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Multi-currency financial consolidation and eliminating entries.
          </p>
        </div>
        <button className="h-10 px-4 bg-purple-500 text-white rounded-xl text-sm font-bold flex items-center gap-2 hover:bg-purple-400 transition-colors">
           <Download className="w-4 h-4" /> Export Report
        </button>
      </div>

      <div className="flex-1 overflow-auto p-8">
        <div className="flex p-1 bg-white border border-slate-200 rounded-xl shadow-sm mb-6 w-max">
          {[
            { id: 'matrix', label: 'Consolidated Matrix', icon: BarChart3 },
            { id: 'adjustments', label: 'Top-Level Adjustments', icon: TrendingUp }
          ].map(tab => (
             <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={cn(
                   "px-6 py-2 rounded-lg text-sm font-bold flex items-center gap-2 transition-all",
                   activeTab === tab.id ? "bg-slate-900 text-white" : "text-slate-500 hover:bg-slate-50"
                )}
             >
                <tab.icon className="w-4 h-4" /> {tab.label}
             </button>
          ))}
        </div>

        {activeTab === 'matrix' && (
          <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
            <div className="grid grid-cols-12 p-4 bg-slate-50 border-b border-slate-200 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
              <div className="col-span-3">Account Group</div>
              <div className="col-span-2 text-right">US Parent (USD)</div>
              <div className="col-span-2 text-right">UK Sub (USD Eq)</div>
              <div className="col-span-2 text-right">EU Sub (USD Eq)</div>
              <div className="col-span-1 text-right text-rose-500">Eliminations</div>
              <div className="col-span-2 text-right text-indigo-600">Consolidated</div>
            </div>
            <div className="divide-y divide-slate-200">
               {/* Mock Rows */}
               <div className="grid grid-cols-12 p-4 items-center hover:bg-slate-50 transition-colors font-mono text-sm">
                  <div className="col-span-3 font-bold font-sans text-slate-900">Total Revenue</div>
                  <div className="col-span-2 text-right">4,500,000</div>
                  <div className="col-span-2 text-right">1,200,000</div>
                  <div className="col-span-2 text-right">800,000</div>
                  <div className="col-span-1 text-right text-rose-500">(150,000)</div>
                  <div className="col-span-2 text-right font-bold text-indigo-600">6,350,000</div>
               </div>
               <div className="grid grid-cols-12 p-4 items-center hover:bg-slate-50 transition-colors font-mono text-sm">
                  <div className="col-span-3 font-bold font-sans text-slate-900">COGS</div>
                  <div className="col-span-2 text-right">1,200,000</div>
                  <div className="col-span-2 text-right">400,000</div>
                  <div className="col-span-2 text-right">300,000</div>
                  <div className="col-span-1 text-right text-rose-500">(45,000)</div>
                  <div className="col-span-2 text-right font-bold text-indigo-600">1,855,000</div>
               </div>
               <div className="grid grid-cols-12 p-4 items-center bg-slate-50 font-mono text-sm font-bold border-t-2 border-slate-300">
                  <div className="col-span-3 font-sans text-slate-900">Gross Margin</div>
                  <div className="col-span-2 text-right">3,300,000</div>
                  <div className="col-span-2 text-right">800,000</div>
                  <div className="col-span-2 text-right">500,000</div>
                  <div className="col-span-1 text-right text-rose-500">(105,000)</div>
                  <div className="col-span-2 text-right text-indigo-600">4,495,000</div>
               </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
