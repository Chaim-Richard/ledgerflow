import { useMemo, useState } from 'react';
import { useLedgerStore } from '../../stores/useLedgerStore';
import { useAuthStore } from '../../stores/useAuthStore';
import { 
  Home, Trash, Sparkles, TrendingUp, TrendingDown, Activity, AlertCircle, PiggyBank, ArrowRightLeft, PieChart as PieChartIcon, BarChart2
} from 'lucide-react';
import { toast } from 'sonner';
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip as RechartsTooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend, AreaChart, Area } from 'recharts';

interface HouseholdAsset {
  id: string;
  name: string;
  category: 'realestate' | 'portfolio' | 'cash' | 'valuable' | 'equity';
  appraisalValue: number;
  growthRate: number; // yearly growth rate (e.g., 0.05 representing 5%)
}

interface HouseholdLiability {
  id: string;
  name: string;
  amount: number;
  interestRate: number; // e.g. 0.06 (6%)
}

const CATEGORY_COLORS = {
  realestate: '#6366f1', // indigo
  portfolio: '#10b981', // emerald
  cash: '#0ea5e9', // sky
  valuable: '#f59e0b', // amber
  equity: '#8b5cf6', // violet
};

const CATEGORY_LABELS = {
  realestate: 'Real Estate',
  portfolio: 'Equities',
  cash: 'Liquid Cash',
  valuable: 'Collectibles',
  equity: 'Private Equity'
};

