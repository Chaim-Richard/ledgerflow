import React, { useState } from 'react';
import { Zap, ShieldCheck, Mail, Workflow, CheckCircle, Package, AlertTriangle, Clock, Copy, Trash2, Power, Pause } from 'lucide-react';
import { toast } from 'sonner';
import { useLedgerStore } from '../../stores/useLedgerStore';

export default function ProcessAutomationHub() {
  const { autoRules } = useLedgerStore();
  const [workflows, setWorkflows] = useState<any[]>(autoRules?.length ? autoRules : []);

  const toggleStatus = (id: string) => {
    setWorkflows(workflows.map(w => {
       if(w.id === id) {
          const newStatus = w.status === 'active' ? 'paused' : 'active';
          toast.success(`Workflow ${newStatus}`);
          return { ...w, status: newStatus };
       }
       return w;
    }));
  };

  const deleteWorkflow = (id: string) => {
    setWorkflows(workflows.filter(w => w.id !== id));
    toast.success('Workflow deleted');
  };

  const cloneWorkflow = (wf: any) => {
    setWorkflows([...workflows, { ...wf, id: `wf-${Date.now()}`, name: `${wf.name} (Copy)`, status: 'paused' }]);
    toast.success('Workflow cloned');
  };

  return (
    <div className="space-y-6 h-full flex flex-col">
       <div className="flex items-center justify-between">
          <div>
             <h2 className="text-3xl font-black text-zinc-900 tracking-tighter">Process Automation</h2>
             <p className="text-zinc-500 font-medium">Configure workflow rules, approval chains, and alerts.</p>
          </div>
          <button className="flex items-center gap-2 px-6 py-3 bg-zinc-900 text-white rounded-xl font-bold hover:bg-zinc-800 transition shadow-lg shadow-zinc-900/20">
             <Zap size={16} /> New Workflow
          </button>
       </div>

       <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white border border-zinc-200 p-4 rounded-[32px] flex items-center justify-between">
             <div className="flex gap-4 items-center">
                <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-[32px] flex items-center justify-center"><Workflow /></div>
                <div>
                   <div className="text-2xl font-black font-mono">14</div>
                   <div className="text-[10px] font-black uppercase text-zinc-500 tracking-widest">Active Rules</div>
                </div>
             </div>
          </div>
          <div className="bg-white border border-zinc-200 p-4 rounded-[32px] flex items-center justify-between">
             <div className="flex gap-4 items-center">
                <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-[32px] flex items-center justify-center"><CheckCircle /></div>
                <div>
                   <div className="text-2xl font-black font-mono">1,204</div>
                   <div className="text-[10px] font-black uppercase text-zinc-500 tracking-widest">Executions (30d)</div>
                </div>
             </div>
          </div>
          <div className="bg-white border border-zinc-200 p-4 rounded-[32px] flex items-center justify-between">
             <div className="flex gap-4 items-center">
                <div className="w-12 h-12 bg-amber-50 text-amber-600 rounded-[32px] flex items-center justify-center"><AlertTriangle /></div>
                <div>
                   <div className="text-2xl font-black font-mono">2</div>
                   <div className="text-[10px] font-black uppercase text-zinc-500 tracking-widest">Exceptions</div>
                </div>
             </div>
          </div>
       </div>

       <div className="bg-white border border-zinc-200 rounded-[32px] overflow-hidden shadow-sm flex-1 p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
             {workflows.map(wf => (
                <div key={wf.id} className="border border-zinc-200 rounded-[32px] p-6 hover:shadow-md hover:border-zinc-300 transition-all flex flex-col relative group">
                   <div className="flex items-start justify-between mb-4">
                      <div className={`w-12 h-12 rounded-xl flex items-center justify-center bg-zinc-50 ${wf.color} border border-zinc-100`}>
                         <wf.icon size={24} />
                      </div>
                      <div className="flex items-center gap-2">
                         <span className={`px-2 py-1 text-[10px] font-black tracking-widest uppercase rounded-lg ${wf.status === 'active' ? 'bg-emerald-100 text-emerald-700' : 'bg-zinc-100 text-zinc-500'}`}>
                            {wf.status}
                         </span>
                      </div>
                   </div>
                   
                   <h3 className="font-bold text-lg text-zinc-900 leading-tight mb-2">{wf.name}</h3>
                   <div className="text-sm text-zinc-500 font-medium mb-6 flex-1">
                      <span className="text-zinc-400">Trigger:</span> {wf.trigger}
                   </div>

                   <div className="flex items-center justify-between pt-4 border-t border-zinc-100 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => cloneWorkflow(wf)} className="p-2 hover:bg-zinc-100 text-zinc-500 rounded-lg transition" title="Clone Rule"><Copy size={16}/></button>
                      <div className="flex items-center gap-1">
                         <button onClick={() => toggleStatus(wf.id)} className="p-2 hover:bg-zinc-100 text-zinc-500 rounded-lg transition" title={wf.status === 'active' ? 'Pause' : 'Activate'}>
                            {wf.status === 'active' ? <Pause size={16}/> : <Power size={16} className="text-emerald-500"/>}
                         </button>
                         <button onClick={() => deleteWorkflow(wf.id)} className="p-2 hover:bg-rose-50 text-rose-500 rounded-lg transition" title="Delete Rule"><Trash2 size={16}/></button>
                      </div>
                   </div>
                   
                   {/* Background Decorative Pattern */}
                   <div className="absolute right-0 bottom-0 opacity-[0.03] pointer-events-none p-6">
                      <wf.icon size={100} />
                   </div>
                </div>
             ))}
          </div>
       </div>
    </div>
  );
}
