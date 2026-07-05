import { TruthEngine } from '../../modules/truth/TruthEngine';
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  RefreshCw, 
  Plus, 
  Trash2, 
  Calendar, 
  Clock, 
  Play,
  Settings,
  X,
  CheckCircle2
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { 
  collection, 
  query, 
  where, 
  onSnapshot, 
  addDoc, 
  deleteDoc, 
  doc,
  updateDoc
} from 'firebase/firestore';
import { db } from '../../firebase';
import { RecurringTransaction } from '../../types';
import { format } from 'date-fns';
import { toast } from 'sonner';

interface RecurringTransactionsProps {
  workspaceId: string;
  uid: string;
  formatCurrency: (cents: number) => string;
}

export default function RecurringTransactions({ workspaceId, uid, formatCurrency }: RecurringTransactionsProps) {
  const [recurring, setRecurring] = useState<RecurringTransaction[]>([]);
  const [isAdding, setIsAdding] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!workspaceId || !uid) return;

    const q = query(
      collection(db, 'recurringTransactions'),
      where('workspaceId', '==', workspaceId),
      where('uid', '==', uid)
    );

    return onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as RecurringTransaction));
      setRecurring(data);
      setLoading(false);
    });
  }, [workspaceId, uid]);

  const [editingRecurring, setEditingRecurring] = useState<RecurringTransaction | null>(null);

  const handleUpdate = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!editingRecurring) return;

    const formData = new FormData(e.currentTarget);
    const updates: Partial<RecurringTransaction> = {
      description: formData.get('description') as string,
      amountCents: TruthEngine.parseAmountToCents(formData.get('amount') as string),
      frequency: formData.get('frequency') as any,
      nextOccurrence: formData.get('startDate') as string,
      template: {
        ...editingRecurring.template,
        description: formData.get('description') as string,
        totalAmountCents: TruthEngine.parseAmountToCents(formData.get('amount') as string),
      }
    };

    try {
      await updateDoc(doc(db, 'recurringTransactions', editingRecurring.id), updates);
      setEditingRecurring(null);
      toast.success('Schedule updated');
    } catch (err) {
      toast.error('Failed to update schedule');
    }
  };

  const handleAdd = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    
    const newRecurring: Omit<RecurringTransaction, 'id'> = {
      uid,
      workspaceId,
      description: formData.get('description') as string,
      amountCents: TruthEngine.parseAmountToCents(formData.get('amount') as string),
      frequency: formData.get('frequency') as any,
      nextOccurrence: formData.get('startDate') as string,
      isActive: true,
      template: {
        description: formData.get('description') as string,
        totalAmountCents: TruthEngine.parseAmountToCents(formData.get('amount') as string),
        status: 'pending',
        type: 'actual'
      },
      createdAt: new Date().toISOString()
    };

    try {
      await addDoc(collection(db, 'recurringTransactions'), newRecurring);
      setIsAdding(false);
      toast.success('Recurring transaction scheduled');
    } catch (err) {
      toast.error('Failed to schedule transaction');
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'recurringTransactions', id));
      toast.success('Recurring transaction removed');
    } catch (err) {
      toast.error('Failed to remove transaction');
    }
  };

  const handleToggle = async (id: string, current: boolean) => {
    try {
      await updateDoc(doc(db, 'recurringTransactions', id), { isActive: !current });
    } catch (err) {
      toast.error('Failed to update status');
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl md:text-4xl font-black text-slate-900 tracking-tighter">Recurring Vectors</h2>
          <p className="text-slate-500 font-medium">Automating periodic financial pulses across the mesh.</p>
        </div>
        <button 
          onClick={() => setIsAdding(true)}
          className="btn-primary flex items-center gap-2"
        >
          <Plus size={18} />
          Schedule New
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {recurring.map((item) => (
          <motion.div 
            layout
            key={item.id}
            className={cn(
              "p-8 bg-white rounded-[32px] border border-slate-200 shadow-sm space-y-6 relative overflow-hidden group hover:border-indigo-600/30 transition-all",
              !item.isActive && "opacity-40 grayscale"
            )}
          >
            <div className="absolute technical-grid pointer-events-none opacity-[0.03] inset-0" />
            <div className="flex items-center justify-between relative z-10">
              <div className="w-12 h-12 bg-slate-900 text-white rounded-[32px] flex items-center justify-center group-hover:bg-indigo-600 transition-all shadow-lg">
                <RefreshCw size={24} className={cn(item.isActive && "animate-spin-slow")} />
              </div>
              <div className="flex items-center gap-2">
                <button 
                  onClick={() => setEditingRecurring(item)}
                  className="p-2 bg-zinc-50 text-zinc-400 rounded-xl hover:text-zinc-900 transition-all hover:bg-zinc-200"
                >
                  <Settings size={18} />
                </button>
                <button 
                  onClick={() => handleToggle(item.id, item.isActive)}
                  className={cn(
                    "p-2 rounded-xl transition-all",
                    item.isActive ? "bg-emerald-50 text-emerald-600" : "bg-zinc-100 text-zinc-400"
                  )}
                >
                  {item.isActive ? <CheckCircle2 size={18} /> : <Play size={18} />}
                </button>
                <button 
                  onClick={() => handleDelete(item.id)}
                  className="p-2 bg-rose-50 text-rose-600 rounded-xl hover:bg-rose-100 transition-all"
                >
                  <Trash2 size={18} />
                </button>
              </div>
            </div>

            <div className="relative z-10 px-4 py-8 bg-slate-900 text-white rounded-[32px] shadow-2xl space-y-6">
              <div>
                <h4 className="text-lg font-black tracking-tight truncate">{item.description}</h4>
                <p className="text-3xl font-black text-white font-mono tracking-tighter mt-1">
                  {formatCurrency(item.amountCents)}
                </p>
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-[0.2em] text-white/30">
                  <span className="flex items-center gap-2"><Clock size={12} className="text-indigo-600" /> Pulse Frequency</span>
                  <span className="text-white">{item.frequency}</span>
                </div>
                <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-[0.2em] text-white/30">
                  <span className="flex items-center gap-2"><Calendar size={12} className="text-indigo-600" /> Next Iteration</span>
                  <span className="text-white">{format(new Date(item.nextOccurrence), 'MMM dd, yyyy')}</span>
                </div>
              </div>
            </div>
          </motion.div>
        ))}

        {recurring.length === 0 && !loading && (
          <div className="md:col-span-2 lg:col-span-3 py-20 bg-zinc-50 border-2 border-dashed border-zinc-200 rounded-[40px] text-center">
            <div className="w-20 h-20 bg-white rounded-[32px] flex items-center justify-center text-zinc-300 mx-auto mb-6 shadow-sm">
              <RefreshCw size={40} />
            </div>
            <h3 className="text-xl font-black text-zinc-900 tracking-tighter mb-2">No Recurring Schedules</h3>
            <p className="text-zinc-500 max-w-sm mx-auto text-sm">Automate your monthly rent, subscriptions, or payroll to save time and ensure accuracy.</p>
          </div>
        )}
      </div>

      <AnimatePresence>
        {(isAdding || editingRecurring) && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => {
                setIsAdding(false);
                setEditingRecurring(null);
              }}
              className="absolute inset-0 bg-zinc-900/60 backdrop-blur-md"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-md bg-white rounded-[40px] shadow-2xl border border-zinc-200 overflow-hidden"
            >
              <div className="p-4 md:p-8 border-b border-zinc-100 flex items-center justify-between">
                <h3 className="text-xl font-black text-zinc-900 tracking-tighter">
                  {editingRecurring ? 'Edit Schedule' : 'Schedule Recurring'}
                </h3>
                <button 
                  onClick={() => {
                    setIsAdding(false);
                    setEditingRecurring(null);
                  }} 
                  className="p-2 hover:bg-zinc-100 rounded-full transition-colors"
                >
                  <X size={20} className="text-zinc-400" />
                </button>
              </div>
              <form onSubmit={editingRecurring ? handleUpdate : handleAdd} className="p-4 md:p-8 space-y-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Description</label>
                  <input 
                    name="description"
                    required
                    defaultValue={editingRecurring?.description}
                    placeholder="e.g. Monthly Rent"
                    className="w-full px-6 py-4 bg-zinc-50 border border-zinc-200 rounded-[32px] focus:outline-none focus:ring-2 focus:ring-zinc-900 transition-all font-bold"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Amount ($)</label>
                    <input 
                      name="amount"
                      type="number"
                      step="0.01"
                      required
                      defaultValue={editingRecurring ? editingRecurring.amountCents / 100 : undefined}
                      placeholder="0.00"
                      className="w-full px-6 py-4 bg-zinc-50 border border-zinc-200 rounded-[32px] focus:outline-none focus:ring-2 focus:ring-zinc-900 transition-all font-bold"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Frequency</label>
                    <select 
                      name="frequency"
                      defaultValue={editingRecurring?.frequency}
                      className="w-full px-6 py-4 bg-zinc-50 border border-zinc-200 rounded-[32px] focus:outline-none focus:ring-2 focus:ring-zinc-900 transition-all font-bold appearance-none"
                    >
                      <option value="weekly">Weekly</option>
                      <option value="monthly">Monthly</option>
                      <option value="quarterly">Quarterly</option>
                      <option value="yearly">Yearly</option>
                    </select>
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Start Date</label>
                  <input 
                    name="startDate"
                    type="date"
                    required
                    defaultValue={editingRecurring ? editingRecurring.nextOccurrence : format(new Date(), 'yyyy-MM-dd')}
                    className="w-full px-6 py-4 bg-zinc-50 border border-zinc-200 rounded-[32px] focus:outline-none focus:ring-2 focus:ring-zinc-900 transition-all font-bold"
                  />
                </div>
                <button type="submit" className="w-full py-5 bg-zinc-900 text-white rounded-[32px] font-black hover:bg-zinc-800 transition-all shadow-xl shadow-zinc-900/20">
                  {editingRecurring ? 'Update Schedule' : 'Create Schedule'}
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
