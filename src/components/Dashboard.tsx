import React, { useState, useMemo } from 'react';
import { useLedgerStore } from '../stores/useLedgerStore';
import { useAuthStore } from '../stores/useAuthStore';
import { DollarSign, ArrowUpRight, ArrowDownRight, Zap, Loader2, TrendingUp, Activity, CheckCircle2, Database, FileText } from 'lucide-react';
import { formatCurrency } from '../lib/utils';
import PrivacyValue from './platform/PrivacyValue';
import { aiService } from '../services/aiService';
import { IntentResolver } from '../lib/intentResolver';
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

export default function Dashboard() {
  const { transactions, accounts, commitTransaction, runningBalances } = useLedgerStore();
  const currentWorkspace = useAuthStore(state => state.getCurrentWorkspace());
  
  const [fastInput, setFastInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  // Accurate Truth metrics based on precise Account Types
  const revenue = useMemo(() => 
     accounts.filter(a => a.type === 'income').reduce((sum, a) => sum + Math.abs(a.balanceCents || 0), 0)
  , [accounts]);

  const expenses = useMemo(() => 
     accounts.filter(a => a.type === 'expense').reduce((sum, a) => sum + Math.abs(a.balanceCents || 0), 0)
  , [accounts]);
  
  const netCash = revenue - expenses;
  
  // Real oxygen calculation exactly matched to asset accounts
  const rawCashAccounts = useMemo(() => 
     accounts.filter(a => a.type === 'asset' && a.subtype === 'cash').reduce((sum, a) => sum + (a.balanceCents || 0), 0)
  , [accounts]);
  
  // Fallback to netCash only if no rawCashAccounts are set up yet and netCash exists.
  const cashAccounts = rawCashAccounts !== 0 ? rawCashAccounts : netCash > 0 ? netCash : 0;

  // Generate chart data based on transactions
  const chartData = useMemo(() => {
    if (!transactions.length) {
      // Mock data if no transactions
      return Array.from({ length: 7 }).map((_, i) => ({
        name: `Day ${i + 1}`,
        revenue: Math.random() * 5000 + 1000,
        expense: Math.random() * 3000 + 500
      }));
    }

    const last7Days = Array.from({ length: 7 }).map((_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (6 - i));
      return d.toISOString().split('T')[0];
    });

    return last7Days.map(date => {
      const dayTxs = transactions.filter(t => t.date.startsWith(date));
      let dayRev = 0;
      let dayExp = 0;
      dayTxs.forEach(tx => {
        if (tx.lines.some(l => {
          const acc = accounts.find(a => a.id === l.accountId);
          return acc && acc.type === 'income';
        })) {
          dayRev += tx.totalAmountCents;
        } else if (tx.lines.some(l => {
          const acc = accounts.find(a => a.id === l.accountId);
          return acc && acc.type === 'expense';
        })) {
          dayExp += tx.totalAmountCents;
        }
      });
      return {
        name: date.slice(5).replace('-', '/'),
        revenue: dayRev / 100,
        expense: dayExp / 100
      };
    });
  }, [transactions, accounts]);

  // Extract 'unclassified' or 'temp' records as Action Items
  const unclassified = useMemo(() => 
     transactions.filter(t => !t.lines || t.lines.length === 0 || t.lines.some(l => l.accountId === 'unassigned')).slice(0, 5)
  , [transactions]);

  const handleExecute = async () => {
    if (!fastInput.trim()) return;
    setIsProcessing(true);
    
    try {
      const deterministicData = IntentResolver.resolveEntry(fastInput, { accounts: accounts.map(a => ({ id: a.id, name: a.name })) });
      
      let p;
      if (deterministicData && deterministicData.length > 0) {
         p = deterministicData[0];
      } else {
         const data = await aiService.process('parse-magic-entry', { 
           input: fastInput, 
           categories: accounts.map(a => a.name),
           accounts: accounts.map(a => ({ id: a.id, name: a.name }))
         });
         p = Array.isArray(data) ? data[0] : data;
      }

      const account = accounts.find(a => a.name === p?.dimensions?.category);

      if (p) {
        commitTransaction({
          ...p,
          id: p.id || crypto.randomUUID(),
          date: p.date || new Date().toISOString().split('T')[0],
          description: p.description || fastInput,
          totalAmountCents: p.amountCents || p.totalAmountCents,
          lines: p.lines || [{
            accountId: account?.id || 'uncategorized',
            accountName: account?.name || 'Uncategorized',
            amountCents: p.amountCents || p.totalAmountCents
          }]
        });
        setFastInput('');
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="flex flex-col p-4 sm:p-6 md:p-8 space-y-6 md:space-y-8 w-full max-w-7xl mx-auto">
      <header className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            {currentWorkspace?.name || 'Command Center'}
          </h1>
          <p className="text-slate-500 mt-1 font-medium">
            Your business at a glance.
          </p>
        </div>
      </header>

      {/* Main Command Bar */}
      <div className="relative group">
         <div className="absolute inset-y-0 left-6 flex items-center pointer-events-none">
           <Zap className="text-indigo-600 group-focus-within:text-indigo-500 transition-colors" size={24} />
         </div>
         <input
            type="text"
           value={fastInput}
           onChange={e => setFastInput(e.target.value)}
           onKeyDown={e => e.key === 'Enter' && handleExecute()}
           placeholder="Fast Entry: Type 'Spent $50 on lunches' or 'Received $500'"
           className="w-full bg-white border border-slate-200 rounded-[32px] py-4 md:py-6 pl-12 md:pl-16 pr-28 md:pr-32 text-base md:text-xl font-bold text-slate-900 shadow-sm focus:border-indigo-600 focus:ring-4 focus:ring-indigo-600/10 transition-all placeholder:text-slate-300 placeholder:text-sm md:placeholder:text-base placeholder:truncate"
         />
         <div className="absolute inset-y-0 right-4 flex items-center">
            <button 
              onClick={handleExecute}
              disabled={isProcessing || !fastInput.trim()}
              className="px-6 py-3 bg-slate-900 hover:bg-black text-white rounded-xl font-medium tracking-wide transition-all uppercase text-xs flex items-center gap-2 disabled:opacity-50"
            >
              {isProcessing ? <Loader2 size={16} className="animate-spin" /> : 'Execute'}
            </button>
         </div>
      </div>
      
      
      {/* Quick Actions */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <button className="p-4 bg-indigo-50 border border-indigo-100 hover:bg-indigo-100 transition-colors rounded-2xl flex flex-col items-center justify-center gap-2 text-indigo-700 font-medium">
          <div className="p-2 bg-white rounded-full shadow-sm"><DollarSign size={18} className="text-indigo-600" /></div>
          Create Invoice
        </button>
        <button className="p-4 bg-emerald-50 border border-emerald-100 hover:bg-emerald-100 transition-colors rounded-2xl flex flex-col items-center justify-center gap-2 text-emerald-700 font-medium">
          <div className="p-2 bg-white rounded-full shadow-sm"><ArrowUpRight size={18} className="text-emerald-600" /></div>
          Record Receipt
        </button>
        <button className="p-4 bg-rose-50 border border-rose-100 hover:bg-rose-100 transition-colors rounded-2xl flex flex-col items-center justify-center gap-2 text-rose-700 font-medium">
          <div className="p-2 bg-white rounded-full shadow-sm"><ArrowDownRight size={18} className="text-rose-600" /></div>
          Add Bill
        </button>
        <button className="p-4 bg-slate-50 border border-slate-200 hover:bg-slate-100 transition-colors rounded-2xl flex flex-col items-center justify-center gap-2 text-slate-700 font-medium">
          <div className="p-2 bg-white rounded-full shadow-sm"><Activity size={18} className="text-slate-600" /></div>
          Reconcile
        </button>
      </div>
      
      {/* The 3 Core Numbers */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
         <div className="p-6 md:p-8 bg-emerald-500/10 border border-emerald-500/30 rounded-[32px] flex flex-col justify-between">
            <h3 className="text-xs font-bold text-emerald-500 uppercase tracking-wider mb-2">Cash Balance</h3>
            <span className="text-4xl md:text-5xl font-light font-mono text-slate-900 tracking-tight">
               <PrivacyValue value={formatCurrency(cashAccounts)} />
            </span>
         </div>
         
         <div className="p-6 md:p-8 bg-white border border-slate-200 rounded-[32px] shadow-sm flex flex-col justify-between">
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-2">
              <ArrowUpRight size={14} className="text-emerald-500" /> Total Money In
            </h3>
            <span className="text-3xl md:text-4xl font-light font-mono text-slate-800 tracking-tight">
               <PrivacyValue value={formatCurrency(revenue)} />
            </span>
         </div>

         <div className="p-6 md:p-8 bg-white border border-slate-200 rounded-[32px] shadow-sm flex flex-col justify-between">
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-2">
              <ArrowDownRight size={14} className="text-rose-500" /> Total Money Out
            </h3>
            <span className="text-3xl md:text-4xl font-light font-mono text-slate-800 tracking-tight">
               <PrivacyValue value={formatCurrency(expenses)} />
            </span>
         </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
      {/* Onboarding Checklist */}
      {transactions.length < 10 && (
        <div className="bg-indigo-50 border border-indigo-100 rounded-[32px] p-6 lg:p-8 mb-6 shadow-sm">
           <h3 className="text-xl font-bold text-indigo-900 mb-2 flex items-center gap-2">
              <CheckCircle2 size={24} className="text-indigo-600" />
              Welcome to the System
           </h3>
           <p className="text-indigo-700 font-medium mb-6">Complete these steps to get your ERP fully operational.</p>
           
           <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-white rounded-2xl p-4 shadow-sm border border-indigo-100 flex items-start gap-3">
                 <div className="p-2 bg-emerald-100 rounded-full text-emerald-600"><CheckCircle2 size={16} /></div>
                 <div>
                    <p className="font-bold text-slate-800 text-sm">Create Workspace</p>
                    <p className="text-xs text-slate-500 mt-1">Your business space is active.</p>
                 </div>
              </div>
              <div className="bg-white rounded-2xl p-4 shadow-sm border border-indigo-100 flex items-start gap-3">
                 <div className="p-2 bg-indigo-100 rounded-full text-indigo-600"><Database size={16} /></div>
                 <div>
                    <p className="font-bold text-slate-800 text-sm">Add Bank Accounts</p>
                    <p className="text-xs text-slate-500 mt-1">Connect or create asset accounts.</p>
                 </div>
              </div>
              <div className="bg-white rounded-2xl p-4 shadow-sm border border-indigo-100 flex items-start gap-3">
                 <div className="p-2 bg-slate-100 rounded-full text-slate-400"><FileText size={16} /></div>
                 <div>
                    <p className="font-bold text-slate-800 text-sm">Create First Invoice</p>
                    <p className="text-xs text-slate-500 mt-1">Get paid by your customers.</p>
                 </div>
              </div>
           </div>
        </div>
      )}

      {/* Chart Section */}
        <div className="lg:col-span-2 bg-white border border-slate-200 rounded-[32px] p-6 shadow-sm flex flex-col">
          <div className="flex items-center justify-between mb-6">
            <h3 className="font-bold text-slate-800 flex items-center gap-2">
              <Activity size={18} className="text-indigo-500" /> 
              Cash Flow
            </h3>
          </div>
          <div className="flex-1 min-h-[250px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="colorExp" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#f43f5e" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis 
                  dataKey="name" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 10, fill: '#94a3b8' }} 
                  dy={10} 
                />
                <YAxis 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 10, fill: '#94a3b8' }}
                  tickFormatter={value => `$${value.toLocaleString()}`}
                />
                <Tooltip 
                  contentStyle={{ borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)', fontSize: '12px' }}
                  itemStyle={{ fontWeight: 500 }}
                  labelStyle={{ color: '#64748b', marginBottom: '4px' }}
                  formatter={(value: number) => [`$${value.toLocaleString()}`, '']}
                />
                <Area type="monotone" dataKey="revenue" name="Revenue" stroke="#10b981" strokeWidth={2} fillOpacity={1} fill="url(#colorRev)" />
                <Area type="monotone" dataKey="expense" name="Expense" stroke="#f43f5e" strokeWidth={2} fillOpacity={1} fill="url(#colorExp)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Unclassified Actions Section */}
        <div className="bg-white border border-slate-200 rounded-[32px] p-6 shadow-sm">
            <h3 className="font-bold text-slate-800 mb-6 flex items-center gap-2">
               <DollarSign size={18} className="text-rose-500" /> Action Items
            </h3>
            
            {unclassified.length === 0 ? (
              <div className="text-center p-8 bg-slate-50 rounded-xl h-[250px] flex flex-col items-center justify-center">
                 <CheckCircle2 size={32} className="text-emerald-500 mb-3" />
                 <p className="text-slate-500 font-medium">Everything is balanced.</p>
                 <p className="text-slate-400 text-sm mt-1">Go sell something.</p>
              </div>
            ) : (
              <div className="space-y-4">
                 {unclassified.map(tx => (
                   <div key={tx.id} className="flex justify-between items-center p-4 border border-slate-100 bg-slate-50 rounded-xl hover:bg-slate-100 transition-colors cursor-pointer">
                     <div className="pr-4">
                       <p className="font-medium text-slate-800 truncate max-w-[150px]">{tx.description}</p>
                       <p className="text-xs text-slate-500 mt-0.5">{tx.date}</p>
                     </div>
                     <p className="font-mono text-slate-900 font-semibold bg-white px-2 py-1 rounded shadow-sm">
                       {formatCurrency(tx.totalAmountCents)}
                     </p>
                   </div>
                 ))}
              </div>
            )}
        </div>
      </div>
    </div>
  );
}
