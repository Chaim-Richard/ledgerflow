import React, { useState } from 'react';
import { Trash2 } from 'lucide-react';
import { cn } from '../../lib/utils';

export default function AssetDisposals() {
  const [activeTab, setActiveTab] = useState<'disposals'>('disposals');

  const disposals: any[] = [];

  return (
    <div className="h-full flex flex-col bg-[#FAFAFA]">
      <div className="px-8 py-6 bg-slate-900 text-white flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-3">
            <Trash2 className="w-6 h-6 text-rose-400" />
            Fixed Asset Disposals & Write-Offs
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Retire assets, calculate realized gain/loss, and post closing entries to the GL.
          </p>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-8">
        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
          <div className="grid grid-cols-12 p-4 bg-slate-50 border-b border-slate-200 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
            <div className="col-span-3">Asset / Ref</div>
            <div className="col-span-2 text-right">Net Book Value</div>
            <div className="col-span-2 text-right">Sale/Salvage Price</div>
            <div className="col-span-2 text-right">Realized Gain (Loss)</div>
            <div className="col-span-3 text-right">Status</div>
          </div>
          <div className="divide-y divide-slate-200">
            {disposals.map(d => (
              <div key={d.id} className="grid grid-cols-12 p-4 items-center hover:bg-slate-50 transition-colors">
                <div className="col-span-3">
                  <div className="font-bold text-slate-900">{d.asset}</div>
                  <div className="text-[10px] font-mono text-slate-400 mt-0.5">{d.id}</div>
                </div>
                <div className="col-span-2 text-right font-mono font-bold text-slate-600">
                  ${d.bookValue.toLocaleString()}
                </div>
                <div className="col-span-2 text-right font-mono font-bold text-slate-900">
                  ${d.salePrice.toLocaleString()}
                </div>
                <div className="col-span-2 text-right font-mono font-bold">
                  <span className={d.glLoss > 0 ? "text-rose-600" : d.glLoss < 0 ? "text-emerald-600" : "text-slate-400"}>
                    {d.glLoss > 0 ? `($${d.glLoss.toLocaleString()})` : d.glLoss < 0 ? `$${Math.abs(d.glLoss).toLocaleString()}` : '$0'}
                  </span>
                </div>
                <div className="col-span-3 flex justify-end">
                   <span className={cn(
                      "px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider border",
                      d.status === 'Posted' ? "bg-emerald-50 text-emerald-700 border-emerald-200" :
                      "bg-amber-50 text-amber-700 border-amber-200"
                   )}>
                      {d.status}
                   </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
