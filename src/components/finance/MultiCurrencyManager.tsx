import React, { useState } from 'react';
import { DollarSign, Globe, RefreshCw, TrendingUp, History } from 'lucide-react';
import { cn } from '../../lib/utils';

export default function MultiCurrencyManager() {
  const [activeTab, setActiveTab] = useState<'rates' | 'revaluation'>('rates');

  const currencies: any[] = [];

  return (
    <div className="h-full flex flex-col bg-[#FAFAFA]">
      <div className="px-8 py-6 bg-slate-900 text-white flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-3">
            <Globe className="w-6 h-6 text-blue-400" />
            Multi-Currency Management
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Manage exchange rates, base currencies, and unrealized FX gains/losses.
          </p>
        </div>
        <button className="h-10 px-4 bg-blue-500 text-white rounded-xl text-sm font-bold flex items-center gap-2 hover:bg-blue-400 transition-colors">
           <RefreshCw className="w-4 h-4" /> Fetch Live Rates
        </button>
      </div>

      <div className="flex-1 overflow-auto p-8">
        <div className="flex p-1 bg-white border border-slate-200 rounded-xl shadow-sm hover:shadow-md transition-shadow duration-200 mb-6 w-max">
          {[
            { id: 'rates', label: 'Exchange Rates', icon: DollarSign },
            { id: 'revaluation', label: 'Currency Revaluation', icon: TrendingUp }
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

        {activeTab === 'rates' && (
          <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
            <div className="grid grid-cols-12 p-4 bg-slate-50 border-b border-slate-200 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
              <div className="col-span-3">Currency</div>
              <div className="col-span-2 text-right">Exchange Rate</div>
              <div className="col-span-2 text-center">Base</div>
              <div className="col-span-3 text-center">Last Updated</div>
              <div className="col-span-2 text-right">Actions</div>
            </div>
            <div className="divide-y divide-slate-200">
              {currencies.map(cur => (
                <div key={cur.code} className="grid grid-cols-12 p-4 items-center hover:bg-slate-50 transition-colors">
                  <div className="col-span-3">
                    <div className="font-bold text-slate-900">{cur.name}</div>
                    <div className="text-[10px] font-mono text-slate-400 mt-0.5">{cur.code}</div>
                  </div>
                  <div className="col-span-2 text-right font-mono font-bold text-slate-900">
                     {cur.rate.toFixed(4)}
                  </div>
                  <div className="col-span-2 flex justify-center">
                     {cur.base && <span className="px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider bg-emerald-50 text-emerald-700 border border-emerald-200">Base Currency</span>}
                  </div>
                  <div className="col-span-3 text-center text-xs font-mono text-slate-600">
                     {cur.lastUpdated}
                  </div>
                  <div className="col-span-2 flex justify-end gap-2">
                     <button className="text-slate-400 hover:text-blue-500"><History className="w-4 h-4" /></button>
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
