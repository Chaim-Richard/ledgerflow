import { useMemo, useState, useEffect } from 'react';
import { useLedgerStore } from '../../stores/useLedgerStore';
import { useAuthStore } from '../../stores/useAuthStore';
import { TrendingUp, Sparkles, DollarSign, Users, 
  Layers, Activity, FileText, Copy, Plus, Trash, Award, AlertCircle, PieChart as PieChartIcon
} from 'lucide-react';
import { toast } from 'sonner';
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip, LineChart, Line, XAxis, YAxis, CartesianGrid, Legend } from 'recharts';

interface InvestorLine {
  id: string;
  name: string;
  equityShare: number;
  isFounder: boolean;
}

export default function CEOBoardroom() {
  const { accounts, transactions } = useLedgerStore();
  const { workspaces, currentWorkspaceId } = useAuthStore();
  const currentWorkspace = workspaces.find(w => w.id === currentWorkspaceId);
  const businessType = currentWorkspace?.businessType || 'generic';

  const [preMoneyValuation, setPreMoneyValuation] = useState<number>(0);
  const [fundingAmount, setFundingAmount] = useState<number>(0);
  const [optionPoolIncrease, setOptionPoolIncrease] = useState<number>(0);
  const [investorLines, setInvestorLines] = useState<InvestorLine[]>([
    { id: '1', name: 'Founders Collective', equityShare: 100, isFounder: true }
  ]);

  const [newInvestorName, setNewInvestorName] = useState('');
  const [newInvestorShare, setNewInvestorShare] = useState<number>(10);

  const [growthScenario, setGrowthScenario] = useState<'conservative' | 'moderate' | 'hyper'>('moderate');

  const financialBase = useMemo(() => {
    const totalIncome = accounts.filter(a => a.type === 'income').reduce((sum, a) => sum + (a.balanceCents || 0), 0) / 100;
    const totalExpense = accounts.filter(a => a.type === 'expense').reduce((sum, a) => sum + (a.balanceCents || 0), 0) / 100;
    const ebitda = totalIncome - totalExpense;
    const cashOnHand = accounts.filter(a => a.type === 'asset' && (a.category === 'Cash' || a.name.toLowerCase().includes('cash') || a.name.toLowerCase().includes('checking'))).reduce((sum, a) => sum + (a.balanceCents || 0), 0) / 100;
    
    return { totalIncome, totalExpense, ebitda, cashOnHand };
  }, [accounts]);

  const computedValuation = useMemo(() => {
    let multiplier = 4.5;
    if (businessType === 'saas') multiplier = 6.0;
    if (businessType === 'retail' || businessType === 'ecommerce') multiplier = 3.5;
    if (businessType === 'realestate') multiplier = 12.0;
    return Math.max(0, financialBase.ebitda * multiplier);
  }, [financialBase.ebitda, businessType]);

  const [hasInitialized, setHasInitialized] = useState(false);
  useEffect(() => {
    if (computedValuation > 0 && !hasInitialized) {
      setPreMoneyValuation(computedValuation);
      setHasInitialized(true);
    }
  }, [computedValuation, hasInitialized]);

  const capTableCalculations = useMemo(() => {
    const postMoneyValuation = preMoneyValuation + fundingAmount;
    const newMoneyShare = postMoneyValuation > 0 ? (fundingAmount / postMoneyValuation) * 100 : 0;
    
    const totalExistingShares = investorLines.reduce((sum, x) => sum + x.equityShare, 0);
    const existingMultiplier = totalExistingShares > 0 ? (100 - newMoneyShare - optionPoolIncrease) / totalExistingShares : 0;

    const postRoundCapTable = investorLines.map(x => {
      const shareAfterRound = x.equityShare * existingMultiplier;
      const valueAfterRound = (shareAfterRound / 100) * postMoneyValuation;
      return {
        ...x,
        preShare: x.equityShare,
        postShare: parseFloat(shareAfterRound.toFixed(2)),
        postValue: parseFloat(valueAfterRound.toFixed(2))
      };
    });

    const newInvestorPostValue = (newMoneyShare / 100) * postMoneyValuation;
    const poolPostValue = (optionPoolIncrease / 100) * postMoneyValuation;

    return {
      postMoneyValuation,
      newMoneyShare: parseFloat(newMoneyShare.toFixed(2)),
      postRoundCapTable,
      newInvestorPostValue,
      poolPostValue
    };
  }, [preMoneyValuation, fundingAmount, optionPoolIncrease, investorLines]);

  const pieChartData = useMemo(() => {
    const data = capTableCalculations.postRoundCapTable.map(inv => ({
      name: inv.name,
      value: inv.postShare,
      color: inv.isFounder ? '#4f46e5' : '#10b981'
    }));
    
    if (capTableCalculations.newMoneyShare > 0) {
      data.push({ name: 'New Investors', value: capTableCalculations.newMoneyShare, color: '#f59e0b' });
    }
    if (optionPoolIncrease > 0) {
      data.push({ name: 'Option Pool', value: optionPoolIncrease, color: '#8b5cf6' });
    }
    
    return data;
  }, [capTableCalculations, optionPoolIncrease]);

  const scenarioForecast = useMemo(() => {
    let multiplier = 4.5;
    if (businessType === 'saas') multiplier = 6.0;
    if (businessType === 'retail' || businessType === 'ecommerce') multiplier = 3.5;
    if (businessType === 'realestate') multiplier = 12.0;

    const baseEbitda = financialBase.ebitda;
    
    const scenarios = {
      conservative: { y1Ebitda: baseEbitda * 1.12, y2Ebitda: baseEbitda * 1.25, y3Ebitda: baseEbitda * 1.40, cagr: '12%', risk: 'Low Risk', strategicGoal: 'Optimize organic lead conversions & compress inventory costs by 4% to lock steady margins.' },
      moderate: { y1Ebitda: baseEbitda * 1.30, y2Ebitda: baseEbitda * 1.70, y3Ebitda: baseEbitda * 2.20, cagr: '30%', risk: 'Moderate Risk', strategicGoal: 'Deploy targeted outbound marketing, hire principal sales developer, and expand channel partnerships.' },
      hyper: { y1Ebitda: baseEbitda * 1.65, y2Ebitda: baseEbitda * 2.60, y3Ebitda: baseEbitda * 4.00, cagr: '60%', risk: 'High Execution Risk', strategicGoal: 'Raise major Series A funding ($3M+), expand to international markets, and launch unified software pricing tiers.' }
    };

    const selected = scenarios[growthScenario];

    return {
      growthScenario,
      rate: selected.cagr,
      risk: selected.risk,
      y1Val: selected.y1Ebitda * multiplier,
      y2Val: selected.y2Ebitda * multiplier,
      y3Val: selected.y3Ebitda * multiplier,
      strategicGoal: selected.strategicGoal,
      ebitdaBase: baseEbitda
    };
  }, [growthScenario, businessType, financialBase.ebitda]);

  const lineChartData = useMemo(() => {
    return [
      { year: 'Current', valuation: scenarioForecast.ebitdaBase * 4.5 },
      { year: 'Year 1', valuation: scenarioForecast.y1Val },
      { year: 'Year 2', valuation: scenarioForecast.y2Val },
      { year: 'Year 3', valuation: scenarioForecast.y3Val },
    ];
  }, [scenarioForecast]);

  const boardroomMemoDraft = useMemo(() => {
    const formattedIncome = financialBase.totalIncome.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
    const formattedEbitda = financialBase.ebitda.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
    const formattedCash = financialBase.cashOnHand.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
    
    return `CONFIDENTIAL | MEMORANDUM TO THE BOARD OF DIRECTORS\n\nDATE: ${new Date().toLocaleDateString('en-US')}\nFROM: Office of the Chief Executive Officer\nSUBJECT: Quarterly Strategic Alignment Update & Growth Performance Audit\n\n1. EXECUTIVE OVERVIEW & LEDGER HEALTH INDICATORS\nThe General Ledger system shows a steady operational pulse. Year-to-date, total top-line revenue records are at ${formattedIncome} with active double-entry integrity. Operational EBITDA stands reconciled at ${formattedEbitda} with cash and liquid cash equivalents reaching ${formattedCash}. \n\n2. SCENARIO & VENTURE VALUATION DEPLOYMENT\nWe are modeling growth under a standard ${growthScenario.toUpperCase()} CAGR pattern targeting a compounding growth milestone. Under this roadmap, the strategic deployment focuses on the following milestones:\n- Key Objective: ${scenarioForecast.strategicGoal}\n- Implied 3-Year Enterprise Valuation target: ${scenarioForecast.y3Val.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })}\n\n3. CAPITALIZATION & DILUTION MITIGATION PLAN\nIn anticipation of our next financing phase of $${(fundingAmount/1000000).toFixed(1)}M on a $${(preMoneyValuation/1000000).toFixed(1)}M pre-money valuation floor, the founding capital table is undergoing robust modeling. By locking in a post-money option pool expansion of ${optionPoolIncrease}%, we are structuring compensation alignment for core staff while maintaining strict anti-dilution targets for our original pre-seed backing coalition.\n\nThe management recommends adopting this consolidated fiscal strategy to insulate core capital and ensure durable growth execution.`;
  }, [financialBase, growthScenario, scenarioForecast, fundingAmount, preMoneyValuation, optionPoolIncrease]);

  const copyMemoToClipboard = () => {
    navigator.clipboard.writeText(boardroomMemoDraft);
    toast.success('EXECUTIVE MEMORANDUM COPIED TO CLIPBOARD', {
      description: 'You can paste this draft directly into your email or document editor.'
    });
  };

  const handleAddInvestor = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newInvestorName || newInvestorShare <= 0) {
      toast.error('INVALID INVESTOR CREDENTIALS');
      return;
    }

    const currentTotal = investorLines.reduce((sum, item) => sum + item.equityShare, 0);
    if (currentTotal + newInvestorShare > 100) {
      toast.error('TOTAL SHARE DILUTION EXCEEDS 100% CAP', {
        description: `Currently allocation stands at ${currentTotal}%. Maximum remaining: ${100 - currentTotal}%`
      });
      return;
    }

    setInvestorLines([...investorLines, { id: Math.random().toString(), name: newInvestorName, equityShare: newInvestorShare, isFounder: false }]);
    setNewInvestorName('');
    toast.success(`ADDED INVESTOR: ${newInvestorName.toUpperCase()}`);
  };

  const deleteInvestorLine = (id: string) => {
    const item = investorLines.find(x => x.id === id);
    if (item?.isFounder) {
      toast.error('FOUNDING COLLECTIVE LINES CANNOT BE REMOVED');
      return;
    }
    setInvestorLines(investorLines.filter(x => x.id !== id));
    toast.info('EQUITY LINE REMOVED');
  };

  const resetInitialCapTable = () => {
    setInvestorLines([{ id: '1', name: 'Founders Collective', equityShare: 100, isFounder: true }]);
    toast.success('EQUITY LEDGER RESET TO SEED DEFAULT');
  };

  return (
    <div className="space-y-8 p-4 md:p-6 lg:p-10 w-full max-w-[1550px] mx-auto pb-20">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between border-b border-slate-200 pb-6 gap-4">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="px-3 py-1 bg-slate-900 text-white rounded-full text-[9px] font-black tracking-widest uppercase shadow-sm">CEO EXECUTIVE VIEW</span>
            <span className="flex h-2 w-2 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
          </div>
          <h1 className="text-3xl font-black text-slate-800 uppercase tracking-tight font-display">
            Strategic Boardroom
          </h1>
          <p className="text-xs text-slate-500 mt-1 uppercase tracking-wider font-bold">
            Executive Multi-Scenario, Venture Capital Dilution, & Board Deck Compiler
          </p>
        </div>
        <div className="flex flex-col md:flex-row md:items-center gap-4">
          <button 
            onClick={copyMemoToClipboard}
            className="px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-black text-xs uppercase tracking-widest rounded-xl transition-all shadow-md hover:shadow-lg flex items-center gap-2 active:scale-95 cursor-pointer h-fit"
          >
            <FileText size={14} />
            <span>Export Board Memo</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
        <div className="bg-white border border-slate-200 rounded-[32px] p-6 shadow-sm hover:shadow-md transition-all flex items-center justify-between group">
          <div className="space-y-1">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Base Ledger Income</p>
            <h3 className="text-xl font-bold text-slate-900 font-mono tracking-tight">
              {financialBase.totalIncome.toLocaleString('en-US', { style: 'currency', currency: 'USD' })}
            </h3>
          </div>
          <div className="p-3.5 rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-100 group-hover:scale-105 transition-transform">
            <TrendingUp size={20} />
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-[32px] p-6 shadow-sm hover:shadow-md transition-all flex items-center justify-between group">
          <div className="space-y-1">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Operational EBITDA</p>
            <h3 className="text-xl font-bold text-slate-900 font-mono tracking-tight">
              {financialBase.ebitda.toLocaleString('en-US', { style: 'currency', currency: 'USD' })}
            </h3>
          </div>
          <div className="p-3.5 rounded-xl bg-indigo-50 text-indigo-600 border border-indigo-100 group-hover:scale-105 transition-transform">
            <Activity size={20} />
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-[32px] p-6 shadow-sm hover:shadow-md transition-all flex items-center justify-between group">
          <div className="space-y-1">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Audited Liquid Cash</p>
            <h3 className="text-xl font-bold text-slate-900 font-mono tracking-tight">
              {financialBase.cashOnHand.toLocaleString('en-US', { style: 'currency', currency: 'USD' })}
            </h3>
          </div>
          <div className="p-3.5 rounded-xl bg-cyan-50 text-cyan-600 border border-cyan-100 group-hover:scale-105 transition-transform">
            <DollarSign size={20} />
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-[32px] p-6 shadow-sm hover:shadow-md transition-all flex items-center justify-between group">
          <div className="space-y-1">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Current Scenario CAGR</p>
            <h3 className="text-xl font-bold text-emerald-600 uppercase tracking-tight flex items-center gap-1.5 font-mono">
              <Sparkles size={16} className="text-emerald-500" />
              <span>{scenarioForecast.rate}</span>
            </h3>
          </div>
          <div className="p-3.5 rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-100 group-hover:scale-105 transition-transform">
            <TrendingUp size={20} />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        <div className="lg:col-span-7 space-y-6">
          <div className="bg-white border border-slate-200 rounded-[32px] shadow-sm p-8 space-y-6">
            <div className="flex justify-between items-center border-b border-slate-100 pb-4">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-indigo-50 text-indigo-600 border border-indigo-100 rounded-[32px]">
                  <PieChartIcon size={20} />
                </div>
                <div>
                  <h2 className="text-sm font-black text-slate-800 uppercase tracking-wider">Cap Table & Dilution Simulator</h2>
                  <p className="text-[10px] text-slate-500 uppercase tracking-wide">Estimate Seed / Series A dilution metrics in real-time</p>
                </div>
              </div>
              <button 
                onClick={resetInitialCapTable}
                className="text-[9px] font-black text-slate-400 hover:text-slate-800 uppercase tracking-widest transition-colors cursor-pointer border border-slate-200 px-4 py-2 rounded-xl bg-slate-50"
              >
                Reset Seed
              </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
               <div className="space-y-6">
                 <div className="space-y-4 bg-slate-50 p-6 rounded-[32px] border border-slate-200">
                    <div>
                      <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-2">Pre-Money Valuation ($)</label>
                      <div className="relative">
                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 text-sm font-bold">$</span>
                        <input 
                          type="number"
                          value={preMoneyValuation}
                          onChange={(e) => setPreMoneyValuation(Math.max(1, parseInt(e.target.value) || 0))}
                          className="w-full pl-8 pr-4 py-3 bg-white border border-slate-300 rounded-xl text-sm font-black font-mono shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-600"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-2">New Investment Round ($)</label>
                      <div className="relative">
                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 text-sm font-bold">$</span>
                        <input 
                          type="number"
                          value={fundingAmount}
                          onChange={(e) => setFundingAmount(Math.max(1, parseInt(e.target.value) || 0))}
                          className="w-full pl-8 pr-4 py-3 bg-white border border-slate-300 rounded-xl text-sm font-black font-mono shadow-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                        />
                      </div>
                    </div>
                    
                    <div>
                      <div className="flex justify-between items-center mb-2">
                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Post-Round Option Pool</label>
                        <span className="text-[10px] font-black text-indigo-600">{optionPoolIncrease}% Share</span>
                      </div>
                      <input 
                        type="range"
                        min="0"
                        max="30"
                        step="1"
                        value={optionPoolIncrease}
                        onChange={(e) => setOptionPoolIncrease(parseInt(e.target.value))}
                        className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                      />
                    </div>
                 </div>

                 <form onSubmit={handleAddInvestor} className="grid grid-cols-1 md:grid-cols-12 gap-3">
                  <div className="md:col-span-7">
                    <input 
                      type="text"
                      placeholder="INVESTOR ENTITY"
                      value={newInvestorName}
                      onChange={(e) => setNewInvestorName(e.target.value)}
                      className="w-full px-4 py-3 bg-white border border-slate-300 rounded-xl text-xs font-bold uppercase tracking-wide focus:outline-none focus:ring-2 focus:ring-slate-900"
                    />
                  </div>
                  <div className="md:col-span-3 relative">
                    <input 
                      type="number"
                      min="1"
                      max="99"
                      placeholder="SHARE %"
                      value={newInvestorShare || ''}
                      onChange={(e) => setNewInvestorShare(parseInt(e.target.value) || 0)}
                      className="w-full pl-4 pr-8 py-3 bg-white border border-slate-300 rounded-xl text-xs font-black focus:outline-none focus:ring-2 focus:ring-slate-900"
                    />
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">%</span>
                  </div>
                  <div className="md:col-span-2">
                    <button 
                      type="submit"
                      className="w-full h-full bg-slate-900 hover:bg-slate-800 text-white font-black text-xs uppercase tracking-widest rounded-xl flex items-center justify-center gap-1 transition-all"
                    >
                      <Plus size={16} />
                    </button>
                  </div>
                </form>
               </div>

               <div className="h-[320px] flex items-center justify-center bg-slate-50 rounded-[32px] border border-slate-200">
                 <ResponsiveContainer width="100%" height="100%">
                   <PieChart>
                     <Pie
                       data={pieChartData}
                       cx="50%"
                       cy="50%"
                       innerRadius={60}
                       outerRadius={100}
                       paddingAngle={2}
                       dataKey="value"
                       stroke="none"
                     >
                       {pieChartData.map((entry, index) => (
                         <Cell key={`cell-${index}`} fill={entry.color} />
                       ))}
                     </Pie>
                     <Tooltip 
                       contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 25px rgba(0,0,0,0.1)', padding: '16px' }}
                       labelStyle={{ fontSize: '10px', fontWeight: 900, textTransform: 'uppercase', color: '#0f172a' }}
                       formatter={(value: number) => [`${value.toFixed(2)}%`, undefined]}
                     />
                     <Legend wrapperStyle={{ fontSize: '10px', fontWeight: 600, textTransform: 'uppercase' }} />
                   </PieChart>
                 </ResponsiveContainer>
               </div>
            </div>

            <div className="space-y-2.5">
              <div className="flex justify-between text-[9px] font-black text-slate-400 uppercase tracking-wider px-4">
                <span>Equity Block / Partner Node</span>
                <div className="flex gap-16">
                  <span>Pre-Round</span>
                  <span>Post-Round</span>
                  <span>Post Value</span>
                </div>
              </div>

              <div className="space-y-2 max-h-[300px] overflow-y-auto custom-scrollbar pr-2">
                {capTableCalculations.postRoundCapTable.map((item) => (
                  <div key={item.id} className="flex items-center justify-between p-4 bg-slate-50 rounded-[32px] border border-slate-200">
                    <div className="flex items-center gap-3">
                      <span className={`w-3 h-3 rounded-full ${item.isFounder ? 'bg-indigo-500' : 'bg-emerald-500'}`} />
                      <span className="text-xs font-bold text-slate-800 truncate max-w-[170px] uppercase">{item.name}</span>
                      {item.isFounder && (
                        <span className="px-2 py-1 bg-indigo-100 text-indigo-700 text-[8px] font-black rounded-md uppercase tracking-widest">Founders</span>
                      )}
                    </div>

                    <div className="flex items-center font-mono text-sm font-bold gap-12">
                      <span className="text-slate-400 w-12 text-right">{item.preShare}%</span>
                      <span className="text-slate-800 w-12 text-right">{item.postShare}%</span>
                      <span className="text-emerald-600 w-28 text-right font-black">
                        {item.postValue.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })}
                      </span>
                      {!item.isFounder ? (
                        <button 
                          onClick={() => deleteInvestorLine(item.id)}
                          className="text-slate-400 hover:text-rose-600 transition-colors w-4"
                        >
                          <Trash size={14} />
                        </button>
                      ) : (
                        <div className="w-4" />
                      )}
                    </div>
                  </div>
                ))}

                <div className="flex items-center justify-between p-4 bg-indigo-50/50 rounded-[32px] border border-dashed border-indigo-200">
                  <div className="flex items-center gap-3 text-indigo-600">
                    <Layers size={14} strokeWidth={2.5} />
                    <span className="text-xs font-black uppercase tracking-wider">Series Option Pool</span>
                  </div>
                  <div className="flex items-center font-mono text-sm font-bold gap-12">
                    <span className="text-slate-400 w-12 text-right">0%</span>
                    <span className="text-indigo-600 w-12 text-right font-black">{optionPoolIncrease}%</span>
                    <span className="text-indigo-600 w-28 text-right font-black">
                      {capTableCalculations.poolPostValue.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })}
                    </span>
                    <div className="w-4" />
                  </div>
                </div>

                <div className="flex items-center justify-between p-4 bg-emerald-50/50 rounded-[32px] border border-dashed border-emerald-200">
                  <div className="flex items-center gap-3 text-emerald-600">
                    <Award size={14} strokeWidth={2.5} />
                    <span className="text-xs font-black uppercase tracking-wider">New VC Capital</span>
                  </div>
                  <div className="flex items-center font-mono text-sm font-bold gap-12">
                    <span className="text-slate-400 w-12 text-right">0%</span>
                    <span className="text-emerald-600 w-12 text-right font-black">{capTableCalculations.newMoneyShare}%</span>
                    <span className="text-emerald-600 w-28 text-right font-black">
                      {capTableCalculations.newInvestorPostValue.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })}
                    </span>
                    <div className="w-4" />
                  </div>
                </div>
              </div>
            </div>
          </div>
          
          <div className="bg-slate-900 text-white rounded-[32px] p-8 shadow-xl flex flex-col md:flex-row justify-between items-center gap-6 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-64 h-64 bg-[radial-gradient(ellipse_at_top_right,rgba(99,102,241,0.3),transparent_50%)] pointer-events-none" />
            <div className="relative z-10">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Estimated Corporate Cap Scale</p>
              <h4 className="text-2xl font-black tracking-tighter text-white uppercase mt-1">Post-Round Enterprise Value</h4>
            </div>
            <div className="relative z-10 text-right flex items-center gap-6">
              <div className="text-right">
                <span className="text-[10px] font-black text-slate-400 block uppercase tracking-widest mb-1">Post-Money Target</span>
                <span className="text-3xl font-black text-emerald-400 font-mono tracking-tighter">
                  {capTableCalculations.postMoneyValuation.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })}
                </span>
              </div>
              <div className="py-3 px-4 bg-slate-800 border border-slate-700 text-slate-300 rounded-xl uppercase font-black text-[10px] tracking-widest shadow-inner">
                {fundingAmount > 0 ? (fundingAmount / preMoneyValuation * 100).toFixed(1) : 0}% Raise Ratio
              </div>
            </div>
          </div>
        </div>

        <div className="lg:col-span-5 flex flex-col gap-6">
          <div className="bg-white border border-slate-200 rounded-[32px] shadow-sm p-8 space-y-6">
            <div className="flex items-center gap-2">
              <Sparkles size={18} className="text-indigo-600" />
              <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest">Perform Growth Target Calibration</h3>
            </div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider -mt-2">Adjust CAGR projections to calibrate future venture value models</p>
            
            <div className="grid grid-cols-3 gap-3">
              {(['conservative', 'moderate', 'hyper'] as const).map((scen) => (
                <button
                  key={scen}
                  onClick={() => setGrowthScenario(scen)}
                  className={`py-3 px-2 text-[10px] font-black uppercase tracking-widest border-2 transition-all rounded-xl select-none cursor-pointer ${
                    growthScenario === scen 
                      ? "bg-indigo-600 border-indigo-600 text-white shadow-md" 
                      : "bg-slate-50 border-slate-200 text-slate-500 hover:bg-slate-100 hover:border-slate-300"
                  }`}
                >
                  {scen}
                </button>
              ))}
            </div>

            <div className="h-[200px] w-full pt-4">
               <ResponsiveContainer width="100%" height="100%">
                 <LineChart data={lineChartData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                   <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                   <XAxis dataKey="year" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8', fontWeight: 600 }} dy={10} />
                   <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8', fontFamily: 'monospace' }} tickFormatter={val => `$${(val/1000000).toFixed(1)}M`} />
                   <Tooltip 
                     cursor={{ stroke: '#cbd5e1', strokeWidth: 1, strokeDasharray: '4 4' }}
                     contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 25px rgba(0,0,0,0.1)', padding: '16px' }}
                     labelStyle={{ fontSize: '10px', fontWeight: 900, textTransform: 'uppercase', color: '#0f172a', marginBottom: '8px' }}
                     formatter={(value: number) => [`$${(value/1000000).toFixed(1)}M`, 'Projected Valuation']}
                   />
                   <Line type="monotone" dataKey="valuation" stroke="#3b82f6" strokeWidth={4} dot={{ r: 4, strokeWidth: 2 }} activeDot={{ r: 6 }} />
                 </LineChart>
               </ResponsiveContainer>
            </div>

            <div className="bg-slate-50 p-6 border border-slate-200 rounded-[32px]">
              <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Strategic Directive</span>
              <p className="text-sm font-medium text-slate-700 leading-relaxed mt-2 italic">"{scenarioForecast.strategicGoal}"</p>
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-[32px] shadow-sm p-8 space-y-4 flex-1 flex flex-col">
            <div className="flex justify-between items-center mb-2">
              <div className="flex items-center gap-2">
                <FileText size={18} className="text-indigo-600" />
                <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest">Executive Board Deck Memo</h3>
              </div>
              <button 
                onClick={copyMemoToClipboard}
                className="text-[10px] font-black text-indigo-600 hover:text-indigo-800 uppercase tracking-widest flex items-center gap-1.5 cursor-pointer transition-colors px-3 py-1.5 bg-indigo-50 rounded-lg"
              >
                <Copy size={12} />
                <span>Copy Draft</span>
              </button>
            </div>
            
            <textarea
              readOnly
              value={boardroomMemoDraft}
              className="w-full flex-1 p-5 bg-slate-50 border border-slate-200 rounded-[32px] text-xs font-mono text-slate-600 leading-relaxed overflow-y-auto outline-none custom-scrollbar uppercase resize-none min-h-[300px]"
            />

            <div className="text-[9px] text-slate-500 bg-slate-100 p-4 rounded-[32px] border border-slate-200 uppercase tracking-wider font-bold flex gap-3 items-center">
              <AlertCircle size={16} className="text-slate-400 shrink-0" />
              <span>Draft compiled under strict accounting rules by integrating LedgerFlow's cash balance database.</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