export default function CFOAtHome() {
  const { accounts } = useLedgerStore();
  const { workspaces, currentWorkspaceId } = useAuthStore();
  
  // Calculate business value base to seed family net worth seamlessly
  const businessNetValue = useMemo(() => {
    // Top line EBITDA multiple is business equity appraisal
    const totalIncome = accounts.filter(a => a.type === 'income').reduce((sum, a) => sum + (a.balanceCents || 0), 0) / 100;
    const totalExpense = accounts.filter(a => a.type === 'expense').reduce((sum, a) => sum + (a.balanceCents || 0), 0) / 100;
    const ebitda = totalIncome - totalExpense;
    return Math.max(0, ebitda * 4.5); // SaaS/SME Median Valuation Multiplier
  }, [accounts]);

  // Household asset roster
  const [householdAssets, setHouseholdAssets] = useState<HouseholdAsset[]>([
    {
       id: 'demo-asset-1',
       name: 'Primary Estate',
       category: 'realestate',
       appraisalValue: 2450000,
       growthRate: 0.045
    },
    {
       id: 'demo-asset-2',
       name: 'Global Equity Trust',
       category: 'portfolio',
       appraisalValue: 1850000,
       growthRate: 0.08
    },
    {
       id: 'demo-asset-3',
       name: 'Private Equity Reserve',
       category: 'equity',
       appraisalValue: 450000,
       growthRate: 0.12
    }
  ]);

  // Household liability list
  const [householdLiabilities, setHouseholdLiabilities] = useState<HouseholdLiability[]>([
    {
       id: 'demo-liab-1',
       name: 'Estate Mortgage',
       amount: 850000,
       interestRate: 0.038
    }
  ]);

  // Asset creation inputs
  const [newAssetName, setNewAssetName] = useState('');
  const [newAssetCategory, setNewAssetCategory] = useState<'realestate' | 'portfolio' | 'cash' | 'valuable' | 'equity'>('portfolio');
  const [newAssetAppraisal, setNewAssetAppraisal] = useState<number>(0);
  const [newAssetGrowth, setNewAssetGrowth] = useState<number>(5);

  // Liability creation inputs
  const [newLiabName, setNewLiabName] = useState('');
  const [newLiabAmount, setNewLiabAmount] = useState<number>(0);
  const [newLiabRate, setNewLiabRate] = useState<number>(4.5);

  // Interactive FIRE Radar variables
  const [targetMonthlyBurn, setTargetMonthlyBurn] = useState<number>(8500); // $8.5k/mo target lifestyle
  const [safeWithdrawalRate, setSafeWithdrawalRate] = useState<number>(4); // 4% rule
  const [retirementYield, setRetirementYield] = useState<number>(6.5); // 6.5% return inflation-adjusted

  // S-Corp / Equity owner divestment optimization sliders
  const [divestmentAmount, setDivestmentAmount] = useState<number>(180000); // total desired payout from business

  // Calculated Net Worth totals
  const netWorthMetrics = useMemo(() => {
    const totalAssets = householdAssets.reduce((sum, val) => sum + val.appraisalValue, 0);
    const totalLiabilities = householdLiabilities.reduce((sum, val) => sum + val.amount, 0);
    const netValue = totalAssets - totalLiabilities;
    
    // Future estimation over 10 Years
    const projected10YearsAssets = householdAssets.reduce((sum, item) => {
      return sum + item.appraisalValue * Math.pow(1 + item.growthRate, 10);
    }, 0);
    const projected10YearsLiab = householdLiabilities.reduce((sum, item) => {
      // Mortgage depreciating, but let's assume a standard 10 years amortized reduction
      return sum + item.amount * Math.pow(1 - 0.035, 10);
    }, 0);
    const projected10YearsNet = projected10YearsAssets - projected10YearsLiab;

    return {
      totalAssets,
      totalLiabilities,
      netValue,
      projected10YearsAssets,
      projected10YearsLiab,
      projected10YearsNet
    };
  }, [householdAssets, householdLiabilities]);

  const assetAllocationData = useMemo(() => {
    const allocation = householdAssets.reduce((acc, asset) => {
      acc[asset.category] = (acc[asset.category] || 0) + asset.appraisalValue;
      return acc;
    }, {} as Record<string, number>);
    
    return Object.entries(allocation).map(([key, value]) => ({
      name: CATEGORY_LABELS[key as keyof typeof CATEGORY_LABELS],
      value,
      color: CATEGORY_COLORS[key as keyof typeof CATEGORY_COLORS]
    })).sort((a, b) => b.value - a.value);
  }, [householdAssets]);

  const projectionData = useMemo(() => {
    const data = [];
    for (let year = 0; year <= 10; year++) {
      const assets = householdAssets.reduce((sum, item) => sum + item.appraisalValue * Math.pow(1 + item.growthRate, year), 0);
      const liabilities = householdLiabilities.reduce((sum, item) => sum + item.amount * Math.pow(1 - 0.035, year), 0);
      data.push({
        year: year === 0 ? 'Now' : `Y${year}`,
        assets,
        liabilities: liabilities * -1, // Negative for charting
        netWorth: assets - liabilities
      });
    }
    return data;
  }, [householdAssets, householdLiabilities]);

  // FIRE calculations
  const fireCalculations = useMemo(() => {
    const targetNestEgg = (targetMonthlyBurn * 12) / (safeWithdrawalRate / 100);
    // Exclude basic home equity from retirement nestegg unless downsizing
    const investableAssets = householdAssets
      .filter(a => a.category === 'portfolio' || a.category === 'cash' || a.category === 'equity')
      .reduce((sum, a) => sum + a.appraisalValue, 0);

    const gap = Math.max(0, targetNestEgg - investableAssets);
    const progressPercent = targetNestEgg > 0 ? Math.min(100, (investableAssets / targetNestEgg) * 100) : 0;
    
    // Years to FIRE assuming 6.5% retirement compound return + standard SS inputs
    const annualSavings = (businessNetValue * 0.15) || 0; // Assuming 15% biz-reinvestment or W-2 payroll deposits
    let yearsLeft = 0;
    if (gap > 0 && annualSavings > 0) {
      // Future value compounding math approximation
      const r = retirementYield / 100;
      yearsLeft = Math.log((gap * r) / annualSavings + 1) / Math.log(1 + r);
    }

    return {
      targetNestEgg,
      investableAssets,
      gap,
      progressPercent: parseFloat(progressPercent.toFixed(1)),
      yearsLeft: parseFloat(Math.max(0, yearsLeft).toFixed(1)),
      annualSavings
    };
  }, [targetMonthlyBurn, safeWithdrawalRate, householdAssets, businessNetValue, retirementYield]);

  // Business Divestment Tax Optimization Logic
  const divestmentOptimization = useMemo(() => {
    // W-2 S-Corp reasonable comp rule
    // Standard recommended splits is 40% W-2 Salary, 60% S-Corp Distribution (K-1)
    const salaryPercent = 40;
    const distributionPercent = 60;
    
    const salaryAmount = divestmentAmount * (salaryPercent / 100);
    const distributionAmount = divestmentAmount * (distributionPercent / 100);

    // Compute estimated tax components
    // FICA (15.3% self-employment or combined payroll maxed out)
    const ficaRate = 0.153; 
    const ficaCapLimit = 168600; // standard W-2 max cap
    const salaryFica = Math.min(salaryAmount, ficaCapLimit) * ficaRate;
    
    // If user paid everything as Salary (Unoptimized W-2 / Sole prop scheduler)
    const fullSalaryFica = Math.min(divestmentAmount, ficaCapLimit) * ficaRate;

    // FICA savings by taking owner distributions (which is exempt from FICA)
    const estimatedFicaSavings = fullSalaryFica - salaryFica;

    return {
      salaryAmount,
      distributionAmount,
      salaryFica,
      fullSalaryFica,
      estimatedFicaSavings,
      reasonableCompCheck: salaryAmount > 60000 ? "PASSES reasonable comp guidelines" : "WARNING: Salary is low, risk of IRS Audit recharacterization."
    };
  }, [divestmentAmount]);

  const handleAddAsset = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAssetName || newAssetAppraisal <= 0) {
      toast.error('INVALID ASSET VALUE');
      return;
    }

    const newAsset: HouseholdAsset = {
      id: Math.random().toString(),
      name: newAssetName,
      category: newAssetCategory,
      appraisalValue: newAssetAppraisal,
      growthRate: newAssetGrowth / 100
    };

    setHouseholdAssets([...householdAssets, newAsset]);
    setNewAssetName('');
    setNewAssetAppraisal(0);
    toast.success(`ASSET REGISTERED: ${newAssetName.toUpperCase()}`);
  };

  const handleAddLiability = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newLiabName || newLiabAmount <= 0) {
      toast.error('INVALID LIABILITY VALUE');
      return;
    }

    const newLiab: HouseholdLiability = {
      id: Math.random().toString(),
      name: newLiabName,
      amount: newLiabAmount,
      interestRate: newLiabRate / 100
    };

    setHouseholdLiabilities([...householdLiabilities, newLiab]);
    setNewLiabName('');
    setNewLiabAmount(0);
    toast.success(`LIABILITY REGISTERED: ${newLiabName.toUpperCase()}`);
  };

  const removeAsset = (id: string) => {
    setHouseholdAssets(householdAssets.filter(x => x.id !== id));
    toast.info('FAMILY ASSET DIVESTED');
  };

  const removeLiability = (id: string) => {
    setHouseholdLiabilities(householdLiabilities.filter(x => x.id !== id));
    toast.info('HOUSEHOLD LIABILITY AMORTIZED');
  };

  return (
    <div className="space-y-8 p-4 md:p-6 lg:p-10 w-full max-w-[1550px] mx-auto pb-20">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between border-b border-slate-200 pb-6 gap-4">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="px-3 py-1 bg-indigo-900 text-white rounded-full text-[9px] font-black tracking-widest uppercase shadow-sm">CFO AT HOME SUITE</span>
            <span className="flex h-2 w-2 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-500"></span>
            </span>
          </div>
          <h1 className="text-3xl font-black text-slate-800 uppercase tracking-tight font-display">
            Family Office Wealth Portal
          </h1>
          <p className="text-xs text-slate-500 mt-1 uppercase tracking-wider font-bold">
            Unified Net Worth Master Balance Sheet, FIRE RADAR, and Corporate Fund Divestment Optimizer
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
        <div className="bg-white border border-slate-200 rounded-[32px] p-6 shadow-sm hover:shadow-md transition-all flex items-center justify-between group">
          <div className="space-y-1">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Family Asset Pool</p>
            <h3 className="text-xl font-bold text-slate-850 font-mono tracking-tight">
              {netWorthMetrics.totalAssets.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })}
            </h3>
          </div>
          <div className="p-3.5 rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-100 group-hover:scale-105 transition-transform">
            <TrendingUp size={20} />
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-[32px] p-6 shadow-sm hover:shadow-md transition-all flex items-center justify-between group">
          <div className="space-y-1">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Household Liabilities</p>
            <h3 className="text-xl font-bold text-rose-600 font-mono tracking-tight">
              {netWorthMetrics.totalLiabilities.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })}
            </h3>
          </div>
          <div className="p-3.5 rounded-xl bg-rose-50 text-rose-600 border border-rose-100 group-hover:scale-105 transition-transform">
            <TrendingDown size={20} />
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-[32px] p-6 shadow-sm hover:shadow-md transition-all flex items-center justify-between group">
          <div className="space-y-1">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Unified Net Worth</p>
            <h3 className="text-2xl font-black text-indigo-700 tracking-tight font-display">
              {netWorthMetrics.netValue.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })}
            </h3>
          </div>
          <div className="p-3.5 rounded-xl bg-indigo-50 text-indigo-600 border border-indigo-100 group-hover:scale-105 transition-transform">
            <Activity size={20} />
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-900 rounded-[32px] p-6 shadow-sm hover:shadow-lg transition-all flex items-center justify-between group text-white">
          <div className="space-y-1">
            <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest">10Y Appraisal Estimate</p>
            <h3 className="text-xl font-black text-emerald-400 font-mono tracking-tight">
              {netWorthMetrics.projected10YearsNet.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })}
            </h3>
          </div>
          <div className="p-3.5 rounded-xl bg-slate-800 text-emerald-400 border border-slate-700 group-hover:scale-105 transition-transform">
            <Sparkles size={20} />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        <div className="lg:col-span-7 space-y-6">
          
          <div className="bg-white border border-slate-200 rounded-[32px] p-8 shadow-sm space-y-6">
            <div className="flex justify-between items-center border-b border-slate-100 pb-4">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-emerald-50 text-emerald-600 border border-emerald-100 rounded-[32px]">
                  <Home size={20} />
                </div>
                <div>
                  <h2 className="text-sm font-black text-slate-800 uppercase tracking-wider">Lifestyle Real & Financial Assets</h2>
                  <p className="text-[10px] text-slate-500 uppercase tracking-wide">Track appraisals, portfolios, equity nodes, and family cash</p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
               <div className="space-y-4">
                 <form onSubmit={handleAddAsset} className="space-y-4 bg-slate-50 p-6 rounded-[32px] border border-slate-200">
                    <div>
                      <label className="text-[10px] font-black uppercase text-slate-500 block mb-2">Asset Designation</label>
                      <input 
                        type="text" 
                        placeholder="e.g. Vacation Beach House" 
                        value={newAssetName}
                        onChange={(e) => setNewAssetName(e.target.value)}
                        className="w-full px-4 py-3 bg-white border border-slate-300 rounded-xl text-sm font-bold shadow-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-[10px] font-black uppercase text-slate-500 block mb-2">Category</label>
                        <select 
                          value={newAssetCategory} 
                          onChange={(e) => setNewAssetCategory(e.target.value as any)}
                          className="w-full px-4 py-3 bg-white border border-slate-300 rounded-xl text-xs font-bold shadow-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                        >
                          <option value="realestate">Real Estate</option>
                          <option value="portfolio">Index Stocks</option>
                          <option value="cash">Cash/Bank Vault</option>
                          <option value="equity">Private Equity</option>
                          <option value="valuable">Collectibles</option>
                        </select>
                      </div>
                      <div>
                        <label className="text-[10px] font-black uppercase text-slate-500 block mb-2">Appraised Value ($)</label>
                        <input 
                          type="number" 
                          value={newAssetAppraisal || ''} 
                          onChange={(e) => setNewAssetAppraisal(parseInt(e.target.value) || 0)}
                          className="w-full px-4 py-3 bg-white border border-slate-300 rounded-xl text-xs font-black shadow-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono"
                        />
                      </div>
                    </div>

                    <button 
                      type="submit"
                      className="w-full py-3 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-black uppercase tracking-widest cursor-pointer transition-all active:scale-95"
                    >
                      Acquire Asset
                    </button>
                 </form>

                 <div className="space-y-2 max-h-[200px] overflow-y-auto custom-scrollbar pr-2">
                    {householdAssets.map((asset) => (
                      <div key={asset.id} className="flex justify-between items-center p-4 bg-slate-50 hover:bg-slate-100 transition-all border border-slate-200 rounded-[32px] group/line">
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-white text-slate-700 border border-slate-200 rounded-xl text-[10px] uppercase font-black w-10 text-center">
                            {asset.category.substring(0, 3)}
                          </div>
                          <div>
                            <h4 className="text-xs font-bold text-slate-800 uppercase tracking-tight">{asset.name}</h4>
                            <p className="text-[9px] font-black text-emerald-600 uppercase tracking-widest mt-0.5">+{(asset.growthRate * 100).toFixed(1)}% / YR</p>
                          </div>
                        </div>

                        <div className="flex items-center gap-6">
                          <span className="font-mono text-sm font-black text-slate-700">
                            {asset.appraisalValue.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })}
                          </span>
                          <button 
                            onClick={() => removeAsset(asset.id)}
                            className="text-slate-300 hover:text-rose-600 cursor-pointer active:scale-95 transition-colors"
                          >
                            <Trash size={14} />
                          </button>
                        </div>
                      </div>
                    ))}
                 </div>
               </div>

               <div className="flex flex-col">
                  <div className="flex items-center gap-2 mb-4">
                     <PieChartIcon size={16} className="text-slate-400" />
                     <span className="text-[10px] font-black uppercase text-slate-500 tracking-widest">Asset Allocation Diversification</span>
                  </div>
                  <div className="flex-1 bg-slate-50 rounded-[32px] border border-slate-200 p-4 min-h-[300px]">
                     <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={assetAllocationData}
                            cx="50%"
                            cy="50%"
                            innerRadius={70}
                            outerRadius={100}
                            paddingAngle={2}
                            dataKey="value"
                            stroke="none"
                          >
                            {assetAllocationData.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={entry.color} />
                            ))}
                          </Pie>
                          <RechartsTooltip 
                            contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 25px rgba(0,0,0,0.1)', padding: '16px' }}
                            labelStyle={{ fontSize: '10px', fontWeight: 900, textTransform: 'uppercase', color: '#0f172a' }}
                            formatter={(value: number) => [value.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }), 'Appraisal']}
                          />
                          <Legend wrapperStyle={{ fontSize: '10px', fontWeight: 600, textTransform: 'uppercase' }} />
                        </PieChart>
                     </ResponsiveContainer>
                  </div>
               </div>
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-[32px] p-8 shadow-sm space-y-6">
            <div className="flex justify-between items-center border-b border-slate-100 pb-4">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-rose-50 text-rose-600 border border-rose-100 rounded-[32px]">
                  <TrendingDown size={20} />
                </div>
                <div>
                  <h2 className="text-sm font-black text-slate-800 uppercase tracking-wider">Household Mortgages & Liabilities</h2>
                  <p className="text-[10px] text-slate-500 uppercase tracking-wide">Monitor debt interest drag on active household wealth acceleration</p>
                </div>
              </div>
            </div>

            <form onSubmit={handleAddLiability} className="grid grid-cols-1 md:grid-cols-12 gap-4 bg-slate-50 p-6 rounded-[32px] border border-slate-200">
              <div className="md:col-span-5">
                <label className="text-[10px] font-black uppercase text-slate-500 block mb-2">Liability designation</label>
                <input 
                  type="text" 
                  placeholder="e.g. Residential Mortgage" 
                  value={newLiabName}
                  onChange={(e) => setNewLiabName(e.target.value)}
                  className="w-full px-4 py-3 bg-white border border-slate-300 rounded-xl text-sm font-bold shadow-sm focus:outline-none focus:ring-2 focus:ring-rose-500"
                />
              </div>

              <div className="md:col-span-3">
                <label className="text-[10px] font-black uppercase text-slate-500 block mb-2">Balance ($)</label>
                <input 
                  type="number" 
                  value={newLiabAmount || ''} 
                  onChange={(e) => setNewLiabAmount(parseInt(e.target.value) || 0)}
                  className="w-full px-4 py-3 bg-white border border-slate-300 rounded-xl text-sm font-black shadow-sm focus:outline-none focus:ring-2 focus:ring-rose-500 font-mono"
                />
              </div>

              <div className="md:col-span-2">
                <label className="text-[10px] font-black uppercase text-slate-500 block mb-2">APR %</label>
                <input 
                  type="number" 
                  step="0.1"
                  value={newLiabRate} 
                  onChange={(e) => setNewLiabRate(parseFloat(e.target.value) || 0)}
                  className="w-full px-4 py-3 bg-white border border-slate-300 rounded-xl text-sm font-black shadow-sm focus:outline-none focus:ring-2 focus:ring-rose-500 font-mono"
                />
              </div>

              <div className="md:col-span-2 flex items-end">
                <button 
                  type="submit"
                  className="w-full py-3 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-black uppercase tracking-widest cursor-pointer transition-all active:scale-95"
                >
                  Fund
                </button>
              </div>
            </form>

            <div className="space-y-2 max-h-[200px] overflow-y-auto custom-scrollbar pr-2">
              {householdLiabilities.map((liab) => (
                <div key={liab.id} className="flex justify-between items-center p-4 bg-slate-50 hover:bg-slate-100 transition-all border border-slate-200 rounded-[32px] group/line">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-white text-rose-600 border border-rose-100 rounded-xl text-[10px] uppercase font-black w-10 text-center">
                      APR
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-slate-800 uppercase tracking-tight">{liab.name}</h4>
                      <p className="text-[9px] font-black text-rose-500 uppercase tracking-widest mt-0.5">INTEREST DRAG: {(liab.interestRate * 100).toFixed(2)}% APR</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-6">
                    <span className="font-mono text-sm font-black text-rose-600">
                      -{liab.amount.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })}
                    </span>
                    <button 
                      onClick={() => removeLiability(liab.id)}
                      className="text-slate-300 hover:text-rose-600 cursor-pointer active:scale-95 transition-colors"
                    >
                      <Trash size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="lg:col-span-5 space-y-6 flex flex-col">
          
          <div className="bg-white border border-slate-200 rounded-[32px] p-8 shadow-sm space-y-6">
            <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
              <div className="p-3 bg-indigo-50 text-indigo-600 border border-indigo-100 rounded-[32px] font-black">
                <PiggyBank size={20} />
              </div>
              <div>
                <h2 className="text-sm font-black text-slate-800 uppercase tracking-wider">Lifestyle FIRE Target Radar</h2>
                <p className="text-[10px] text-slate-500 uppercase tracking-wide">Model when your investments yield total visual self-sustainability</p>
              </div>
            </div>

            <div className="space-y-6">
              <div className="bg-slate-50 p-6 rounded-[32px] border border-slate-200">
                <div className="flex justify-between items-center mb-2">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Monthly Lifestyle Burn Target</label>
                  <span className="text-sm font-black text-indigo-600 font-mono">{targetMonthlyBurn.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })}/mo</span>
                </div>
                <input 
                  type="range"
                  min="2000"
                  max="35000"
                  step="500"
                  value={targetMonthlyBurn}
                  onChange={(e) => setTargetMonthlyBurn(parseInt(e.target.value))}
                  className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-black text-slate-500 uppercase block mb-2">Safe Withdrawal Rate (%)</label>
                  <input 
                    type="number"
                    step="0.25"
                    value={safeWithdrawalRate}
                    onChange={(e) => setSafeWithdrawalRate(parseFloat(e.target.value) || 3)}
                    className="w-full py-3 px-4 bg-white border border-slate-300 rounded-xl text-sm font-black shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-500 uppercase block mb-2">Compound Yield (%)</label>
                  <input 
                    type="number"
                    step="0.5"
                    value={retirementYield}
                    onChange={(e) => setRetirementYield(parseFloat(e.target.value) || 5)}
                    className="w-full py-3 px-4 bg-white border border-slate-300 rounded-xl text-sm font-black shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
                  />
                </div>
              </div>

              <div className="bg-slate-50 p-6 border border-slate-200 rounded-[32px] space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-[10px] font-black uppercase text-slate-500 tracking-widest">Required FIRE Nest Egg</span>
                  <span className="font-mono text-lg text-indigo-700 font-black">
                    {fireCalculations.targetNestEgg.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })}
                  </span>
                </div>

                <div className="flex justify-between items-center">
                  <span className="text-[10px] font-black uppercase text-slate-500 tracking-widest">Investable Assets Roster</span>
                  <span className="font-mono text-slate-800 font-bold">
                    {fireCalculations.investableAssets.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })}
                  </span>
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between items-center text-[10px] font-black uppercase">
                    <span className="text-slate-500">Completion progress</span>
                    <span className="text-emerald-600">{fireCalculations.progressPercent}%</span>
                  </div>
                  <div className="w-full h-3 bg-slate-200 rounded-full overflow-hidden">
                    <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${fireCalculations.progressPercent}%` }} />
                  </div>
                </div>

                <div className="border-t border-slate-200 pt-4 flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <Sparkles size={16} className="text-emerald-500" />
                    <span className="text-[10px] font-black uppercase text-slate-800 tracking-wider">Estimated years to escape</span>
                  </div>
                  <span className="text-xl font-black text-emerald-600 font-mono tracking-tight">
                    {fireCalculations.yearsLeft} Years left
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-[32px] p-8 shadow-sm space-y-6">
            <div className="flex items-center gap-2 border-b border-slate-100 pb-4">
              <BarChart2 size={18} className="text-slate-400" />
              <h2 className="text-sm font-black text-slate-800 uppercase tracking-wider">10-Year Trajectory</h2>
            </div>
            
            <div className="h-[240px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={projectionData} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorNetWorth" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="year" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8', fontWeight: 600 }} dy={10} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8', fontFamily: 'monospace' }} tickFormatter={val => `$${(val/1000000).toFixed(1)}M`} />
                  <RechartsTooltip 
                    contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 25px rgba(0,0,0,0.1)', padding: '16px' }}
                    labelStyle={{ fontSize: '10px', fontWeight: 900, textTransform: 'uppercase', color: '#0f172a', marginBottom: '8px' }}
                    formatter={(value: number, name: string) => [value.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }), name === 'netWorth' ? 'Net Worth' : name]}
                  />
                  <Area type="monotone" dataKey="netWorth" stroke="#6366f1" strokeWidth={3} fillOpacity={1} fill="url(#colorNetWorth)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-[32px] p-8 shadow-sm space-y-6 flex-1 flex flex-col">
            <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
              <div className="p-3 bg-amber-50 text-amber-600 border border-amber-100 rounded-[32px] font-black">
                <ArrowRightLeft size={20} />
              </div>
              <div>
                <h2 className="text-sm font-black text-slate-800 uppercase tracking-wider">Corporate Divestment Optimizer</h2>
                <p className="text-[10px] text-slate-500 uppercase tracking-wide">Optimize compensation payload mixes for tax reduction</p>
              </div>
            </div>

            <div className="space-y-6">
              <div className="bg-slate-50 p-6 rounded-[32px] border border-slate-200">
                <div className="flex justify-between items-center mb-2">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Total Desired Cash Extraction</label>
                  <span className="text-sm font-black text-emerald-600 font-mono">{divestmentAmount.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })} YR</span>
                </div>
                <input 
                  type="range"
                  min="40000"
                  max="350000"
                  step="10000"
                  value={divestmentAmount}
                  onChange={(e) => setDivestmentAmount(parseInt(e.target.value))}
                  className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-emerald-600"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="bg-slate-50 border border-slate-200 rounded-[32px] p-4 text-center">
                  <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 block mb-1">W-2 Salary (40%)</span>
                  <span className="text-lg font-black text-slate-800 font-mono tracking-tight">
                    {divestmentOptimization.salaryAmount.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })}
                  </span>
                  <p className="text-[9px] font-bold text-slate-400 uppercase mt-1">Subject to Payroll FICA</p>
                </div>

                <div className="bg-indigo-50 border border-indigo-100 rounded-[32px] p-4 text-center">
                  <span className="text-[9px] font-black uppercase tracking-widest text-indigo-400 block mb-1">S-Corp Distributions (60%)</span>
                  <span className="text-lg font-black text-indigo-700 font-mono tracking-tight">
                    {divestmentOptimization.distributionAmount.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })}
                  </span>
                  <p className="text-[9px] font-bold text-indigo-500 uppercase mt-1">Exempt from FICA Taxes</p>
                </div>
              </div>

              <div className="p-5 bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-[32px] flex items-center justify-between">
                <div>
                  <span className="text-[9px] font-black uppercase text-emerald-600 tracking-widest">Annual Self-Employment Tax Saved</span>
                  <h4 className="text-lg font-black tracking-tight font-display text-emerald-800 uppercase mt-1">FICA Tax Savings Realized</h4>
                </div>
                <span className="text-2xl font-black font-mono text-emerald-600 tracking-tight">
                  +{divestmentOptimization.estimatedFicaSavings.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })}/yr
                </span>
              </div>

              <div className="text-[9px] text-slate-500 bg-slate-100 p-4 rounded-[32px] border border-slate-200 uppercase tracking-wider font-bold flex gap-3 items-center">
                <AlertCircle size={16} className="text-indigo-600 shrink-0" />
                <span>IRS matching rule audit compliance: {divestmentOptimization.reasonableCompCheck}</span>
              </div>
            </div>
          </div>

        </div>

      </div>
    </div>
  );
}
