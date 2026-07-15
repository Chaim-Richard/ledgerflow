import React, { useState } from 'react';
import { FileText, Folder, Lock, History } from 'lucide-react';
import { cn } from '../../lib/utils';

export default function DocumentManager() {
  const [activeTab, setActiveTab] = useState<'files' | 'audit'>('files');

  const files: any[] = [];

  return (
    <div className="h-full flex flex-col bg-[#FAFAFA]">
      <div className="px-8 py-6 bg-slate-900 text-white flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-3">
            <FileText className="w-6 h-6 text-indigo-400" />
            Document Management (DMS)
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Secure vault for corporate documents, contracts, and compliance records.
          </p>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-8">
        <div className="flex p-1 bg-white border border-slate-200 rounded-xl shadow-sm hover:shadow-md transition-shadow duration-200 mb-6 w-max">
          {[
            { id: 'files', label: 'File Repository', icon: Folder },
            { id: 'audit', label: 'Access Audit Log', icon: History }
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

        {activeTab === 'files' && (
          <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
            <div className="grid grid-cols-12 p-4 bg-slate-50 border-b border-slate-200 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
              <div className="col-span-4">File Name</div>
              <div className="col-span-2 text-right">Size</div>
              <div className="col-span-2 text-center">Owner</div>
              <div className="col-span-2 text-right">Upload Date</div>
              <div className="col-span-2 text-right">Security</div>
            </div>
            <div className="divide-y divide-slate-200">
              {files.map(file => (
                <div key={file.id} className="grid grid-cols-12 p-4 items-center hover:bg-slate-50 transition-colors cursor-pointer">
                  <div className="col-span-4 flex items-center gap-3">
                    <div className={cn("p-2 rounded-lg", file.type === 'PDF' ? "bg-rose-50 text-rose-600" : "bg-blue-50 text-blue-600")}>
                       <FileText className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="font-bold text-slate-900">{file.name}</div>
                      <div className="text-[10px] font-mono text-slate-400 mt-0.5">{file.id}</div>
                    </div>
                  </div>
                  <div className="col-span-2 text-right text-xs font-mono text-slate-500">
                     {file.size}
                  </div>
                  <div className="col-span-2 text-center text-xs font-bold text-slate-700">
                    {file.owner}
                  </div>
                  <div className="col-span-2 text-right text-xs font-mono text-slate-600">
                     {file.date}
                  </div>
                  <div className="col-span-2 flex justify-end">
                    <span className={cn(
                      "px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider border flex items-center gap-1",
                      file.status === 'Secured' ? "bg-indigo-50 text-indigo-700 border-indigo-200" :
                      file.status === 'Archived' ? "bg-slate-100 text-slate-700 border-slate-200" :
                      "bg-emerald-50 text-emerald-700 border-emerald-200"
                    )}>
                      {file.status === 'Secured' && <Lock className="w-3 h-3" />}
                      {file.status}
                    </span>
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
