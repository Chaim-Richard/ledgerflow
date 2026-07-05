import React, { useState, useMemo } from 'react';
import { ArrowDownToLine, ArrowUpFromLine, RefreshCw, Layers, Wallet, FileText, ChevronRight } from 'lucide-react';
import { toast } from 'sonner';
import { useLedgerStore } from '../../stores/useLedgerStore';
import { formatCurrency } from '../../lib/utils';
import { format } from 'date-fns';

export default function TreasuryHub() {
  const [activeTab, setActiveTab] = useState<'deposits'|'payments'|'transfers'>('deposits');
  const transactions = useLedgerStore(state => state.transactions);

  // Compute metrics from actual transactions
  const metrics = useMemo(() => {
    let totalCash = 0;
    let deposits30d = 0;
    let transfersOut = 0;
    let undeposited = 0;
    const now = new Date();

    transactions.forEach(t => {
      // Calculate cash balances (simple heuristic looking for checking/cash/savings accounts in lines)
      t.lines?.forEach(l => {
        const name = (l.accountName || '').toLowerCase();
        if (name.includes('bank') || name.includes('cash') || name.includes('checking') || name.includes('savings')) {
            totalCash += l.amountCents;
        }
        if (name.includes('undeposited') && l.amountCents > 0) {
            undeposited += l.amountCents;
        }
      });

      // Calculate recent deposits (last 30 days)
      const txDate = new Date(t.date);
      const diff = (now.getTime() - txDate.getTime()) / (1000 * 60 * 60 * 24);
      if (diff <= 30 && diff >= 0) {
           if (t.totalAmountCents > 0 && ((t.type as string) === 'deposit' || (t.type as string) === 'revenue' || (t.type as string) === 'payment')) {
              deposits30d += t.totalAmountCents;
           }
           if ((t.type as string) === 'transfer' || (t.type as string) === 'expense') {
              transfersOut += t.totalAmountCents;
           }
        }
      });
  
      return { totalCash, deposits30d, transfersOut, undeposited };
    }, [transactions]);
  
    const treasuryItems = useMemo(() => {
      return transactions.filter(t => (t.type as string) === 'deposit' || (t.type as string) === 'transfer' || (t.type as string) === 'payment' || (t.type as string) === 'revenue' || (t as any).subType === 'merchant_payout')
        .map((t: any) => ({
          id: t.id,
          type: t.type === 'payment' ? 'customer_payment' : t.type === 'transfer' ? 'bank_transfer' : 'grouped_deposit',
          refs: t.description || `Tx ${t.number || t.id.slice(-6)}`,
        amount: t.totalAmountCents || 0,
        date: format(new Date(t.date), 'yyyy-MM-dd'),
        status: t.status || 'cleared',
        account: t.lines && t.lines.length > 0 ? t.lines[0].accountName : 'N/A'
      }));
  }, [transactions]);

  const updateStatus = (id: string, status: string) => {
    useLedgerStore.getState().updateTransaction(id, { status: status as any });
    toast.success(`Marked as ${status}`);
  };

  const createGroupedDeposit = () => {
    toast.success('Grouped Deposit intent initiated.');
  };

  return (
    <div className="space-y-6 flex flex-col h-full">
       <div className="flex items-center justify-between">
          <div>
             <h2 className="text-3xl font-black text-zinc-900 tracking-tighter">Treasury & Cash</h2>
             <p className="text-zinc-500 font-medium">Record grouped deposits, ACH transfers, and match customer payments.</p>
          </div>
          <button onClick={createGroupedDeposit} className="flex items-center gap-2 px-6 py-3 bg-zinc-900 text-white rounded-xl font-bold hover:bg-zinc-800 transition shadow-lg shadow-zinc-900/20">
             <Layers size={16} /> Record Grouped Deposit
          </button>
       </div>

       <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white border border-zinc-200 p-6 rounded-[32px]">
             <div className="text-[10px] font-black uppercase text-zinc-500 tracking-widest mb-2 flex items-center gap-2">
                <Wallet className="text-emerald-500" size={14}/> Total Cash
             </div>
             <div className="text-3xl font-black font-mono text-zinc-900">{formatCurrency(metrics.totalCash)}</div>
          </div>
          <div className="bg-white border border-zinc-200 p-6 rounded-[32px]">
             <div className="text-[10px] font-black uppercase text-zinc-500 tracking-widest mb-2 flex items-center gap-2">
                <ArrowDownToLine className="text-blue-500" size={14}/> Deposits (30d)
             </div>
             <div className="text-3xl font-black font-mono text-zinc-900">{formatCurrency(metrics.deposits30d)}</div>
          </div>
          <div className="bg-white border border-zinc-200 p-6 rounded-[32px]">
             <div className="text-[10px] font-black uppercase text-zinc-500 tracking-widest mb-2 flex items-center gap-2">
                <ArrowUpFromLine className="text-rose-500" size={14}/> Transfers Out
             </div>
             <div className="text-3xl font-black font-mono text-zinc-900">{formatCurrency(metrics.transfersOut)}</div>
          </div>
          <div className="bg-white border border-zinc-200 p-6 rounded-[32px]">
             <div className="text-[10px] font-black uppercase text-zinc-500 tracking-widest mb-2 flex items-center gap-2">
                <FileText className="text-amber-500" size={14}/> Undeposited
             </div>
             <div className="text-3xl font-black font-mono text-zinc-900">{formatCurrency(metrics.undeposited)}</div>
          </div>
       </div>

       <div className="bg-white border border-zinc-200 rounded-[32px] overflow-hidden shadow-sm flex-1 flex flex-col">
          <div className="p-4 border-b border-zinc-100 bg-zinc-50/50 flex gap-2">
             <button onClick={() => setActiveTab('deposits')} className={`px-4 py-2 text-sm font-bold rounded-xl transition ${activeTab === 'deposits' ? 'bg-white shadow text-emerald-700' : 'text-zinc-500 hover:text-zinc-700'}`}>Bank Deposits & ACH</button>
             <button onClick={() => setActiveTab('payments')} className={`px-4 py-2 text-sm font-bold rounded-xl transition ${activeTab === 'payments' ? 'bg-white shadow text-emerald-700' : 'text-zinc-500 hover:text-zinc-700'}`}>Customer Payments</button>
             <button onClick={() => setActiveTab('transfers')} className={`px-4 py-2 text-sm font-bold rounded-xl transition ${activeTab === 'transfers' ? 'bg-white shadow text-emerald-700' : 'text-zinc-500 hover:text-zinc-700'}`}>Transfers & Sweeps</button>
          </div>
          <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
             <div className="space-y-3">
                {treasuryItems.filter(i => {
                   if (activeTab === 'deposits') return i.type.includes('deposit') || i.type === 'merchant_payout';
                   if (activeTab === 'payments') return i.type === 'customer_payment';
                   return i.type === 'bank_transfer';
                }).map(item => (
                   <div key={item.id} className="border border-zinc-200 rounded-[32px] p-4 flex items-center justify-between hover:border-emerald-200 hover:shadow-sm transition-all group">
                      <div className="flex-1 flex items-center gap-4">
                         <div className="w-12 h-12 bg-zinc-100 rounded-xl flex items-center justify-center text-zinc-500 group-hover:bg-emerald-100 group-hover:text-emerald-600 transition-colors">
                            {item.type.includes('deposit') || item.type.includes('payment') ? <ArrowDownToLine size={20}/> : <RefreshCw size={20} />}
                         </div>
                         <div>
                            <div className="font-bold text-zinc-900">{item.refs}</div>
                            <div className="text-xs text-zinc-500">{item.date} • {item.account?.toUpperCase() || 'N/A'}</div>
                         </div>
                      </div>
                      
                      <div className="w-48 hidden md:block">
                         <span className="text-[10px] font-black uppercase tracking-widest bg-zinc-100 text-zinc-600 px-2 py-1 rounded">{item.type.replace('_', ' ')}</span>
                      </div>

                      <div className="w-32">
                         <select 
                            value={item.status}
                            onChange={(e) => updateStatus(item.id, e.target.value)}
                            className="text-xs font-bold uppercase tracking-wider outline-none bg-transparent"
                         >
                            <option value="pending">Pending</option>
                            <option value="unapplied">Unapplied</option>
                            <option value="matched">Matched</option>
                            <option value="cleared">Cleared</option>
                            <option value="void">Void</option>
                         </select>
                      </div>

                      <div className="w-32 text-right">
                         <span className="text-lg font-black font-mono text-zinc-900 hover:text-indigo-600 transition-colors">{formatCurrency(item.amount)}</span>
                      </div>

                      <div className="ml-4 opacity-0 group-hover:opacity-100 transition-opacity">
                         <button className="p-2 hover:bg-zinc-100 text-zinc-500 rounded"><ChevronRight size={20}/></button>
                      </div>
                   </div>
                ))}
                {treasuryItems.length === 0 && (
                   <div className="text-center py-24 text-zinc-500 font-medium">No treasury transactions found matching this filter. Connect Bank Feeds to ingest data automatically.</div>
                )}
             </div>
          </div>
       </div>
    </div>
  );
}

