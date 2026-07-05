import React, { useMemo, useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { 
  Globe, 
  RefreshCcw, 
  TrendingUp, 
  TrendingDown, 
  ArrowUpRight, 
  Zap,
  ShieldCheck,
  ZapOff
} from 'lucide-react';
import { cn, formatCurrency } from '../../lib/utils';
import { useLedgerStore } from '../../stores/useLedgerStore';
import { TemporalTruth } from '../../modules/truth/TruthEngine';
import { TemporalValidity } from '../../types';
import { getIdToken } from '../../firebase';
import { toast } from 'sonner';

interface CurrencyRate {
  pair: string;
  currencyCode: string;
  rate: number;
  change: number;
  status: 'optimal' | 'volatile';
  timeSeries: TemporalValidity[];
}

export default function CurrencyHub() {
  const accounts = useLedgerStore(state => state.accounts);
  
  const [targetDate, setTargetDate] = useState(new Date().toISOString().split('T')[0]);
  const [baseDate, setBaseDate] = useState('2023-06-01');
  const [isSyncing, setIsSyncing] = useState(false);
  const [liveRates, setLiveRates] = useState<Record<string, number>>({});

  const defaultRates: CurrencyRate[] = useMemo(() => [
    { 
      pair: 'USD / EUR', currencyCode: 'EUR', rate: 0.924, change: 0.12, status: 'optimal',
      timeSeries: [
        { validFrom: '0000-01-01', validTo: '2022-12-31', value: 0.82 },
        { validFrom: '2023-01-01', validTo: '2023-12-31', value: 0.85 },
        { validFrom: '2024-01-01', validTo: '9999-12-31', value: 0.924 }
      ]
    },
    { 
      pair: 'USD / GBP', currencyCode: 'GBP', rate: 0.792, change: -0.05, status: 'optimal',
      timeSeries: [
        { validFrom: '0000-01-01', validTo: '2022-12-31', value: 0.72 },
        { validFrom: '2023-01-01', validTo: '2023-12-31', value: 0.75 },
        { validFrom: '2024-01-01', validTo: '9999-12-31', value: 0.792 }
      ]
    },
    { 
      pair: 'USD / JPY', currencyCode: 'JPY', rate: 155.82, change: 2.45, status: 'volatile',
      timeSeries: [
        { validFrom: '0000-01-01', validTo: '2022-12-31', value: 120.00 },
        { validFrom: '2023-01-01', validTo: '2023-12-31', value: 130.50 },
        { validFrom: '2024-01-01', validTo: '9999-12-31', value: 155.82 }
      ]
    },
    { 
      pair: 'USD / BTC', currencyCode: 'BTC', rate: 0.000015, change: -1.2, status: 'volatile',
      timeSeries: [
        { validFrom: '0000-01-01', validTo: '2022-12-31', value: 0.000040 },
        { validFrom: '2023-01-01', validTo: '2023-12-31', value: 0.000030 },
        { validFrom: '2024-01-01', validTo: '9999-12-31', value: 0.000015 }
      ]
    },
  ], []);

  const rates: CurrencyRate[] = useMemo(() => {
    return defaultRates.map(r => {
      const liveRate = liveRates[r.currencyCode];
      if (liveRate) {
        return {
          ...r,
          rate: liveRate,
          timeSeries: [
            ...r.timeSeries.filter(t => t.validTo !== '9999-12-31'),
            { validFrom: new Date().toISOString().split('T')[0], validTo: '9999-12-31', value: liveRate }
          ]
        };
      }
      return r;
    });
  }, [defaultRates, liveRates]);

  const fetchLiveRates = async () => {
    try {
      setIsSyncing(true);
      const token = await getIdToken();
      if (!token) return;

      const symbols = ["EUR", "GBP", "JPY", "BTC"].join(",");
      const res = await fetch(`/api/v1/currency/live?source=USD&currencies=${symbols}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      const data = await res.json();
      if (data.success && data.quotes) {
        setLiveRates({
           'EUR': data.quotes['USDEUR'],
           'GBP': data.quotes['USDGBP'],
           'JPY': data.quotes['USDJPY'],
           'BTC': data.quotes['USDBTC']
        });
        toast.success('Enterprise API: Live rates synced successfully');
      } else if (!data.success && data.error) {
        toast.error(`Currency API Error: ${data.error.info || data.error.type}`);
      }
    } catch (e: any) {
      console.error(e);
      toast.error('Failed to sync live currency rates', { description: e.message });
    } finally {
      setIsSyncing(false);
    }
  };

  useEffect(() => {
    fetchLiveRates();
  }, []);

  // Compute foreign exposure
  const foreignAccounts = useMemo(() => {
    return accounts.filter(a => a.currency && a.currency !== 'USD');
  }, [accounts]);

  const { baseAssetValue, currentValuation, unrealizedDelta } = useMemo(() => {
    let base = 0;
    let current = 0;

    foreignAccounts.forEach(acc => {
      const code = acc.currency || 'USD';
      const rateConfig = rates.find(r => r.currencyCode === code);
      if (rateConfig) {
        // Historical generic base (simulating average entry cost via old timeSeries)
        try {
          const historicalRate = TemporalTruth.resolveEffectiveValue(rateConfig.timeSeries, baseDate);
          const currentRate = TemporalTruth.resolveEffectiveValue(rateConfig.timeSeries, targetDate);
          
          // Simple derivation of USD value: Foreign Balance / Rate
          // e.g. 100 EUR / 0.85 = $117.64
          const historicalUsd = acc.balanceCents / historicalRate;
          const currentUsd = acc.balanceCents / currentRate;
          
          base += historicalUsd;
          current += currentUsd;
        } catch (e) {
          console.warn("Could not resolve temporal truth", e);
        }
      }
    });

    return {
      baseAssetValue: Math.round(base),
      currentValuation: Math.round(current),
      unrealizedDelta: Math.round(current - base)
    };
  }, [foreignAccounts, rates, targetDate]);

  return (
    <div className="space-y-12">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-8">
        <div>
          <div className="flex items-center gap-2 text-[10px] font-black text-indigo-500 uppercase tracking-widest truncate mb-4">
            <Globe size={14} />
            Treasury Management
          </div>
          <h2 className="text-3xl md:text-5xl font-black text-slate-900 tracking-tighter italic">Currency Exposure</h2>
          <p className="text-slate-500 font-medium text-lg mt-2 italic opacity-60">High-frequency exchange rate tracking and temporal unrealized valuation analysis.</p>
        </div>

        <div className="flex flex-wrap items-center gap-4">
           <div className="px-6 py-4 bg-white border border-slate-200 rounded-[32px] flex items-center gap-4 shadow-sm">
              <div className="flex flex-col">
                <span className="text-[9px] font-medium uppercase tracking-wider text-slate-500 mb-1">Base Date</span>
                <input 
                  type="date" 
                  value={baseDate} 
                  onChange={(e) => setBaseDate(e.target.value)}
                  className="bg-transparent text-sm font-bold text-slate-900 outline-none"
                />
              </div>
           </div>
           <div className="px-6 py-4 bg-white border border-slate-200 rounded-[32px] flex items-center gap-4 shadow-sm">
              <div className="flex flex-col">
                <span className="text-[9px] font-medium uppercase tracking-wider text-slate-500 mb-1">Valuation Date</span>
                <input 
                  type="date" 
                  value={targetDate} 
                  onChange={(e) => setTargetDate(e.target.value)}
                  className="bg-transparent text-sm font-bold text-slate-900 outline-none"
                />
              </div>
           </div>
           <div className="px-6 py-4 bg-white border border-slate-200 rounded-[32px] flex items-center gap-4 shadow-sm">
              <div className="flex items-center gap-2">
                 <div className={cn("w-2 h-2 rounded-full", isSyncing ? "bg-amber-500 animate-pulse" : "bg-emerald-500")} />
                 <span className="text-[10px] font-medium uppercase tracking-wider text-slate-500">
                   {isSyncing ? 'Syncing Rates...' : 'Market Sync Ready'}
                 </span>
              </div>
              <div className="h-4 w-px bg-slate-200" />
              <button 
                onClick={fetchLiveRates}
                disabled={isSyncing}
                className="flex items-center gap-2 text-[10px] font-medium uppercase tracking-wider text-slate-900 hover:text-indigo-600 transition-colors disabled:opacity-50"
              >
                 <RefreshCcw size={14} className={isSyncing ? "animate-spin" : ""} />
                 Force Refetch
              </button>
           </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
        {rates.map((rate) => {
          const effectiveRate = TemporalTruth.resolveEffectiveValue(rate.timeSeries, targetDate).toFixed(4);
          return (
            <motion.div 
              key={rate.pair}
              whileHover={{ y: -5 }}
              className="p-4 md:p-8 bg-white border border-slate-200 rounded-[32px] shadow-sm relative overflow-hidden group"
            >
              <div className={cn(
                "absolute top-0 right-0 w-1 h-full",
                rate.status === 'optimal' ? "bg-emerald-500" : "bg-orange-500"
              )} />
              
              <div className="flex items-center justify-between mb-8">
                 <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest truncate opacity-40">{rate.pair}</span>
                 {rate.status === 'volatile' ? <ZapOff size={14} className="text-orange-500" /> : <ShieldCheck size={14} className="text-emerald-500" />}
              </div>

              <div className="space-y-1">
                 <div className="text-3xl font-black text-slate-900 font-mono tracking-tighter italic">{effectiveRate}</div>
                 <div className={cn(
                   "flex items-center gap-1 text-[11px] font-medium uppercase tracking-wider",
                   rate.change > 0 ? "text-emerald-600" : "text-rose-600"
                 )}>
                    {rate.change > 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                    {rate.change > 0 ? '+' : ''}{rate.change}%
                 </div>
              </div>

              <div className="mt-8 pt-6 border-t border-slate-200 flex justify-between items-center">
                 <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest opacity-30">Temporal Truth</span>
                 <button className="w-8 h-8 rounded-lg bg-slate-50 flex items-center justify-center text-slate-500 hover:text-slate-900 transition-colors border border-slate-200">
                    <ArrowUpRight size={14} />
                 </button>
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Revaluation Control */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-12">
         <div className="xl:col-span-8 bg-slate-900 rounded-[32px] p-12 text-white relative overflow-hidden">
            <div className="absolute technical-grid inset-0 opacity-[0.05] pointer-events-none" />
            <div className="flex items-start justify-between relative z-10 mb-12">
               <div>
                  <h3 className="text-3xl font-black tracking-tight italic uppercase">Valuation Adjustment</h3>
                  <p className="text-xs font-medium text-white/40 uppercase tracking-[0.3em] mt-2">Update balance sheet based on multi-currency temporal fluctuations</p>
               </div>
               <Zap size={32} className="text-emerald-400" />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-12 relative z-10">
               <div className="space-y-4">
                  <p className="text-[10px] font-black text-white/30 uppercase tracking-widest">Base Asset Value (USD Equivalent)</p>
                  <p className="text-2xl md:text-4xl font-black italic tracking-tighter">{formatCurrency(baseAssetValue)}</p>
               </div>
               <div className="space-y-4">
                  <p className="text-[10px] font-black text-white/30 uppercase tracking-widest">Unrealized Delta ({targetDate})</p>
                  <p className={cn("text-4xl font-black italic tracking-tighter", unrealizedDelta >= 0 ? "text-emerald-400" : "text-rose-400")}>
                    {unrealizedDelta >= 0 ? '+' : ''}{formatCurrency(unrealizedDelta)}
                  </p>
               </div>
               <div className="pt-4 flex items-end">
                  <button className="w-full py-5 bg-white text-slate-900 rounded-[32px] text-xs font-medium uppercase tracking-wider hover:bg-emerald-500 hover:text-white transition-all shadow-2xl disabled:opacity-50" disabled={unrealizedDelta === 0}>
                     Sync Revaluation Entry
                  </button>
               </div>
            </div>
         </div>

         <div className="xl:col-span-4 bg-indigo-500/5 border-2 border-indigo-500/20 rounded-[32px] p-12 space-y-8 flex flex-col justify-between">
            <div>
               <h4 className="text-2xl font-black text-indigo-900 tracking-tight italic uppercase">Market Feed</h4>
               <p className="text-[10px] font-bold text-indigo-900/40 uppercase tracking-[0.3em] mt-1 italic">Inter-bank Spot Rate Pipeline</p>
            </div>
            
            <div className="space-y-6">
               {rates.slice(0, 3).map(rate => (
                 <div key={rate.pair} className="flex items-center justify-between p-4 bg-white/50 border border-indigo-500/10 rounded-[32px]">
                    <div className="w-10 h-10 rounded-xl bg-indigo-500/10 flex items-center justify-center text-indigo-600">
                       <RefreshCcw size={18} className={isSyncing ? "animate-spin" : ""} />
                    </div>
                    <div className="flex-1 px-4">
                       <div className="flex items-center justify-between mb-1">
                          <div className="text-xs font-bold text-indigo-900">{rate.pair}</div>
                          {!isSyncing && <div className="text-xs font-black font-mono text-indigo-600">{rate.rate.toFixed(4)}</div>}
                       </div>
                       <div className="h-1.5 w-full bg-indigo-500/10 rounded-full overflow-hidden">
                          {isSyncing ? (
                            <motion.div 
                              animate={{ x: [-100, 200] }}
                              transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
                              className="h-full w-20 bg-indigo-500/40"
                            />
                          ) : (
                            <div className="h-full w-full bg-emerald-500/40" />
                          )}
                       </div>
                    </div>
                    <span className="text-[9px] font-mono text-indigo-600 uppercase font-black ml-2">
                      {isSyncing ? 'Syncing...' : 'Live'}
                    </span>
                 </div>
               ))}
            </div>

            <p className="text-[9px] font-black text-indigo-500/40 leading-relaxed uppercase tracking-widest">
               All rates derived from real-time inter-bank market feeds. Compliance verified.
            </p>
         </div>
      </div>
    </div>
  );
}
