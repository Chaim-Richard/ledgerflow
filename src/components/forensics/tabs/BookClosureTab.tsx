import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Lock, Unlock } from 'lucide-react';
import { useLedgerStore } from '../../../stores/useLedgerStore';
import { toast } from 'sonner';
import { parseLocalDate, getLocalDateISO } from '../../../lib/utils';

export default function BookClosureTab() {
  const { lockDate, setLockDate } = useLedgerStore(state => ({
    lockDate: state.lockDate,
    setLockDate: state.setLockDate
  }));

  const [dateInput, setDateInput] = useState(lockDate ? lockDate.split('T')[0] : getLocalDateISO());
  const [password, setPassword] = useState('');
  const [isLocking, setIsLocking] = useState(false);

  const handleLockBooks = () => {
    if (!password) {
      toast.error('Closing password is required to secure the books.');
      return;
    }
    setLockDate(parseLocalDate(dateInput).toISOString());
    toast.success(`Books successfully closed through ${dateInput}. Prior entries are now immutable.`);
    setPassword('');
  };

  const handleUnlockBooks = () => {
    if (!password) {
      toast.error('Administrator password is required to unlock the books.');
      return;
    }
    setLockDate(null);
    toast.success('Books unlocked. Historical ledgers are editable again.');
    setPassword('');
  };

  return (
    <motion.div
      key="book-closure-tab"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="space-y-8 animate-fade-in text-left"
    >
      <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-[var(--line)] pb-6 gap-4">
        <div>
          <h4 className="text-xl font-black text-[var(--text)] uppercase tracking-tight">Close the Books (Immutable Locking)</h4>
          <p className="text-xs text-slate-500 font-bold uppercase tracking-wider mt-1 opacity-65">
            Prevent changes to historical transactions before a designated closing date.
          </p>
        </div>
      </div>

      <div className="bg-[var(--ink)] border border-[var(--line)] rounded-[32px] p-8 max-w-2xl mx-auto space-y-8">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-slate-900 text-white flex items-center justify-center shadow-lg">
            {lockDate ? <Lock size={24} /> : <Unlock size={24} />}
          </div>
          <div>
            <h5 className="font-black text-lg text-[var(--text)] uppercase tracking-tight">
              {lockDate ? 'Periods are Locked' : 'Periods are Open'}
            </h5>
            <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mt-1">
              {lockDate 
                ? `Changes prior to ${new Date(lockDate).toLocaleDateString()} require admin override.`
                : 'All historical transactions are currently editable.'}
            </p>
          </div>
        </div>

        <div className="space-y-6">
          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase text-slate-400 font-mono block">Closing Date</label>
            <input 
              type="date" 
              value={dateInput}
              onChange={(e) => setDateInput(e.target.value)}
              className="w-full px-4 py-3 bg-[var(--surface)] border border-[var(--line)] rounded-xl text-sm font-bold shadow-sm outline-none focus:ring-2 focus:ring-indigo-600 disabled:opacity-50"
              disabled={!!lockDate}
            />
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase text-slate-400 font-mono block">Accounting Administration Password</label>
            <input 
              type="password"
              placeholder="Enter master admin password to verify"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-3 bg-[var(--surface)] border border-[var(--line)] rounded-xl text-sm shadow-sm outline-none focus:ring-2 focus:ring-indigo-600"
            />
            <p className="text-[10px] text-slate-400 leading-relaxed max-w-md">
              Restricts access to designated closing periods, preventing prior year tax or reconciliation drift over recorded accounting.
            </p>
          </div>

          <div className="pt-4 border-t border-[var(--line)]">
            {lockDate ? (
              <button 
                onClick={handleUnlockBooks}
                disabled={isLocking}
                className="w-full flex items-center justify-center gap-2 px-6 py-4 rounded-xl font-bold uppercase tracking-widest text-[11px] transition-all bg-red-50 text-red-600 hover:bg-red-100 disabled:opacity-50"
              >
                {isLocking ? 'Unlocking...' : 'Unlock Books & Remove Date'}
              </button>
            ) : (
              <button 
                onClick={handleLockBooks}
                disabled={isLocking}
                className="w-full flex items-center justify-center gap-2 px-6 py-4 rounded-xl font-black uppercase tracking-widest text-[11px] transition-all bg-slate-900 text-white shadow-xl hover:translate-y-[-2px] disabled:opacity-50"
              >
                {isLocking ? 'Securing Ledger Chain...' : 'Secure & Close Books'}
              </button>
            )}
          </div>
        </div>

      </div>
    </motion.div>
  );
}
