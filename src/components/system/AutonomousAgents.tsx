import React, { useState } from 'react';
import { Cpu, Zap, Activity, ShieldAlert, ArrowRight, Play, Square, Settings2 } from 'lucide-react';
import { cn } from '../../lib/utils';
import { useLedgerStore } from '../../stores/useLedgerStore';

export default function AutonomousAgents() {
  const [agents, setAgents] = useState<any[]>([]);

  const toggleAgent = (id: string) => {
    setAgents(agents.map(a => a.id === id ? { ...a, active: !a.active } : a));
  };

  return (
    <div className="h-full flex flex-col bg-[#FAFAFA] dark:bg-[#0c0d0e]">
      <div className="px-8 py-6 bg-slate-900 text-white flex justify-between items-start border-b border-slate-800">
        <div>
          <h1 className="text-2xl font-black uppercase italic tracking-tighter flex items-center gap-3">
            <Cpu className="w-6 h-6 text-blue-400" />
            Autonomous Agent Daemons
          </h1>
          <p className="text-sm text-blue-400/80 mt-1 uppercase tracking-widest font-bold">
            Copilot Cowork Background Execution
          </p>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-8 space-y-6 custom-scrollbar">
        <div className="bg-blue-50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-800 rounded-2xl p-6 mb-8">
           <h4 className="text-sm font-bold text-blue-900 dark:text-blue-400 uppercase tracking-widest flex items-center gap-2 mb-2">
             <Activity className="w-4 h-4" /> Agentic Event-Driven Architecture
           </h4>
           <p className="text-sm text-blue-800 dark:text-blue-500 leading-relaxed max-w-3xl">
             LedgerFlow operates autonomous daemons in sandboxed containers. Unlike rules-based scripts, these agents run logistic regression loops and probabilistic risk models to determine optimal financial action—executing multi-step dunning operations or treasury sweeps independently without manual oversight.
           </p>
        </div>

        <div className="grid grid-cols-1 gap-6">
          {agents.map(agent => (
            <div key={agent.id} className={cn("bg-white dark:bg-[#161718] border rounded-3xl p-6 shadow-sm transition-all", agent.active ? "border-blue-200 dark:border-blue-800" : "border-slate-200 dark:border-slate-800 opacity-75")}>
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="text-lg font-black uppercase tracking-wider text-slate-900 dark:text-white flex items-center gap-2">
                    {agent.name}
                    {agent.active && <span className="flex h-2 w-2 rounded-full bg-blue-500 animate-pulse ml-2" />}
                  </h3>
                  <p className="text-sm text-slate-500 mt-1 max-w-2xl">{agent.desc}</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs font-bold uppercase text-slate-400">Last Run: {agent.lastRun}</span>
                  <button onClick={() => toggleAgent(agent.id)} className={cn("h-8 px-4 rounded-lg text-xs font-bold uppercase tracking-wider flex items-center gap-2 transition-colors", agent.active ? "bg-slate-100 text-slate-700 hover:bg-slate-200" : "bg-blue-600 text-white hover:bg-blue-500")}>
                    {agent.active ? <><Square className="w-3 h-3" /> Stop</> : <><Play className="w-3 h-3" /> Start</>}
                  </button>
                  <button className="h-8 w-8 flex items-center justify-center bg-slate-100 text-slate-600 rounded-lg hover:bg-slate-200">
                    <Settings2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="bg-slate-900 rounded-xl p-4 font-mono text-xs text-blue-400 space-y-1">
                {agent.logs?.map((log: any, i: number) => (
                  <div key={i} className="flex gap-2">
                    <span className="text-slate-600 opacity-50">&gt;</span> {log}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
