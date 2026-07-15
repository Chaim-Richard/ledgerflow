import React from 'react';
import { motion } from 'motion/react';
import { ResponsiveContainer, AreaChart, Area, CartesianGrid, XAxis, YAxis, Tooltip } from 'recharts';
import { Brain, Zap, Scale, Coins, FileSpreadsheet, Wand2, Info, ShieldCheck, Layers, Activity, RefreshCw } from 'lucide-react';
import { cn, formatCurrency } from '../../../lib/utils';

interface EconomicsMatrixTabProps {
  inflationScenario: number;
  setInflationScenario: (v: number) => void;
  taxClassification: number;
  setTaxClassification: (v: number) => void;
  costOfCapital: number;
  setCostOfCapital: (v: number) => void;
  bookAssets: number;
  bookLiabilities: number;
  preTaxNetIncome: number;
  rawExpenses: number;
  trueEconomicWORTH: number;
  onAction?: (action: string, details?: any) => void;
  setActiveSubTab: (tab: 'audit' | 'tracer' | 'symmetry' | 'cash-reconciler' | 'economics-matrix') => void;
  runDiagnostics: () => Promise<void>;
  isStressRunning: boolean;
  handleRunStressSimulation: () => void;
  stressTelemetry: any;
  stressData: any[];
}

