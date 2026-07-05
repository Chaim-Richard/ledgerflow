import React, { useState } from 'react';
import { Target, CheckCircle2, Clock, Plus } from 'lucide-react';
import { useLedgerStore } from '../../stores/useLedgerStore';
import { motion } from 'motion/react';

export default function FinancialGoals() {
  const { transactions } = useLedgerStore();
  const [isAdding, setIsAdding] = useState(false);

  const [goals, setGoals] = useState<{ id: string, name: string, targetAmount: number, currentAmount: number, deadline: string, category: string }[]>([]);

  const handleAddGoal = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setGoals(prev => [...prev, {
      id: crypto.randomUUID(),
      name: fd.get('name') as string,
      targetAmount: Number(fd.get('targetAmount')),
      currentAmount: Number(fd.get('currentAmount')),
      deadline: fd.get('deadline') as string,
      category: fd.get('category') as string
    }]);
    setIsAdding(false);
  };

  return (
    <div className="space-y-8 p-4 md:p-6 lg:p-10 w-full max-w-[1550px] mx-auto h-full text-slate-800">
      <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-sky-200 pb-6 gap-4">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="px-3 py-1 bg-sky-50 text-sky-700 rounded-full text-[9px] font-black tracking-widest uppercase shadow-sm border border-sky-200">Planning Hub</span>
            <div className="flex items-center gap-1.5 px-2.5 py-1 bg-slate-900 text-sky-400 rounded-full border border-slate-800">
               <Target size={10} />
               <span className="text-[9px] font-black tracking-widest uppercase">Target Engine Active</span>
            </div>
          </div>
          <h1 className="text-3xl font-black text-slate-800 uppercase tracking-tight font-display">
            Financial Goals & Savings
          </h1>
          <p className="text-xs text-slate-500 mt-1 uppercase tracking-wider font-bold">
            Deterministic goal tracking and milestone projections.
          </p>
        </div>
        <button 
          onClick={() => setIsAdding(true)}
          className="h-12 px-6 bg-slate-900 text-white rounded-xl text-xs font-medium uppercase tracking-wider font-display shadow-lg hover:shadow-xl hover:-translate-y-1 transition-all flex items-center justify-center gap-2"
        >
          <Plus size={16} /> New Target
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-[32px] border border-slate-200 shadow-sm flex items-center justify-between">
           <div>
              <p className="text-[10px] font-medium uppercase tracking-wider text-slate-400">Total Goal Targets</p>
              <p className="text-3xl font-black tracking-tighter mt-1 font-mono">${goals.reduce((acc, g) => acc + g.targetAmount, 0).toLocaleString()}</p>
           </div>
        </div>

        <div className="bg-sky-50 p-6 rounded-[32px] border border-sky-100 shadow-sm flex items-center justify-between pointer-events-none">
           <div>
              <p className="text-[10px] font-medium uppercase tracking-wider text-sky-600">Total Saved</p>
              <p className="text-3xl font-black tracking-tighter mt-1 font-mono text-sky-700">${goals.reduce((acc, g) => acc + g.currentAmount, 0).toLocaleString()}</p>
           </div>
        </div>

        <div className="bg-emerald-50 p-6 rounded-[32px] border border-emerald-100 shadow-sm flex items-center justify-between pointer-events-none">
           <div>
              <p className="text-[10px] font-medium uppercase tracking-wider text-emerald-600">Average Completion</p>
              <p className="text-3xl font-black tracking-tighter mt-1 font-mono text-emerald-700">
                 {Math.round((goals.reduce((acc, g) => acc + g.currentAmount, 0) / goals.reduce((acc, g) => acc + g.targetAmount, 0)) * 100)}%
              </p>
           </div>
        </div>
      </div>

      {goals.length === 0 ? (
        <div className="bg-slate-50 border border-slate-200 border-dashed rounded-[32px] p-16 flex flex-col items-center justify-center text-center">
          <Target size={48} className="text-slate-300 mb-4" />
          <h3 className="text-xl font-bold text-slate-700">No Goals Created</h3>
          <p className="text-slate-500 mt-2 max-w-md">Goals help you track progress toward large capital expenses, savings buffers, or distributions. Add a goal to visualize your funding progress.</p>
          <button 
            onClick={() => setIsAdding(true)}
            className="mt-6 px-6 py-3 bg-white border border-slate-200 text-slate-700 rounded-xl font-bold shadow-sm hover:border-indigo-600 transition-colors flex items-center gap-2"
          >
            <Plus size={18} /> Create First Target
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {goals.map(goal => {
            const progress = goal.targetAmount > 0 ? Math.min(100, Math.round((goal.currentAmount / goal.targetAmount) * 100)) : 0;
            return (
              <div key={goal.id} className="bg-white p-6 rounded-[32px] border border-slate-200 shadow-sm hover:shadow-lg transition-all flex flex-col gap-6 relative overflow-hidden group">
                 {progress >= 100 && (
                    <div className="absolute top-0 right-0 p-4 opacity-10 text-emerald-500">
                       <CheckCircle2 size={100} />
                    </div>
                 )}
                 <div className="flex items-start justify-between relative z-10">
                    <div>
                       <span className="px-2 py-0.5 bg-slate-100 text-slate-500 text-[9px] font-medium uppercase tracking-wider rounded-sm border border-slate-200 mb-2 inline-block">
                          {goal.category}
                       </span>
                       <h3 className="text-xl font-black text-slate-800 tracking-tight">{goal.name}</h3>
                       <div className="flex items-center gap-2 text-[10px] font-bold text-slate-400 mt-1 tracking-widest uppercase">
                          <Clock size={12} />
                          Target: {goal.deadline}
                       </div>
                    </div>
                    <div className={`w-12 h-12 rounded-[32px] flex items-center justify-center border shadow-sm ${progress >= 100 ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-sky-50 text-sky-600 border-sky-100'}`}>
                       {progress >= 100 ? <CheckCircle2 size={24} /> : <Target size={24} />}
                    </div>
                 </div>

                 <div className="relative z-10">
                    <div className="flex items-end justify-between mb-2">
                       <p className={`text-2xl font-black font-mono tracking-tighter ${progress >= 100 ? 'text-emerald-600' : 'text-slate-800'}`}>
                          ${goal.currentAmount.toLocaleString()}
                       </p>
                       <p className="text-xs font-bold text-slate-400 font-mono">
                          / ${goal.targetAmount.toLocaleString()}
                       </p>
                    </div>
                    <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                       <motion.div 
                         initial={{ width: 0 }}
                         animate={{ width: `${progress}%` }}
                         className={`h-full ${progress >= 100 ? 'bg-emerald-500' : 'bg-sky-500'}`}
                         transition={{ duration: 1, ease: 'easeOut' }}
                       />
                    </div>
                    <p className="text-[10px] font-medium uppercase tracking-wider text-right mt-2 text-slate-500">
                       {progress}% Funded
                    </p>
                 </div>
              </div>
            )
          })}
        </div>
      )}
      {isAdding && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="bg-white rounded-[32px] p-6 w-full max-w-md shadow-2xl">
            <h2 className="text-xl font-bold mb-4">New Financial Goal</h2>
            <form onSubmit={handleAddGoal} className="space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Goal Name</label>
                <input required name="name" className="w-full border p-2 rounded-xl mt-1" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Target Amount ($)</label>
                  <input required name="targetAmount" type="number" className="w-full border p-2 rounded-xl mt-1" />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Current Amount ($)</label>
                  <input required name="currentAmount" type="number" defaultValue={0} className="w-full border p-2 rounded-xl mt-1" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Deadline</label>
                  <input required name="deadline" type="date" className="w-full border p-2 rounded-xl mt-1" />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Category</label>
                  <input required name="category" placeholder="e.g. Safety" className="w-full border p-2 rounded-xl mt-1" />
                </div>
              </div>
              <div className="flex justify-end gap-2 mt-6">
                <button type="button" onClick={() => setIsAdding(false)} className="px-4 py-2 text-slate-500 font-medium">Cancel</button>
                <button type="submit" className="px-4 py-2 bg-slate-900 text-white rounded-xl font-medium">Save Goal</button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </div>
  )
}
