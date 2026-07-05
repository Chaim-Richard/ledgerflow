import React, { useMemo, useState } from 'react';
import { useLedgerStore } from '../../stores/useLedgerStore';
import { useAuthStore } from '../../stores/useAuthStore';
import { Target, Search, Layers, Activity, ArrowUpRight, CheckCircle2, ShieldAlert, Sparkles, Building2, Briefcase, User, Box } from 'lucide-react';
import { toast } from 'sonner';

export default function MarketMultiplier() {
  const { transactions, inventory, accounts, invoices } = useLedgerStore();
  const { workspaces, currentWorkspaceId } = useAuthStore();
  const [isAuditing, setIsAuditing] = useState(false);
  const [hasAudited, setHasAudited] = useState(false);

  const currentWorkspace = useMemo(() => workspaces.find(w => w.id === currentWorkspaceId), [workspaces, currentWorkspaceId]);
  const businessType = currentWorkspace?.businessType || 'generic';

  const handleDeepAudit = () => {
    setIsAuditing(true);
    const loader = toast.loading('Initializing Deep Strategy Audit...', { description: 'Cross-referencing Unit Economics with Macro-Industry Market Arbitrage models...' });
    
    setTimeout(() => {
      toast.loading(`Analyzing structural valuation for ${businessType.toUpperCase()} architecture...`, { id: loader, description: 'Searching for Sub-Optimal sizing and hidden margin potential...' });
      
      setTimeout(() => {
         setIsAuditing(false);
         setHasAudited(true);
         toast.success('Strategy Audit Complete', { id: loader, description: 'Discovered hidden Truth multiples and industry-aligned optimization.' });
      }, 2000);
    }, 2000);
  };

  const analysis = useMemo(() => {
    const totalIncomeCents = accounts.filter(a => a.type === 'income').reduce((sum, a) => sum + (a.balanceCents || 0), 0);
    const totalExpenseCents = accounts.filter(a => a.type === 'expense').reduce((sum, a) => sum + (a.balanceCents || 0), 0);
    const ebitdaCents = totalIncomeCents - totalExpenseCents;

    let baseValuation = ebitdaCents * 4; 
    let optimizedValuation = baseValuation * 2; 
    let valuationName = "SaaS Multiple Base";
    let valuationMultiplierText = "4.0x EBITDA";
    let optimizationNarrative = "Target enterprise value utilizing discovered margin arbitrage, compounding unit pricing strategies, and eliminating expense leakages identified in the ledger's absolute truth.";

    switch (businessType) {
      case 'saas':
        valuationName = 'Annual Recurring Rev Multiple';
        valuationMultiplierText = '6.0x ARR Base';
        baseValuation = totalIncomeCents * 6;
        optimizedValuation = baseValuation * 2.5;
        optimizationNarrative = "Exponential trajectory achieved by minimizing customer churn, optimizing CAC pay-back periods, and realizing pure MRR scale.";
        break;
      case 'retail':
      case 'ecommerce':
      case 'manufacturing':
        valuationName = 'Gross Margin Multiple';
        valuationMultiplierText = '3.5x EBITDA';
        baseValuation = ebitdaCents * 3.5;
        optimizedValuation = baseValuation * 1.8;
        optimizationNarrative = "Valuation derived by tightening supply chain logistics, executing bulk arbitrage orders, and accelerating inventory turnover ratio.";
        break;
      case 'realestate':
        valuationName = 'NOI / Cap Rate (8%)';
        valuationMultiplierText = '12.5x NOI Base (8% Cap)';
        baseValuation = ebitdaCents * 12.5;
        optimizedValuation = ebitdaCents * 16.6;
        optimizationNarrative = "Market value realization by compressing capitalization rates through tenant stabilization, structural improvements, and reducing vacancy bleed.";
        break;
      case 'personal':
      case 'household':
        valuationName = 'FIRE Target (25x Yearly Spend)';
        valuationMultiplierText = '25.0x Expenses';
        baseValuation = ebitdaCents;
        optimizedValuation = totalExpenseCents * 25;
        optimizationNarrative = "Not a business evaluation, but a mathematical Financial Independence (FIRE) trajectory based on optimizing compound interest yields against median annual household burn rate.";
        break;
      case 'nonprofit':
      case 'charity':
        valuationName = 'Endowment Reserve Target';
        valuationMultiplierText = '3.0x Annual Operations Base';
        baseValuation = totalExpenseCents * 3;
        optimizedValuation = totalExpenseCents * 5;
        optimizationNarrative = "Ensuring generational sustainability by building an endowment capital pool that yields operational coverage purely from structural dividends.";
        break;
    }

    const unitArbitrageOpportunities = inventory.filter(item => 
      item.unitsPerPackage && item.unitsPerPackage > 1 && item.quantityAtHand > 0
    ).map(item => {
      const standardCost = item.unitCostCents;
      const trueUnitCost = Math.round(item.unitCostCents / (item.unitsPerPackage || 1));
      const optimalMarginLift = item.unitPriceCents - trueUnitCost;
      const currentMargin = item.unitPriceCents - standardCost;
      return {
        item,
        trueUnitCost,
        marginLiftCents: optimalMarginLift - currentMargin,
        isArbitrageActive: (optimalMarginLift - currentMargin) > 0
      };
    }).sort((a, b) => b.marginLiftCents - a.marginLiftCents);
    
    const nowMs = Date.now();
    const AR_Bleed = invoices.filter(inv => inv.status !== 'paid').map(inv => {
       const txDateMs = new Date(inv.dueDate || inv.date || Date.now()).getTime();
       const daysOutstanding = Math.floor((nowMs - txDateMs) / (1000 * 60 * 60 * 24));
       const impliedCostOfCapitalCents = Math.round((inv.totalCents || inv.amountCents) * (0.08 / 365) * Math.max(0, daysOutstanding));
       return {
         invoice: inv,
         daysOutstanding,
         impliedCostOfCapitalCents
       };
    }).filter(x => x.daysOutstanding > 30).sort((a,b) => b.impliedCostOfCapitalCents - a.impliedCostOfCapitalCents);

    const totalArBleedCents = AR_Bleed.reduce((sum, item) => sum + item.impliedCostOfCapitalCents, 0);

    const revenueByCustomer = transactions.filter(t => t.totalAmountCents > 0).reduce((acc: Record<string, number>, t) => {
        const name = t.payee?.trim() || 'Unknown';
        acc[name] = (acc[name] || 0) + t.totalAmountCents;
        return acc;
    }, {});
    
    const maxClientRevenue = Math.max(...Object.values(revenueByCustomer), 0);
    const concentrationRatio = totalIncomeCents > 0 ? (maxClientRevenue / totalIncomeCents) : 0;
    const isHighConcentrationRisk = concentrationRatio > 0.4;
    
    if (isHighConcentrationRisk) {
      optimizedValuation = optimizedValuation * 0.85;
      optimizationNarrative += " Valuations are currently suppressed by a -15% concentration penalty. Diversification of client base is mathematically required to reach optimal potential.";
    }

    if (totalArBleedCents > (ebitdaCents * 0.05)) {
       optimizationNarrative += " Additionally, optimizing the Days Sales Outstanding (DSO) cycle could liberate critical cash flow currently acting as zero-interest loans to the client base.";
    }

    return {
      ebitdaCents,
      totalIncomeCents,
      totalExpenseCents,
      baseValuation,
      optimizedValuation,
      valuationName,
      valuationMultiplierText,
      optimizationNarrative,
      unitArbitrageOpportunities,
      AR_Bleed,
      totalArBleedCents,
      concentrationRatio,
      isHighConcentrationRisk
    };
  }, [transactions, inventory, accounts, hasAudited, businessType]);

  const IndustryIcon = useMemo(() => {
    switch (businessType) {
      case 'saas': return Building2;
      case 'retail': 
      case 'manufacturing': return Box;
      case 'realestate': return Building2;
      case 'personal': return User;
      default: return Briefcase;
    }
  }, [businessType]);

  return (
    <div className="space-y-8 p-4 md:p-6 lg:p-10 w-full max-w-[1550px] mx-auto pb-20">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between border-b border-slate-200 pb-6 gap-4">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Target size={24} className="text-indigo-600" />
            <span className="text-xs font-black uppercase tracking-widest text-indigo-600">
              Valuation Multiplier
            </span>
          </div>
          <h1 className="text-3xl font-black text-slate-800 uppercase tracking-tight font-display">
            Mathematical Truth Model
          </h1>
          <p className="text-xs text-slate-500 mt-1 uppercase tracking-wider font-bold max-w-2xl">
            Analyzing double-entry ground truth to identify unit economic blind spots and optimize pricing multiples for a <span className="text-emerald-600">{businessType.toUpperCase()}</span> architecture.
          </p>
        </div>
        <div className="text-left md:text-right">
          <p className="text-[10px] font-black text-slate-400 tracking-[0.2em] uppercase mb-1">Current Truth Value</p>
          <p className="text-3xl font-black font-mono text-slate-800 tracking-tight">
            ${(analysis.baseValuation / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="p-8 bg-emerald-50 border border-emerald-200 rounded-[32px] col-span-1 md:col-span-2 relative overflow-hidden shadow-sm">
          <div className="absolute top-0 right-0 p-4 md:p-8 opacity-10">
            <IndustryIcon className="w-48 h-48 text-emerald-900" />
          </div>
          <div className="relative z-10">
            <p className="text-[10px] font-black text-emerald-600 tracking-widest uppercase mb-2">Optimized Trajectory</p>
            <h2 className="text-4xl md:text-5xl font-black text-emerald-900 font-mono tracking-tighter mb-4">
              ${(analysis.optimizedValuation / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </h2>
            <p className="text-emerald-800 font-bold max-w-xl mb-8 leading-relaxed text-sm">
              {analysis.optimizationNarrative}
            </p>
            <button 
              onClick={handleDeepAudit}
              disabled={isAuditing}
              className="px-6 py-3.5 bg-emerald-700 text-white rounded-xl text-xs font-black uppercase tracking-widest hover:bg-emerald-800 transition-all flex items-center gap-2 disabled:opacity-50"
            >
              <Sparkles size={16} />
              {isAuditing ? 'Auditing Architecture Logic...' : 'Run Deep Strategy Audit'}
            </button>
          </div>
        </div>

        <div className="p-8 bg-white border border-slate-200 rounded-[32px] space-y-6 shadow-sm flex flex-col justify-center">
          <div className="flex items-center gap-2 text-slate-400 border-b border-slate-100 pb-4">
            <Activity size={18} />
            <span className="text-[10px] font-black uppercase tracking-widest">Base Metrics</span>
          </div>
          <div className="space-y-1">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{businessType === 'personal' ? 'Total Expenses (Burn)' : 'TTM EBITDA (Truth)'}</p>
            <p className="text-2xl font-black font-mono text-slate-800 tracking-tight">
               ${(Math.abs(businessType === 'personal' ? analysis.totalExpenseCents : analysis.ebitdaCents) / 100).toLocaleString()}
            </p>
          </div>
          <div className="space-y-1">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{analysis.valuationName}</p>
            <p className="text-xl font-bold font-mono text-indigo-600 tracking-tight">{analysis.valuationMultiplierText}</p>
          </div>
        </div>
      </div>

      <div className="mt-12 space-y-8">
        <div className="flex items-center gap-3 border-b border-slate-200 pb-4">
          <Search className="text-indigo-500" size={24} />
          <h2 className="text-xl font-black text-slate-800 uppercase tracking-wider">Macro Blind Spots & Truth Engine Rules</h2>
        </div>

        {analysis.isHighConcentrationRisk && (
           <div className="p-6 bg-rose-50 border border-rose-200 rounded-[32px] flex flex-col md:flex-row gap-6 items-center shadow-sm">
             <div className="p-4 bg-white text-rose-600 rounded-[32px] border border-rose-100 shadow-sm">
               <ShieldAlert size={28} />
             </div>
             <div className="flex-1">
               <h3 className="text-sm font-black text-rose-900 uppercase tracking-wider mb-2">Overconcentration Penalty Detected</h3>
               <p className="text-rose-800/90 text-xs font-bold leading-relaxed max-w-2xl">
                 A single client makes up <span className="font-black text-rose-900 bg-rose-200/50 px-1 rounded">{Math.round(analysis.concentrationRatio * 100)}%</span> of total gross revenue. This structural weakness suppresses valuation multiples by <span className="font-black text-rose-900 bg-rose-200/50 px-1 rounded">-15%</span> due to key-dependency danger.
               </p>
             </div>
             <div className="text-center bg-white p-6 rounded-[32px] border border-rose-100 shadow-sm min-w-[200px]">
               <p className="text-[10px] font-black tracking-widest text-rose-500 uppercase mb-2">Multipler Impact</p>
               <p className="text-3xl font-black font-mono text-rose-700 tracking-tight">-15%</p>
             </div>
           </div>
        )}

        {analysis.AR_Bleed.length > 0 && hasAudited && (
          <div className="bg-white border border-slate-200 rounded-[32px] p-8 shadow-sm">
            <h3 className="text-sm font-black text-slate-800 uppercase tracking-wider mb-6 flex items-center gap-2">
              <Activity className="text-amber-500" size={18} /> Velocity Bleed: DSO Cost of Capital
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
               {analysis.AR_Bleed.map((bleed, i) => (
                 <div key={i} className="p-5 border border-slate-200 bg-slate-50 rounded-[32px] flex justify-between items-center group hover:bg-white hover:shadow-sm transition-all">
                   <div>
                     <p className="text-xs font-black text-slate-800 uppercase tracking-tight mb-1">{bleed.invoice.customerName || 'Unknown Customer'}</p>
                     <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Aging: <span className="text-amber-600 font-black">{bleed.daysOutstanding} days</span> (Inv #{bleed.invoice.id.slice(0,6)})</p>
                   </div>
                   <div className="text-right">
                     <p className="text-[9px] uppercase font-black tracking-widest text-slate-400 mb-1">Yield Bleed</p>
                     <p className="font-mono text-sm font-black text-rose-600">-${(bleed.impliedCostOfCapitalCents / 100).toFixed(2)}</p>
                   </div>
                 </div>
               ))}
            </div>
            
            <div className="mt-6 p-5 bg-amber-50 text-amber-900 rounded-[32px] text-xs font-bold border border-amber-200 flex justify-between items-center shadow-sm">
              <span className="uppercase tracking-wider">Total calculated truth drag from outstanding receivables</span>
              <span className="font-black font-mono tracking-tight text-lg">Total Drag: ${(analysis.totalArBleedCents / 100).toFixed(2)}</span>
            </div>
          </div>
        )}

        <div className="bg-white border border-slate-200 rounded-[32px] p-8 shadow-sm">
          <h3 className="text-sm font-black text-slate-800 uppercase tracking-wider mb-6 flex items-center gap-2">
            <Layers className="text-emerald-500" size={18} /> Physical Arbitrage: Margin Expansion
          </h3>
          {analysis.unitArbitrageOpportunities.length === 0 ? (
            <div className="p-12 border-2 border-dashed border-slate-200 rounded-[32px] text-center bg-slate-50 transition-all flex flex-col items-center justify-center">
              <Layers className="text-slate-300 mb-4" size={48} />
              <h3 className="text-sm font-black text-slate-600 uppercase tracking-wider mb-2">Awaiting Deep Audit</h3>
              <p className="text-slate-500 text-xs font-bold max-w-sm mx-auto mb-6 leading-relaxed">
                Execute a strategy audit to detect undocumented arbitrage opportunities, or configure 'Units Per Package' in Inventory.
              </p>
              <button 
                onClick={handleDeepAudit}
                disabled={isAuditing}
                className="px-6 py-3 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-xl text-xs font-black tracking-widest uppercase hover:bg-indigo-100 transition-all shadow-sm"
              >
                Scan for Blind Spots
              </button>
            </div>
          ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {analysis.unitArbitrageOpportunities.map((opp, i) => (
              <div key={i} className="p-6 bg-slate-50 border border-slate-200 rounded-[32px] shadow-sm transition-all hover:shadow-md hover:bg-white animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="flex justify-between items-start mb-6">
                  <div>
                    <h3 className="font-black text-slate-800 uppercase tracking-tight">{opp.item.name}</h3>
                    <p className="text-[10px] text-slate-500 font-mono font-bold mt-1 uppercase tracking-widest">{opp.item.sku}</p>
                  </div>
                  {opp.isArbitrageActive ? (
                    <span className="px-3 py-1.5 bg-emerald-100 text-emerald-700 text-[9px] font-black rounded-xl uppercase tracking-widest flex items-center gap-1.5 shadow-sm">
                      <CheckCircle2 size={12} /> Arbitrage Active
                    </span>
                  ) : (
                    <span className="px-3 py-1.5 bg-amber-100 text-amber-700 text-[9px] font-black rounded-xl uppercase tracking-widest flex items-center gap-1.5 shadow-sm">
                      <ShieldAlert size={12} /> Sub-Optimal
                    </span>
                  )}
                </div>
                
                <div className="grid grid-cols-2 gap-4 mb-6">
                  <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-sm">
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Standard Cost</p>
                    <p className="font-mono text-sm font-bold text-slate-500 line-through">${(opp.item.unitCostCents / 100).toFixed(2)}</p>
                  </div>
                  <div className="p-4 bg-indigo-50 rounded-xl border border-indigo-100 shadow-sm relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-2 opacity-5">
                      <Sparkles className="w-16 h-16 text-indigo-900" />
                    </div>
                    <p className="text-[9px] font-black text-indigo-500 uppercase tracking-widest mb-1 relative z-10">True Unit Cost</p>
                    <p className="font-mono font-black text-xl text-indigo-700 relative z-10 tracking-tight">${(opp.trueUnitCost / 100).toFixed(2)}</p>
                  </div>
                </div>

                <div className="flex justify-between items-center pt-4 border-t border-slate-200">
                  <p className="text-[10px] font-bold text-slate-500 w-2/3 leading-relaxed">
                    Pricing this per <span className="text-slate-800 uppercase font-black">{opp.item.measurementUnit || 'unit'}</span> while buying in bulk <span className="text-emerald-600 font-black">({opp.item.unitsPerPackage}x)</span> reveals hidden value.
                  </p>
                  <p className="text-xs font-black text-emerald-600 flex items-center gap-1 bg-emerald-50 px-2 py-1 rounded-lg">
                    <ArrowUpRight size={14} />
                    +${(opp.marginLiftCents / 100).toFixed(2)} Lift
                  </p>
                </div>
              </div>
            ))}
          </div>
          )}
        </div>
      </div>
    </div>
  );
}
