import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Calculator, ArrowRight, DollarSign, Percent, TrendingUp, BarChart3, RefreshCw, CheckCircle2, ShieldCheck, Zap } from 'lucide-react';
import { useLedgerStore } from '../../stores/useLedgerStore';

interface FinancialCalculatorViewProps {
  type: 'breakeven' | 'compound' | 'rule72' | 'ltv' | 'npv' | 'cac' | 'wacc' | 'roas' | 'caprate' | 'ratios' | 'ebitda';
}

export default function FinancialCalculatorView({ type }: FinancialCalculatorViewProps) {
  const transactions = useLedgerStore(state => state.transactions || []);
  const accounts = useLedgerStore(state => state.accounts || []);

  // Compute live ledger base figures
  const totalIncome = transactions.reduce((sum, t) => {
    const inc = t.lines?.filter(l => l.amountCents > 0).reduce((a, b) => a + b.amountCents, 0) || 0;
    return sum + (inc / 100);
  }, 0);
  const totalExpense = transactions.reduce((sum, t) => {
    const exp = t.lines?.filter(l => l.amountCents < 0).reduce((a, b) => a + Math.abs(b.amountCents), 0) || 0;
    return sum + (exp / 100);
  }, 0);
  const totalAssets = accounts.filter(a => a.type === 'asset').reduce((s, a) => s + Math.abs(a.balanceCents / 100), 0);
  const totalLiabilities = accounts.filter(a => a.type === 'liability').reduce((s, a) => s + Math.abs(a.balanceCents / 100), 0);

  // Dynamic state per calculator type
  const [fixedCosts, setFixedCosts] = useState<number>(totalExpense > 0 ? Math.round(totalExpense * 0.4) : 10000);
  const [unitPrice, setUnitPrice] = useState<number>(150);
  const [unitVarCost, setUnitVarCost] = useState<number>(50);

  const [principal, setPrincipal] = useState<number>(totalIncome > 0 ? Math.round(totalIncome) : 25000);
  const [rate, setRate] = useState<number>(7.5);
  const [years, setYears] = useState<number>(5);

  const [arpu, setArpu] = useState<number>(120);
  const [churn, setChurn] = useState<number>(2.5);
  const [marginPct, setMarginPct] = useState<number>(75);

  const [adSpend, setAdSpend] = useState<number>(5000);
  const [adRevenue, setAdRevenue] = useState<number>(22500);

  const [noi, setNoi] = useState<number>(totalIncome > totalExpense ? totalIncome - totalExpense : 45000);
  const [propValue, setPropValue] = useState<number>(650000);

  const [mktgCost, setMktgCost] = useState<number>(15000);
  const [newCustomers, setNewCustomers] = useState<number>(50);

  const [costEquity, setCostEquity] = useState<number>(10);
  const [costDebt, setCostDebt] = useState<number>(5);
  const [equityVal, setEquityVal] = useState<number>(500000);
  const [debtVal, setDebtVal] = useState<number>(200000);
  const [taxRate, setTaxRate] = useState<number>(21);

  const [initialInv, setInitialInv] = useState<number>(100000);
  const [cashFlow1, setCashFlow1] = useState<number>(30000);
  const [cashFlow2, setCashFlow2] = useState<number>(40000);
  const [cashFlow3, setCashFlow3] = useState<number>(50000);
  const [discountRate, setDiscountRate] = useState<number>(8);

  // Renderer mapping
  const renderCalculatorContent = () => {
    switch (type) {
      case 'breakeven': {
        const cm = unitPrice - unitVarCost;
        const breakEvenUnits = cm > 0 ? Math.ceil(fixedCosts / cm) : 0;
        const breakEvenRev = breakEvenUnits * unitPrice;
        return (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 bg-[var(--surface)] border border-[var(--line)] rounded-2xl">
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-1">Fixed Operating Costs ($)</label>
                <input type="number" value={fixedCosts} onChange={e => setFixedCosts(Number(e.target.value))} className="w-full text-lg font-bold bg-[var(--ink)] border border-[var(--line)] rounded-xl p-2.5 text-[var(--text)]" />
              </div>
              <div className="p-4 bg-[var(--surface)] border border-[var(--line)] rounded-2xl">
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-1">Unit Price ($)</label>
                <input type="number" value={unitPrice} onChange={e => setUnitPrice(Number(e.target.value))} className="w-full text-lg font-bold bg-[var(--ink)] border border-[var(--line)] rounded-xl p-2.5 text-[var(--text)]" />
              </div>
              <div className="p-4 bg-[var(--surface)] border border-[var(--line)] rounded-2xl">
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-1">Variable Cost per Unit ($)</label>
                <input type="number" value={unitVarCost} onChange={e => setUnitVarCost(Number(e.target.value))} className="w-full text-lg font-bold bg-[var(--ink)] border border-[var(--line)] rounded-xl p-2.5 text-[var(--text)]" />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 p-6 bg-[var(--panel)] text-[var(--text)] rounded-[32px] border border-[var(--line)] shadow-lg">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-widest text-[var(--brass)]">Required Break-Even Units</span>
                <p className="text-3xl font-black mt-1">{breakEvenUnits.toLocaleString()} Units</p>
                <p className="text-xs text-[var(--muted)] mt-1">Contribution margin per unit: ${cm.toLocaleString()}</p>
              </div>
              <div>
                <span className="text-[10px] font-bold uppercase tracking-widest text-[var(--pos)]">Break-Even Revenue Volume</span>
                <p className="text-3xl font-black mt-1">${breakEvenRev.toLocaleString()}</p>
                <p className="text-xs text-[var(--muted)] mt-1">Revenue needed to cover fixed and variable expenses</p>
              </div>
            </div>
          </div>
        );
      }

      case 'compound': {
        const r = rate / 100;
        const futureVal = principal * Math.pow(1 + r, years);
        const totalInterest = futureVal - principal;
        return (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 bg-[var(--surface)] border border-[var(--line)] rounded-2xl">
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-1">Principal Amount ($)</label>
                <input type="number" value={principal} onChange={e => setPrincipal(Number(e.target.value))} className="w-full text-lg font-bold bg-[var(--ink)] border border-[var(--line)] rounded-xl p-2.5 text-[var(--text)]" />
              </div>
              <div className="p-4 bg-[var(--surface)] border border-[var(--line)] rounded-2xl">
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-1">Annual Interest Rate (%)</label>
                <input type="number" step="0.1" value={rate} onChange={e => setRate(Number(e.target.value))} className="w-full text-lg font-bold bg-[var(--ink)] border border-[var(--line)] rounded-xl p-2.5 text-[var(--text)]" />
              </div>
              <div className="p-4 bg-[var(--surface)] border border-[var(--line)] rounded-2xl">
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-1">Duration (Years)</label>
                <input type="number" value={years} onChange={e => setYears(Number(e.target.value))} className="w-full text-lg font-bold bg-[var(--ink)] border border-[var(--line)] rounded-xl p-2.5 text-[var(--text)]" />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 p-6 bg-slate-900 text-white rounded-[32px] border border-slate-800">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-widest text-emerald-400">Future Value</span>
                <p className="text-3xl font-black mt-1">${Math.round(futureVal).toLocaleString()}</p>
                <p className="text-xs text-slate-400 mt-1">Total accumulated value after {years} years</p>
              </div>
              <div>
                <span className="text-[10px] font-bold uppercase tracking-widest text-indigo-400">Compounded Interest Yield</span>
                <p className="text-3xl font-black mt-1">${Math.round(totalInterest).toLocaleString()}</p>
                <p className="text-xs text-slate-400 mt-1">Gain over initial principal</p>
              </div>
            </div>
          </div>
        );
      }

      case 'rule72': {
        const yearsToDouble = rate > 0 ? (72 / rate).toFixed(1) : '∞';
        return (
          <div className="space-y-6">
            <div className="p-4 bg-[var(--surface)] border border-[var(--line)] rounded-2xl max-w-md">
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-1">Annual Growth / Rate of Return (%)</label>
              <input type="number" step="0.5" value={rate} onChange={e => setRate(Number(e.target.value))} className="w-full text-lg font-bold bg-[var(--ink)] border border-[var(--line)] rounded-xl p-2.5 text-[var(--text)]" />
            </div>

            <div className="p-6 bg-slate-900 text-white rounded-[32px] border border-slate-800">
              <span className="text-[10px] font-bold uppercase tracking-widest text-indigo-400">Estimated Years to Double Capital</span>
              <p className="text-4xl font-black mt-2">{yearsToDouble} Years</p>
              <p className="text-xs text-slate-400 mt-2">At a constant return of {rate}%, capital doubles every {yearsToDouble} years.</p>
            </div>
          </div>
        );
      }

      case 'ltv': {
        const ltvVal = churn > 0 ? ((arpu * (marginPct / 100)) / (churn / 100)) : 0;
        return (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 bg-[var(--surface)] border border-[var(--line)] rounded-2xl">
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-1">Monthly ARPU ($)</label>
                <input type="number" value={arpu} onChange={e => setArpu(Number(e.target.value))} className="w-full text-lg font-bold bg-[var(--ink)] border border-[var(--line)] rounded-xl p-2.5 text-[var(--text)]" />
              </div>
              <div className="p-4 bg-[var(--surface)] border border-[var(--line)] rounded-2xl">
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-1">Gross Margin (%)</label>
                <input type="number" value={marginPct} onChange={e => setMarginPct(Number(e.target.value))} className="w-full text-lg font-bold bg-[var(--ink)] border border-[var(--line)] rounded-xl p-2.5 text-[var(--text)]" />
              </div>
              <div className="p-4 bg-[var(--surface)] border border-[var(--line)] rounded-2xl">
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-1">Monthly Churn Rate (%)</label>
                <input type="number" step="0.1" value={churn} onChange={e => setChurn(Number(e.target.value))} className="w-full text-lg font-bold bg-[var(--ink)] border border-[var(--line)] rounded-xl p-2.5 text-[var(--text)]" />
              </div>
            </div>

            <div className="p-6 bg-slate-900 text-white rounded-[32px] border border-slate-800">
              <span className="text-[10px] font-bold uppercase tracking-widest text-emerald-400">Customer Lifetime Value (LTV)</span>
              <p className="text-4xl font-black mt-2">${Math.round(ltvVal).toLocaleString()}</p>
              <p className="text-xs text-slate-400 mt-2">Expected net profit generated per customer relationship</p>
            </div>
          </div>
        );
      }

      case 'cac': {
        const cacVal = newCustomers > 0 ? Math.round(mktgCost / newCustomers) : 0;
        return (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 bg-[var(--surface)] border border-[var(--line)] rounded-2xl">
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-1">Total Marketing & Sales Cost ($)</label>
                <input type="number" value={mktgCost} onChange={e => setMktgCost(Number(e.target.value))} className="w-full text-lg font-bold bg-[var(--ink)] border border-[var(--line)] rounded-xl p-2.5 text-[var(--text)]" />
              </div>
              <div className="p-4 bg-[var(--surface)] border border-[var(--line)] rounded-2xl">
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-1">New Acquired Customers</label>
                <input type="number" value={newCustomers} onChange={e => setNewCustomers(Number(e.target.value))} className="w-full text-lg font-bold bg-[var(--ink)] border border-[var(--line)] rounded-xl p-2.5 text-[var(--text)]" />
              </div>
            </div>

            <div className="p-6 bg-slate-900 text-white rounded-[32px] border border-slate-800">
              <span className="text-[10px] font-bold uppercase tracking-widest text-rose-400">Customer Acquisition Cost (CAC)</span>
              <p className="text-4xl font-black mt-2">${cacVal.toLocaleString()}</p>
              <p className="text-xs text-slate-400 mt-2">Average cost required to acquire one new customer</p>
            </div>
          </div>
        );
      }

      case 'roas': {
        const roasVal = adSpend > 0 ? (adRevenue / adSpend).toFixed(2) : '0';
        const roasPct = adSpend > 0 ? Math.round((adRevenue / adSpend) * 100) : 0;
        return (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 bg-[var(--surface)] border border-[var(--line)] rounded-2xl">
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-1">Total Ad Spend ($)</label>
                <input type="number" value={adSpend} onChange={e => setAdSpend(Number(e.target.value))} className="w-full text-lg font-bold bg-[var(--ink)] border border-[var(--line)] rounded-xl p-2.5 text-[var(--text)]" />
              </div>
              <div className="p-4 bg-[var(--surface)] border border-[var(--line)] rounded-2xl">
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-1">Attributable Ad Revenue ($)</label>
                <input type="number" value={adRevenue} onChange={e => setAdRevenue(Number(e.target.value))} className="w-full text-lg font-bold bg-[var(--ink)] border border-[var(--line)] rounded-xl p-2.5 text-[var(--text)]" />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 p-6 bg-slate-900 text-white rounded-[32px] border border-slate-800">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-widest text-emerald-400">ROAS Multiple</span>
                <p className="text-4xl font-black mt-1">{roasVal}x</p>
                <p className="text-xs text-slate-400 mt-1">For every $1 spent on ads, ${roasVal} revenue is generated</p>
              </div>
              <div>
                <span className="text-[10px] font-bold uppercase tracking-widest text-indigo-400">ROAS Percentage</span>
                <p className="text-4xl font-black mt-1">{roasPct}%</p>
                <p className="text-xs text-slate-400 mt-1">Return on marketing capital efficiency</p>
              </div>
            </div>
          </div>
        );
      }

      case 'caprate': {
        const capRateVal = propValue > 0 ? ((noi / propValue) * 100).toFixed(2) : '0';
        return (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 bg-[var(--surface)] border border-[var(--line)] rounded-2xl">
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-1">Net Operating Income (NOI) ($)</label>
                <input type="number" value={noi} onChange={e => setNoi(Number(e.target.value))} className="w-full text-lg font-bold bg-[var(--ink)] border border-[var(--line)] rounded-xl p-2.5 text-[var(--text)]" />
              </div>
              <div className="p-4 bg-[var(--surface)] border border-[var(--line)] rounded-2xl">
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-1">Asset Value / Purchase Price ($)</label>
                <input type="number" value={propValue} onChange={e => setPropValue(Number(e.target.value))} className="w-full text-lg font-bold bg-[var(--ink)] border border-[var(--line)] rounded-xl p-2.5 text-[var(--text)]" />
              </div>
            </div>

            <div className="p-6 bg-slate-900 text-white rounded-[32px] border border-slate-800">
              <span className="text-[10px] font-bold uppercase tracking-widest text-indigo-400">Capitalization Rate (Cap Rate)</span>
              <p className="text-4xl font-black mt-2">{capRateVal}%</p>
              <p className="text-xs text-slate-400 mt-2">Unleveraged rate of return generated by the asset</p>
            </div>
          </div>
        );
      }

      case 'wacc': {
        const totalV = equityVal + debtVal;
        const eWeight = totalV > 0 ? equityVal / totalV : 0;
        const dWeight = totalV > 0 ? debtVal / totalV : 0;
        const afterTaxDebtCost = (costDebt / 100) * (1 - taxRate / 100);
        const waccVal = totalV > 0 ? ((eWeight * (costEquity / 100) + dWeight * afterTaxDebtCost) * 100).toFixed(2) : '0';

        return (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 bg-[var(--surface)] border border-[var(--line)] rounded-2xl">
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-1">Cost of Equity (%)</label>
                <input type="number" step="0.1" value={costEquity} onChange={e => setCostEquity(Number(e.target.value))} className="w-full text-lg font-bold bg-[var(--ink)] border border-[var(--line)] rounded-xl p-2.5 text-[var(--text)]" />
              </div>
              <div className="p-4 bg-[var(--surface)] border border-[var(--line)] rounded-2xl">
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-1">Pre-Tax Cost of Debt (%)</label>
                <input type="number" step="0.1" value={costDebt} onChange={e => setCostDebt(Number(e.target.value))} className="w-full text-lg font-bold bg-[var(--ink)] border border-[var(--line)] rounded-xl p-2.5 text-[var(--text)]" />
              </div>
              <div className="p-4 bg-[var(--surface)] border border-[var(--line)] rounded-2xl">
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-1">Corporate Tax Rate (%)</label>
                <input type="number" value={taxRate} onChange={e => setTaxRate(Number(e.target.value))} className="w-full text-lg font-bold bg-[var(--ink)] border border-[var(--line)] rounded-xl p-2.5 text-[var(--text)]" />
              </div>
            </div>

            <div className="p-6 bg-slate-900 text-white rounded-[32px] border border-slate-800">
              <span className="text-[10px] font-bold uppercase tracking-widest text-indigo-400">Weighted Average Cost of Capital (WACC)</span>
              <p className="text-4xl font-black mt-2">{waccVal}%</p>
              <p className="text-xs text-slate-400 mt-2">Hurdle rate required to generate economic value add (EVA)</p>
            </div>
          </div>
        );
      }

      case 'npv': {
        const r = discountRate / 100;
        const npvVal = -initialInv + (cashFlow1 / (1 + r)) + (cashFlow2 / Math.pow(1 + r, 2)) + (cashFlow3 / Math.pow(1 + r, 3));
        return (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 bg-[var(--surface)] border border-[var(--line)] rounded-2xl">
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-1">Initial Outlay ($)</label>
                <input type="number" value={initialInv} onChange={e => setInitialInv(Number(e.target.value))} className="w-full text-lg font-bold bg-[var(--ink)] border border-[var(--line)] rounded-xl p-2.5 text-[var(--text)]" />
              </div>
              <div className="p-4 bg-[var(--surface)] border border-[var(--line)] rounded-2xl">
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-1">Discount Rate / Hurdle Rate (%)</label>
                <input type="number" step="0.5" value={discountRate} onChange={e => setDiscountRate(Number(e.target.value))} className="w-full text-lg font-bold bg-[var(--ink)] border border-[var(--line)] rounded-xl p-2.5 text-[var(--text)]" />
              </div>
            </div>

            <div className="p-6 bg-slate-900 text-white rounded-[32px] border border-slate-800">
              <span className="text-[10px] font-bold uppercase tracking-widest text-emerald-400">Net Present Value (NPV)</span>
              <p className="text-4xl font-black mt-2">${Math.round(npvVal).toLocaleString()}</p>
              <p className="text-xs text-slate-400 mt-2">{npvVal >= 0 ? 'Project creates value above required discount hurdle rate' : 'Project destroys value at current discount rate'}</p>
            </div>
          </div>
        );
      }

      case 'ratios':
      case 'ebitda':
      default: {
        const currentRatio = totalLiabilities > 0 ? (totalAssets / totalLiabilities).toFixed(2) : 'N/A';
        const grossMargin = totalIncome > 0 ? (((totalIncome - totalExpense * 0.3) / totalIncome) * 100).toFixed(1) : '0';
        const netMargin = totalIncome > 0 ? (((totalIncome - totalExpense) / totalIncome) * 100).toFixed(1) : '0';
        const ebitdaVal = Math.round(totalIncome - totalExpense * 0.85);

        return (
          <div className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="p-5 bg-[var(--surface)] border border-[var(--line)] rounded-2xl">
                <span className="text-[9px] font-bold uppercase tracking-wider text-slate-500">Current Ratio</span>
                <p className="text-2xl font-black text-[var(--text)] mt-1">{currentRatio}</p>
                <p className="text-[10px] text-slate-400 mt-1">Total Assets / Total Liabilities</p>
              </div>
              <div className="p-5 bg-[var(--surface)] border border-[var(--line)] rounded-2xl">
                <span className="text-[9px] font-bold uppercase tracking-wider text-slate-500">Gross Margin</span>
                <p className="text-2xl font-black text-emerald-600 mt-1">{grossMargin}%</p>
                <p className="text-[10px] text-slate-400 mt-1">Derived from live ledger entries</p>
              </div>
              <div className="p-5 bg-[var(--surface)] border border-[var(--line)] rounded-2xl">
                <span className="text-[9px] font-bold uppercase tracking-wider text-slate-500">Net Profit Margin</span>
                <p className="text-2xl font-black text-indigo-600 mt-1">{netMargin}%</p>
                <p className="text-[10px] text-slate-400 mt-1">Live net profitability yield</p>
              </div>
              <div className="p-5 bg-[var(--surface)] border border-[var(--line)] rounded-2xl">
                <span className="text-[9px] font-bold uppercase tracking-wider text-slate-500">Estimated EBITDA</span>
                <p className="text-2xl font-black text-[var(--text)] mt-1">${ebitdaVal.toLocaleString()}</p>
                <p className="text-[10px] text-slate-400 mt-1">Operational earnings indicator</p>
              </div>
            </div>
          </div>
        );
      }
    }
  };

  return (
    <div className="p-6 md:p-8 bg-[var(--surface)] border border-[var(--line)]/80 rounded-[32px] shadow-sm space-y-6">
      <div className="flex items-center gap-3 border-b border-[var(--line)] pb-5">
        <div className="w-10 h-10 bg-[var(--brass)] text-black rounded-xl flex items-center justify-center font-bold">
          <Calculator size={20} />
        </div>
        <div>
          <h2 className="text-lg font-bold text-[var(--text)] uppercase tracking-tight">
            {type.toUpperCase()} Analytical Lens Calculator
          </h2>
          <p className="text-xs text-slate-500 font-mono">
            Interactive financial computation powered by live workspace ledger physics
          </p>
        </div>
      </div>

      {renderCalculatorContent()}
    </div>
  );
}
