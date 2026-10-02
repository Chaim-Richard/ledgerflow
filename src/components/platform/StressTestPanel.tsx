
import { Terminal, ShieldCheck, Cpu, Wrench, Play } from 'lucide-react';

import { cn } from '../../lib/utils';

import { withOccurrenceKeys } from './SystemCommandCenterShared';
import type { SystemCommandCenterModel } from './SystemCommandCenter';
export function StressTestPanel({ model }: { model: SystemCommandCenterModel }) {
 const { simulatedLogs, setSimulatedLogs, handleTriggerStressEvent, liveErrors } = model;
 return (<div className="space-y-6">
            {/* Stress Test Generator Panel */}
            <div className="bg-slate-900 border border-slate-800 text-white rounded-[32px] p-4 md:p-8 shadow-lg relative overflow-hidden">
              <div className="absolute inset-0 technical-grid opacity-[0.03] pointer-events-none" />
              <div className="flex items-center gap-3 mb-4 pb-2 border-b border-white/10">
                <Wrench aria-hidden="true" className="text-pink-400 animate-spin-slow" size={18} />
                <h2 className="text-sm font-black uppercase tracking-wider text-pink-400">Stress Test Injector</h2>
              </div>
              <p className="text-[10px] text-white/50 uppercase font-black mb-4 leading-relaxed">
                Manually dispatch synthetic test requests to visualize real-time error piping, quota exception handling, and diagnostic reporting on the dashboard.
              </p>
              <div className="flex flex-col gap-2">
                <button
                  type="button"
                  onClick={() => handleTriggerStressEvent('normal_gemini')}
                  className="w-full py-2.5 bg-[var(--surface)]/5 hover:bg-[var(--surface)]/10 rounded-xl text-[9px] font-black uppercase text-white hover:text-indigo-300 transition-all text-left px-4 flex items-center justify-between"
                >
                  <span>1. POST /gemini/summarize (200 OK)</span>
                  <Play aria-hidden="true" size={10} className="text-indigo-400" />
                </button>
                <button
                  type="button"
                  onClick={() => handleTriggerStressEvent('quota_low')}
                  className="w-full py-2.5 bg-amber-500/10 hover:bg-amber-500/20 rounded-xl text-[9px] font-black uppercase text-amber-300 border border-amber-500/20 transition-all text-left px-4 flex items-center justify-between"
                >
                  <span>2. GET /transactions/ledger_audit (429 Rate Exceeded)</span>
                  <Play aria-hidden="true" size={10} className="text-amber-400 animate-pulse" />
                </button>
                <button
                  type="button"
                  onClick={() => handleTriggerStressEvent('db_timeout')}
                  className="w-full py-2.5 bg-rose-500/10 hover:bg-rose-500/20 rounded-xl text-[9px] font-black uppercase text-rose-300 border border-rose-500/20 transition-all text-left px-4 flex items-center justify-between"
                >
                  <span>3. GET /admin/telemetry (503 Service Unavailable)</span>
                  <Play aria-hidden="true" size={10} className="text-rose-400 animate-pulse" />
                </button>
              </div>
            </div>

            {/* Diagnostic Logs Panel */}
            <div className="bg-[var(--surface)] border border-[var(--line)] rounded-[32px] p-4 md:p-8 shadow-3xs flex flex-col h-[520px]">
              <div className="flex items-center justify-between pb-4 border-b border-[var(--line)] mb-4">
                <div className="flex items-center gap-3">
                  <Terminal aria-hidden="true" size={18} className="text-indigo-600 animate-pulse" />
                  <h2 className="text-base font-black uppercase tracking-tight italic text-[var(--text)]">Event Logging Stream</h2>
                </div>
                <div className="flex h-2.5 w-2.5 relative">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-indigo-500"></span>
                </div>
              </div>

              {/* Log filter toggles */}
              <div className="flex gap-1 mb-4 bg-slate-100 p-1 rounded-xl">
                <button
                  type="button"
                  className="flex-1 py-1 text-[8px] font-black uppercase tracking-wider rounded-lg bg-[var(--surface)] text-[var(--text)] shadow-3xs"
                 aria-label={`Latest events (${liveErrors.length})`}>
                  Latest Events ({liveErrors.length})
                </button>
                {simulatedLogs.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setSimulatedLogs([])}
                    className="px-2 py-1 text-[8px] font-black uppercase tracking-wider rounded-lg text-rose-600 hover:bg-rose-50 transition"
                  >
                    Clear Sim
                  </button>
                )}
              </div>

              <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar space-y-3 font-mono text-[10px]">
                {liveErrors.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-[var(--muted)] opacity-50 gap-2 text-center p-4">
                    <ShieldCheck aria-hidden="true" size={36} className="text-emerald-500" />
                    <p className="text-[10px] font-black uppercase tracking-wider text-slate-700">Audit pipeline is empty</p>
                    <p className="text-[9px] lowercase max-w-[170px]">Invoke client endpoints to stream event triggers.</p>
                  </div>
                ) : (
                  withOccurrenceKeys(liveErrors, log => log.id || JSON.stringify([log.timestamp, log.method, log.path, log.statusCode, log.ip, log.apiKeyUsed])).map(({ item: log, key }) => {
                    const isError = log.statusCode >= 500;
                    const isWarning = log.statusCode === 429;
                    return (
                      <div
                        key={key}
                        className={cn(
                          "p-4 border rounded-[32px] relative overflow-hidden shadow-3xs transition-all",
                          isError ? "bg-rose-50/50 border-rose-150" :
                          isWarning ? "bg-amber-50/50 border-amber-150" :
                          "bg-[var(--ink)] border-slate-150"
                        )}
                      >
                        <div className="flex justify-between items-center mb-2">
                          <span className={cn(
                            "text-[8px] font-bold px-1.5 py-0.5 rounded-md border",
                            isError ? "bg-rose-50 text-rose-700 border-rose-200" :
                            isWarning ? "bg-amber-50 text-amber-700 border-amber-200" :
                            "bg-indigo-50 text-indigo-700 border-indigo-200"
                          )}>
                            HTTP_{log.statusCode} {log.simulated && '[SIMULATED]'}
                          </span>
                          <span className="text-[var(--muted)] text-[8px] uppercase font-bold">
                            {new Date(log.timestamp).toLocaleTimeString()}
                          </span>
                        </div>
                        <div className="mb-2 font-black text-[var(--text)] break-all leading-tight text-xs">
                          <span className={cn(
                            "font-bold mr-1.5",
                            isError ? "text-rose-600" : isWarning ? "text-amber-600" : "text-indigo-600"
                          )}>{log.method}</span> {log.path}
                        </div>
                        <div className="space-y-0.5 text-[8px] text-[var(--muted)] font-semibold uppercase tracking-wider pt-1.5 border-t border-[var(--line)]">
                          <div>Source Node: {log.ip}</div>
                          <div className="truncate">Client Ref: {log.apiKeyUsed}</div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* Platform spec box */}
            <div className="bg-slate-900 text-white rounded-[32px] p-4 md:p-8 relative overflow-hidden group">
              <div className="absolute technical-grid inset-0 opacity-[0.05]" />
              <Cpu aria-hidden="true" size={32} className="text-emerald-400 mb-4" />
              <h4 className="text-lg font-black tracking-tight italic uppercase mb-1">Decentralized Trust Hook</h4>
              <p className="text-[10px] font-medium text-white/40 leading-relaxed uppercase tracking-widest leading-loose">
                Real-time cryptographic pipeline audits. Mutex locks prevent race overrides, securing multi-tenant ledger synchronization bounds on memory channels.
              </p>
            </div>
          </div>);
}
