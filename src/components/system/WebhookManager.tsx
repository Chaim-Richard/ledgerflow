import React, { useState } from 'react';
import { Target, Server, Database, Cloud, ShieldCheck, Cpu } from 'lucide-react';
import { cn } from '../../lib/utils';

export default function WebhookManager() {
  const [activeTab, setActiveTab] = useState<'endpoints' | 'logs'>('endpoints');

  const webhooks: any[] = [];

  return (
    <div className="h-full flex flex-col bg-[#FAFAFA]">
      <div className="px-8 py-6 bg-slate-900 text-white flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-3">
            <Cloud className="w-6 h-6 text-sky-400" />
            Webhook Integrations
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Manage outbound event subscriptions and incoming data hooks.
          </p>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-8">
        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
          <div className="grid grid-cols-12 p-4 bg-slate-50 border-b border-slate-200 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
            <div className="col-span-4">Endpoint URL</div>
            <div className="col-span-4">Subscribed Events</div>
            <div className="col-span-2 text-center">Last Fired</div>
            <div className="col-span-2 text-right">Status</div>
          </div>
          <div className="divide-y divide-slate-200">
            {webhooks.map(wh => (
              <div key={wh.id} className="grid grid-cols-12 p-4 items-center hover:bg-slate-50 transition-colors">
                <div className="col-span-4">
                  <div className="font-bold text-slate-900 truncate pr-4">{wh.url}</div>
                  <div className="text-[10px] font-mono text-slate-400 mt-0.5">{wh.id}</div>
                </div>
                <div className="col-span-4 text-xs font-mono text-slate-600 space-y-1">
                   {wh.events.map((e: any) => <div key={e}>{e}</div>)}
                </div>
                <div className="col-span-2 text-center text-xs font-mono text-slate-500">
                   {wh.lastFired}
                </div>
                <div className="col-span-2 flex justify-end">
                   <span className={cn(
                      "px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider border",
                      wh.status === 'Active' ? "bg-emerald-50 text-emerald-700 border-emerald-200" :
                      "bg-slate-100 text-slate-700 border-slate-200"
                   )}>
                      {wh.status}
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
