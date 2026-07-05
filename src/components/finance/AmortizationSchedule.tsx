import { TruthEngine } from '../../modules/truth/TruthEngine';
import React, { useState } from 'react';
import { Calculator, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';

interface AmortizationProps {
  workspaceId: string;
  formatCurrency: (cents: number) => string;
}

export default function AmortizationSchedule({ workspaceId, formatCurrency }: AmortizationProps) {
  const [principalCents, setPrincipalCents] = useState<number>(0);
  const [annualInterestRate, setAnnualInterestRate] = useState<number>(0.05);
  const [totalPeriods, setTotalPeriods] = useState<number>(360);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);

  const calculateAmortization = async () => {
    if (principalCents <= 0 || totalPeriods <= 0) {
      toast.error('Invalid loan parameters');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('/api/v1/math/amortization', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          principalCents,
          annualInterestRate,
          totalPeriods,
          paymentsPerYear: 12
        })
      });

      if (!response.ok) {
        throw new Error('Failed to calculate amortization');
      }

      const data = await response.json();
      setResult(data);
      toast.success('Amortization schedule validated by TruthEngine');
    } catch (err) {
      console.error(err);
      toast.error('Matrix calculation failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-8 p-4 md:p-6 lg:p-10 w-full max-w-[1550px] mx-auto pb-20 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between border-b border-slate-200 pb-6 gap-4">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Calculator size={24} className="text-slate-600" />
            <span className="text-xs font-black uppercase tracking-widest text-slate-500">
              Mathematical Forecasting
            </span>
          </div>
          <h1 className="text-3xl font-black text-slate-800 uppercase tracking-tight font-display">
            Amortization Engine
          </h1>
          <p className="text-xs text-slate-500 mt-1 uppercase tracking-wider font-bold max-w-2xl">
            Cryptographic mathematical evaluation of principal vs interest burn rates over time
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="col-span-1 border border-slate-200 rounded-[32px] bg-white p-8 shadow-sm flex flex-col justify-between">
          <div>
            <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-8">Loan Parameters</h3>
            
            <div className="space-y-6">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block">Principal Amount ($)</label>
                <input 
                  type="number"
                  value={principalCents / 100 || ''}
                  onChange={(e) => setPrincipalCents(TruthEngine.parseAmountToCents(e.target.value))}
                  className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-[32px] focus:outline-none focus:ring-2 focus:ring-slate-900 transition-all font-mono font-black text-lg text-slate-800 shadow-sm"
                  placeholder="0.00"
                />
              </div>
              
              <div className="space-y-2">
                 <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block">Annual Interest Rate (%)</label>
                 <input 
                   type="number"
                   step="0.01"
                   value={(annualInterestRate * 100).toFixed(2)}
                   onChange={(e) => setAnnualInterestRate(parseFloat(e.target.value) / 100)}
                   className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-[32px] focus:outline-none focus:ring-2 focus:ring-slate-900 transition-all font-mono font-black text-lg text-slate-800 shadow-sm"
                   placeholder="0.00"
                 />
              </div>

              <div className="space-y-2">
                 <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block">Total Periods (Months)</label>
                 <input 
                   type="number"
                   value={totalPeriods}
                   onChange={(e) => setTotalPeriods(parseInt(e.target.value))}
                   className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-[32px] focus:outline-none focus:ring-2 focus:ring-slate-900 transition-all font-mono font-black text-lg text-slate-800 shadow-sm"
                   placeholder="360"
                 />
              </div>
            </div>
          </div>

          <button 
             onClick={calculateAmortization}
             disabled={loading}
             className="w-full py-4 mt-10 bg-slate-900 text-white rounded-[32px] font-black tracking-widest uppercase text-xs hover:bg-slate-800 transition-all active:scale-95 flex items-center justify-center shadow-lg"
          >
             {loading ? 'Evaluating...' : 'Compute Schedule'}
          </button>
        </div>

        <div className="col-span-1 lg:col-span-2">
          {result ? (
            <div className="h-full border border-slate-800 rounded-[32px] bg-slate-900 p-8 md:p-12 shadow-xl text-white flex flex-col justify-between relative overflow-hidden">
               <div className="absolute technical-grid inset-0 opacity-[0.03]" />
               <div className="absolute top-0 right-0 p-12 opacity-[0.03] pointer-events-none">
                 <ShieldCheck size={250} />
               </div>
               
               <div className="relative z-10 space-y-8 flex-1 flex flex-col justify-center">
                 <div className="flex items-center gap-3 mb-4">
                   <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
                     <ShieldCheck size={20} />
                   </div>
                   <h3 className="text-xs font-black uppercase tracking-widest text-emerald-400">Mathematical Truth Reached</h3>
                 </div>

                 <div className="grid grid-cols-1 sm:grid-cols-2 gap-10">
                   <div>
                     <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Periodic Payment</p>
                     <p className="text-4xl md:text-6xl font-black font-mono tracking-tighter text-white drop-shadow-[0_0_15px_rgba(255,255,255,0.1)]">
                        {formatCurrency(result.periodicPaymentCents)}
                     </p>
                     <p className="text-xs text-slate-400 mt-3 font-bold uppercase tracking-wider leading-relaxed">Standard monthly deduction required to zero balance.</p>
                   </div>
                   <div>
                     <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Total Validated Interest</p>
                     <p className="text-3xl md:text-5xl font-black font-mono tracking-tighter text-amber-400 drop-shadow-[0_0_15px_rgba(251,191,36,0.2)]">
                        {formatCurrency((result.periodicPaymentCents * totalPeriods) - principalCents)}
                     </p>
                     <p className="text-xs text-slate-400 mt-3 font-bold uppercase tracking-wider leading-relaxed">Capital lost to servicing fees.</p>
                   </div>
                 </div>
               </div>

               <div className="relative z-10 pt-8 mt-10 border-t border-slate-800 flex justify-between items-center">
                 <span className="text-[10px] font-black uppercase tracking-widest text-emerald-500 flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" /> TruthEngine Verified
                 </span>
                 <p className="text-xs font-mono font-black text-slate-600">
                   {totalPeriods} / {totalPeriods} Complete
                 </p>
               </div>
            </div>
          ) : (
             <div className="h-full border border-dashed border-slate-300 rounded-[32px] bg-slate-50/50 flex flex-col items-center justify-center p-12 text-center">
                <div className="w-16 h-16 bg-white rounded-[32px] shadow-sm border border-slate-200 flex items-center justify-center mb-6">
                  <Calculator size={28} className="text-slate-400" />
                </div>
                <h3 className="text-sm font-black text-slate-800 uppercase tracking-wider mb-2">Awaiting Operation</h3>
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest max-w-sm leading-relaxed">
                  Input capital parameters to deploy the TruthEngine mathematical solver and realize the amortization curve.
                </p>
             </div>
          )}
        </div>
      </div>
    </div>
  );
}
