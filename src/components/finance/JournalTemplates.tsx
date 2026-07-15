import React, { useState } from 'react';
import { Copy, Plus, FileText } from 'lucide-react';

export default function JournalTemplates() {
  const [activeTab, setActiveTab] = useState<'templates'>('templates');

  const templates: any[] = [];

  return (
    <div className="h-full flex flex-col bg-[#FAFAFA]">
      <div className="px-8 py-6 bg-slate-900 text-white flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-3">
            <Copy className="w-6 h-6 text-indigo-400" />
            Journal Entry Templates
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Create standard templates for fast data entry of routine journals.
          </p>
        </div>
        <button className="h-10 px-4 bg-indigo-500 text-white rounded-xl text-sm font-bold flex items-center gap-2 hover:bg-indigo-400 transition-colors">
           <Plus className="w-4 h-4" /> New Template
        </button>
      </div>

      <div className="flex-1 overflow-auto p-8">
        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
          <div className="grid grid-cols-12 p-4 bg-slate-50 border-b border-slate-200 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
            <div className="col-span-4">Template Name</div>
            <div className="col-span-2 text-center">Lines</div>
            <div className="col-span-2 text-center">Type</div>
            <div className="col-span-2 text-center">Last Used</div>
            <div className="col-span-2 text-right">Actions</div>
          </div>
          <div className="divide-y divide-slate-200">
            {templates.map(tpl => (
              <div key={tpl.id} className="grid grid-cols-12 p-4 items-center hover:bg-slate-50 transition-colors">
                <div className="col-span-4 flex items-center gap-3">
                  <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
                     <FileText className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="font-bold text-slate-900">{tpl.name}</div>
                    <div className="text-[10px] font-mono text-slate-400 mt-0.5">{tpl.id}</div>
                  </div>
                </div>
                <div className="col-span-2 text-center font-mono text-sm text-slate-700">
                  {tpl.lines}
                </div>
                <div className="col-span-2 text-center">
                   <span className="px-2 py-1 bg-slate-100 border border-slate-200 rounded text-[10px] font-bold uppercase tracking-wider text-slate-600">
                      {tpl.type}
                   </span>
                </div>
                <div className="col-span-2 text-center text-xs font-mono text-slate-500">
                   {tpl.lastUsed}
                </div>
                <div className="col-span-2 flex justify-end gap-2">
                   <button className="px-3 py-1.5 text-indigo-600 bg-indigo-50 border border-indigo-200 rounded-lg text-xs font-bold hover:bg-indigo-100 transition-colors">
                      Use Template
                   </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
