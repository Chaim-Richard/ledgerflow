import type { Transaction } from '../../types';
import type { LucideIcon } from 'lucide-react';
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar,
  Radar, RadarChart, PolarGrid, PolarAngleAxis
} from 'recharts';
import { BarChart3, ShieldCheck, Target, Download, Maximize2, Minimize2, BrainCircuit, TrendingUp, Activity, Info, ChevronRight, Sparkles, Menu, X, Search, Calendar, Flame, Loader2, LayoutGrid, Building, DollarSign, Users, BarChart as BarChartIcon, Calculator, Zap } from 'lucide-react';
import { cn } from '../../lib/utils';
import { useLedgerStore } from '../../stores/useLedgerStore';
import { useAuditTelemetry } from '../../hooks/useAuditTelemetry';
import { select } from 'd3-selection';
import { scaleBand, scaleLinear } from 'd3-scale';
import { max } from 'd3-array';
import { axisBottom, axisLeft } from 'd3-axis';
import { area, line, curveMonotoneX } from 'd3-shape';
import { useUIStore } from '../../stores/useUIStore';
import { useCommandDispatcher } from '../../hooks/useSystemContext';
import ForensicAuditor from '../reporting/ForensicAuditor';
import PivotSheet from '../ledger/PivotSheet';
import BudgetManager from '../planning/BudgetManager';
import TaxManager from '../finance/TaxManager';
import Consolidation from '../finance/Consolidation';
import ToolSandbox from '../platform/ToolSandbox';
import FinancialCalculatorView from './FinancialCalculatorView';
import { FINANCIAL_ALGORITHMS } from '../../lib/financial-algorithms';
import { ANALYTICAL_LENSES_REGISTRY, LENS_COMPONENTS } from '../../config/registry';
import { ViewErrorBoundary } from '../common/ViewErrorBoundary';
import { useLedgerCollections } from '../../hooks/useLedgerCollections';

