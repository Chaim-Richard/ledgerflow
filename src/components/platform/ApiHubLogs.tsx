

import { RefreshCw, Activity, FileText } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '../../lib/utils';


import type { useApiHubModel } from './useApiHubModel';
export function ApiHubLogs({ model }: { model: ReturnType<typeof useApiHubModel> }) {
 const { apiLogs, fetchLogs } = model;
 return (<div className="ledger-card p-6 space-y-6 animate-in fade-in duration-300 shadow-sm">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[var(--line)] pb-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-50 text-indigo-600 flex items-center justify-center">
                <FileText aria-hidden="true" size={20} />
              </div>
              <div>
                <h3 className="font-header font-bold text-[var(--text)]">API Pipeline Chronological Logs</h3>
                <p className="text-xs text-[var(--muted)] font-medium">Diagnostic ledger feed & key consumption audits.</p>
              </div>
            </div>

            <div className="flex flex-wrap gap-2 items-center">
              <button
                onClick={fetchLogs}
                className="p-2 bg-[var(--ink)] border border-[var(--line)] text-slate-700 rounded-lg hover:bg-slate-100 transition-all flex items-center gap-1.5 text-xs font-bold shrink-0 cursor-pointer"
               aria-label="Sync Feed">
                <RefreshCw aria-hidden="true" size={12} /> Sync Feed
              </button>
            </div>
          </div>

          {/* Table display */}
          {apiLogs.length === 0 ? (
            <div className="py-12 text-center border border-slate-150 bg-[var(--ink)]/50 rounded-[32px]">
              <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-3">
                <Activity aria-hidden="true" size={20} className="text-[var(--muted)]" />
              </div>
              <p className="text-xs text-[var(--muted)] font-medium italic">No integration API requests have been processed in this workspace yet.</p>
              <p className="text-[10px] text-[var(--muted)] mt-1">Make API queries via the <strong>Playground Sandbox</strong> or integrations to populate this monitor.</p>
            </div>
          ) : (
            <div className="border border-slate-150 rounded-[32px] shadow-3xs overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <caption className="sr-only">API request log</caption>
                  <thead className="bg-[#FAFBFB] border-b border-slate-150 text-[10px] text-[var(--muted)] uppercase tracking-wider font-extrabold">
                    <tr>
                      <th scope="col" className="p-4">Timestamp</th>
                      <th scope="col" className="p-4">Request Specs</th>
                      <th scope="col" className="p-4">Key Credit Cost</th>
                      <th scope="col" className="p-4">API Origin Credentials</th>
                      <th scope="col" className="p-4">Status</th>
                      <th scope="col" className="p-4 text-right">Details</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-[var(--surface)]">
                    {apiLogs.map((log) => {
                      const isSuccess = log.statusCode >= 200 && log.statusCode < 300;
                      return (
                        <tr key={log.id} className="hover:bg-[var(--ink)]/50 transition-colors">
                          <td className="p-4 whitespace-nowrap text-xs font-mono font-bold text-slate-450 text-[11px]">
                            {log.timestamp ? new Date(log.timestamp).toLocaleTimeString() : new Date().toLocaleTimeString()}
                          </td>
                          <td className="p-4">
                            <div className="flex items-center gap-2.5">
                              <span className={cn(
                                "px-2 py-0.5 rounded text-[9px] font-medium uppercase tracking-wider font-mono text-white",
                                log.method === 'POST' ? "bg-emerald-500" :
                                log.method === 'PUT' ? "bg-amber-500" :
                                log.method === 'DELETE' ? "bg-rose-500" : "bg-blue-500"
                              )}>
                                {log.method || 'GET'}
                              </span>
                              <span className="font-mono text-xs text-[var(--text)] font-bold max-w-[200px] truncate">{log.path || '/api/v1/status'}</span>
                            </div>
                          </td>
                          <td className="p-4 whitespace-nowrap">
                            <span className="text-xs font-mono font-bold text-slate-700 bg-purple-50 px-2 py-0.5 rounded border border-purple-100">
                              {log.method === 'POST' && log.path.includes('brain') ? '10 cr' : log.method === 'POST' ? '3 cr' : '1 cr'}
                            </span>
                          </td>
                          <td className="p-4 whitespace-nowrap">
                            <span className="text-[11px] font-mono bg-[var(--ink)] text-slate-600 px-2 py-0.5 rounded border border-[var(--line)]">
                              {log.apiKeyUsed === 'Active Admin Session' ? '🖥️ Admin Session' : `🔑 Key: lf_id_${String(log.apiKeyUsed).slice(-6)}`}
                            </span>
                          </td>
                          <td className="p-4 whitespace-nowrap">
                            <span className={cn(
                              "px-2 py-0.5 rounded-full text-[9px] font-black tracking-wide font-mono uppercase text-white",
                              isSuccess ? "bg-emerald-500" : "bg-rose-500"
                            )}>
                              {log.statusCode} {isSuccess ? 'Success' : 'Error'}
                            </span>
                          </td>
                          <td className="p-4 text-right">
                            <button
                              onClick={() => {
                                toast.info("API Frame Inspected", {
                                  description: <div className="font-mono text-[9px] text-left overflow-x-auto max-h-[140px] bg-slate-900 text-slate-200 p-2 rounded mt-2">{JSON.stringify(log, null, 2)}</div>,
                                  duration: 6000
                                });
                              }}
                              className="text-xs font-bold text-indigo-600 hover:underline bg-transparent border-0 cursor-pointer"
                            >
                              Inspect Raw
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>);
}
