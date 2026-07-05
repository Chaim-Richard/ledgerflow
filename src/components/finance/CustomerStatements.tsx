import React, { useState } from 'react';
import { FileText, Download, Mail, CheckCircle2 } from 'lucide-react';
import { cn } from '../../lib/utils';

export default function CustomerStatements() {
  const [activeTab, setActiveTab] = useState<'statements'>('statements');

  const statements: any[] = [];

  return (
    <div className="h-full flex flex-col bg-[#FAFAFA]">
      <div className="px-8 py-6 bg-slate-900 text-white flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-3">
            <FileText className="w-6 h-6 text-indigo-400" />
            Customer Account Statements
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Generate and dispatch monthly summaries of all open invoices, payments, and credits.
          </p>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-8">
        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
          <div className="grid grid-cols-12 p-4 bg-slate-50 border-b border-slate-200 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
            <div className="col-span-4">Customer / Statement Ref</div>
            <div className="col-span-2 text-center">Period</div>
            <div className="col-span-2 text-right">Closing Balance</div>
            <div className="col-span-2 text-center">Dispatch Status</div>
            <div className="col-span-2 text-right">Actions</div>
          </div>
          <div className="divide-y divide-slate-200">
            {statements.map(s => (
              <div key={s.id} className="grid grid-cols-12 p-4 items-center hover:bg-slate-50 transition-colors">
                <div className="col-span-4">
                  <div className="font-bold text-slate-900">{s.customer}</div>
                  <div className="text-[10px] font-mono text-slate-400 mt-0.5">{s.id}</div>
                </div>
                <div className="col-span-2 text-center text-xs font-mono font-bold text-slate-700">
                  {s.period}
                </div>
                <div className="col-span-2 text-right font-bold font-mono text-slate-900">
                  ${s.balance.toLocaleString()}
                </div>
                <div className="col-span-2 flex justify-center">
                   <span className={cn(
                      "px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider border",
                      s.emailStatus === 'Sent' ? "bg-emerald-50 text-emerald-700 border-emerald-200" :
                      "bg-amber-50 text-amber-700 border-amber-200"
                   )}>
                      {s.emailStatus}
                   </span>
                </div>
                <div className="col-span-2 flex justify-end gap-2">
                   <button className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded transition-colors"><Download className="w-4 h-4" /></button>
                   <button className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded transition-colors"><Mail className="w-4 h-4" /></button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
