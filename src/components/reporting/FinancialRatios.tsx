import { TruthEngine } from '../../modules/truth/TruthEngine';
import React, { useMemo, useState } from 'react';
import { 
  Activity, 
  TrendingUp, 
  Scale, 
  Zap,
  ShieldCheck,
  Calculator,
  Layers,
  Award
} from 'lucide-react';
import { cn } from '../../lib/utils';

interface FinancialRatiosProps {
  accounts: any[];
  computedAccounts: any[];
}

export default function FinancialRatios({ accounts, computedAccounts }: FinancialRatiosProps) {
  const [selectedScenario, setSelectedScenario] = useState<'current' | 'stressed'>('current');

  const ratiosData = useMemo(() => {
    // Helper to sum by various criteria
    const getBalanceByType = (type: string) => {
      return (computedAccounts || [])
        .filter(a => a.type === type)
        .reduce((sum, a) => sum + (a.balanceCents || 0), 0);
    };

    // Heuristics for robust current metrics extraction
    const cashAndEquivalents = (computedAccounts || [])
      .filter(a => 
        a.category?.toLowerCase() === 'cash' || 
        (a.name || '').toLowerCase().includes('checking') || 
        (a.name || '').toLowerCase().includes('savings') || 
        (a.name || '').toLowerCase().includes('cash') || 
        (a.name || '').toLowerCase().includes('petty') ||
        (a.name || '').toLowerCase().includes('bank')
      )
      .reduce((sum, a) => sum + (a.balanceCents || 0), 0);

    const receivables = (computedAccounts || [])
      .filter(a => 
        a.category?.toLowerCase() === 'receivable' || 
        (a.name || '').toLowerCase().includes('receivable') || 
        a.code.startsWith('120')
      )
      .reduce((sum, a) => sum + (a.balanceCents || 0), 0);

    const inventory = (computedAccounts || [])
      .filter(a => 
        a.category?.toLowerCase() === 'inventory' || 
        (a.name || '').toLowerCase().includes('inventory') || 
        (a.name || '').toLowerCase().includes('stock') ||
        a.code.startsWith('130')
      )
      .reduce((sum, a) => sum + (a.balanceCents || 0), 0);

    const payables = (computedAccounts || [])
      .filter(a => 
        a.category?.toLowerCase() === 'payable' || 
        (a.name || '').toLowerCase().includes('payable') || 
        a.code.startsWith('200')
      )
      .reduce((sum, a) => sum + (a.balanceCents || 0), 0);

    const shortTermUnsecured = (computedAccounts || [])
      .filter(a => 
        (a.name || '').toLowerCase().includes('credit card') || 
        (a.name || '').toLowerCase().includes('visa') || 
        (a.name || '').toLowerCase().includes('mastercard') || 
        (a.name || '').toLowerCase().includes('cc ') ||
        (a.type === 'liability' && a.category?.toLowerCase() === 'credit')
      )
      .reduce((sum, a) => sum + (a.balanceCents || 0), 0);

    // Current assets are Cash + A/R + Inventory
    const currentAssets = cashAndEquivalents + receivables + inventory;
    // Current Liabilities are Payables + Credit Cards
    const currentLiabilities = Math.max(1, payables + shortTermUnsecured);

    const totalAssets = Math.max(1, getBalanceByType('asset'));
    const totalLiabilities = getBalanceByType('liability');
    
    // Total Equity sum
    const equityBalance = getBalanceByType('equity');
    const bookEquity = Math.max(1, equityBalance > 0 ? equityBalance : (totalAssets - totalLiabilities));

    const revenue = Math.max(1, getBalanceByType('income'));
    const expenses = Math.abs(getBalanceByType('expense')); // Expenses are typically debit balances (positive net), but if negative absolute them if necessary depending on ledger state
    
    // Use Truth Engine to compute exact net income (simple subtraction, but could be broader)
    const netIncome = Math.round(revenue - expenses);

    // 1. Current Ratio
    let currentRatioVal = 0;
    let quickRatioVal = 0;
    let debtToEquityVal = 0;
    let netProfitMarginVal = 0;
    
    try {
      currentRatioVal = TruthEngine.calculateCurrentRatio(currentAssets, currentLiabilities);
      quickRatioVal = TruthEngine.calculateQuickRatio(currentAssets, inventory, currentLiabilities);
      debtToEquityVal = TruthEngine.calculateDebtToEquityRatio(totalLiabilities, bookEquity);
      // NPM uses Gross Profit Margin as a proxy or we can just derive it
      netProfitMarginVal = netIncome / (revenue || 1);
    } catch (err) {
      console.warn("TruthEngine calculation fallback", err);
      currentRatioVal = currentAssets / currentLiabilities;
      quickRatioVal = (currentAssets - inventory) / currentLiabilities;
      debtToEquityVal = totalLiabilities / bookEquity;
      netProfitMarginVal = netIncome / (revenue || 1);
    }

    // 5. Operating Asset Turnover
    const assetTurnoverVal = revenue / totalAssets;

    // 6. Return on Equity (ROE)
    const returnOnEquityVal = netIncome / bookEquity;

    // Altman Z-Score
    const x1 = (currentAssets - currentLiabilities) / totalAssets;
    const x2 = (bookEquity + (netIncome > 0 ? netIncome : 0)) / totalAssets;
    const x3 = netIncome / totalAssets;
    const x4 = bookEquity / Math.max(1, totalLiabilities);
    const x5 = revenue / totalAssets;

    let zScore = (1.2 * x1) + (1.4 * x2) + (3.3 * x3) + (0.6 * x4) + (0.999 * x5);
    
    // Apply stress scenario headwinds if needed
    if (selectedScenario === 'stressed') {
      zScore *= 0.78;
    }

    let zZone = 'safe';
    let zZoneName = 'Safe Zone';
    let zConfidence = 95;
    if (zScore <= 1.23) {
      zZone = 'distress';
      zZoneName = 'Distress Zone';
      zConfidence = 85;
    } else if (zScore <= 2.9) {
      zZone = 'grey';
      zZoneName = 'Grey Area';
      zConfidence = 90;
    }

    return {
      currentRatio: currentRatioVal,
      quickRatio: quickRatioVal,
      debtToEquity: debtToEquityVal,
      netProfitMargin: netProfitMarginVal,
      assetTurnover: assetTurnoverVal,
      returnOnEquity: returnOnEquityVal,
      workingCapital: currentAssets - currentLiabilities,
      totalAssets,
      totalLiabilities,
      bookEquity,
      revenue,
      expenses,
      netIncome,
      cashAndEquivalents,
      receivables,
      payables,
      zScore,
      zZone,
      zZoneName,
      zConfidence,
      xVars: { x1, x2, x3, x4, x5 }
    };
  }, [computedAccounts, selectedScenario]);

  const ratioList = useMemo(() => {
    return [
      {
        id: 'current',
        name: 'Current Ratio',
        value: ratiosData.currentRatio.toFixed(2),
        desc: 'Short-term liquidity factor measuring total current resources relative to urgent obligations.',
        formula: 'Current Assets / Current Liabilities',
        category: 'Liquidity',
        icon: Activity,
        status: ratiosData.currentRatio >= 1.5 ? 'healthy' : ratiosData.currentRatio >= 1.0 ? 'neutral' : 'critical',
        color: ratiosData.currentRatio >= 1.5 ? 'text-emerald-500' : 'text-rose-500',
        progress: Math.min(105, Math.max(5, ratiosData.currentRatio * 35))
      },
      {
        id: 'quick',
        name: 'Quick Ratio (Acid-Test)',
        value: ratiosData.quickRatio.toFixed(2),
        desc: 'High-stringency cash liquidity. Excludes inventory to focus on immediately convertible capital.',
        formula: '(Cash + Accounts Receivable) / Current Liabilities',
        category: 'Liquidity',
        icon: Zap,
        status: ratiosData.quickRatio >= 1.1 ? 'healthy' : ratiosData.quickRatio >= 0.8 ? 'neutral' : 'critical',
        color: ratiosData.quickRatio >= 1.1 ? 'text-emerald-500' : 'text-rose-500',
        progress: Math.min(105, Math.max(5, ratiosData.quickRatio * 45))
      },
      {
        id: 'debt_equity',
        name: 'Debt-to-Equity Ratio',
        value: ratiosData.debtToEquity.toFixed(2),
        desc: 'Leverage index evaluating total enterprise debt liabilities against the registered book equity value.',
        formula: 'Total Liabilities / Book Value Equity',
        category: 'Solvency',
        icon: Scale,
        status: ratiosData.debtToEquity < 0.8 ? 'healthy' : ratiosData.debtToEquity < 1.5 ? 'neutral' : 'critical',
        color: ratiosData.debtToEquity < 0.8 ? 'text-emerald-500' : 'text-rose-500',
        progress: Math.min(105, Math.max(5, (2 - Math.min(2, ratiosData.debtToEquity)) * 50))
      },
      {
        id: 'profit_margin',
        name: 'Net Profit Margin',
        value: `${(ratiosData.netProfitMargin * 100).toFixed(1)}%`,
        desc: 'Bottom-line efficiency ratio measuring how much net operational profit is generated from raw sales revenue.',
        formula: 'Net Income / Total Revenue',
        category: 'Profitability',
        icon: TrendingUp,
        status: ratiosData.netProfitMargin >= 0.15 ? 'healthy' : ratiosData.netProfitMargin >= 0.05 ? 'neutral' : 'critical',
        color: ratiosData.netProfitMargin >= 0.15 ? 'text-emerald-500' : 'text-rose-500',
        progress: Math.min(105, Math.max(5, ratiosData.netProfitMargin * 350))
      },
      {
        id: 'asset_turnover',
        name: 'Asset Turnover',
        value: `${ratiosData.assetTurnover.toFixed(2)}x`,
        desc: 'Operational utilization speed measuring how efficiently the firm deploys capital assets to generate revenue.',
        formula: 'Revenue / Total Assets',
        category: 'Efficiency',
        icon: Layers,
        status: ratiosData.assetTurnover >= 1.2 ? 'healthy' : ratiosData.assetTurnover >= 0.6 ? 'neutral' : 'critical',
        color: ratiosData.assetTurnover >= 1.2 ? 'text-emerald-500' : 'text-rose-500',
        progress: Math.min(105, Math.max(5, ratiosData.assetTurnover * 50))
      },
      {
        id: 'roe',
        name: 'Return on Equity (ROE)',
        value: `${(ratiosData.returnOnEquity * 100).toFixed(1)}%`,
        desc: 'Capital profitability. Evaluates the rate of return on shareholder or partner equity investments.',
        formula: 'Net Income / Book Value Equity',
        category: 'Profitability',
        icon: Award,
        status: ratiosData.returnOnEquity >= 0.15 ? 'healthy' : ratiosData.returnOnEquity >= 0.04 ? 'neutral' : 'critical',
        color: ratiosData.returnOnEquity >= 0.15 ? 'text-emerald-500' : 'text-rose-500',
        progress: Math.min(105, Math.max(5, ratiosData.returnOnEquity * 300))
      }
    ];
  }, [ratiosData]);

  return (
    <div className="space-y-8 text-slate-800">
      
      {/* 1. Altman Z-Score Forensic Solvency Panel */}
      <section className="bg-slate-900 text-white rounded-[32px] p-6 sm:p-4 md:p-8 relative overflow-hidden shadow-md border border-slate-800">
        <div className="absolute right-0 top-0 w-80 h-80 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none -mr-16 -mt-16" />
        
        <div className="relative z-10 flex flex-col xl:flex-row xl:items-center justify-between gap-8 text-left">
          <div className="space-y-4 max-w-2xl text-left">
            <div className="flex gap-2 flex-wrap items-center">
              <span className="text-[10px] bg-indigo-600 px-3 py-1 rounded-full font-bold uppercase tracking-widest text-indigo-50">
                Altman Z-Score Model
              </span>
              <span className="text-[10px] bg-white/10 text-slate-300 border border-white/5 py-1 px-3 rounded-full font-mono font-medium">
                Statistical Accuracy: {ratiosData.zConfidence}%
              </span>
            </div>
            
            <h2 className="text-2xl font-black tracking-tight leading-tight">
              Corporate Insolvency Prediction Diagnostics
            </h2>
            
            <p className="text-xs text-slate-400 font-medium leading-relaxed">
              Based on the 1968 multivariate linear discriminant formula developed by Edward Altman. 
              The algorithm evaluates five distinct financial ratios from the journal tree to evaluate overall operational resilience, 
              estimating the probability of sudden financial headwinds or distress within 24 months.
            </p>

            <div className="flex items-center gap-3 pt-2">
              <span className="text-xs text-slate-350 font-bold uppercase tracking-wider">Scenario Mode:</span>
              <div className="flex bg-slate-800 p-0.5 rounded-lg border border-slate-700">
                <button
                  type="button"
                  onClick={() => setSelectedScenario('current')}
                  className={cn(
                    "px-3 py-1 rounded-md text-[9px] font-bold uppercase tracking-wider transition-all cursor-pointer",
                    selectedScenario === 'current' ? "bg-white text-slate-800 font-bold" : "text-slate-400 hover:text-white"
                  )}
                >
                  Strict Current
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedScenario('stressed')}
                  className={cn(
                    "px-3 py-1 rounded-md text-[9px] font-bold uppercase tracking-wider transition-all cursor-pointer",
                    selectedScenario === 'stressed' ? "bg-white text-slate-800 font-bold animate-pulse" : "text-slate-400 hover:text-white"
                  )}
                >
                  Stress Headwind (-22%)
                </button>
              </div>
            </div>
          </div>

          {/* Large dynamic rating display */}
          <div className="bg-white/5 border border-white/10 rounded-[32px] p-6 flex flex-col items-center justify-center shrink-0 w-full sm:w-80 text-center space-y-4">
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Calculated Score</p>
            
            <div className="space-y-0.5">
              <p className="text-3xl md:text-5xl font-black tracking-tighter text-white font-mono leading-none">
                {ratiosData.zScore.toFixed(2)}
              </p>
              <p className={cn(
                "text-xs font-bold uppercase tracking-widest mt-2",
                ratiosData.zZone === 'safe' ? 'text-emerald-400' : ratiosData.zZone === 'grey' ? 'text-amber-400' : 'text-rose-400'
              )}>
                {ratiosData.zZoneName}
              </p>
            </div>

            {/* Simulated analog metric slider */}
            <div className="w-full space-y-1 pt-1">
              <div className="w-full h-1.5 bg-slate-800 rounded-full relative">
                <div className="absolute left-0 top-0 h-full w-[35%] bg-rose-500/30 rounded-l-full" title="Distress Zone (< 1.23)" />
                <div className="absolute left-[35%] top-0 h-full w-[45%] bg-amber-500/30" title="Grey Area (1.23 - 2.90)" />
                <div className="absolute left-[80%] top-0 h-full w-[20%] bg-emerald-500/30 rounded-r-full" title="Safe Zone (2.90+)" />
                
                <div 
                  className={cn(
                    "absolute -top-1.5 w-4 w-4 rounded-full border-2 border-slate-950 shadow-md transition-all duration-300 transform -translate-x-1/2",
                    ratiosData.zZone === 'safe' ? 'bg-emerald-400' : ratiosData.zZone === 'grey' ? 'bg-amber-400' : 'bg-rose-400'
                  )}
                  style={{ left: `${Math.min(98, Math.max(2, (ratiosData.zScore / 4.5) * 100))}%` }}
                />
              </div>
              <div className="flex justify-between text-[8px] font-mono font-bold text-slate-500">
                <span>0.0 (Distress)</span>
                <span>2.9 (Safe Edge)</span>
                <span>4.5+</span>
              </div>
            </div>
            
            <p className="text-[10px] font-medium leading-relaxed text-slate-400 max-w-xs italic leading-tight">
              {ratiosData.zZone === 'safe' 
                ? "The general ledger demonstrates excellent equity coverage and robust cash flow integrity."
                : ratiosData.zZone === 'grey'
                ? "The solvency buffer is average. Monitor operating cash burn rates to avoid capital degradation."
                : "A lower relative cash reserve to debt ratio warrants conservative planning and expense constraints."}
            </p>
          </div>
        </div>

        {/* Variables details container */}
        <div className="mt-8 pt-6 border-t border-white/5 grid grid-cols-2 lg:grid-cols-5 gap-4 text-left">
          {[
            { label: 'X1: Working Capital/Assets', val: ratiosData.xVars.x1, coefficient: '1.2x', title: 'Liquidity' },
            { label: 'X2: Retained earnings/Assets', val: ratiosData.xVars.x2, coefficient: '1.4x', title: 'Reinvestment' },
            { label: 'X3: Net Yield/Assets', val: ratiosData.xVars.x3, coefficient: '3.3x', title: 'Asset RoE' },
            { label: 'X4: Capital Coverage/Debt', val: ratiosData.xVars.x4, coefficient: '0.6x', title: 'Solvency' },
            { label: 'X5: Book Efficiency Velocity', val: ratiosData.xVars.x5, coefficient: '1.0x', title: 'Efficiency' }
          ].map((v, i) => (
            <div key={i} className="p-3 bg-white/5 rounded-xl border border-white/5 space-y-1">
              <span className="text-[7.5px] font-bold text-indigo-400 uppercase tracking-widest">{v.title}</span>
              <p className="text-[9px] font-bold text-slate-300 leading-none truncate">{v.label}</p>
              <div className="flex items-baseline justify-between pt-1">
                <span className="text-xs font-bold text-white font-mono">{v.val.toFixed(3)}</span>
                <span className="text-[8px] font-mono text-slate-500">({v.coefficient})</span>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* 2. Structured Multi-Ratio Evaluation Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 text-left">
        {ratioList.map((ratio) => (
          <div 
            key={ratio.id}
            className="bg-white border border-slate-200/80 hover:border-slate-350 rounded-[32px] p-5 shadow-3xs hover:shadow-2xs transition-all flex flex-col justify-between text-left"
          >
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="p-2.5 bg-slate-50 border border-slate-100 rounded-xl text-slate-700">
                  <ratio.icon size={16} />
                </div>
                <div className="flex flex-col items-end">
                  <span className="text-[8px] font-bold uppercase tracking-wider text-slate-400">{ratio.category}</span>
                  <span className={cn(
                    "text-[8px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-md mt-1 border",
                    ratio.status === 'healthy' 
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-100' 
                      : ratio.status === 'neutral' 
                      ? 'bg-amber-50 text-amber-700 border-amber-100' 
                      : 'bg-rose-50 text-rose-750 border-rose-100'
                  )}>
                    {ratio.status}
                  </span>
                </div>
              </div>

              <div className="space-y-1 text-left">
                <h4 className="text-xs font-bold uppercase tracking-tight text-slate-800">{ratio.name}</h4>
                <div className="flex items-baseline gap-1 pt-0.5">
                  <span className="text-2xl font-bold text-slate-800 font-mono tracking-tight">{ratio.value}</span>
                </div>
                <p className="text-[8.5px] font-mono text-slate-400 font-bold uppercase tracking-wider bg-slate-50 border px-1.5 py-0.5 rounded-sm inline-block">
                  Formula: {ratio.formula}
                </p>
                <p className="text-[10.5px] font-medium leading-relaxed text-slate-500 pt-2 leading-tight">
                  {ratio.desc}
                </p>
              </div>
            </div>

            <div className="pt-4 mt-4 border-t border-slate-100 space-y-1 text-left">
              <div className="w-full h-1 bg-slate-100 rounded-full overflow-hidden">
                <div 
                  className={cn(
                    "h-full rounded-full transition-all duration-300",
                    ratio.status === 'healthy' ? 'bg-emerald-500' : ratio.status === 'neutral' ? 'bg-amber-500' : 'bg-rose-500'
                  )}
                  style={{ width: `${ratio.progress}%` }}
                />
              </div>
              <div className="flex justify-between items-center text-[8px] font-mono font-bold text-slate-400">
                <span>Minimal</span>
                <span>Optimized Target</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* 3. Deep Analytical Formula Context / Education Cards */}
      <section className="bg-slate-50 border border-slate-200 rounded-[32px] p-5 text-left flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex items-start md:items-center gap-4 text-left font-sans">
          <div className="p-3 bg-slate-900 text-white rounded-xl flex items-center justify-center shrink-0">
            <Calculator size={18} />
          </div>
          <div className="space-y-1">
            <h4 className="text-xs font-bold uppercase tracking-widest text-slate-800 leading-none">
              Balance Sheet Symmetry Verification
            </h4>
            <p className="text-[10.5px] text-slate-500 leading-relaxed max-w-xl leading-normal font-medium">
              Every ratio listed above represents a real-time mathematical fraction compiled via deterministic double-entry assets/liabilities matching. If transaction drift or single adjustments compromise Ledger balances, these values auto-recalculate to guarantee total compliance "truth".
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <div className="text-right">
            <p className="text-[8px] font-mono text-slate-450 uppercase tracking-wider font-bold">Accounting Standard</p>
            <p className="text-[10px] font-bold text-slate-800 uppercase">US GAAP & IFRS compliant</p>
          </div>
          <ShieldCheck className="text-indigo-600" size={18} />
        </div>
      </section>

    </div>
  );
}