// -------------------------------------------------------------
// Interactive D3 Ledger Volumetric Flow & Activity Visualizer
// -------------------------------------------------------------
const D3LedgerVisualizer = ({ data }: { data: (Transaction & { category?: string })[] }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const [dimensions, setDimensions] = useState({ width: 600, height: 180 });
  
  // Interactive values for live tooltip readouts
  const [hoveredTx, setHoveredTx] = useState<{ 
    index: number; 
    amount: number; 
    date: string; 
    desc: string; 
    category: string;
  } | null>(null);

  // Core resize observer implementation
  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver((entries) => {
      if (!entries || entries.length === 0) return;
      const { width } = entries[0].contentRect;
      setDimensions({ width: Math.max(width, 280), height: 170 });
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  // Compute D3 details
  useEffect(() => {
    if (!svgRef.current || !data.length) return;

    const svg = select(svgRef.current);
    svg.selectAll("*").remove();

    const { width, height } = dimensions;
    const margin = { top: 12, right: 16, bottom: 22, left: 36 };

    // Get the last 20 operations
    const last20 = data.slice(-20);
    const processed = last20.map((d, i) => ({ 
      label: `T-${last20.length - i}`, 
      value: Math.abs(d.totalAmountCents) / 100,
      date: d.date || 'Jan 1',
      desc: d.description || 'System Ledger',
      category: d.category || 'Trading',
      index: i
    }));
    
    const x = scaleBand()
      .range([margin.left, width - margin.right])
      .padding(0.28);

    const y = scaleLinear()
      .range([height - margin.bottom, margin.top]);

    x.domain(processed.map(d => d.label));
    
    const maxVal = max(processed, d => d.value) || 100;
    y.domain([0, maxVal * 1.05]);

    // Add continuous background gridlines
    svg.append("g")
      .attr("class", "grid")
      .attr("transform", `translate(0, ${height - margin.bottom})`)
      .call(axisBottom(x).tickSize(-height + margin.top + margin.bottom).tickFormat(() => ""))
      .call(g => g.select(".domain").remove())
      .call(g => g.selectAll(".tick line").attr("stroke", "#f1f5f9").attr("stroke-opacity", 0.8));

    svg.append("g")
      .attr("class", "grid")
      .attr("transform", `translate(${margin.left}, 0)`)
      .call(axisLeft(y).tickSize(-width + margin.left + margin.right).ticks(4).tickFormat(() => ""))
      .call(g => g.select(".domain").remove())
      .call(g => g.selectAll(".tick line").attr("stroke", "#f1f5f9").attr("stroke-opacity", 0.8));

    // Gradients definitions
    const defs = svg.append("defs");
    
    // Modern gradient definition for bars
    const barGradient = defs.append("linearGradient")
      .attr("id", "modernBarGradient")
      .attr("x1", "0%")
      .attr("y1", "0%")
      .attr("x2", "0%")
      .attr("y2", "100%");
    barGradient.append("stop").attr("offset", "0%").attr("stop-color", "#6366f1").attr("stop-opacity", 0.7);
    barGradient.append("stop").attr("offset", "100%").attr("stop-color", "#818cf8").attr("stop-opacity", 0.05);

    // Modern area gradient under the continuous line
    const areaGradient = defs.append("linearGradient")
      .attr("id", "areaTrendGradient")
      .attr("x1", "0%")
      .attr("y1", "0%")
      .attr("x2", "0%")
      .attr("y2", "100%");
    areaGradient.append("stop").attr("offset", "0%").attr("stop-color", "#10b981").attr("stop-opacity", 0.12);
    areaGradient.append("stop").attr("offset", "100%").attr("stop-color", "#10b981").attr("stop-opacity", 0);

    // 1. Plot area plot under the spline curve
    svg.append("path")
      .datum(processed)
      .attr("fill", "url(#areaTrendGradient)")
      .attr("d", area<(typeof processed)[number]>()
        .x((d) => (x(d.label) || 0) + x.bandwidth() / 2)
        .y0(height - margin.bottom)
        .y1((d) => y(d.value))
        .curve(curveMonotoneX)
      );

    // 2. Bars
    svg.append("g")
      .selectAll("rect")
      .data(processed)
      .join("rect")
      .attr("x", (d) => x(d.label) || 0)
      .attr("y", (d) => y(d.value))
      .attr("height", (d) => Math.max(0, (height - margin.bottom) - y(d.value)))
      .attr("width", x.bandwidth())
      .attr("fill", "url(#modernBarGradient)")
      .attr("rx", 3.5)
      .attr("class", "transition-all duration-150 origin-bottom hover:fill-indigo-550")
      .style("cursor", "crosshair");

    // 3. Dynamic trend line path
    svg.append("path")
      .datum(processed)
      .attr("fill", "none")
      .attr("stroke", "#10b981")
      .attr("stroke-width", 1.8)
      .attr("stroke-opacity", 0.8)
      .attr("d", line<(typeof processed)[number]>()
        .x((d) => (x(d.label) || 0) + x.bandwidth() / 2)
        .y((d) => y(d.value))
        .curve(curveMonotoneX)
      );

    // 4. Glowing trend points
    svg.append("g")
      .selectAll("circle")
      .data(processed)
      .join("circle")
      .attr("cx", (d) => (x(d.label) || 0) + x.bandwidth() / 2)
      .attr("cy", (d) => y(d.value))
      .attr("r", 3)
      .attr("fill", "#ffffff")
      .attr("stroke", "#10b981")
      .attr("stroke-width", 1.5)
      .style("cursor", "pointer");

    // 5. Invisible interactive bands over X-axis for high-fidelity hovering details
    const bandHeight = height - margin.top - margin.bottom;
    svg.append("g")
      .selectAll("rect")
      .data(processed)
      .join("rect")
      .attr("x", (d) => (x(d.label) || 0))
      .attr("y", margin.top)
      .attr("width", x.bandwidth())
      .attr("height", bandHeight)
      .attr("fill", "transparent")
      .style("cursor", "crosshair")
      .on("mouseenter", (event, d) => {
        setHoveredTx({
          index: d.index,
          amount: d.value,
          date: d.date,
          desc: d.desc,
          category: d.category
        });
      })
      .on("mouseleave", () => {
        setHoveredTx(null);
      });

    // 6. X-Axis rendering
    svg.append("g")
      .attr("transform", `translate(0, ${height - margin.bottom})`)
      .call(axisBottom(x).tickSize(0).tickPadding(6))
      .call(g => g.select(".domain").attr("stroke", "#e2e8f0"))
      .call(g => g.selectAll(".tick text")
        .attr("fill", "#64748b")
        .attr("font-size", "8.5px")
        .attr("font-family", "JetBrains Mono, ui-monospace"));

    // 7. Y-Axis rendering
    svg.append("g")
      .attr("transform", `translate(${margin.left}, 0)`)
      .call(axisLeft(y).ticks(4).tickFormat(d => `$${d}`))
      .call(g => g.select(".domain").remove())
      .call(g => g.selectAll(".tick text")
        .attr("fill", "#64748b")
        .attr("font-size", "8.5px")
        .attr("font-family", "JetBrains Mono, ui-monospace"));

  }, [data, dimensions]);

  return (
    <div ref={containerRef} className="w-full bg-[var(--surface)] rounded-[32px] p-5 border border-[var(--line)]/80 relative shadow-3xs overflow-hidden group">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 mb-3">
         <div className="flex items-center gap-2">
           <Activity aria-hidden="true" size={13} className="text-indigo-600 shrink-0" />
           <span className="text-[10px] font-mono font-bold tracking-wider text-[var(--muted)] uppercase">Recent Transaction Volume</span>
         </div>
         <div className="flex items-center gap-2">
           <span className="px-2 py-0.5 bg-[var(--ink)] border border-[var(--line)] text-slate-700 text-[8px] font-mono font-black uppercase rounded-sm">Current</span>
         </div>
      </div>
      
      <div className="relative">
        <svg ref={svgRef} width={dimensions.width} height={dimensions.height} className="w-full select-none" />
        
        {/* Dynamic Tactile Interactive HUD Overlay */}
        <AnimatePresence>
          {hoveredTx ? (
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.1 }}
              className="absolute top-2 right-2 bg-slate-900/95 backdrop-blur-md text-white px-3 py-2 rounded-xl text-[10px] border border-white/10 shadow-lg space-y-1 z-20 pointer-events-none max-w-xs font-mono"
            >
              <div className="flex items-center justify-between border-b border-white/10 pb-1 mb-1 gap-4">
                <span className="font-bold text-indigo-400">T-{20 - hoveredTx.index} Details</span>
                <span className="text-emerald-400 font-extrabold text-xs">${hoveredTx.amount.toLocaleString()}</span>
              </div>
              <p className="font-medium text-white line-clamp-1">{hoveredTx.desc}</p>
              <div className="flex items-center justify-between pt-0.5 text-white/50 text-[9px]">
                <span>{hoveredTx.category}</span>
                <span>{hoveredTx.date}</span>
              </div>
            </motion.div>
          ) : (
            <div className="absolute top-2 right-2 text-[9px] text-[var(--muted)] uppercase font-mono pointer-events-none hidden sm:block">
              Hover series peaks to scope ledger context
            </div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};



// -------------------------------------------------------------
// Core Redesigned Analytical Channels
// -------------------------------------------------------------
interface ChannelItem {
  id: string;
  icon: LucideIcon;
  label: Record<string, string>;
  desc?: Record<string, string>;
  name?: string;
  description?: string;
  badge?: string;
}

const CHANNELS: { group: Record<string, string>; items: ChannelItem[] }[] = [
  {
    group: { en: 'Executive Overview', he: 'סקירת מנהלים' },
    items: [
      { id: 'radar', icon: Activity, label: { en: 'Metrics Radar', he: 'רדאר מדדים' }, desc: { en: 'Live volumetric operational spider web view', he: 'תצוגת רדאר תקציבית חיה' } },
      { id: 'roi', icon: Target, label: { en: 'ROI Matrix', he: 'מטריצת החזר השקעה' }, desc: { en: 'Calculates true velocity and margin projections', he: 'חישוב מהירות החזר השקעה' } }
    ]
  },
  {
    group: { en: 'Financial Core', he: 'פיננסים' },
    items: [
      { id: 'pivot', icon: LayoutGrid, label: { en: 'Pivot Sheet', he: 'גיליון ציר' }, desc: { en: 'Advanced pivot tables for transactions', he: 'טבלאות ציר מתקדמות לתנועות' } },
      { id: 'budgets', icon: DollarSign, label: { en: 'Budget Analysis', he: 'ניתוח תקציב' }, desc: { en: 'Budget vs Actual variance reporting', he: 'דוחות סטיות של תקציב מול מציאות' } },
      { id: 'nexus', icon: ShieldCheck, label: { en: 'Tax Nexus', he: 'מיסוי מקומי' }, desc: { en: 'Identify tax liabilities across jurisdictions', he: 'זיהוי חבויות מס ברחבי המדינות' } },
      { id: 'entities', icon: Building, label: { en: 'Entity Consolidation', he: 'איחוד ישויות' }, desc: { en: 'Multi-company ledger aggregation', he: 'ריכוז ואיחוד ספרי הנהלת חשבונות' } },
      { id: 'forensics', icon: ShieldCheck, label: { en: 'Audit & Forensics', he: 'ביקורת וממצאים' }, desc: { en: 'Deep scan integrity ledger evaluation', he: 'סריקת עומק והערכת תקינות ספר יומן' } }
    ]
  },
  {
    group: { en: 'Calculators', he: 'מחשבונים' },
    items: [
      { id: 'breakeven', icon: Target, label: { en: 'Break-Even Analysis', he: 'ניתוח נקודת איזון' }, desc: { en: 'Calculate break-even units and revenue', he: 'חישוב יחידות והכנסות לנקודת איזון' } },
      { id: 'compound', icon: Calculator, label: { en: 'Compound Interest', he: 'ריבית דריבית' }, desc: { en: 'Calculate compounding investment returns', he: 'חישוב תשואות השקעה בריבית דריבית' } },
      { id: 'rule72', icon: Activity, label: { en: 'Rule of 72', he: 'כלל ה-72' }, desc: { en: 'Calculate years to double investment', he: 'חישוב שנים להכפלת השקעה' } },
      { id: 'ltv', icon: Users, label: { en: 'Customer Lifetime Value (LTV)', he: 'ערך חיי לקוח (LTV)' }, desc: { en: 'Customer Lifetime Value metrics', he: 'חישוב ערך חיי לקוח' } },
      { id: 'cac', icon: Users, label: { en: 'Customer Acquisition Cost (CAC)', he: 'עלות רכישת לקוח (CAC)' }, desc: { en: 'Customer Acquisition Cost metrics', he: 'חישוב עלות רכישת לקוח' } },
      { id: 'npv', icon: BarChartIcon, label: { en: 'Net Present Value (NPV)', he: 'ערך נוכחי נקי (NPV)' }, desc: { en: 'Discounted cash flow NPV calculator', he: 'חישוב ערך נוכחי נקי' } },
      { id: 'wacc', icon: BarChart3, label: { en: 'Weighted Average Cost of Capital (WACC)', he: 'עלות הון משוקללת (WACC)' }, desc: { en: 'Cost of capital computation', he: 'חישוב עלות הון משוקללת' } },
      { id: 'roas', icon: TrendingUp, label: { en: 'Return on Ad Spend (ROAS)', he: 'החזר על הוצאות פרסום (ROAS)' }, desc: { en: 'Ad campaign ROI calculation', he: 'חישוב תשואה על קמפיינים' } },
      { id: 'caprate', icon: Building, label: { en: 'Cap Rate', he: 'שיעור היוון נדל״ן' }, desc: { en: 'Real estate capitalization rate', he: 'שיעור היוון לנדל״ן' } },
      { id: 'ratios', icon: BarChart3, label: { en: 'Financial Ratios', he: 'יחסים פיננסיים' }, desc: { en: 'In-depth financial metric analysis', he: 'ניתוח עומק של יחסים ومדדים' } },
      { id: 'ebitda', icon: BarChart3, label: { en: 'EBITDA Calculator', he: 'מחשבון EBITDA' }, desc: { en: 'Earnings Before Interest, Taxes, Depreciation', he: 'רווח לפני ריבית, מסים ופחת' } }
    ]
  },
  {
    group: { en: 'Algorithmic Intelligence Tools', he: 'כלי בינה אלגוריתמיים' },
    items: Object.entries(FINANCIAL_ALGORITHMS).map(([id, algo]) => ({
      id,
      icon: Zap,
      label: { en: algo.name, he: algo.name },
      desc: { en: algo.description, he: algo.description }
    }))
  }
];

export default function AnalyticalCenter() {
  const transactions = useLedgerStore(s => s.transactions);
  const rawAccounts = useLedgerStore(s => s.accounts);
  const computedAccounts = useLedgerStore(s => s.computedAccounts);
  const accounts = useMemo(() => {
    return computedAccounts && computedAccounts.length > 0 ? computedAccounts : rawAccounts;
  }, [computedAccounts, rawAccounts]);
  const projects = useLedgerStore(s => s.projects);
  useLedgerStore(s => s.bills);
  useLedgerStore(s => s.invoices);
  useLedgerCollections('bills', 'invoices');
  useUIStore(s => s.filterCriteria);
  const { handleAction: onAction } = useCommandDispatcher();
  const passedMetrics = useAuditTelemetry(transactions, accounts);
  
  const activeChannel = useUIStore(state => state.activeIntelChannel);
  const setActiveChannel = useUIStore(state => state.setActiveIntelChannel);
  const [timeRange, setTimeRange] = useState(30);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  const language = useUIStore(state => state.language);
  const isFocusMode = useUIStore(state => state.isFocusMode);
  const runningBalances = useLedgerStore(state => state.runningBalances);
  const integrityStatus = useLedgerStore(state => state.integrityStatus);
  const budgets = useLedgerStore(state => state.budgets);
  useLedgerCollections('budgets');
  
  // High efficiency metrics calculations
  const metrics = useAuditTelemetry(transactions, accounts, timeRange, (timeRange === 30) ? passedMetrics : undefined);

  // Active channel attributes lookup
  const activeChannelDef = useMemo(() => {
    for (const group of CHANNELS) {
      const match = group.items.find((item) => item?.id === activeChannel);
      if (match) return match;
    }
    return CHANNELS[0].items[0];
  }, [activeChannel]);

  // Compute stats for Projects
  const projectStats = useMemo(() => {
    return projects.map(p => {
      const metric = runningBalances.projectMetrics[p.id] || { income: 0n, expense: 0n };
      const income = Number(metric.income);
      const expense = Number(metric.expense);
      const profit = (income - expense);
      const margin = income > 0 ? (profit / income) * 100 : 0;
      return { id: p.id, name: p.name, profit: profit / 100, margin, expense: expense / 100 };
    }).sort((a, b) => b.profit - a.profit);
  }, [runningBalances, projects]);

  // Recharts Radar metric calculation elements
  const radarData = useMemo(() => [
    { subject: 'Liquidity', A: Math.min(100, (metrics?.kpis?.currentRatio || 0) * 45), fullMark: 100 },
    { subject: 'Efficiency', A: metrics?.kpis?.yieldEfficiency || 0, fullMark: 100 },
    { subject: 'Margin', A: metrics?.kpis?.grossMargin || 0, fullMark: 100 },
    { subject: 'Velocity', A: Math.min(100, (metrics?.kpis?.cashVelocity || 0) * 55), fullMark: 100 },
    { subject: 'Integrity', A: metrics?.kpis?.complianceScore || 0, fullMark: 100 },
    { subject: 'Stability', A: metrics?.kpis?.healthScore || 0, fullMark: 100 },
  ], [metrics]);

  const filteredChannels = useMemo(() => {
    return CHANNELS.map(g => ({
      ...g,
      items: g.items.filter((i) =>
        i?.label?.en?.toLowerCase().includes(searchTerm.toLowerCase()) || 
        i?.desc?.en?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (i?.label?.he && i.label.he.includes(searchTerm))
      )
    })).filter(g => g.items.length > 0);
  }, [searchTerm]);

  const activeChannelName = activeChannelDef ? ((activeChannelDef.label && (activeChannelDef.label[language] || activeChannelDef.label['en'])) || (activeChannelDef).name || activeChannelDef.id) : '';

  if (!activeChannelDef) {
    return null;
  }

  return (
    <div className="flex flex-col lg:flex-row h-full min-h-[660px] overflow-hidden bg-[var(--surface)] border border-[var(--line)]/80 rounded-[32px] shadow-sm relative text-[var(--text)] font-sans">
      
      {/* -------------------------------------------------------------
          Smart localized CSS adjustment to style nested modules flawlessly
          ------------------------------------------------------------- */}
      <style>{`
        /* Local scrollbar styles & pristine lens containers */
        .custom-scrollbar::-webkit-scrollbar {
          width: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #cbd5e1;
          border-radius: 20px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #94a3b8;
        }
      `}</style>

      {/* -------------------------------------------------------------
          1. Sidebar (Master Panel) - Pristine Layout
          ------------------------------------------------------------- */}
      {!isFocusMode && (
        <aside className="lg:w-72 border-r border-[var(--line)] bg-[var(--surface)] hidden lg:flex flex-col h-full overflow-hidden shrink-0">
          
          {/* Executive identity header */}
          <div className="p-4 border-b border-[var(--line)] bg-[var(--panel)] shrink-0 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 bg-[var(--brass)] text-[var(--ink)] rounded-lg flex items-center justify-center shrink-0 shadow-xs font-bold">
                  <Target aria-hidden="true" size={14} className="stroke-[2.5px]" />
                </div>
                <div>
                  <h2 className="text-xs font-bold text-[var(--text)] leading-snug">Advanced Overview</h2>
                  <p className="text-[9px] font-mono font-medium text-[var(--muted)]">Financial Metrics</p>
                </div>
              </div>
              
              {/* Stability Node Pulse */}
              <div className="flex items-center gap-1 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full select-none">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-60"></span>
                  <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500"></span>
                </span>
                <span className="text-[8px] font-mono font-bold tracking-wide text-emerald-600 uppercase">Live</span>
              </div>
            </div>

            {/* Instant Filter Box */}
            <div className="relative">
              <input aria-label="Search analytics and auditing"
                type="text"
                placeholder="Search analytics & auditing..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="w-full text-xs px-3 py-1.5 pl-8 bg-[var(--surface)] border border-[var(--line)] focus:border-[var(--brass-line)] focus:outline-none rounded-lg transition-all text-[var(--text)] placeholder:text-[var(--faint)]"
              />
              <Search aria-hidden="true" size={12} className="absolute left-2.5 top-2.5 text-[var(--muted)]" />
              {searchTerm && (
                <button onClick={() => setSearchTerm('')} className="absolute right-2 top-1.5 text-[var(--muted)] hover:text-[var(--text)] font-mono text-[11px] px-1">
                  ×
                </button>
              )}
            </div>
          </div>

          {/* Categorized Options List as Cards */}
          <div className="flex-1 overflow-y-auto p-3 space-y-4 custom-scrollbar select-none">
            {filteredChannels.map(group => (
              <div key={group.group.en} className="space-y-1">
                <div className="px-2 pb-1 flex items-center justify-between">
                  <span className="text-[8.5px] font-mono font-bold uppercase tracking-widest text-[var(--muted)] block">
                    {group.group[language] || group.group['en']}
                  </span>
                  <span className="text-[8px] font-mono text-[var(--faint)] font-semibold">{group.items.length} LENSES</span>
                </div>
                
                <div className="space-y-0.5">
                  {group.items.map((item) => {
                    const isActive = activeChannel === item.id;
                    const IconComponent = item.icon;
                    return (
                      <button
                        key={item.id}
                        onClick={() => setActiveChannel(item.id)}
                        className={cn(
                          "w-full flex items-start gap-2.5 px-3 py-2 rounded-lg text-left transition-all duration-150 border cursor-pointer group",
                          isActive
                            ? "bg-[var(--brass-soft)] border-[var(--brass-line)] text-[var(--text)] shadow-xs font-semibold"
                            : "bg-transparent border-transparent text-[var(--muted)] hover:bg-[var(--panel)] hover:text-[var(--text)]"
                        )}
                      >
                        <div className={cn(
                          "w-5 h-5 rounded-md flex items-center justify-center shrink-0 mt-0.5 transition-colors",
                          isActive ? "bg-[var(--brass)] text-[var(--ink)] font-bold" : "bg-[var(--surface)] border border-[var(--line)] text-[var(--muted)] group-hover:text-[var(--text)]"
                        )}>
                          <IconComponent size={12} className="stroke-[2.2px]" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className={cn("text-[11.5px] leading-none tracking-tight transition-colors", isActive ? "font-bold text-[var(--text)]" : "font-medium text-[var(--text)]")}>
                            {((item).label?.[language] || (item).label?.['en']) || (item).name || item.id}
                          </p>
                          <p className="text-[9px] text-[var(--muted)] mt-1 leading-normal font-medium truncate group-hover:text-[var(--text)] transition-colors">
                            {((item).desc?.[language] || (item).desc?.['en']) || item.description || ''}
                          </p>
                        </div>
                        {isActive && (
                          <div className="w-1 h-3 rounded-full bg-[var(--brass)] shrink-0 self-center" />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
            
            {filteredChannels.length === 0 && (
              <p className="text-center text-[10px] text-[var(--muted)] font-mono py-6">No specific intelligence lenses matched.</p>
            )}
          </div>
          
          {/* Sidebar Footer with Workspace Stats summary info */}
          <div className="p-3 border-t border-[var(--line)] bg-[var(--panel)] shrink-0 text-[10px] space-y-1 font-mono text-[var(--muted)]">
             <div className="flex items-center justify-between">
               <span>Total Transactions</span>
               <span className="font-bold text-[var(--text)] tabular-nums">{transactions.length} items</span>
             </div>
             <div className="flex items-center justify-between">
               <span>Active Accounts</span>
               <span className="font-bold text-[var(--text)] tabular-nums">{accounts.length} nodes</span>
             </div>
          </div>
        </aside>
      )}

      {/* -------------------------------------------------------------
          2. Main Workspace Detail View (Pristine Canvas)
          ------------------------------------------------------------- */}
      <main className="flex-1 flex flex-col min-w-0 min-h-full bg-[var(--surface)]">
        
        {/* Dynamic header toolbar */}
        <header className="px-5 py-3 border-b border-[var(--line)] flex items-center justify-between shrink-0 bg-[var(--ink)]/50">
          <div className="flex items-center gap-3">
            {/* Mobile menu trigger */}
            <button aria-label="Toggle Menu"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)} 
              className="lg:hidden p-1.5 border border-slate-250 hover:bg-slate-100 text-slate-600 rounded-lg shrink-0 cursor-pointer"
              title="Toggle Menu"
            >
              <Menu aria-hidden="true" size={14} />
            </button>

            {/* Display active state details */}
            <div className="space-y-0.5">
              <div className="flex items-center gap-1">
                <span className="text-[9px] font-bold text-indigo-650 uppercase tracking-widest">{(activeChannelDef).badge || "PRO"}</span>
                <ChevronRight aria-hidden="true" size={10} className="text-slate-350" />
                <span className="text-[9px] font-semibold text-slate-450 uppercase tracking-wider">{activeChannelDef.id} lens</span>
              </div>
              <h1 className="text-sm font-bold tracking-tight text-[var(--text)] flex items-center gap-1.5 leading-none">
                <activeChannelDef.icon size={14} className="text-indigo-600 shrink-0" />
                <span>{activeChannelName}</span>
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Time interval selection pills */}
            <div className="flex bg-slate-100 p-0.5 rounded-lg border border-[var(--line)]/80 shrink-0">
              {[30, 90, 365].map(days => (
                <button
                  key={days}
                  onClick={() => setTimeRange(days)}
                  className={cn(
                    "px-2.5 py-0.5 rounded-md text-[9px] font-bold uppercase tracking-wider cursor-pointer whitespace-nowrap",
                    timeRange === days ? "bg-[var(--surface)] text-[var(--text)] border border-[var(--line)] shadow-3xs" : "text-[var(--muted)] hover:text-[var(--text)]"
                  )}
                >
                  {days}D
                </button>
              ))}
            </div>

            {/* Minimal focus controller */}
            <button aria-label={isFocusMode ? "Standard Workspace View" : "Maximize Intelligence Lens"}
              onClick={() => onAction?.('toggle-focus-mode')}
              title={isFocusMode ? "Standard Workspace View" : "Maximize Intelligence Lens"}
              className="p-1.5 border border-[var(--line)] hover:bg-[var(--ink)] rounded-lg text-[var(--muted)] hover:text-[var(--text)] shadow-3xs cursor-pointer transition-all shrink-0"
            >
              {isFocusMode ? <Minimize2 aria-hidden="true" size={12} /> : <Maximize2 aria-hidden="true" size={12} />}
            </button>

            {/* Export data trigger */}
            <button 
              onClick={() => onAction?.('export', { transactions })} 
              className="px-2.5 py-1.5 bg-slate-900 hover:bg-indigo-600 text-white rounded-lg text-[9px] font-bold uppercase tracking-wider transition-all shadow-3xs flex items-center gap-1.5 shrink-0 cursor-pointer"
            >
              <Download aria-hidden="true" size={10} />
              <span>Export</span>
            </button>
          </div>
        </header>

        {/* -------------------------------------------------------------
            3. Workspace Canvas View: Unified, single scrolling layer
            ------------------------------------------------------------- */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 custom-scrollbar bg-[var(--ink)]/30 lens-canvas-wrapper">
          
          {isFocusMode && (
            <div className="mb-4 px-4 py-2 bg-indigo-50 border border-indigo-100 rounded-xl flex items-center justify-between gap-3 text-[10.5px] animate-in slide-in-from-top-1 shadow-3xs">
              <div className="flex items-center gap-2">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-indigo-600"></span>
                </span>
                <span className="font-semibold text-indigo-950">Focused Intelligence Channel Canvas (Sidebar collapsed)</span>
              </div>
              <button 
                onClick={() => onAction?.('toggle-focus-mode')}
                className="text-[9px] font-extrabold uppercase text-indigo-700 hover:text-indigo-950 underline leading-none cursor-pointer"
              >
                Restore Sidebar
              </button>
            </div>
          )}

          <AnimatePresence mode="wait">
            
            {/* ----------------- HEALTH RADAR OVERVIEW ----------------- */}
            {activeChannel === 'radar' && (
              <motion.div
                key="radar"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                className="space-y-5"
              >
                {/* Re-engineered Bento Grid metrics readout (Highly visual, clean) */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                  
                  {/* Card 1: Integrity */}
                  <div className="p-4 bg-[var(--surface)] border border-[var(--line)]/80 rounded-xl shadow-3xs flex flex-col justify-between hover:border-slate-350 transition-colors">
                    <div className="flex items-center justify-between text-[var(--muted)] mb-2">
                      <span className="text-[8.5px] font-bold uppercase tracking-wider text-[var(--muted)]">Data Integrity</span>
                      <ShieldCheck aria-hidden="true" size={14} className="text-emerald-500" />
                    </div>
                    <div className="space-y-0.5">
                      <p className="text-lg font-black text-[var(--text)] leading-none">
                        {integrityStatus.isConsistent ? 'VERIFIED' : 'VARIANCE'}
                      </p>
                      <p className="text-[9px] text-[var(--muted)] font-mono tracking-tight leading-normal">
                        {transactions.length} secure trace logs
                      </p>
                    </div>
                  </div>

                  {/* Card 2: Enterprise Viability Score */}
                  <div className="p-4 bg-[var(--surface)] border border-[var(--line)]/80 rounded-xl shadow-3xs flex flex-col justify-between hover:border-slate-350 transition-colors">
                    <div className="flex items-center justify-between text-[var(--muted)] mb-2">
                      <span className="text-[8.5px] font-bold uppercase tracking-wider">Health Score</span>
                      <Sparkles aria-hidden="true" size={14} className="text-indigo-500" />
                    </div>
                    <div className="space-y-1.5">
                      <p className="text-lg font-black text-[var(--text)] leading-none">
                        {metrics?.kpis?.healthScore || 0}%
                      </p>
                      {/* Metric visual micro-progress bar */}
                      <div className="w-full h-1 bg-slate-100 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-indigo-600 rounded-full transition-all duration-300"
                          style={{ width: `${metrics?.kpis?.healthScore || 0}%` }}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Card 3: Cash Solvent Runway */}
                  <div className="p-4 bg-[var(--surface)] border border-[var(--line)]/80 rounded-xl shadow-3xs flex flex-col justify-between hover:border-slate-350 transition-colors">
                    <div className="flex items-center justify-between text-[var(--muted)] mb-2">
                      <span className="text-[8.5px] font-bold uppercase tracking-wider">Estimated Runway</span>
                      <Calendar aria-hidden="true" size={14} className="text-amber-500" />
                    </div>
                    <div className="space-y-0.5">
                      <p className="text-lg font-black text-[var(--text)] leading-none whitespace-nowrap">
                        {metrics.kpis.runwayMonths.toFixed(1)} Months
                      </p>
                      <p className="text-[9px] text-[var(--muted)] font-mono tracking-tight leading-normal whitespace-nowrap truncate">
                        At ${Math.round((metrics.kpis.burnRate * 30) / 100).toLocaleString()}/Mo burn
                      </p>
                    </div>
                  </div>

                  {/* Card 4: Index Volatility */}
                  <div className="p-4 bg-[var(--surface)] border border-[var(--line)]/80 rounded-xl shadow-3xs flex flex-col justify-between hover:border-slate-350 transition-colors">
                    <div className="flex items-center justify-between text-[var(--muted)] mb-2">
                      <span className="text-[8.5px] font-bold uppercase tracking-wider">Trend Volatility</span>
                      <Flame aria-hidden="true" size={14} className="text-rose-500" />
                    </div>
                    <div className="space-y-0.5">
                      <p className="text-lg font-black text-[var(--text)] leading-none">
                        {metrics.kpis.volatility.toFixed(1)}%
                      </p>
                      <p className="text-[9px] text-[var(--muted)] font-mono tracking-tight leading-normal">
                        Cashflow trend deviation
                      </p>
                    </div>
                  </div>

                </div>

                {/* Primary Radar grid + Insights (Side-by-Side Bento) */}
                <div className="grid grid-cols-1 xl:grid-cols-12 gap-5 items-start">
                  
                  {/* Radar Performance Web Grid */}
                  <div className="xl:col-span-7 bg-[var(--surface)] border border-[var(--line)]/80 rounded-[32px] p-5 flex flex-col justify-between shadow-3xs min-h-[420px]">
                     <div className="pb-3 border-b border-[var(--line)] flex items-center justify-between">
                        <div>
                           <h3 className="text-xs font-bold text-[var(--text)] uppercase tracking-wider">Metric Distribution Web</h3>
                           <p className="text-[9px] text-[var(--muted)]">Comparative metrics across baseline dimensions</p>
                        </div>
                     </div>
                     
                     <div className="flex-1 flex items-center justify-center min-h-[220px] py-4">
                        <ResponsiveContainer width="100%" height={230}>
                          <RadarChart cx="50%" cy="50%" outerRadius="75%" data={radarData}>
                            <PolarGrid stroke="#f1f5f9" />
                            <PolarAngleAxis dataKey="subject" tick={{ fontSize: 9, fontWeight: 700, fontFamily: 'Inter', fill: '#64748b' }} />
                            <Radar
                              name="Metrics View"
                              dataKey="A"
                              stroke="#6366f1"
                              fill="#6366f1"
                              fillOpacity={0.06}
                            />
                          </RadarChart>
                        </ResponsiveContainer>
                     </div>

                     <div className="pt-3 border-t border-[var(--line)] grid grid-cols-3 gap-2 text-center bg-[var(--ink)]/50 -mx-5 -mb-5 rounded-b-2xl p-3">
                        <div>
                           <p className="text-[8.5px] font-bold text-[var(--muted)] uppercase tracking-wider">Quick Liquidity</p>
                           <p className="text-xs font-bold text-indigo-600 mt-0.5">{(metrics?.kpis?.currentRatio || 0).toFixed(2)}x</p>
                        </div>
                        <div>
                           <p className="text-[8.5px] font-bold text-[var(--muted)] uppercase tracking-wider">Compliance</p>
                           <p className="text-xs font-bold text-emerald-600 mt-0.5">{metrics?.kpis?.complianceScore || 0}%</p>
                        </div>
                        <div>
                           <p className="text-[8.5px] font-bold text-[var(--muted)] uppercase tracking-wider">Yield Factor</p>
                           <p className="text-xs font-bold text-[var(--text)] mt-0.5">{metrics?.kpis?.yieldEfficiency || 0}%</p>
                        </div>
                     </div>
                  </div>

                  {/* Refined clean actionable summary list (Clean typography) */}
                  <div className="xl:col-span-5 bg-[var(--surface)] border border-[var(--line)]/80 rounded-[32px] p-5 shadow-3xs h-[420px] flex flex-col justify-between">
                     <div className="space-y-4">
                        <div className="flex items-center gap-2 pb-2.5 border-b border-[var(--line)]">
                          <BrainCircuit aria-hidden="true" size={15} className="text-indigo-600 shrink-0" />
                          <h3 className="text-xs font-extrabold text-[var(--text)] uppercase tracking-wider">Key Metrics Summary</h3>
                        </div>
                        
                        <div className="space-y-3.5">
                           {[
                             { 
                               title: 'Runway Estimate', 
                               text: `Estimated reserves to support ${metrics.kpis.runwayMonths.toFixed(1)} months of activity without adjustments.`, 
                               status: metrics.kpis.runwayMonths < 6 ? 'WARNING' : 'STABLE',
                               color: metrics.kpis.runwayMonths < 6 ? 'border-amber-500' : 'border-emerald-500'
                             },
                             { 
                               title: 'Average Burn Rate', 
                               text: `Average operational burn sits at $${((metrics.kpis.burnRate * 30) / 100).toLocaleString()}/Mo.`, 
                               status: 'AUDITED',
                               color: 'border-indigo-500'
                             },
                             { 
                               title: 'Anomaly Warnings', 
                               text: metrics.anomalies.length > 0 
                                 ? `Identified ${metrics.anomalies.length} potential balance deviations for forensic protocols.`
                                 : "Zero record integrity deviations found across selected indices.", 
                               status: metrics.anomalies.length > 0 ? 'ALERT' : 'PASS',
                               color: metrics.anomalies.length > 0 ? 'border-rose-500' : 'border-emerald-500'
                             }
                           ].map((item) => (
                             <div key={item.title} className={cn("p-2.5 border-l-2 bg-[var(--ink)]/50 rounded-r-lg space-y-1.5 transition-all hover:bg-[var(--ink)]", item.color)}>
                               <div className="flex items-center justify-between">
                                 <span className="text-[10px] font-bold text-slate-850">{item.title}</span>
                                 <span className="text-[8px] font-mono font-black tracking-wider uppercase bg-[var(--surface)] border px-1.5 py-0.5 rounded-sm text-[var(--muted)]">
                                   {item.status}
                                 </span>
                               </div>
                               <p className="text-[10.5px] font-medium leading-relaxed text-slate-600">
                                 {item.text}
                               </p>
                             </div>
                           ))}
                        </div>
                     </div>

                     <div className="p-3 bg-indigo-50/45 border border-indigo-100/65 rounded-xl flex items-start gap-2.5">
                        <Info aria-hidden="true" size={13} className="text-indigo-600 shrink-0 mt-0.5" />
                        <p className="text-[9.5px] text-indigo-950 font-medium leading-relaxed">
                          Analysis is computed locally based on the transactions and accounts present in the workspace database.
                        </p>
                     </div>
                  </div>

                </div>

                {/* Volumetric Interactive Live Graph */}
                <D3LedgerVisualizer data={transactions} />

              </motion.div>
            )}

            {/* ----------------- ROI PROFITABILITY MATRIX ----------------- */}
            {activeChannel === 'roi' && (
              <motion.div
                key="roi"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                className="space-y-5"
              >
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                   <div className="p-5 bg-[var(--surface)] border border-[var(--line)]/80 rounded-[32px] shadow-3xs flex flex-col h-[320px]">
                      <h4 className="text-xs font-bold text-[var(--text)] uppercase tracking-wider mb-3 pb-2 border-b border-[var(--line)]">Project Raw Revenue & Profit Matrix</h4>
                      <div className="flex-1 min-h-[180px]">
                         <ResponsiveContainer width="100%" height="100%">
                            <BarChart 
                              data={projectStats}
                              onClick={(eventData) => {
                                if (eventData && eventData.activePayload && eventData.activePayload[0] && onAction) {
                                  onAction('filter_project', { projectId: eventData.activePayload[0].payload.id });
                                }
                              }}
                              className="cursor-crosshair"
                            >
                               <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                               <XAxis dataKey="name" tick={{ fontSize: 9, fontWeight: 600, fill: '#64748b' }} />
                               <YAxis tick={{ fontSize: 8, fill: '#64748b' }} />
                               <Tooltip 
                                 contentStyle={{ borderRadius: '0.5rem', border: '1px solid #e2e8f0', boxShadow: '0 2px 4px -1px rgb(0 0 0 / 0.05)', fontSize: '10px' }}
                                 formatter={(val) => [`$${val.toLocaleString()}`, 'Profit']}
                               />
                               <Bar dataKey="profit" fill="#6366f1" radius={[3, 3, 0, 0]} />
                            </BarChart>
                         </ResponsiveContainer>
                      </div>
                      <p className="text-[8px] font-mono text-[var(--muted)] uppercase text-center mt-3 tracking-wider">Click columns to filter transaction explorer down to project bounds</p>
                   </div>

                   <div className="p-5 bg-[var(--surface)] border border-[var(--line)]/80 rounded-[32px] shadow-3xs flex flex-col h-[320px]">
                      <h4 className="text-xs font-bold text-[var(--text)] uppercase tracking-wider mb-3 pb-2 border-b border-[var(--line)]">Relative Profit Margins</h4>
                      <div className="flex-1 min-h-[180px]">
                         <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={projectStats}>
                               <defs>
                                 <linearGradient id="marginColorGrad" x1="0" y1="0" x2="0" y2="100%">
                                   <stop offset="5%" stopColor="#10b981" stopOpacity={0.12}/>
                                   <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                                 </linearGradient>
                               </defs>
                               <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                               <XAxis dataKey="name" tick={{ fontSize: 9, fontWeight: 600, fill: '#64748b' }} />
                               <YAxis tick={{ fontSize: 8, fill: '#64748b' }} />
                               <Tooltip 
                                 contentStyle={{ fontSize: '10px', borderRadius: '0.5rem' }} 
                                 formatter={(val) => [`${parseFloat(val as string).toFixed(1)}%`, 'Operational Margin']}
                               />
                               <Area type="monotone" dataKey="margin" stroke="#10b981" strokeWidth={1.8} fillOpacity={1} fill="url(#marginColorGrad)" />
                            </AreaChart>
                         </ResponsiveContainer>
                      </div>
                      <p className="text-[8px] font-mono text-[var(--muted)] uppercase text-center mt-3 tracking-wider">Dynamic mathematical ratio derived from live journal lines</p>
                   </div>
                </div>

                {/* Strategic Profitability List */}
                <div className="p-5 bg-[var(--surface)] border border-[var(--line)]/80 rounded-[32px] shadow-3xs">
                   <h4 className="text-xs font-bold text-[var(--text)] uppercase tracking-wider mb-3">Enterprise Segment Allocations Performance</h4>
                   <div className="space-y-2">
                      {projectStats.map(p => (
                         <div key={p.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-3 bg-[var(--ink)]/50 border border-[var(--line)]/60 rounded-xl hover:bg-slate-100/40 transition-colors gap-3">
                            <div className="flex items-center gap-3">
                               <div className="w-6 h-6 rounded bg-emerald-50 text-emerald-700 border border-emerald-100 flex items-center justify-center shrink-0">
                                  <TrendingUp aria-hidden="true" size={11} className="stroke-[2.5px]" />
                               </div>
                               <div>
                                  <p className="text-xs font-bold text-slate-850">{p.name}</p>
                                  <p className="text-[9.5px] text-[var(--muted)] mt-0.5 leading-none">
                                     Operating profit bounds: <span className="font-semibold text-slate-700 whitespace-nowrap">${p.profit.toLocaleString()}</span>
                                  </p>
                               </div>
                            </div>
                            
                            {/* Project profitability indicators */}
                            <div className="flex items-center gap-4">
                               <div className="flex flex-col items-end text-right">
                                  <span className="text-[10px] font-extrabold text-[var(--text)]">{p.margin.toFixed(1)}% Margin</span>
                                  <span className="text-[8px] text-[var(--muted)] uppercase tracking-wider">Ratio yield</span>
                               </div>
                               <span className={cn(
                                 "text-[8px] font-black tracking-wider uppercase px-2 py-0.5 rounded border shadow-3xs",
                                 p.margin > 30 ? "bg-emerald-50 text-emerald-700 border-emerald-150" : "bg-indigo-50 text-indigo-700 border-indigo-150"
                               )}>
                                 {p.margin > 30 ? 'EFFICIENT' : 'STABLE'}
                               </span>
                            </div>
                         </div>
                      ))}
                      {projectStats.length === 0 && (
                        <p className="text-center text-[11px] text-[var(--muted)] font-mono py-6">No enterprise segments categorized inside active ledger bounds.</p>
                      )}
                   </div>
                </div>
              </motion.div>
            )}

            {/* ----------------- FORENSIC AUDITOR ----------------- */}
            {activeChannel === 'forensics' && (
              <motion.div
                key="forensics"
                initial={{ opacity: 0, scale: 0.99 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.99 }}
              >
                <ForensicAuditor isEmbedded={true} />
              </motion.div>
            )}

            {/* ----------------- ENTITY CONSOLIDATION ----------------- */}
            {activeChannel === 'entities' && (
              <motion.div
                key="entities"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
              >
                <Consolidation />
              </motion.div>
            )}

            {/* ----------------- PIVOT SHEET ----------------- */}
            {activeChannel === 'pivot' && (
              <motion.div
                key="pivot"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
              >
                <PivotSheet transactions={transactions} isEmbedded={true} />
              </motion.div>
            )}

            {/* ----------------- BUDGET ANALYSIS ----------------- */}
            {activeChannel === 'budgets' && (
              <motion.div
                key="budgets"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
              >
                <BudgetManager />
              </motion.div>
            )}

            {/* ----------------- TAX NEXUS & MANAGEMENT ----------------- */}
            {activeChannel === 'nexus' && (
              <motion.div
                key="nexus"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
              >
                <TaxManager />
              </motion.div>
            )}

            {/* ----------------- FINANCIAL CALCULATORS & LENSES ----------------- */}
            {['breakeven', 'compound', 'rule72', 'ltv', 'npv', 'cac', 'wacc', 'roas', 'caprate', 'ratios', 'ebitda'].includes(activeChannel) && (
              <motion.div
                key={activeChannel}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
              >
                <FinancialCalculatorView type={activeChannel as React.ComponentProps<typeof FinancialCalculatorView>['type']} />
              </motion.div>
            )}

            {/* ----------------- ALGORITHM TOOL SANDBOX ----------------- */}
            {FINANCIAL_ALGORITHMS[activeChannel] && (
              <ViewErrorBoundary viewName={FINANCIAL_ALGORITHMS[activeChannel]?.name || 'Algorithm Sandbox'}>
                <ToolSandbox 
                  toolId={activeChannel} 
                  toolName={FINANCIAL_ALGORITHMS[activeChannel]?.name || 'Algorithm Sandbox'} 
                  onClose={() => setActiveChannel('radar')} 
                />
              </ViewErrorBoundary>
            )}

            {/* ----------------- DYNAMIC REGISTRY REFERRED LENSES ----------------- */}
            {activeChannel !== 'radar' && activeChannel !== 'roi' && activeChannel !== 'forensics' && activeChannel !== 'entities' && activeChannel !== 'pivot' && activeChannel !== 'budgets' && activeChannel !== 'nexus' && !['breakeven', 'compound', 'rule72', 'ltv', 'npv', 'cac', 'wacc', 'roas', 'caprate', 'ratios', 'ebitda'].includes(activeChannel) && !FINANCIAL_ALGORITHMS[activeChannel] && (() => {
              const lensDef = ANALYTICAL_LENSES_REGISTRY.find(l => l.id === activeChannel);
              if (lensDef && lensDef.componentName) {
                const Component = LENS_COMPONENTS[lensDef.componentName];
                if (Component) {
                  return (
                    <motion.div
                      key={activeChannel}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="h-full"
                    >
                      <ViewErrorBoundary viewName={(lensDef)?.label?.en || lensDef.id || activeChannel}>
                        <React.Suspense fallback={
                          <div className="flex flex-col items-center justify-center p-16 space-y-3 bg-[var(--surface)] border border-[var(--line)] rounded-[32px] min-h-[380px] text-center">
                            <Loader2 aria-hidden="true" className="w-7 h-7 text-indigo-650 animate-spin shrink-0" />
                            <p className="text-[10px] uppercase font-mono font-bold tracking-widest text-[var(--muted)]">Restructuring Lens Component...</p>
                          </div>
                        }>
                          <Component 
                            accounts={accounts} 
                            computedAccounts={accounts} 
                            budgets={budgets} 
                            projects={projects}
                            isEmbedded={true}
                          />
                        </React.Suspense>
                      </ViewErrorBoundary>
                    </motion.div>
                  );
                }
              }
              return (
                <div className="p-4 md:p-8 text-center bg-[var(--surface)] border border-[var(--line)] rounded-[32px]">
                  <p className="text-[var(--muted)] text-xs font-mono">Select a channel lens to align telemetry parameters.</p>
                </div>
              );
            })()}

          </AnimatePresence>
        </div>
      </main>

      {/* -------------------------------------------------------------
          4. Drawer/Sidebar for Mobile Layout Screen sizes
          ------------------------------------------------------------- */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <>
            {/* Backdrop overlay */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.45 }}
              exit={{ opacity: 0 }}
              onClick={() => setMobileMenuOpen(false)}
              className="lg:hidden absolute inset-0 bg-slate-900 z-40"
            />

            {/* Sliding navigation drawer */}
            <motion.div
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 220 }}
              className="lg:hidden absolute top-0 bottom-0 left-0 w-72 bg-[var(--surface)] z-50 shadow-xl border-r border-slate-250 flex flex-col h-full"
            >
              <div className="p-4 border-b border-[var(--line)] bg-[var(--ink)] flex items-center justify-between shrink-0">
                <div className="flex items-center gap-1.5">
                  <Target aria-hidden="true" size={14} className="text-indigo-650 stroke-[2.5px]" />
                  <span className="text-xs font-bold text-[var(--text)] tracking-tight">Advanced Overview</span>
                </div>
                <button aria-label="Close intelligence menu"
                  onClick={() => setMobileMenuOpen(false)} 
                  className="p-1 border border-[var(--line)] hover:bg-slate-100 rounded-lg text-[var(--muted)] cursor-pointer"
                >
                  <X aria-hidden="true" size={13} />
                </button>
              </div>

              {/* Channels navigation selector */}
              <div className="flex-1 overflow-y-auto p-3 space-y-4 custom-scrollbar select-none">
                {CHANNELS.map(group => (
                  <div key={group.group.en} className="space-y-1">
                    <span className="text-[8.5px] font-bold text-[var(--muted)] uppercase tracking-widest px-2 block">
                      {group.group[language] || group.group['en']}
                    </span>
                    <div className="space-y-0.5">
                      {group.items.map((item) => {
                        const isActive = activeChannel === item.id;
                        const IconComponent = item.icon;
                        return (
                          <button
                            key={item.id}
                            onClick={() => {
                              setActiveChannel(item.id);
                              setMobileMenuOpen(false);
                            }}
                            className={cn(
                              "w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-left border cursor-pointer text-[11.5px]",
                              isActive
                                ? "bg-[var(--brass)]/15 border-[var(--brass-line)] text-[var(--text)] font-bold"
                                : "bg-transparent border-transparent text-[var(--muted)] hover:bg-[var(--ink)]"
                            )}
                          >
                            <IconComponent size={13} className={cn(isActive ? "text-indigo-600" : "text-[var(--muted)]")} />
                            <span>{((item).label?.[language] || (item).label?.['en']) || (item).name || item.id}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

    </div>
  );
}
