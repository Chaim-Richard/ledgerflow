import React, { useState } from 'react';
import { Users, PieChart, TrendingUp, Briefcase, Plus, FileText, ArrowRight } from 'lucide-react';
import { cn } from '../../lib/utils';
import { motion } from 'motion/react';

export default function CapTableManager() {
  const [activeTab, setActiveTab] = useState<'shareholders' | 'certificates' | 'scenarios'>('shareholders');

  const shareholders: any[] = [];

  const totalShares = shareholders.reduce((sum, s) => sum + s.shares, 0);

  return (
    <div className="h-full flex flex-col bg-[#FAFAFA]">
      <div className="px-8 py-6 bg-slate-900 text-white flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-3">
            <PieChart className="w-6 h-6 text-purple-400" />
            Cap Table & Ownership Matrix
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Manage corporate equity, shareholder ledgers, and capitalization structure.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button className="h-10 px-4 bg-purple-500 text-slate-900 rounded-xl text-sm font-bold flex items-center gap-2 hover:bg-purple-400 transition-colors shadow-sm">
            <Plus className="w-4 h-4" /> Issue Shares
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-8">
        {/* KPI Dashboard */}
        <div className="grid grid-cols-4 gap-6 mb-8">
          <div className="p-6 bg-white rounded-2xl border border-slate-200 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Total Outstanding</span>
              <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center">
                <PieChart className="w-4 h-4 text-slate-600" />
              </div>
            </div>
            <div className="text-3xl font-bold font-mono text-slate-900">{totalShares.toLocaleString()}</div>
          </div>

          <div className="p-6 bg-white rounded-2xl border border-slate-200 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Total Shareholders</span>
              <div className="w-8 h-8 rounded-full bg-blue-50 flex items-center justify-center">
                <Users className="w-4 h-4 text-blue-600" />
              </div>
            </div>
            <div className="text-3xl font-bold text-slate-900">{shareholders.length}</div>
          </div>
          
          <div className="p-6 bg-white rounded-2xl border border-slate-200 shadow-sm bg-purple-50 border-purple-100">
            <div className="flex items-center justify-between mb-4">
              <span className="text-[10px] font-bold text-purple-600 uppercase tracking-wider">Implied Valuation</span>
              <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center">
                <TrendingUp className="w-4 h-4 text-purple-600" />
              </div>
            </div>
            <div className="text-3xl font-bold text-purple-700">$25.0<span className="text-sm font-bold text-purple-600 ml-1">M</span></div>
          </div>
        </div>

        {/* Tab Bar */}
        <div className="flex p-1 bg-white border border-slate-200 rounded-xl shadow-sm mb-6 w-max">
          {[
            { id: 'shareholders', label: 'Shareholder Ledger', icon: Users },
            { id: 'certificates', label: 'Stock Certificates', icon: FileText },
            { id: 'scenarios', label: 'Exit Scenarios', icon: ArrowRight }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={cn(
                "px-6 py-2 rounded-lg text-sm font-bold flex items-center gap-2 transition-all",
                activeTab === tab.id ? "bg-slate-900 text-white" : "text-slate-500 hover:bg-slate-50"
              )}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </div>

        {/* Content Area */}
        {activeTab === 'shareholders' && (
          <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
            <div className="grid grid-cols-12 p-4 bg-slate-50 border-b border-slate-200 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
              <div className="col-span-4">Shareholder Name</div>
              <div className="col-span-3">Equity Class</div>
              <div className="col-span-3 text-right">Shares Owned</div>
              <div className="col-span-2 text-right">Ownership %</div>
            </div>
            <div className="divide-y divide-slate-200">
              {shareholders.map((sh) => (
                <div key={sh.id} className="grid grid-cols-12 p-4 items-center hover:bg-slate-50 transition-colors">
                  <div className="col-span-4">
                    <div className="font-bold text-slate-900">{sh.name}</div>
                    <div className="text-[10px] font-mono text-slate-400 mt-0.5">{sh.id}</div>
                  </div>
                  <div className="col-span-3">
                    <span className={cn(
                      "px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider border",
                      sh.type === 'Common' ? "bg-slate-100 text-slate-700 border-slate-200" :
                      sh.type === 'Options' ? "bg-amber-50 text-amber-700 border-amber-200" :
                      "bg-purple-50 text-purple-700 border-purple-200"
                    )}>
                      {sh.type}
                    </span>
                  </div>
                  <div className="col-span-3 text-right font-mono text-sm font-bold text-slate-700">
                    {sh.shares.toLocaleString()}
                  </div>
                  <div className="col-span-2 text-right font-mono text-sm font-black text-slate-900">
                    {sh.percentage.toFixed(2)}%
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
