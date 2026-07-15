import React, { useState } from 'react';
import { Tags, Tag } from 'lucide-react';
import { cn } from '../../lib/utils';

export default function TagsDimensions() {
  const [activeTab, setActiveTab] = useState<'dimensions'>('dimensions');

  const dimensions: any[] = [];

  return (
    <div className="h-full flex flex-col bg-[#FAFAFA]">
      <div className="px-8 py-6 bg-slate-900 text-white flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-3">
            <Tags className="w-6 h-6 text-fuchsia-400" />
            Tags & Dimensions
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Create lightweight tracking dimensions without polluting the chart of accounts.
          </p>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-8">
        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
          <div className="grid grid-cols-12 p-4 bg-slate-50 border-b border-slate-200 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
            <div className="col-span-3">Dimension Name</div>
            <div className="col-span-5">Allowed Values (Tags)</div>
            <div className="col-span-2 text-center">Status</div>
            <div className="col-span-2 text-right">Requirement</div>
          </div>
          <div className="divide-y divide-slate-200">
            {dimensions.map(dim => (
              <div key={dim.id} className="grid grid-cols-12 p-4 items-center hover:bg-slate-50 transition-colors">
                <div className="col-span-3">
                  <div className="font-bold text-slate-900">{dim.name}</div>
                  <div className="text-[10px] font-mono text-slate-400 mt-0.5">{dim.id}</div>
                </div>
                <div className="col-span-5 flex flex-wrap gap-2">
                   {dim.values.map((v: any) => (
                      <span key={v} className="px-2 py-1 bg-slate-100 border border-slate-200 rounded text-[10px] font-bold text-slate-600 flex items-center gap-1">
                         <Tag className="w-3 h-3" /> {v}
                      </span>
                   ))}
                </div>
                <div className="col-span-2 flex justify-center">
                   <span className="px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider bg-emerald-50 text-emerald-700 border border-emerald-200">
                      Active
                   </span>
                </div>
                <div className="col-span-2 flex justify-end">
                   <span className={cn(
                      "px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider border",
                      dim.required ? "bg-rose-50 text-rose-700 border-rose-200" : "bg-slate-100 text-slate-700 border-slate-200"
                   )}>
                      {dim.required ? 'Required' : 'Optional'}
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