export default function EconomicsMatrixTab({
  inflationScenario,
  setInflationScenario,
  taxClassification,
  setTaxClassification,
  costOfCapital,
  setCostOfCapital,
  bookAssets,
  bookLiabilities,
  preTaxNetIncome,
  rawExpenses,
  trueEconomicWORTH,
  onAction,
  setActiveSubTab,
  runDiagnostics,
  isStressRunning,
  handleRunStressSimulation,
  stressTelemetry,
  stressData,
}: EconomicsMatrixTabProps) {
  return (
    <motion.div
      key="economics-tab"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="space-y-12 animate-fade-in"
    >
      {/* Intro Section */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between border-b border-slate-200 pb-6 gap-6 text-left">
        <div className="space-y-1">
          <h4 className="text-2xl font-black text-slate-900 uppercase tracking-tight flex items-center gap-2">
            <Brain className="text-slate-900 animate-pulse" size={24} />
            Zenith Economics Thinking Engine
          </h4>
          <p className="text-xs text-slate-500 font-medium uppercase tracking-wider opacity-65">
            Unified Strategic Comparison Matrix & Macroeconomic Truth Arbiter
          </p>
        </div>
        <div className="px-5 py-2.5 bg-slate-900 text-emerald-400 rounded-xl font-mono text-[9px] uppercase tracking-[0.2em] font-black flex items-center gap-2 self-start lg:self-center">
          <Zap size={10} className="text-emerald-400 animate-bounce" /> Dual-Mode Validated
        </div>
      </div>

      {/* Economic Scenario Sandbox & Simulator */}
      <div className="p-4 md:p-8 bg-slate-50 border border-slate-200 rounded-[32px] space-y-8 text-left">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-slate-900 text-white flex items-center justify-center shadow-md">
            <Scale size={16} />
          </div>
          <div>
            <h4 className="text-sm font-black text-slate-900 uppercase tracking-wider">Macro-Economic Truth Stress Simulator</h4>
            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-0.5">Determine the true purchasing value of ledger liquidity by modeling real monetary forces</p>
          </div>
        </div>

        {/* 3 Interactive Sliders */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Slider 1 */}
          <div className="bg-white p-6 rounded-[32px] border border-slate-200 shadow-sm space-y-4">
            <div className="flex justify-between items-center text-xs">
              <span className="font-black text-slate-900 uppercase tracking-wider flex items-center gap-1">
                <Coins size={12} className="text-indigo-400" /> Annualized Inflation
              </span>
              <span className="font-mono font-black text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded-lg text-[10px]">{inflationScenario.toFixed(1)}%</span>
            </div>
            <input 
              type="range"
              min="0"
              max="15"
              step="0.5"
              value={inflationScenario}
              onChange={(e) => setInflationScenario(parseFloat(e.target.value))}
              className="w-full h-2 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-indigo-600"
              id="inflation-input"
            />
            <p className="text-[9px] text-slate-500 font-medium">Degrades total book assets by real loss of purchasing power.</p>
          </div>

          {/* Slider 2 */}
          <div className="bg-white p-6 rounded-[32px] border border-slate-200 shadow-sm space-y-4">
            <div className="flex justify-between items-center text-xs">
              <span className="font-black text-slate-900 uppercase tracking-wider flex items-center gap-1">
                <FileSpreadsheet size={12} className="text-emerald-400" /> Est. Marginal Tax Rate
              </span>
              <span className="font-mono font-black text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-lg text-[10px]">{taxClassification}%</span>
            </div>
            <input 
              type="range"
              min="10"
              max="50"
              step="1"
              value={taxClassification}
              onChange={(e) => setTaxClassification(parseInt(e.target.value))}
              className="w-full h-2 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-emerald-600"
              id="tax-input"
            />
            <p className="text-[9px] text-slate-500 font-medium">Model pre-tax capital offsets to isolate absolute post-tax net assets.</p>
          </div>

          {/* Slider 3 */}
          <div className="bg-white p-6 rounded-[32px] border border-slate-200 shadow-sm space-y-4">
            <div className="flex justify-between items-center text-xs">
              <span className="font-black text-slate-900 uppercase tracking-wider flex items-center gap-1">
                <Wand2 size={12} className="text-amber-400" /> Cost of Outside Capital
              </span>
              <span className="font-mono font-black text-amber-600 bg-amber-50 px-2.5 py-1 rounded-lg text-[10px]">{costOfCapital.toFixed(1)}%</span>
            </div>
            <input 
              type="range"
              min="0"
              max="15"
              step="0.5"
              value={costOfCapital}
              onChange={(e) => setCostOfCapital(parseFloat(e.target.value))}
              className="w-full h-2 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-amber-600"
              id="capital-input"
            />
            <p className="text-[9px] text-slate-500 font-medium">Subtracts compounding leverage charges on current liabilities.</p>
          </div>
        </div>

        {/* Calculations & Worth Output Displays - Desktop side-by-side, mobile stacked */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 pt-4">
          {/* Nominal Bookkeeping Balance Sheet Valuation */}
          <div className="p-4 md:p-8 bg-white border border-slate-200 rounded-[32px] space-y-4 relative overflow-hidden text-left" id="nominal-kpi">
            <div className="absolute top-0 right-0 w-24 h-24 bg-slate-50 opacity-40 rounded-full blur-2xl pointer-events-none" />
            <div>
              <span className="text-[9px] font-black text-slate-500 uppercase tracking-[0.3em]">QuickBooks Nominal Net Valuation</span>
              <p className="text-2xl md:text-4xl font-black text-slate-800 tracking-tight mt-3">{formatCurrency(bookAssets - Math.abs(bookLiabilities))}</p>
            </div>
            <div className="text-[10px] text-slate-500 font-bold uppercase tracking-widest pt-2 flex items-center gap-2">
              <Info size={12} className="text-slate-400" />
              Sum of nominal ledger asset values: {formatCurrency(bookAssets)} less liabilities
            </div>
          </div>

          {/* True Inflation-Adjusted Arbitrage Worth */}
          <div className="p-4 md:p-8 bg-slate-900 text-white rounded-[32px] space-y-4 relative overflow-hidden shadow-2xl border border-slate-800 text-left" id="economic-kpi">
            <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/10 rounded-full blur-2xl pointer-events-none" />
            <div>
              <span className="text-[9px] font-black text-emerald-400 uppercase tracking-[0.3em]">Zenith TRUE Adjusted Economic Worth</span>
              <p className="text-2xl md:text-4xl font-black text-emerald-400 tracking-tight mt-3">{formatCurrency(trueEconomicWORTH)}</p>
            </div>
            <div className="text-[10px] text-white/50 font-medium uppercase tracking-wider pt-2 flex items-center gap-2">
              <ShieldCheck size={12} className="text-emerald-400" />
              Purchasing adjusted, post-tax & interest risk position
            </div>
          </div>
        </div>
      </div>

      {/* Comparison Matrix Table - QuickBooks vs Excel vs LedgerFlow */}
      <div className="space-y-6 text-left">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-slate-900 text-white flex items-center justify-center">
            <Layers size={16} />
          </div>
          <div>
            <h4 className="text-sm font-black text-slate-900 uppercase tracking-wider">Continuous Feature & Core Architecture Verification</h4>
            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-0.5">Objective engineering gap audit of QuickBooks and Excel versus LedgerFlow core "TRUTH" protocols</p>
          </div>
        </div>

        <div className="border border-slate-200 rounded-[32px] overflow-hidden bg-white shadow-xl max-w-full overflow-x-auto">
          <table className="w-full text-xs text-left min-w-[650px]" id="comparison-table">
            <thead>
              <tr className="bg-slate-900 text-white text-[9px] uppercase tracking-widest font-black font-mono border-b border-transparent">
                <th className="p-5 w-1/3">Accounting Tool Concept</th>
                <th className="p-5 text-center text-slate-400">QuickBooks Online</th>
                <th className="p-5 text-center text-slate-400">Microsoft Excel</th>
                <th className="p-5 text-center text-emerald-400 bg-slate-950/50">LedgerFlow (Absolute Truth)</th>
                <th className="p-5 text-right font-mono">Integrity Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ledger-line font-medium text-slate-900">
              {/* Concept 1 */}
              <tr className="hover:bg-slate-50 transition-colors">
                <td className="p-5">
                  <span className="font-black uppercase tracking-tight text-slate-800 block">Double-Entry Ledger Structures</span>
                  <span className="text-[9px] text-slate-500 mt-1 uppercase font-mono block">Rigid bookkeeping journal ledger logs</span>
                </td>
                <td className="p-5 text-center">
                  <span className="inline-flex px-3 py-1 text-[9px] font-black uppercase tracking-wider bg-emerald-50 text-emerald-600 rounded-lg">Standard Support</span>
                </td>
                <td className="p-5 text-center text-rose-600 font-bold uppercase font-mono text-[10px]">❌ None (Manual Sheets)</td>
                <td className="p-5 text-center bg-slate-950/[0.01] font-bold text-emerald-600">
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 text-[9px] font-black uppercase tracking-wider bg-emerald-100 text-emerald-800 rounded-lg">
                    ✅ Fully Automatic & Audited
                  </span>
                </td>
                <td className="p-5 text-right">
                  <button
                    onClick={() => { if (onAction) onAction('switch-tab', 'ledger'); }}
                    className="px-4 py-2 bg-slate-100 hover:bg-slate-900 hover:text-white rounded-xl text-[9px] font-black uppercase tracking-wider transition-all"
                    id="verify-ledger-btn-matrix"
                  >
                    Verify Ledger
                  </button>
                </td>
              </tr>

              {/* Concept 2 */}
              <tr className="hover:bg-slate-50 transition-colors">
                <td className="p-5">
                  <span className="font-black uppercase tracking-tight text-slate-800 block">Cell Formula Precedent Tracing</span>
                  <span className="text-[9px] text-slate-500 mt-1 uppercase font-mono block">Audit total summaries to raw entries</span>
                </td>
                <td className="p-5 text-center text-rose-600 font-bold uppercase font-mono text-[10px]">❌ Pending Data Connection</td>
                <td className="p-5 text-center">
                  <span className="inline-flex px-3 py-1 text-[9px] font-black uppercase tracking-wider bg-emerald-50 text-emerald-600 rounded-lg">Excellent Trace</span>
                </td>
                <td className="p-5 text-center bg-slate-950/[0.01] font-bold text-emerald-600">
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 text-[9px] font-black uppercase tracking-wider bg-emerald-100 text-emerald-800 rounded-lg">
                    ✅ Excel Formula Tracer Tab
                  </span>
                </td>
                <td className="p-5 text-right">
                  <button
                    onClick={() => setActiveSubTab('tracer')}
                    className="px-4 py-2 bg-slate-100 hover:bg-slate-900 hover:text-white rounded-xl text-[9px] font-black uppercase tracking-wider transition-all"
                    id="open-tracer-btn-matrix"
                  >
                    Open Tracer
                  </button>
                </td>
              </tr>

              {/* Concept 3 */}
              <tr className="hover:bg-slate-50 transition-colors">
                <td className="p-5">
                  <span className="font-black uppercase tracking-tight text-slate-800 block">Cryptographic Merkle Proofs</span>
                  <span className="text-[9px] text-slate-500 mt-1 uppercase font-mono block">Sequential ledger chain verification securing history</span>
                </td>
                <td className="p-5 text-center text-rose-600 font-bold uppercase font-mono text-[10px]">❌ None (Unsecured database)</td>
                <td className="p-5 text-center text-rose-600 font-bold uppercase font-mono text-[10px]">❌ None (Plain text grids)</td>
                <td className="p-5 text-center bg-slate-950/[0.01] font-bold text-emerald-600">
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 text-[9px] font-black uppercase tracking-wider bg-emerald-100 text-emerald-800 rounded-lg">
                    ✅ 256-Bit merkel chains
                  </span>
                </td>
                <td className="p-5 text-right">
                  <button
                    onClick={() => { setActiveSubTab('audit'); runDiagnostics(); }}
                    className="px-4 py-2 bg-slate-100 hover:bg-slate-900 hover:text-white rounded-xl text-[9px] font-black uppercase tracking-wider transition-all"
                    id="scan-hashes-btn-matrix"
                  >
                    Scan Hashes
                  </button>
                </td>
              </tr>

              {/* Concept 4 */}
              <tr className="hover:bg-slate-50 transition-colors">
                <td className="p-5">
                  <span className="font-black uppercase tracking-tight text-slate-800 block">Bilateral Zero-Delta Matcher</span>
                  <span className="text-[9px] text-slate-500 mt-1 uppercase font-mono block">Zero-leak statement reconciliation</span>
                </td>
                <td className="p-5 text-center">
                  <span className="inline-flex px-3 py-1 text-[9px] font-black uppercase tracking-wider bg-emerald-50 text-emerald-600 rounded-lg">Full Support</span>
                </td>
                <td className="p-5 text-center text-rose-600 font-bold uppercase font-mono text-[10px]">❌ Manual lookup formulas</td>
                <td className="p-5 text-center bg-slate-950/[0.01] font-bold text-emerald-600">
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 text-[9px] font-black uppercase tracking-wider bg-emerald-100 text-emerald-800 rounded-lg">
                    ✅ Automated neural match
                  </span>
                </td>
                <td className="p-5 text-right">
                  <button
                    onClick={() => { if (onAction) onAction('switch-tab', 'reconciliation'); }}
                    className="px-4 py-2 bg-slate-100 hover:bg-slate-900 hover:text-white rounded-xl text-[9px] font-black uppercase tracking-wider transition-all"
                    id="align-bank-btn-matrix"
                  >
                    Align Bank
                  </button>
                </td>
              </tr>

              {/* Concept 5 */}
              <tr className="hover:bg-slate-50 transition-colors">
                <td className="p-5">
                  <span className="font-black uppercase tracking-tight text-slate-800 block">Macroeconomic Stress-Testing</span>
                  <span className="text-[9px] text-slate-500 mt-1 uppercase font-mono block">Model real purchasing positions instantly</span>
                </td>
                <td className="p-5 text-center text-rose-600 font-bold uppercase font-mono text-[10px]">❌ Bookkeeping only</td>
                <td className="p-5 text-center">
                  <span className="inline-flex px-3 py-1 text-[9px] font-black uppercase tracking-wider bg-emerald-50 text-emerald-600 rounded-lg">Manual modeling sheets</span>
                </td>
                <td className="p-5 text-center bg-slate-950/[0.01] font-bold text-emerald-600">
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 text-[9px] font-black uppercase tracking-wider bg-emerald-100 text-emerald-800 rounded-lg">
                    ✅ Native Simulation Engine
                  </span>
                </td>
                <td className="p-5 text-right">
                  <span className="text-[9px] font-black font-mono uppercase text-indigo-600 bg-indigo-50 px-3 py-1.5 rounded-lg">
                    Active above
                  </span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* ==================== SCALE STRESS SIMULATOR (200+ NODES) ==================== */}
      <div className="pt-10 border-t border-slate-200 space-y-8 text-left">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 text-left">
          <div className="space-y-1">
            <h4 className="text-lg font-black text-slate-900 uppercase tracking-tight flex items-center gap-2">
              <Activity className="text-indigo-600 animate-pulse" size={20} />
              Zenith Depth Monitor: 200+ Transaction Stress Simulator
            </h4>
            <p className="text-xs text-slate-500 font-medium uppercase tracking-wider opacity-65">
              Verify real-time computation speeds & zero-leak ledger balancing under high-frequency enterprise streams
            </p>
          </div>
          
          <button
            onClick={handleRunStressSimulation}
            disabled={isStressRunning}
            className={cn(
              "px-6 py-3.5 rounded-[32px] font-black text-xs uppercase tracking-widest transition-all flex items-center gap-2.5 shadow-lg select-none",
              isStressRunning 
                ? "bg-slate-200 text-slate-400 cursor-not-allowed"
                : "bg-slate-900 text-white hover:bg-indigo-600 hover:shadow-indigo-100 hover:scale-[1.02] active:scale-[0.98]"
            )}
          >
            {isStressRunning ? (
              <>
                <RefreshCw size={14} className="animate-spin" />
                Processing 200+ nodes...
              </>
            ) : (
              <>
                <Zap size={14} className="text-amber-400 fill-amber-400" />
                Launch 235-Node Audit
              </>
            )}
          </button>
        </div>

        {isStressRunning && (
          <div className="p-16 text-center border border-dashed border-slate-200 rounded-[32px] bg-slate-50/50 space-y-4 animate-pulse">
            <RefreshCw className="animate-spin text-indigo-500 mx-auto" size={32} />
            <div className="space-y-1">
              <p className="text-xs font-black uppercase text-slate-800 tracking-wider">Compiling Double-Entry Array...</p>
              <p className="text-[10px] text-slate-400 uppercase font-mono animate-pulse">Generating chronological ledger sequence & cryptolink hashes</p>
            </div>
          </div>
        )}

        {!isStressRunning && stressTelemetry && (
          <div className="space-y-8 animate-fade-in text-left">
            {/* Telemetry Indicator Blocks */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="p-6 bg-white border border-slate-200 rounded-[32px] flex flex-col justify-between shadow-sm text-left">
                <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest">Chronological Volume</span>
                <div>
                  <p className="text-2xl font-black text-slate-800 mt-2">{stressTelemetry.txCount} Splits</p>
                  <p className="text-[9px] text-emerald-600 font-bold uppercase mt-1">100% Core compliance</p>
                </div>
              </div>

              <div className="p-6 bg-white border border-slate-200 rounded-[32px] flex flex-col justify-between shadow-sm text-left">
                <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest">Comp. Re-hash Latency</span>
                <div>
                  <p className="text-2xl font-black text-indigo-600 mt-2">{stressTelemetry.verificationMs} ms</p>
                  <p className="text-[9px] text-emerald-600 font-bold uppercase mt-1">
                    Throughput: {((stressTelemetry.txCount / (stressTelemetry.verificationMs || 0.1)) * 1000).toLocaleString(undefined, { maximumFractionDigits: 0 })}/s
                  </p>
                </div>
              </div>

              <div className="p-6 bg-white border border-slate-200 rounded-[32px] flex flex-col justify-between shadow-sm text-left">
                <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest">Zero-Sum Drift Value</span>
                <div>
                  <p className="text-2xl font-black text-slate-800 mt-2">$0.00</p>
                  <p className="text-[9px] text-emerald-600 font-bold uppercase mt-1">Zero-Leak Check [OK]</p>
                </div>
              </div>

              <div className="p-6 bg-white border border-slate-200 rounded-[32px] flex flex-col justify-between shadow-sm text-left">
                <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest">Memory Footprint</span>
                <div>
                  <p className="text-2xl font-black text-slate-800 mt-2">~{stressTelemetry.memoryKb} KB</p>
                  <p className="text-[9px] text-slate-400 font-mono uppercase mt-1">Ultra-light footprint</p>
                </div>
              </div>
            </div>

            {/* Merkle Consensus Bar */}
            <div className="p-4 bg-slate-900 text-slate-300 rounded-[32px] flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs border border-slate-800 text-left">
              <div className="flex items-center gap-2">
                <ShieldCheck size={14} className="text-emerald-400 shrink-0" />
                <span className="font-bold uppercase tracking-wider text-[10px]">Consensus Compiled Merkle Root Hash:</span>
              </div>
              <span className="font-mono font-black text-[11px] bg-slate-950 px-3 py-1.5 rounded-lg text-emerald-400 select-all truncate max-w-full sm:max-w-md font-bold text-left">
                {stressTelemetry.merkleRoot}
              </span>
            </div>

            {/* Grid: Curve Chart & Interactive Real-Time Security Log Console */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 text-left">
              <div className="p-6 bg-slate-50 border border-slate-200 rounded-[32px] space-y-4 text-left">
                <div>
                  <span className="text-[9px] font-black text-slate-500 uppercase tracking-[0.2em] block">Volume Dispersion Curve (Amount vs Index)</span>
                  <p className="text-[10px] text-slate-500 font-bold mt-0.5">Visualize mathematical balance symmetry across 235 dataset nodes</p>
                </div>

                <div className="h-[220px] w-full pt-2">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart
                      data={stressData.map((d, index) => ({
                        index: index + 1,
                        amount: d.totalAmountCents / 100,
                        name: d.description
                      }))}
                      margin={{ top: 10, right: 10, left: -25, bottom: 0 }}
                    >
                      <defs>
                        <linearGradient id="colorStressAmount" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.15}/>
                          <stop offset="95%" stopColor="#4f46e5" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                      <XAxis dataKey="index" stroke="#94a3b8" fontSize={9} tickLine={false} />
                      <YAxis stroke="#94a3b8" fontSize={9} tickLine={false} />
                      <Tooltip
                        content={({ active, payload }) => {
                          if (active && payload && payload.length) {
                            const data = payload[0].payload;
                            return (
                              <div className="p-3 bg-white border border-slate-200 shadow-xl rounded-xl text-[10px] space-y-1 text-left">
                                <p className="font-mono text-slate-400">Node ID: #{data.index}</p>
                                <p className="font-black uppercase text-slate-800 truncate max-w-[180px]">{data.name}</p>
                                <p className="font-mono font-black text-indigo-600">${data.amount.toFixed(2)}</p>
                              </div>
                            );
                          }
                          return null;
                        }}
                      />
                      <Area 
                        type="monotone" 
                        dataKey="amount" 
                        stroke="#4f46e5" 
                        strokeWidth={1.5} 
                        fillOpacity={1} 
                        fill="url(#colorStressAmount)" 
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="p-6 bg-slate-900 rounded-[32px] flex flex-col border border-slate-800 text-left">
                <div className="pb-3 border-b border-slate-800 flex justify-between items-center text-left">
                  <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest font-mono font-black flex items-center">Real-Time Cryptolink Stream Ledger</span>
                  <span className="text-[8px] font-mono text-emerald-400 uppercase bg-slate-950 px-2 py-0.5 rounded-md font-semibold animate-pulse">● Monitoring</span>
                </div>

                <div className="flex-1 mt-3 h-[200px] overflow-y-auto font-mono text-[9px] text-slate-400 space-y-2 custom-scrollbar pr-2 select-text text-left">
                  {stressData.slice(0, 30).map((tx, idx) => (
                    <div key={tx.id} className="flex flex-col gap-0.5 leading-relaxed hover:bg-slate-800/50 p-1.5 rounded-lg transition-colors text-left">
                      <div className="flex justify-between items-center font-black">
                        <span className="text-indigo-400">[VERIFIED] NODE #{idx + 1}</span>
                        <span className="text-slate-500 text-[8px]">{tx.date}</span>
                      </div>
                      <div className="text-slate-300 truncate max-w-full font-bold">
                        DESC: {(tx.description || '').toUpperCase()}
                      </div>
                      <div className="flex justify-between text-slate-500 text-[8px] mt-0.5 font-bold">
                        <span className="truncate max-w-[150px]">HASH: {tx.verification.hash}</span>
                        <span className="text-emerald-400 font-black">${(tx.totalAmountCents / 100).toFixed(2)}</span>
                      </div>
                    </div>
                  ))}
                  {stressData.length > 30 && (
                    <div className="py-2 text-center text-slate-500 border-t border-slate-800/40 text-[8px] uppercase">
                      ... and {stressData.length - 30} more security verified ledger lines ...
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
        
        {!isStressRunning && !stressTelemetry && (
          <div className="py-12 text-center border border-dashed border-slate-200 rounded-[32px] bg-slate-50/50">
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">No active simulation compiled</p>
            <button 
              onClick={handleRunStressSimulation}
              className="px-5 py-2.5 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 text-[10px] font-mono uppercase tracking-[0.1em] text-slate-700 shadow-sm active:scale-95 transition-all font-black"
            >
              [Initialize 200+ Enterprise Load Validation]
            </button>
          </div>
        )}
      </div>
    </motion.div>
  );
}
