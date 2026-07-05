import React, { useMemo } from 'react';
import { useLedgerStore } from '../../stores/useLedgerStore';
import { 
  PieChart as PieChartIcon, 
  LineChart as LineChartIcon, 
  Wallet, 
  Home, 
  TrendingUp, 
  Building, 
  ArrowDownRight, 
  Anchor 
} from 'lucide-react';
import { format } from 'date-fns';
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  PieChart, 
  Pie, 
  Cell 
} from 'recharts';

export default function WealthHub() {
  const { transactions, computedAccounts, accounts } = useLedgerStore();

  const displayData = useMemo(() => {
    let liquidAssets = 0;
    let investments = 0;
    let realEstate = 0;
    let liabilities = 0;

    const workingAccounts = computedAccounts && computedAccounts.length > 0 ? computedAccounts : (accounts || []);

    workingAccounts.forEach((acc) => {
      const balance = (acc.balanceCents || 0) / 100;
      const type = (acc.type || '').toLowerCase();
      const name = (acc.name || '').toLowerCase();
      const category = (acc.category || '').toLowerCase();

      if (type === 'asset') {
        const isInvestment = category.includes('investment') || name.includes('invest') || name.includes('brokerage') || name.includes('fund') || name.includes('vanguard') || name.includes('etf') || name.includes('stock');
        const isRealEstate = category.includes('property') || category.includes('real estate') || category.includes('fixed asset') || name.includes('residence') || name.includes('house') || name.includes('property') || name.includes('real estate');
        
        if (isInvestment) {
          investments += balance;
        } else if (isRealEstate) {
          realEstate += balance;
        } else {
          liquidAssets += balance;
        }
      } else if (type === 'liability') {
        liabilities += Math.abs(balance);
      }
    });

    const totalNetWorth = (liquidAssets + investments + realEstate) - liabilities;

    return {
      totalNetWorth,
      liquidAssets,
      investments,
      realEstate,
      liabilities: -liabilities,
      trend: 0
    };
  }, [computedAccounts, accounts]);

  const trackedItemsList = useMemo(() => {
    const workingAccounts = computedAccounts && computedAccounts.length > 0 ? computedAccounts : (accounts || []);
    return workingAccounts.filter(acc => acc.type === 'asset' || acc.type === 'liability');
  }, [computedAccounts, accounts]);

  const historicalNetWorthData = useMemo(() => {
    const workingAccounts = computedAccounts && computedAccounts.length > 0 ? computedAccounts : (accounts || []);
    if (!workingAccounts.length) return [];

    // Initialize map of account balances with opening balance
    const currentBalances: Record<string, number> = {};
    let runningAssets = 0;
    let runningLiabilities = 0;

    workingAccounts.forEach(acc => {
      const opening = (acc.openingBalanceCents || 0) / 100;
      currentBalances[acc.id] = opening;

      if (acc.type === 'asset') {
        runningAssets += opening;
      } else if (acc.type === 'liability') {
        runningLiabilities += Math.abs(opening);
      }
    });

    const timeline: { date: string; NetWorth: number; Assets: number; Liabilities: number }[] = [];

    // Pushing structural opening mark
    timeline.push({
      date: 'Opening',
      NetWorth: Math.round((runningAssets - runningLiabilities) * 100) / 100,
      Assets: Math.round(runningAssets * 100) / 100,
      Liabilities: Math.round(runningLiabilities * 100) / 100,
    });

    if (transactions && transactions.length > 0) {
      const activeTxs = transactions
        .filter(t => !t.deletedAt)
        .sort((a, b) => (a.date || '').localeCompare(b.date || ''));

      activeTxs.forEach((tx) => {
        tx.lines?.forEach((line) => {
          if (line.accountId in currentBalances) {
            const delta = (line.amountCents || 0) / 100;
            const acc = workingAccounts.find(a => a.id === line.accountId);
            if (!acc) return;

            if (acc.type === 'asset') {
              // Positive cents is debit, which raises asset balance
              runningAssets += delta;
            } else if (acc.type === 'liability') {
              // Negative cents is credit, which raises liability balance. So credits must subtract from NetWorth or increase absolute credit debt
              runningLiabilities += -delta;
            }
          }
        });

        // Format date to readable key
        let label = tx.date;
        try {
          label = format(new Date(tx.date), 'MM/dd/yy');
        } catch (_) {}

        timeline.push({
          date: label,
          NetWorth: Math.round((runningAssets - runningLiabilities) * 100) / 100,
          Assets: Math.round(runningAssets * 100) / 100,
          Liabilities: Math.round(runningLiabilities * 100) / 100,
        });
      });
    }

    // De-duplicate by date, keeping the final status of that day
    const uniqueMap = new Map<string, typeof timeline[0]>();
    timeline.forEach(pt => {
      uniqueMap.set(pt.date, pt);
    });

    return Array.from(uniqueMap.values());
  }, [transactions, computedAccounts, accounts]);

  const assetAllocationData = useMemo(() => {
    const data: any[] = [];
    return data.filter(d => d.value > 0);
  }, [displayData]);

  return (
    <div className="space-y-8 p-4 md:p-6 lg:p-10 w-full max-w-[1550px] mx-auto h-full text-slate-800">
      
      <div className="flex flex-col md:flex-row md:items-start md:justify-between border-b border-emerald-200 pb-6 gap-4">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="px-3 py-1 bg-emerald-50 text-emerald-700 rounded-full text-[9px] font-black tracking-widest uppercase shadow-sm border border-emerald-200">Wealth Orchestration</span>
            <div className="flex items-center gap-1.5 px-2.5 py-1 bg-slate-900 text-teal-400 rounded-full border border-slate-800">
               <Anchor size={10} />
               <span className="text-[9px] font-black tracking-widest uppercase">Value Engine Active</span>
            </div>
          </div>
          <h1 className="text-3xl font-black text-slate-800 uppercase tracking-tight font-display">
            All Is Worth It
          </h1>
          <p className="text-xs text-slate-500 mt-1 uppercase tracking-wider font-bold">
            A complete perspective on everything you have built and achieved.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-slate-900 text-white p-6 rounded-[32px] shadow-sm flex flex-col justify-between md:col-span-1 border border-slate-800 relative overflow-hidden">
           <div className="absolute top-0 right-0 p-6 opacity-20"><Wallet size={80} /></div>
           <div>
              <p className="text-[10px] font-medium uppercase tracking-wider text-slate-400">All Is Worth It</p>
              <p className="text-2xl md:text-3xl font-black tracking-tighter mt-1 font-mono">${(displayData.totalNetWorth).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
           </div>
           <div className="mt-8 flex items-center gap-2 text-emerald-400">
             <span className="text-[10px] font-black tracking-widest uppercase bg-slate-900/40 px-2 py-0.5 rounded border border-slate-700">Absolute Ledger Truth</span>
           </div>
        </div>

        <div className="bg-white p-6 rounded-[32px] border border-slate-200 shadow-sm flex flex-col justify-between">
           <div className="flex items-center justify-between">
              <p className="text-[10px] font-medium uppercase tracking-wider text-slate-500">Liquid Capital</p>
              <Wallet size={16} className="text-slate-400" />
           </div>
           <p className="text-2xl font-black tracking-tighter mt-4 font-mono">${(displayData.liquidAssets).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
        </div>
        
        <div className="bg-white p-6 rounded-[32px] border border-slate-200 shadow-sm flex flex-col justify-between">
           <div className="flex items-center justify-between">
              <p className="text-[10px] font-medium uppercase tracking-wider text-slate-500">Market Positions</p>
              <TrendingUp size={16} className="text-slate-400" />
           </div>
           <p className="text-2xl font-black tracking-tighter mt-4 font-mono">${(displayData.investments).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
        </div>

        <div className="bg-rose-50 p-6 rounded-[32px] border border-rose-100 shadow-sm flex flex-col justify-between">
           <div className="flex items-center justify-between">
              <p className="text-[10px] font-medium uppercase tracking-wider text-rose-500">Obligations</p>
              <ArrowDownRight size={16} className="text-rose-400" />
           </div>
           <p className="text-2xl font-black tracking-tighter mt-4 font-mono text-rose-700">
             {displayData.liabilities < 0 ? '-' : ''}${Math.abs(displayData.liabilities).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
           </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white border border-slate-200 rounded-[32px] shadow-sm p-6 flex flex-col justify-between min-h-[350px]">
             <div>
                <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">The Arc of Wealth</h3>
                <p className="text-[10px] font-medium text-slate-400 uppercase tracking-wider">Your financial journey, charted transaction by transaction.</p>
             </div>

             
             <div className="h-60 mt-4 relative">
                {historicalNetWorthData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={historicalNetWorthData}>
                      <defs>
                        <linearGradient id="netWorthGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#10b981" stopOpacity={0.2}/>
                          <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                      <XAxis dataKey="date" stroke="#94a3b8" fontSize={10} tickLine={false} />
                      <YAxis stroke="#94a3b8" fontSize={10} tickLine={false} tickFormatter={(val) => `$${val.toLocaleString()}`} />
                      <Tooltip 
                        contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '12px' }}
                        labelStyle={{ color: '#94a3b8', fontSize: '10px', fontWeight: 'bold' }}
                        itemStyle={{ color: '#fff', fontSize: '12px', fontWeight: 'black' }}
                        formatter={(value) => [`$${Number(value).toLocaleString()}`, 'Net Worth']}
                      />
                      <Area type="monotone" dataKey="NetWorth" stroke="#10b981" strokeWidth={2.5} fillOpacity={1} fill="url(#netWorthGrad)" />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-300">
                    <LineChartIcon size={32} className="text-slate-200 mb-2" />
                    <p className="text-[10px] font-medium uppercase tracking-widest">No timeline points yet</p>
                  </div>
                )}
             </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-[32px] shadow-sm p-6 flex flex-col justify-between min-h-[350px]">
             <div>
                <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">Capital Distribution</h3>
                <p className="text-[10px] font-medium text-slate-400 uppercase tracking-wider">The living structure of your financial standing.</p>
             </div>

             <div className="grid grid-cols-5 items-center gap-4 h-60 mt-4">
                <div className="col-span-3 h-full relative">
                   {assetAllocationData.length > 0 ? (
                     <ResponsiveContainer width="100%" height="100%">
                       <PieChart>
                         <Pie
                           data={assetAllocationData}
                           cx="50%"
                           cy="50%"
                           innerRadius={50}
                           outerRadius={80}
                           paddingAngle={4}
                           dataKey="value"
                         >
                           {assetAllocationData.map((entry, index) => (
                             <Cell key={`cell-${index}`} fill={entry.color} />
                           ))}
                         </Pie>
                         <Tooltip 
                           contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '12px' }}
                           itemStyle={{ color: '#fff', fontSize: '12px', fontWeight: 'bold' }}
                           formatter={(value) => [`$${Number(value).toLocaleString()}`, 'Balance']}
                         />
                       </PieChart>
                     </ResponsiveContainer>
                   ) : (
                     <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-300">
                       <PieChartIcon size={32} className="text-slate-200 mb-2" />
                       <p className="text-[10px] font-medium uppercase tracking-widest">No active allocation</p>
                     </div>
                   )}
                </div>

                <div className="col-span-2 space-y-3 pr-2">
                   {assetAllocationData.length > 0 ? (
                     assetAllocationData.map((item, index) => {
                       const totalAll = assetAllocationData.reduce((sum, d) => sum + d.value, 0) || 1;
                       const pct = Math.round((item.value / totalAll) * 100);
                       return (
                         <div key={index} className="flex flex-col">
                           <div className="flex items-center gap-1.5">
                             <span className="w-2 h-2 rounded-full" style={{ backgroundColor: item.color }} />
                             <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">{item.name}</span>
                           </div>
                           <div className="flex items-baseline gap-1 mt-0.5">
                             <span className="font-mono font-black text-xs text-slate-800">${item.value.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                             <span className="font-mono text-[9px] font-bold text-slate-400">({pct}%)</span>
                           </div>
                         </div>
                       );
                     })
                   ) : (
                     <p className="text-[10px] text-slate-400 italic">Financial structure will emerge once active capital is registered.</p>
                   )}
                </div>
             </div>
          </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-[32px] shadow-sm overflow-hidden">
         <div className="px-6 py-4 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
            <h3 className="text-xs font-medium uppercase tracking-wider text-slate-500">Active Holdings & Obligations</h3>
         </div>
         <div className="divide-y divide-slate-100">
            {trackedItemsList.length > 0 ? (
              trackedItemsList.map((acc) => {
                const balanceVal = (acc.balanceCents || 0) / 100;
                const isLiability = acc.type === 'liability';
                const nameLower = acc.name.toLowerCase();
                const catLower = (acc.category || '').toLowerCase();
                
                let IconComponent = Wallet;
                let iconClass = "bg-indigo-50 text-indigo-600 border-indigo-100";
                
                if (isLiability) {
                  IconComponent = Home;
                  iconClass = "bg-rose-50 text-rose-600 border-rose-100";
                } else if (catLower.includes('investment') || nameLower.includes('invest') || nameLower.includes('brokerage') || nameLower.includes('fund') || nameLower.includes('vanguard') || nameLower.includes('etf') || nameLower.includes('stock')) {
                  IconComponent = TrendingUp;
                  iconClass = "bg-emerald-50 text-emerald-600 border-emerald-100";
                } else if (catLower.includes('property') || catLower.includes('real estate') || catLower.includes('fixed asset') || nameLower.includes('residence') || nameLower.includes('house') || nameLower.includes('property')) {
                  IconComponent = Building;
                  iconClass = "bg-sky-50 text-sky-600 border-sky-100";
                }

                return (
                  <div key={acc.id || acc.code} className="p-6 flex items-center justify-between hover:bg-slate-50 transition-colors">
                     <div className="flex items-center gap-4">
                        <div className={`w-12 h-12 rounded-xl flex items-center justify-center border ${iconClass}`}>
                           <IconComponent size={20} />
                        </div>
                        <div>
                           <h4 className="font-black text-slate-800 uppercase tracking-tight">{acc.name}</h4>
                           <p className="text-[10px] font-bold text-slate-400 tracking-widest uppercase">
                             {acc.category || (isLiability ? 'Liability / Debt' : 'Asset Account')}
                           </p>
                        </div>
                     </div>
                     <div className="text-right">
                        <p className={`font-mono font-black text-lg ${isLiability ? 'text-rose-600' : 'text-slate-800'}`}>
                          {isLiability ? '-' : ''}${Math.abs(balanceVal).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </p>
                        <p className="text-[10px] font-bold text-slate-400 tracking-widest uppercase">Code {acc.code}</p>
                     </div>
                  </div>
                );
              })
            ) : (
              <div className="p-12 text-center text-slate-400">
                <p className="text-sm font-bold uppercase tracking-widest">The ledger is silent.</p>
                <p className="text-xs mt-1">To begin your financial journey, record transactions or initialize your active accounts.</p>
              </div>
            )}
         </div>
      </div>
    </div>
  );
}
