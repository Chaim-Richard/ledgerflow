import React, { useState } from 'react';
import { Globe } from 'lucide-react';
import { cn } from '../../lib/utils';

export default function CustomerPortalSettings() {
  const [activeTab, setActiveTab] = useState<'portal'>('portal');

  const settings: any[] = [];

  return (
    <div className="h-full flex flex-col bg-[#FAFAFA]">
      <div className="px-8 py-6 bg-slate-900 text-white flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-3">
            <Globe className="w-6 h-6 text-sky-400" />
            Customer Portal Configuration
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Configure the features available to your clients in their dedicated self-service portal.
          </p>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-8">
        <div className="max-w-2xl mx-auto bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
          <div className="p-6 border-b border-slate-200">
             <h2 className="text-lg font-bold text-slate-900">Feature Toggles</h2>
             <p className="text-sm text-slate-500">Enable or disable self-service features for your customers.</p>
          </div>
          <div className="divide-y divide-slate-200">
            {settings.map(s => (
              <div key={s.id} className="p-6 flex items-center justify-between hover:bg-slate-50 transition-colors">
                <div>
                  <div className="font-bold text-slate-900">{s.name}</div>
                </div>
                <div>
                   <div className={cn(
                      "relative inline-flex h-6 w-11 items-center rounded-full transition-colors cursor-pointer",
                      s.value ? "bg-sky-500" : "bg-slate-300"
                   )}>
                      <span className={cn(
                         "inline-block h-4 w-4 transform rounded-full bg-white transition-transform",
                         s.value ? "translate-x-6" : "translate-x-1"
                      )}/>
                   </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
