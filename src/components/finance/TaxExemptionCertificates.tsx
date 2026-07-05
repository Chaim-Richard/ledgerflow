import React, { useState } from 'react';
import { ShieldCheck, FileText, AlertTriangle, Building2 } from 'lucide-react';
import { cn } from '../../lib/utils';

export default function TaxExemptionCertificates() {
  const [activeTab, setActiveTab] = useState<'certificates'>('certificates');

  const certificates: any[] = [];

  return (
    <div className="h-full flex flex-col bg-[#FAFAFA]">
      <div className="px-8 py-6 bg-slate-900 text-white flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-3">
            <ShieldCheck className="w-6 h-6 text-sky-400" />
            Tax Exemption Certificates
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Manage customer tax-exempt statuses, resale certificates, and expiration dates.
          </p>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-8">
        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
          <div className="grid grid-cols-12 p-4 bg-slate-50 border-b border-slate-200 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
            <div className="col-span-4">Customer / ID</div>
            <div className="col-span-2 text-center">Jurisdiction</div>
            <div className="col-span-2 text-center">Exemption Type</div>
            <div className="col-span-2 text-center">Valid Until</div>
            <div className="col-span-2 text-right">Status</div>
          </div>
          <div className="divide-y divide-slate-200">
            {certificates.map(c => (
              <div key={c.id} className="grid grid-cols-12 p-4 items-center hover:bg-slate-50 transition-colors">
                <div className="col-span-4">
                  <div className="font-bold text-slate-900">{c.customer}</div>
                  <div className="text-[10px] font-mono text-slate-400 mt-0.5">{c.id}</div>
                </div>
                <div className="col-span-2 text-center text-xs font-bold font-mono text-slate-700 bg-slate-50 py-1 rounded inline-block w-max mx-auto">
                  {c.state}
                </div>
                <div className="col-span-2 text-center text-xs text-slate-600">
                  {c.type}
                </div>
                <div className="col-span-2 text-center font-mono text-xs font-bold text-slate-700">
                   {c.expiry}
                </div>
                <div className="col-span-2 flex justify-end">
                   <span className={cn(
                      "px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider border",
                      c.status === 'Valid' ? "bg-emerald-50 text-emerald-700 border-emerald-200" :
                      "bg-rose-50 text-rose-700 border-rose-200"
                   )}>
                      {c.status}
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
