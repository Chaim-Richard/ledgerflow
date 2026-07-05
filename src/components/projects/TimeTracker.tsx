import React, { useState, useEffect } from 'react';
import { useLedgerStore } from '../../stores/useLedgerStore';
import { useAuthStore } from '../../stores/useAuthStore';
import { db } from '../../firebase';
import { collection, query, where, onSnapshot, doc, setDoc, deleteDoc } from 'firebase/firestore';
import { Play, Square, Clock, Trash2, CheckCircle, XCircle, Copy, Briefcase } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';

export default function TimeTracker() {
  const { projects = [], transactions, setTransactions } = useLedgerStore();
  const user = useAuthStore(state => state.user);
  const workspaceId = useAuthStore(state => state.currentWorkspaceId);
  
  const [activeTimer, setActiveTimer] = useState<{ startTime: number, description: string, projectId: string, isBillable: boolean } | null>(null);
  const [elapsed, setElapsed] = useState(0);
  
  const [timeEntries, setTimeEntries] = useState<Array<{
    id: string,
    projectId: string,
    description: string,
    durationMs: number,
    date: string,
    isBillable: boolean,
    status: 'pending' | 'approved' | 'rejected' | 'billed' | 'transferred' | 'locked'
  }>>([]);

  useEffect(() => {
    if (!user || !workspaceId) return;
    const q = query(collection(db, 'timeEntries'), where('workspaceId', '==', workspaceId));
    const unsub = onSnapshot(q, (snap) => {
       setTimeEntries(snap.docs.map(d => ({ id: d.id, ...d.data() } as any)).sort((a, b) => b.id.localeCompare(a.id)));
    });
    return () => unsub();
  }, [user, workspaceId]);

  useEffect(() => {
    let interval: any;
    if (activeTimer) {
      interval = setInterval(() => {
        setElapsed(Date.now() - activeTimer.startTime);
      }, 1000);
    } else {
      setElapsed(0);
    }
    return () => clearInterval(interval);
  }, [activeTimer]);

  const saveEntry = async (entry: any) => {
    if (!user || !workspaceId) return;
    toast.promise(setDoc(doc(db, 'timeEntries', entry.id), { ...entry, workspaceId, uid: user.uid }), {
       loading: 'Saving time entry...',
       success: 'Time entry captured',
       error: 'Failed to capture entry'
    });
  };

  const startTimer = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setActiveTimer({
      startTime: Date.now(),
      description: fd.get('description') as string,
      projectId: fd.get('projectId') as string,
      isBillable: fd.get('isBillable') === 'on'
    });
  };

  const stopTimer = () => {
    if (!activeTimer) return;
    const entry = {
      id: `time-${Date.now()}`,
      projectId: activeTimer.projectId,
      description: activeTimer.description,
      durationMs: Date.now() - activeTimer.startTime,
      date: format(new Date(), 'yyyy-MM-dd'),
      isBillable: activeTimer.isBillable,
      status: 'pending' as const
    };
    saveEntry(entry);
    setActiveTimer(null);
  };

  const manualEntry = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const hrs = parseFloat(fd.get('hours') as string) || 0;
    
    if (hrs <= 0) return toast.error('Enter valid hours');

    const entry = {
      id: `time-manual-${Date.now()}`,
      projectId: fd.get('projectId') as string,
      description: fd.get('description') as string,
      durationMs: hrs * 3600 * 1000,
      date: format(new Date(), 'yyyy-MM-dd'),
      isBillable: fd.get('isBillable') === 'on',
      status: 'pending' as const
    };
    saveEntry(entry);
    (e.target as HTMLFormElement).reset();
  };

  const formatDuration = (ms: number) => {
    const totalSeconds = Math.floor(ms / 1000);
    const h = Math.floor(totalSeconds / 3600).toString().padStart(2, '0');
    const m = Math.floor((totalSeconds % 3600) / 60).toString().padStart(2, '0');
    const s = (totalSeconds % 60).toString().padStart(2, '0');
    return `${h}:${m}:${s}`;
  };

  const updateStatus = (id: string, status: typeof timeEntries[0]['status']) => {
    const existing = timeEntries.find(t => t.id === id);
    if (!existing) return;
    if (existing.status === 'locked') {
        return toast.error('Cannot modify locked entry');
    }
    toast.promise(setDoc(doc(db, 'timeEntries', id), { ...existing, status }, { merge: true }), {
       loading: 'Updating status...',
       success: `Entry marked as ${status}`,
       error: 'Failed to update'
    });
  };

  const deleteEntry = async (id: string) => {
    if (timeEntries.find(t => t.id === id && t.status === 'locked')) {
        return toast.error('Cannot modify locked entry');
    }
    toast.promise(deleteDoc(doc(db, 'timeEntries', id)), {
       loading: 'Removing entry...',
       success: 'Time entry removed',
       error: 'Failed to remove entry'
    });
  };
  
  const duplicateEntry = (id: string) => {
    const src = timeEntries.find(t => t.id === id);
    if (!src) return;
    saveEntry({ ...src, id: `time-dup-${Date.now()}`, status: 'pending' });
  };

  return (
    <div className="space-y-8 p-4 md:p-6 lg:p-10 w-full max-w-[1550px] mx-auto pb-20">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between border-b border-slate-200 pb-6 gap-4">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Clock size={24} className="text-slate-600" />
            <span className="text-xs font-black uppercase tracking-widest text-slate-500">
              Labor Capture & Tracking
            </span>
          </div>
          <h1 className="text-3xl font-black text-slate-800 uppercase tracking-tight font-display">
            Chronology Protocol
          </h1>
          <p className="text-xs text-slate-500 mt-1 uppercase tracking-wider font-bold max-w-2xl">
            Immutable time tracking and billable labor optimization
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="bg-slate-900 border border-slate-800 rounded-[32px] p-8 shadow-xl text-white flex flex-col justify-between">
             <div className="flex items-center gap-3 border-b border-slate-800 pb-4 mb-6">
                <div className="p-2 bg-emerald-950 text-emerald-400 rounded-xl">
                  <Play size={18} />
                </div>
                <div>
                   <h3 className="font-black text-white uppercase tracking-wider text-sm">Active Operation Pulse</h3>
                   <p className="text-[10px] text-slate-400 uppercase tracking-widest">Real-time session recording</p>
                </div>
             </div>
             
             {activeTimer ? (
               <div className="flex flex-col items-center justify-center flex-1 py-8 space-y-6">
                  <div className="text-6xl md:text-7xl font-black font-mono tracking-tighter text-emerald-400 drop-shadow-[0_0_15px_rgba(52,211,153,0.3)]">
                    {formatDuration(elapsed)}
                  </div>
                  <div className="text-center space-y-1">
                    <p className="font-black text-xl uppercase tracking-tight text-white">{activeTimer.description || 'ACTIVE PROCESS...'}</p>
                    <p className="text-slate-400 text-xs font-bold uppercase tracking-widest">Target: {projects.find(p => p.id === activeTimer.projectId)?.name || 'Unassigned Context'}</p>
                  </div>
                  <button onClick={stopTimer} className="flex items-center justify-center w-full max-w-xs gap-3 px-8 py-4 bg-rose-600 hover:bg-rose-500 text-white rounded-[32px] font-black uppercase tracking-widest transition-all mt-4 active:scale-95 shadow-lg shadow-rose-900/20">
                    <Square size={18} fill="currentColor" /> Terminate Session
                  </button>
               </div>
             ) : (
               <form onSubmit={startTimer} className="space-y-6 flex-1 flex flex-col justify-center">
                 <div>
                   <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">Operation Description</label>
                   <input name="description" placeholder="Specify current objective..." required className="w-full bg-slate-800 border border-slate-700 rounded-[32px] px-5 py-4 placeholder:text-slate-500 focus:ring-2 focus:ring-emerald-500 outline-none font-bold text-sm" />
                 </div>
                 
                 <div className="grid grid-cols-3 gap-4">
                   <div className="col-span-2">
                     <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">Project Binding</label>
                     <select name="projectId" className="w-full bg-slate-800 border border-slate-700 rounded-[32px] px-5 py-4 focus:ring-2 focus:ring-emerald-500 outline-none font-bold text-sm appearance-none">
                       <option value="">(No Assignment)</option>
                       {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                     </select>
                   </div>
                   <div>
                     <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2 opacity-0">Billable</label>
                     <label className="flex items-center justify-center h-[54px] gap-2 px-4 bg-slate-800 border border-slate-700 rounded-[32px] cursor-pointer hover:bg-slate-700 transition select-none">
                       <input type="checkbox" name="isBillable" defaultChecked className="w-4 h-4 rounded text-emerald-500 focus:ring-emerald-500 bg-slate-900 border-slate-600" />
                       <span className="text-[10px] font-black uppercase tracking-widest">Billable</span>
                     </label>
                   </div>
                 </div>
                 <button type="submit" className="w-full flex items-center justify-center gap-3 py-4 bg-emerald-500 hover:bg-emerald-400 text-emerald-950 font-black uppercase tracking-widest rounded-[32px] transition-all active:scale-95 shadow-lg shadow-emerald-900/20 mt-auto">
                   <Play size={18} fill="currentColor" /> Initiate Pulse
                 </button>
               </form>
             )}
          </div>

          <div className="bg-white border border-slate-200 rounded-[32px] p-8 shadow-sm flex flex-col justify-between">
             <div className="flex items-center gap-3 border-b border-slate-100 pb-4 mb-6">
                <div className="p-2 bg-slate-100 text-slate-600 rounded-xl">
                  <Clock size={18} />
                </div>
                <div>
                   <h3 className="font-black text-slate-800 uppercase tracking-wider text-sm">Retroactive Log Entry</h3>
                   <p className="text-[10px] text-slate-500 uppercase tracking-widest">Manual time span injection</p>
                </div>
             </div>
             
             <form onSubmit={manualEntry} className="space-y-6 flex-1 flex flex-col justify-center">
                 <div>
                   <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-2">Description of Work</label>
                   <input name="description" placeholder="Detail completed objectives..." required className="w-full bg-slate-50 border border-slate-200 rounded-[32px] px-5 py-4 focus:ring-2 focus:ring-slate-900 outline-none font-bold text-sm shadow-sm" />
                 </div>
                 <div className="grid grid-cols-3 gap-4">
                   <div>
                     <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-2">Duration (Hrs)</label>
                     <input name="hours" type="number" step="0.01" min="0" placeholder="e.g. 2.5" required className="w-full bg-slate-50 border border-slate-200 rounded-[32px] px-5 py-4 focus:ring-2 focus:ring-slate-900 outline-none font-mono font-black text-sm shadow-sm" />
                   </div>
                   <div className="col-span-2">
                     <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-2">Project Binding</label>
                     <select name="projectId" className="w-full bg-slate-50 border border-slate-200 rounded-[32px] px-5 py-4 focus:ring-2 focus:ring-slate-900 outline-none font-bold text-sm appearance-none shadow-sm">
                       <option value="">(No Assignment)</option>
                       {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                     </select>
                   </div>
                 </div>
                 <div className="flex items-center justify-between pt-4 mt-auto">
                     <label className="flex items-center gap-2 cursor-pointer select-none">
                       <input type="checkbox" name="isBillable" defaultChecked className="w-5 h-5 rounded border-slate-300 text-slate-900 focus:ring-slate-900" />
                       <span className="text-xs font-black uppercase tracking-widest text-slate-700">Client Billable</span>
                     </label>
                     <button type="submit" className="px-8 py-3.5 bg-slate-900 text-white rounded-[32px] text-xs font-black uppercase tracking-widest hover:bg-slate-800 transition-all active:scale-95 shadow-md">
                       Inject Record
                     </button>
                 </div>
             </form>
          </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-[32px] shadow-sm">
         <div className="p-6 md:p-8 border-b border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Briefcase size={20} className="text-slate-400" />
              <h3 className="font-black text-slate-800 uppercase tracking-wider text-sm">Chronological Archive</h3>
            </div>
         </div>
         <div className="overflow-x-auto min-h-[400px]">
            <table className="w-full text-left text-sm whitespace-nowrap">
               <thead className="bg-slate-50/50 border-b border-slate-100 text-slate-400 uppercase tracking-widest text-[10px] font-black">
                  <tr>
                     <th className="px-8 py-5">Date</th>
                     <th className="px-6 py-5">Operation Details</th>
                     <th className="px-6 py-5">Project Assignment</th>
                     <th className="px-6 py-5">Duration</th>
                     <th className="px-6 py-5">Type</th>
                     <th className="px-6 py-5">Status</th>
                     <th className="px-8 py-5 text-right">Actions</th>
                  </tr>
               </thead>
               <tbody className="divide-y divide-slate-100">
                  {timeEntries.map(e => (
                     <tr key={e.id} className="hover:bg-slate-50 transition-colors group">
                        <td className="px-8 py-4 font-mono text-xs font-bold text-slate-500">{e.date}</td>
                        <td className="px-6 py-4 font-bold text-slate-800">{e.description}</td>
                        <td className="px-6 py-4">
                           <span className="text-[10px] font-black uppercase tracking-widest text-slate-500 bg-slate-100 px-2.5 py-1.5 rounded-lg border border-slate-200">
                             {projects.find(p => p.id === e.projectId)?.name || 'Unassigned'}
                           </span>
                        </td>
                        <td className="px-6 py-4 font-mono font-black text-slate-900">{formatDuration(e.durationMs)}</td>
                        <td className="px-6 py-4">
                           {e.isBillable ? (
                             <span className="px-2.5 py-1.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-lg text-[9px] font-black uppercase tracking-widest">Billable</span>
                           ) : (
                             <span className="px-2.5 py-1.5 bg-slate-100 text-slate-500 border border-slate-200 rounded-lg text-[9px] font-black uppercase tracking-widest">Internal</span>
                           )}
                        </td>
                        <td className="px-6 py-4">
                           <select 
                            value={e.status} 
                            onChange={(ev) => updateStatus(e.id, ev.target.value as any)}
                            className="bg-transparent border border-slate-200 rounded-lg px-3 py-1.5 text-[10px] font-black uppercase tracking-widest outline-none hover:bg-slate-50 focus:ring-2 focus:ring-slate-900 cursor-pointer"
                            disabled={e.status === 'locked'}
                           >
                              <option value="pending">Pending</option>
                              <option value="approved">Approved</option>
                              <option value="rejected">Rejected</option>
                              <option value="billed">Billed</option>
                              <option value="transferred">Transferred</option>
                              <option value="locked">Locked</option>
                           </select>
                        </td>
                        <td className="px-8 py-4 flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                           <button onClick={() => updateStatus(e.id, 'approved')} className="text-emerald-500 hover:bg-emerald-50 hover:text-emerald-600 p-2 rounded-xl transition-colors" title="Approve"><CheckCircle size={16}/></button>
                           <button onClick={() => updateStatus(e.id, 'rejected')} className="text-rose-400 hover:bg-rose-50 hover:text-rose-600 p-2 rounded-xl transition-colors" title="Reject"><XCircle size={16}/></button>
                           <button onClick={() => duplicateEntry(e.id)} className="text-indigo-400 hover:bg-indigo-50 hover:text-indigo-600 p-2 rounded-xl transition-colors" title="Duplicate"><Copy size={16}/></button>
                           <button onClick={() => deleteEntry(e.id)} className="text-slate-300 hover:bg-rose-50 hover:text-rose-600 p-2 rounded-xl transition-colors"><Trash2 size={16}/></button>
                        </td>
                     </tr>
                  ))}
                  {timeEntries.length === 0 && (
                     <tr>
                        <td colSpan={7} className="px-8 py-20 text-center">
                           <div className="flex flex-col items-center justify-center">
                              <Clock size={48} className="text-slate-200 mb-4" />
                              <p className="text-slate-400 font-bold uppercase tracking-widest text-xs">No Chronological Data Found</p>
                           </div>
                        </td>
                     </tr>
                  )}
               </tbody>
            </table>
         </div>
      </div>
    </div>
  );
}
