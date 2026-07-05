import React, { useState } from 'react';
import { ShoppingBag, RefreshCw, Server, CheckCircle2 } from 'lucide-react';
import { cn } from '../../lib/utils';

export default function EcommerceIntegrations() {
  const [activeTab, setActiveTab] = useState<'channels'>('channels');

  const channels: any[] = [];

  return (
    <div className="h-full flex flex-col bg-[#FAFAFA]">
      <div className="px-8 py-6 bg-slate-900 text-white flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-3">
            <ShoppingBag className="w-6 h-6 text-purple-400" />
            E-Commerce Integrations
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Omnichannel synchronization for orders, inventory, and fulfillment across digital storefronts.
          </p>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-8">
        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
          <div className="grid grid-cols-12 p-4 bg-slate-50 border-b border-slate-200 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
            <div className="col-span-3">Platform / Store</div>
            <div className="col-span-3 text-center">Sync Health</div>
            <div className="col-span-3 text-center">Last Sync</div>
            <div className="col-span-3 text-right">Orders Today</div>
          </div>
          <div className="divide-y divide-slate-200">
            {channels.map(c => (
              <div key={c.id} className="grid grid-cols-12 p-4 items-center hover:bg-slate-50 transition-colors">
                <div className="col-span-3">
                  <div className="font-bold text-slate-900">{c.platform}</div>
                  <div className="text-[10px] text-slate-500 mt-0.5">{c.storeName}</div>
                </div>
                <div className="col-span-3 flex justify-center">
                   <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider bg-emerald-50 text-emerald-700 border border-emerald-200">
                      <CheckCircle2 className="w-3 h-3" /> {c.syncStatus}
                   </span>
                </div>
                <div className="col-span-3 text-center text-xs font-mono text-slate-500">
                  {c.lastSync}
                </div>
                <div className="col-span-3 text-right font-bold font-mono text-slate-900 text-lg">
                  {c.ordersToday}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
