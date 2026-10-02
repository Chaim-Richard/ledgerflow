

import { cn } from '../../lib/utils';


import type { useApiHubModel } from './useApiHubModel';
export function ApiHubNavigation({ model }: { model: ReturnType<typeof useApiHubModel> }) {
 const { activeTab, setActiveTab, loadBillingStatus, fetchLogs } = model;
 return (<div className="flex bg-[var(--ink)] border border-slate-150 p-1.5 rounded-xl gap-1 mb-6 max-w-4xl shrink-0 overflow-x-auto">
        <button
          onClick={() => setActiveTab('overview')}
          className={cn(
            "flex-1 py-1 px-3 text-[11px] font-black uppercase tracking-wider rounded-lg transition-all text-center whitespace-nowrap cursor-pointer",
            activeTab === 'overview' ? "bg-[var(--surface)] text-[var(--text)] shadow-2xs border border-[var(--line)] font-bold" : "text-[var(--muted)] hover:text-[var(--text)]"
          )}
        >
          Overview
        </button>
        <button
          onClick={() => setActiveTab('keys')}
          className={cn(
            "flex-1 py-1 px-3 text-[11px] font-black uppercase tracking-wider rounded-lg transition-all text-center whitespace-nowrap cursor-pointer",
            activeTab === 'keys' ? "bg-[var(--surface)] text-[var(--text)] shadow-2xs border border-[var(--line)] font-bold" : "text-[var(--muted)] hover:text-[var(--text)]"
          )}
        >
          Auth Keys
        </button>
        <button
          onClick={() => setActiveTab('docs')}
          className={cn(
            "flex-1 py-1 px-3 text-[11px] font-black uppercase tracking-wider rounded-lg transition-all text-center whitespace-nowrap cursor-pointer",
            activeTab === 'docs' ? "bg-[var(--surface)] text-[var(--text)] shadow-2xs border border-[var(--line)] font-bold" : "text-[var(--muted)] hover:text-[var(--text)]"
          )}
        >
          Docs
        </button>
        <button
          onClick={() => setActiveTab('sandbox')}
          className={cn(
            "flex-1 py-1 px-3 text-[11px] font-black uppercase tracking-wider rounded-lg transition-all text-center whitespace-nowrap cursor-pointer",
            activeTab === 'sandbox' ? "bg-[var(--surface)] text-[var(--text)] shadow-2xs border border-[var(--line)] font-bold text-emerald-500 font-black" : "text-[var(--muted)] hover:text-[var(--text)]"
          )}
        >
          ⚡ Playground Sandbox
        </button>
        <button
          onClick={() => {
            setActiveTab('logs');
            fetchLogs();
          }}
          className={cn(
            "flex-1 py-1 px-3 text-[11px] font-black uppercase tracking-wider rounded-lg transition-all text-center whitespace-nowrap cursor-pointer",
            activeTab === 'logs' ? "bg-[var(--surface)] text-[var(--text)] shadow-2xs border border-[var(--line)] font-bold text-indigo-400" : "text-[var(--muted)] hover:text-[var(--text)]"
          )}
        >
          API Logs
        </button>
        <button
          onClick={() => {
            setActiveTab('billing');
            loadBillingStatus();
          }}
          className={cn(
            "flex-1 py-1 px-3 text-[11px] font-black uppercase tracking-wider rounded-lg transition-all text-center whitespace-nowrap cursor-pointer",
            activeTab === 'billing' ? "bg-[var(--surface)] text-[var(--text)] shadow-2xs border border-[var(--line)] font-bold text-[var(--brass)]" : "text-[var(--muted)] hover:text-[var(--text)]"
          )}
        >
          Compute Metering
        </button>
      </div>);
}
