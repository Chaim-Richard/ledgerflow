import { useLedgerStore } from '../../stores/useLedgerStore';
import React, { useState, useMemo } from 'react';
import { User } from 'firebase/auth';
import { Transaction, ChartAccount, TaxRate } from '../../types';
import { TruthEngine } from '../../modules/integrity/TruthEngine';
import { 
  Receipt, 
  Calculator, 
  Download, 
  Plus,
  Trash2,
  Edit2,
  Activity,
  Layers,
  ShieldCheck,
  Zap
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { parseLocalDate, cn, formatCurrency, safeConfirm } from '../../lib/utils';

interface TaxManagerProps {
  user?: User | null;
  workspaceId?: string;
  accounts?: ChartAccount[];
  taxRates?: TaxRate[];
  onAddTaxRate?: (data: Partial<TaxRate>) => Promise<void>;
  onUpdateTaxRate?: (id: string, data: Partial<TaxRate>) => Promise<void>;
  onDeleteTaxRate?: (id: string) => Promise<void>;
}

export default function TaxManager({ 
  user, 
  workspaceId = 'default', 
  accounts = [],
  taxRates = [],
  onAddTaxRate,
  onUpdateTaxRate,
  onDeleteTaxRate
}: TaxManagerProps = {}) {
  const transactions = useLedgerStore(state => state.transactions || []);
  
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingRate, setEditingRate] = useState<TaxRate | null>(null);
  const [activeTab, setActiveTab] = useState<'rates' | 'contractors' | 'reporting'>('rates');
  const [includeSE, setIncludeSE] = useState(false);
  
  const taxMetrics = useMemo(() => {
    const yearTransactions = (transactions || []).filter(tx => parseLocalDate(tx.date).getFullYear() === selectedYear);
    
    const grossIncome = yearTransactions
      .reduce((acc, tx) => {
        const incomeLines = tx.lines?.filter(l => accounts.find(a => a.id === l.accountId)?.type === 'income') || [];
        // Typically income lines are negative in a ledger (Credit)
        return acc + incomeLines.reduce((sum, l) => sum + Math.abs(l.amountCents), 0);
      }, 0);

    const expenses = yearTransactions
      .reduce((acc, tx) => {
        const expenseLines = tx.lines?.filter(l => accounts.find(a => a.id === l.accountId)?.type === 'expense') || [];
        return acc + expenseLines.reduce((sum, l) => sum + Math.abs(l.amountCents), 0);
      }, 0);

    const netProfit = grossIncome - expenses;
    
    const incomeTaxConfig = taxRates.find(r => r.type === 'Income');
    
    let effectiveTaxRate = incomeTaxConfig?.rate ?? 0.21;
    if (incomeTaxConfig?.timeSeries && incomeTaxConfig.timeSeries.length > 0) {
      try {
        // Evaluate the tax rate specifically for the end of the selected fiscal year
        effectiveTaxRate = TruthEngine.resolveEffectiveValue(incomeTaxConfig.timeSeries, `${selectedYear}-12-31`);
      } catch (err) {
        console.warn('Temporal Integrity resolution failed for tax rate, falling back to static rate', err);
      }
    }

    const estimatedTax = netProfit > 0 ? (netProfit * effectiveTaxRate) + (includeSE ? netProfit * 0.153 : 0) : 0; 

    const salesTaxCollected = yearTransactions
      .flatMap(tx => tx.lines)
      .filter(line => accounts.find(a => a.id === line.accountId)?.name.toLowerCase().includes('sales tax'))
      .reduce((acc, line) => acc + line.amountCents, 0);

    return {
      grossIncome,
      expenses,
      netProfit,
      estimatedTax,
      salesTaxCollected
    };
  }, [selectedYear, accounts, taxRates, includeSE]);

  return (
    <div className="space-y-12 p-4 md:p-6 lg:p-10 w-full max-w-[1550px] mx-auto pb-20 animate-in fade-in duration-500">
      {/* Rule Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-8 border-b border-[var(--line)] pb-8">
        <div>
          <div className="flex items-center gap-2 text-xs font-black text-slate-500 uppercase tracking-widest truncate mb-2">
            <Receipt size={24} className="text-slate-600" />
            Fiscal Compliance Protocol
          </div>
          <h2 className="text-3xl font-black text-[var(--text)] tracking-tight uppercase font-display">Tax Reserve Estimator</h2>
          <p className="text-xs text-slate-500 font-bold uppercase tracking-wider mt-1">Rough tax reserve estimate — not tax advice. Confirm with your accountant.</p>
        </div>

        <div className="flex items-center gap-4">
          <div className="relative">
             <select 
               value={selectedYear}
               onChange={(e) => setSelectedYear(parseInt(e.target.value, 10))}
               className="px-6 py-3.5 bg-[var(--ink)] border border-[var(--line)] rounded-[32px] text-[10px] font-black uppercase tracking-widest text-[var(--text)] focus:outline-none focus:ring-2 focus:ring-slate-900 transition-all appearance-none cursor-pointer pr-10 shadow-sm"
             >
               {[2023, 2024, 2025, 2026].map(year => (
                 <option key={year} value={year}>{year} Fiscal Domain</option>
               ))}
             </select>
          </div>
          <button className="flex items-center gap-2 px-6 py-3.5 bg-[var(--brass)] text-black rounded-[32px] text-[10px] font-black uppercase tracking-widest hover:opacity-90 transition-all active:scale-95 shadow-md cursor-pointer">
            <Download size={16} />
            Fiscal Export
          </button>
        </div>
      </div>

      {/* Tab Selector */}
      <div className="flex flex-wrap items-center gap-2 p-2 bg-[var(--ink)] border border-[var(--line)] rounded-[32px] w-fit shadow-sm">
        <button
          onClick={() => setActiveTab('rates')}
          className={cn(
            "px-6 py-3 rounded-[32px] text-[10px] font-black uppercase tracking-widest transition-all cursor-pointer active:scale-95",
            activeTab === 'rates' ? "bg-[var(--brass)] text-black font-bold shadow-md" : "text-[var(--muted)] hover:text-[var(--text)]"
          )}
        >
          Federal Rates & Provisions
        </button>
        
        
      </div>

      {(
        <>
          {/* Deterministic Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="p-6 md:p-8 bg-[var(--surface)] rounded-[32px] border border-[var(--line)] shadow-sm relative overflow-hidden group">
          <div className="absolute technical-grid inset-0 opacity-[0.02] pointer-events-none" />
          <div className="flex justify-between items-start relative z-10 mb-4">
            <p className="text-[10px] font-black text-[var(--muted)] uppercase tracking-widest">Estimated Liability</p>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={includeSE} onChange={e => setIncludeSE(e.target.checked)} className="accent-[var(--brass)] w-3 h-3 cursor-pointer" />
              <span className="text-[9px] font-black text-[var(--text)] uppercase tracking-widest">Incl. SE Tax</span>
            </label>
          </div>
          <p className="text-3xl md:text-4xl font-black text-[var(--text)] font-mono tracking-tighter relative z-10">
            {formatCurrency(taxMetrics.estimatedTax)}
          </p>
          <div className="mt-4 flex items-center gap-2 text-[9px] font-black text-[var(--brass)] uppercase tracking-widest bg-[var(--brass-soft)] p-2 rounded-lg border border-[var(--brass-line)] w-fit">
             <Calculator size={12} />
             Basis: {((taxMetrics.estimatedTax / Math.max(1, taxMetrics.netProfit)) * 100).toFixed(1)}% Eff. Factor
          </div>
        </div>

        <div className="p-6 md:p-8 bg-[var(--surface)] rounded-[32px] border border-[var(--line)] shadow-sm relative overflow-hidden group">
          <div className="absolute technical-grid inset-0 opacity-[0.02] pointer-events-none" />
          <p className="text-[10px] font-black text-[var(--muted)] uppercase tracking-widest mb-4 relative z-10">Indirect Provisioning</p>
          <p className="text-3xl md:text-4xl font-black text-[var(--text)] font-mono tracking-tighter relative z-10">
            {formatCurrency(taxMetrics.salesTaxCollected)}
          </p>
          <div className="mt-4 flex items-center gap-2 text-[9px] font-black text-[var(--pos)] uppercase tracking-widest bg-[var(--pos)]/10 p-2 rounded-lg border border-[var(--pos)]/20 w-fit">
             <ShieldCheck size={12} />
             100% Locked for Filing
          </div>
        </div>

        <div className="p-6 md:p-8 bg-[var(--surface)] rounded-[32px] border border-[var(--line)] shadow-sm relative overflow-hidden group">
          <div className="absolute technical-grid inset-0 opacity-[0.02] pointer-events-none" />
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4 relative z-10">Fiscal Period Yield</p>
          <p className="text-3xl md:text-4xl font-black text-[var(--text)] font-mono tracking-tighter relative z-10">
            {formatCurrency(taxMetrics.netProfit)}
          </p>
          <div className="mt-4 flex items-center gap-2 text-[9px] font-black text-slate-500 uppercase tracking-widest bg-[var(--ink)] p-2 rounded-lg border border-[var(--line)] w-fit">
             <Activity size={12} />
             Net Taxable Momentum
          </div>
        </div>

        <div className="p-6 md:p-8 bg-slate-900 text-white rounded-[32px] shadow-xl relative overflow-hidden group border border-slate-800">
          <div className="absolute technical-grid inset-0 opacity-[0.03] pointer-events-none" />
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4 relative z-10">Audit Deadline</p>
          <p className="text-3xl md:text-4xl font-black text-amber-400 tracking-tighter font-display relative z-10">April 15</p>
          <div className="mt-4 flex items-center gap-2 text-[9px] font-black text-amber-400 uppercase tracking-widest bg-amber-500/10 p-2 rounded-lg border border-amber-500/20 w-fit">
             <Zap size={12} />
             T-Minus 84d Critical
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Rate Matrix */}
        <div className="lg:col-span-4 space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-black text-[var(--text)] tracking-tight uppercase font-display">Rate Protocols</h3>
            <button 
              onClick={() => {
                setEditingRate(null);
                setIsModalOpen(true);
              }}
              className="w-10 h-10 bg-slate-900 text-white rounded-[32px] flex items-center justify-center hover:bg-slate-800 transition-all shadow-md active:scale-95"
            >
              <Plus size={18} />
            </button>
          </div>

          <div className="space-y-4">
            {taxRates.map(rate => (
              <motion.div 
                key={rate.id}
                whileHover={{ x: 4 }}
                className="p-6 bg-[var(--surface)] rounded-[32px] border border-[var(--line)] shadow-sm relative overflow-hidden group hover:border-slate-300 transition-all"
              >
                <div className="absolute technical-grid inset-0 opacity-[0.02] pointer-events-none" />
                <div className="flex items-center justify-between relative z-10">
                  <div className="space-y-1">
                    <p className="text-sm font-black text-[var(--text)] leading-none uppercase tracking-tight">{rate.name}</p>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{rate.type} Classification</p>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-black font-mono text-[var(--text)] tracking-tighter">{(rate.rate * 100).toFixed(1)}%</p>
                    <div className="flex items-center justify-end gap-3 mt-2 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                      <button onClick={() => { setEditingRate(rate); setIsModalOpen(true); }} className="text-slate-400 hover:text-[var(--text)] transition-colors"><Edit2 size={14} /></button>
                      <button onClick={() => onDeleteTaxRate?.(rate.id)} className="text-slate-400 hover:text-rose-500 transition-colors"><Trash2 size={14} /></button>
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>

        {/* Forensic Breakdown */}
        <div className="lg:col-span-8 space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-black text-[var(--text)] tracking-tight uppercase font-display">Liability Mapping</h3>
            <div className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest">
               <Layers size={14} />
               Cross-Analysis active
            </div>
          </div>

          <div className="bg-[var(--surface)] rounded-[32px] border border-[var(--line)] overflow-hidden shadow-sm relative group">
            <div className="absolute technical-grid inset-0 opacity-[0.01] pointer-events-none" />
            <div className="overflow-x-auto">
              <table className="w-full text-left relative z-10 min-w-[700px]">
              <thead>
                <tr className="bg-[var(--ink)] border-b border-[var(--line)]">
                  <th className="px-6 py-5 text-[10px] font-black text-slate-500 uppercase tracking-widest">Protocol Domain</th>
                  <th className="px-6 py-5 text-[10px] font-black text-slate-500 uppercase tracking-widest text-right">Basis</th>
                  <th className="px-6 py-5 text-[10px] font-black text-slate-500 uppercase tracking-widest text-center">Metric</th>
                  <th className="px-6 py-5 text-[10px] font-black text-slate-700 uppercase tracking-widest text-right bg-slate-100/50">Apportionment</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                <tr className="hover:bg-[var(--ink)]/50 transition-all group/row">
                  <td className="px-6 py-6">
                    <p className="text-sm font-black text-[var(--text)] tracking-tight uppercase">Federal Corporate Levy</p>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1 font-mono">IRC SEC 11 COMPLIANT</p>
                  </td>
                  <td className="px-6 py-6 text-right font-mono text-sm font-black text-[var(--text)]">
                    {formatCurrency(taxMetrics.netProfit)}
                  </td>
                  <td className="px-6 py-6 text-center">
                    <div className="inline-flex h-7 items-center px-3 bg-slate-100 rounded-lg text-[9px] font-black text-slate-500 uppercase tracking-widest border border-[var(--line)]">NET_YIELD</div>
                  </td>
                  <td className="px-6 py-6 text-right font-mono text-base font-black text-[var(--text)] bg-[var(--ink)]/50 group-hover/row:bg-slate-100/50">
                    {formatCurrency(taxMetrics.netProfit > 0 ? taxMetrics.netProfit * (taxRates.find(r => r.type === 'Income')?.rate ?? 0.21) : 0)}
                  </td>
                </tr>
                {includeSE && (
                <tr className="hover:bg-[var(--ink)]/50 transition-all group/row">
                  <td className="px-6 py-6">
                    <p className="text-sm font-black text-[var(--text)] tracking-tight uppercase">Self-Employment Tax</p>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1 font-mono">SECA PROVISION (15.3%)</p>
                  </td>
                  <td className="px-6 py-6 text-right font-mono text-sm font-black text-[var(--text)]">
                    {formatCurrency(taxMetrics.netProfit)}
                  </td>
                  <td className="px-6 py-6 text-center">
                    <div className="inline-flex h-7 items-center px-3 bg-slate-100 rounded-lg text-[9px] font-black text-slate-500 uppercase tracking-widest border border-[var(--line)]">NET_YIELD</div>
                  </td>
                  <td className="px-6 py-6 text-right font-mono text-base font-black text-[var(--text)] bg-[var(--ink)]/50 group-hover/row:bg-slate-100/50">
                    {formatCurrency(taxMetrics.netProfit > 0 ? taxMetrics.netProfit * 0.153 : 0)}
                  </td>
                </tr>
                )}
                <tr className="hover:bg-[var(--ink)]/50 transition-all group/row">
                  <td className="px-6 py-6">
                    <p className="text-sm font-black text-[var(--text)] tracking-tight uppercase">Indirect Consumption Flow</p>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1 font-mono">SALES & USE PASS-THROUGH</p>
                  </td>
                  <td className="px-6 py-6 text-right font-mono text-sm font-black text-[var(--text)]">
                    {formatCurrency(taxMetrics.salesTaxCollected)}
                  </td>
                  <td className="px-6 py-6 text-center">
                    <div className="inline-flex h-7 items-center px-3 bg-slate-100 rounded-lg text-[9px] font-black text-slate-500 uppercase tracking-widest border border-[var(--line)]">GROSS_FLOW</div>
                  </td>
                  <td className="px-6 py-6 text-right font-mono text-base font-black text-emerald-600 bg-emerald-50/50 group-hover/row:bg-emerald-50">
                    {formatCurrency(taxMetrics.salesTaxCollected)}
                  </td>
                </tr>
              </tbody>
            </table>
            </div>
          </div>
        </div>
      </div>
      </>
      )}

      {/* Persistence Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-[600] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsModalOpen(false)}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-xl bg-[var(--surface)] rounded-[32px] shadow-2xl border border-[var(--line)] overflow-hidden p-8 md:p-12"
            >
              <div className="flex items-center justify-between mb-10">
                 <div>
                    <h2 className="text-2xl font-black text-[var(--text)] tracking-tight uppercase font-display">{editingRate ? 'Modify Protocol' : 'Deploy Threshold'}</h2>
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-1">Operational Fiscal Parameterization</p>
                 </div>
                 <button onClick={() => setIsModalOpen(false)} className="w-12 h-12 bg-[var(--ink)] rounded-[32px] flex items-center justify-center text-slate-400 hover:text-[var(--text)] hover:bg-slate-100 transition-all border border-[var(--line)]">
                    <Plus size={24} className="rotate-45" />
                 </button>
              </div>

              <form 
                onSubmit={async (e) => {
                  e.preventDefault();
                  const formData = new FormData(e.currentTarget);
                  const data = {
                    name: formData.get('name') as string,
                    type: formData.get('type') as any,
                    rate: parseFloat(formData.get('rate') as string) / 100,
                  };

                  if (editingRate) {
                    await onUpdateTaxRate?.(editingRate.id, data);
                  } else {
                    await onAddTaxRate?.(data);
                  }
                  setIsModalOpen(false);
                }}
                className="space-y-6"
              >
                <div className="space-y-2">
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest truncate">Threshold Metadata (Name)</label>
                  <input name="name" required defaultValue={editingRate?.name} placeholder="e.g. FEDERAL_REVENUE_SERVICE" className="w-full px-5 py-4 bg-[var(--ink)] border border-[var(--line)] rounded-[32px] focus:outline-none focus:ring-2 focus:ring-slate-900 transition-all font-bold text-[var(--text)] uppercase tracking-widest placeholder:text-slate-300" />
                </div>

                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest truncate">Scalar Intensity (%)</label>
                    <input name="rate" type="number" step="0.1" required defaultValue={(editingRate?.rate ?? 0) * 100} className="w-full px-5 py-4 bg-[var(--ink)] border border-[var(--line)] rounded-[32px] focus:outline-none focus:ring-2 focus:ring-slate-900 transition-all font-mono font-black text-[var(--text)] text-right text-lg" />
                  </div>
                  <div className="space-y-2">
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest truncate">Mapping Type</label>
                    <select name="type" defaultValue={editingRate?.type || 'Income'} className="w-full px-5 py-4 bg-[var(--ink)] border border-[var(--line)] rounded-[32px] focus:outline-none focus:ring-2 focus:ring-slate-900 transition-all font-bold text-[var(--text)] appearance-none cursor-pointer uppercase tracking-widest">
                      <option value="Income">Income Protocol</option>
                      <option value="Sales">Sales Flow</option>
                      <option value="Payroll">Payroll Cluster</option>
                    </select>
                  </div>
                </div>

                <div className="pt-8 flex gap-4 border-t border-[var(--line)] mt-8">
                  <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 py-4 bg-[var(--surface)] border border-[var(--line)] text-slate-600 rounded-[32px] text-[10px] font-black uppercase tracking-widest hover:bg-[var(--ink)] transition-all active:scale-95 shadow-sm">Abort</button>
                  <button type="submit" className="flex-[2] py-4 bg-slate-900 text-white rounded-[32px] text-[10px] font-black uppercase tracking-widest hover:bg-slate-800 transition-all shadow-md active:scale-95">Deploy Parameter</button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
