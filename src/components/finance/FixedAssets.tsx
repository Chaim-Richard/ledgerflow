import React, { useState } from 'react';
import { Briefcase, Building, Layers, Settings, FileText, CheckCircle2 } from 'lucide-react';
import { cn } from '../../lib/utils';

export default function FixedAssets() {
  const [activeTab, setActiveTab] = useState<'register' | 'depreciation'>('register');

  const assets: any[] = [];

  return (
    <div className="h-full flex flex-col bg-[#FAFAFA]">
      <div className="px-8 py-6 bg-slate-900 text-white flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-3">
            <Briefcase className="w-6 h-6 text-emerald-400" />
            Fixed Asset Register (FAS)
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Manage capital assets, calculate depreciation, and track net book value.
          </p>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-8">
        <div className="flex p-1 bg-white border border-slate-200 rounded-xl shadow-sm mb-6 w-max">
          {[
            { id: 'register', label: 'Asset Register', icon: Layers },
            { id: 'depreciation', label: 'Depreciation Runs', icon: Settings }
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

        {activeTab === 'register' && (
          <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
            <div className="grid grid-cols-12 p-4 bg-slate-50 border-b border-slate-200 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
              <div className="col-span-3">Asset Name</div>
              <div className="col-span-2">Category</div>
              <div className="col-span-2 text-right">Purchase Value</div>
              <div className="col-span-2 text-right">Acc. Dep.</div>
              <div className="col-span-2 text-right">Net Book Value</div>
              <div className="col-span-1 text-center">Date</div>
            </div>
            <div className="divide-y divide-slate-200">
              {assets.map(asset => (
                <div key={asset.id} className="grid grid-cols-12 p-4 items-center hover:bg-slate-50 transition-colors">
                  <div className="col-span-3">
                    <div className="font-bold text-slate-900">{asset.name}</div>
                    <div className="text-[10px] font-mono text-slate-400 mt-0.5">{asset.id}</div>
                  </div>
                  <div className="col-span-2 text-xs font-bold text-slate-700">
                    {asset.category}
                  </div>
                  <div className="col-span-2 text-right font-mono font-bold text-slate-900">
                     ${asset.value.toLocaleString()}
                  </div>
                  <div className="col-span-2 text-right font-mono text-slate-600">
                     ${asset.accDep.toLocaleString()}
                  </div>
                  <div className="col-span-2 text-right font-mono font-bold text-emerald-600">
                     ${asset.nbv.toLocaleString()}
                  </div>
                  <div className="col-span-1 text-center text-xs font-mono text-slate-500">
                     {asset.date}
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
