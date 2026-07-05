import React, { useState, useEffect } from 'react';
import { Bot, Zap, Play, Square, Settings, ShieldAlert, Cpu, Activity, ListChecks, ArrowRightLeft } from 'lucide-react';
import { cn } from '../../lib/utils';
import { combineStringSimilarity } from '../../lib/algorithms/fuzzy';
import { calculateZScore, mean, standardDeviation } from '../../lib/algorithms/math';

export default function LedgerAutoPilot() {
  const [activeTab, setActiveTab] = useState<'console' | 'rules' | 'anomalies'>('console');
  const [isRunning, setIsRunning] = useState(false);
  const [logs, setLogs] = useState<{id: string, time: string, message: string, type: 'info' | 'success' | 'warn' | 'error'}[]>([]);

  useEffect(() => {
     let interval: any;
     if (isRunning) {
        interval = setInterval(() => {
           const actions: any[] = [];
           const randomAction = actions[Math.floor(Math.random() * actions.length)];
           setLogs(prev => [{
              id: Math.random().toString(36).substring(7),
              time: new Date().toLocaleTimeString(),
              message: randomAction.msg,
              type: randomAction.type as any
           }, ...prev].slice(0, 50));
        }, 3000);
     }
     return () => clearInterval(interval);
  }, [isRunning]);

  return (
    <div className="h-full flex flex-col bg-[#FAFAFA]">
      <div className="px-8 py-6 bg-slate-900 text-white flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-3">
            <Bot className="w-6 h-6 text-fuchsia-400" />
            Autonomous Ledger AutoPilot
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Continuous background processing, intelligent reconciliation, and algorithmic corrections.
          </p>
        </div>
        <div className="flex items-center gap-4">
           {isRunning ? (
              <button onClick={() => setIsRunning(false)} className="h-10 px-4 bg-rose-500 text-white rounded-xl text-sm font-bold flex items-center gap-2 hover:bg-rose-400 transition-colors shadow-[0_0_15px_rgba(244,63,94,0.5)]">
                 <Square className="w-4 h-4 fill-current" /> Stop AutoPilot
              </button>
           ) : (
              <button onClick={() => setIsRunning(true)} className="h-10 px-4 bg-fuchsia-500 text-white rounded-xl text-sm font-bold flex items-center gap-2 hover:bg-fuchsia-400 transition-colors shadow-[0_0_15px_rgba(217,70,239,0.5)]">
                 <Play className="w-4 h-4 fill-current" /> Engage AutoPilot
              </button>
           )}
        </div>
      </div>

      <div className="flex-1 overflow-auto p-8">
        <div className="flex p-1 bg-white border border-slate-200 rounded-xl shadow-sm mb-6 w-max">
          {[
            { id: 'console', label: 'Live Agent Console', icon: Activity },
            { id: 'rules', label: 'Heuristic Rules', icon: Settings },
            { id: 'anomalies', label: 'Quarantine Queue', icon: ShieldAlert }
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

        {activeTab === 'console' && (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl flex flex-col h-[600px]">
             <div className="p-4 border-b border-slate-800 bg-slate-900/50 flex items-center justify-between">
                <div className="flex items-center gap-3">
                   <div className="relative flex h-3 w-3">
                     {isRunning && <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-fuchsia-400 opacity-75"></span>}
                     <span className={cn("relative inline-flex rounded-full h-3 w-3", isRunning ? "bg-fuchsia-500" : "bg-slate-600")}></span>
                   </div>
                   <h2 className="text-sm font-bold font-mono text-slate-300">SYSTEM.AUTOPILOT.PROCESS_STDOUT</h2>
                </div>
                <div className="text-xs font-mono text-fuchsia-400">UPTIME: 99.99%</div>
             </div>
             <div className="flex-1 p-6 font-mono text-xs overflow-y-auto space-y-2">
                {logs.length === 0 && (
                   <div className="text-slate-600 italic">Waiting for AutoPilot engagement...</div>
                )}
                {logs.map(log => (
                   <div key={log.id} className="flex gap-4 items-start">
                      <div className="text-slate-500 shrink-0">[{log.time}]</div>
                      <div className={cn(
                         "flex-1",
                         log.type === 'info' ? 'text-slate-300' :
                         log.type === 'success' ? 'text-emerald-400' :
                         log.type === 'warn' ? 'text-amber-400' : 'text-rose-400'
                      )}>
                         {log.type === 'success' && <span className="mr-2">✓</span>}
                         {log.type === 'warn' && <span className="mr-2">⚠</span>}
                         {log.type === 'error' && <span className="mr-2">✗</span>}
                         {log.message}
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
