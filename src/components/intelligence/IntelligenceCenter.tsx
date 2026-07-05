import React, { useState, useMemo, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar,
  Radar, RadarChart, PolarGrid, PolarAngleAxis
} from 'recharts';
import { Building2, Globe, BarChart3, Layers, ShieldCheck, Target, Download, Maximize2, Minimize2, BrainCircuit, TrendingUp, Activity, Info, Grid3X3, ChevronRight, Sparkles, Radar as RadarIcon, Menu, X, Search, Calendar, Flame, Loader2, LayoutGrid, Building, Clock, DollarSign, Users, BarChart, Bank, Briefcase as BriefcaseIcon, Scale, Wallet, LineChart, RotateCcw, Landmark, LineChart as LineChartIcon, Receipt, TrendingDown, Crosshair, BriefcaseMedical, Umbrella, Banknote, BarChart4, Hourglass, FastForward, Zap, RefreshCw, PackageCheck, Droplets, Link, Home, ArrowLeftRight, CandlestickChart, Network, Factory, BookOpen, PiggyBank, HandCoins, ActivitySquare, Leaf, Shield, Sprout, Box, Clock4, Clock8, Sliders, AlertTriangle, ClipboardCheck, PercentCircle, BookMarked, PieChart, Coins, Signal, Calculator } from 'lucide-react';
import { cn } from '../../lib/utils';
import { useLedgerStore } from '../../stores/useLedgerStore';
import { useAuditTelemetry } from '../../hooks/useAuditTelemetry';
import * as d3 from 'd3';
import { Transaction, ChartAccount, Project, Bill, Invoice } from '../../types';
import { useUIStore } from '../../stores/useUIStore';
import ForensicAuditor from '../reporting/ForensicAuditor';
import EntityConsolidation from '../finance/EntityConsolidation';
import { ANALYTICAL_LENSES_REGISTRY, LENS_COMPONENTS } from '../../config/registry';

// -------------------------------------------------------------
// Interactive D3 Ledger Volumetric Flow & Activity Visualizer
// -------------------------------------------------------------
const D3LedgerVisualizer = ({ data }: { data: any[] }) => {
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

    const svg = d3.select(svgRef.current);
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
    
    const x = d3.scaleBand()
      .range([margin.left, width - margin.right])
      .padding(0.28);

    const y = d3.scaleLinear()
      .range([height - margin.bottom, margin.top]);

    x.domain(processed.map(d => d.label));
    
    const maxVal = d3.max(processed, d => d.value) || 100;
    y.domain([0, maxVal * 1.05]);

    // Add continuous background gridlines
    svg.append("g")
      .attr("class", "grid")
      .attr("transform", `translate(0, ${height - margin.bottom})`)
      .call(d3.axisBottom(x).tickSize(-height + margin.top + margin.bottom).tickFormat(() => ""))
      .call(g => g.select(".domain").remove())
      .call(g => g.selectAll(".tick line").attr("stroke", "#f1f5f9").attr("stroke-opacity", 0.8));

    svg.append("g")
      .attr("class", "grid")
      .attr("transform", `translate(${margin.left}, 0)`)
      .call(d3.axisLeft(y).tickSize(-width + margin.left + margin.right).ticks(4).tickFormat(() => ""))
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
      .attr("d", d3.area()
        .x((d: any) => (x(d.label) || 0) + x.bandwidth() / 2)
        .y0(height - margin.bottom)
        .y1((d: any) => y(d.value))
        .curve(d3.curveMonotoneX) as any
      );

    // 2. Bars
    svg.append("g")
      .selectAll("rect")
      .data(processed)
      .join("rect")
      .attr("x", (d: any) => x(d.label) || 0)
      .attr("y", (d: any) => y(d.value))
      .attr("height", (d: any) => Math.max(0, (height - margin.bottom) - y(d.value)))
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
      .attr("d", d3.line()
        .x((d: any) => (x(d.label) || 0) + x.bandwidth() / 2)
        .y((d: any) => y(d.value))
        .curve(d3.curveMonotoneX) as any
      );

    // 4. Glowing trend points
    svg.append("g")
      .selectAll("circle")
      .data(processed)
      .join("circle")
      .attr("cx", (d: any) => (x(d.label) || 0) + x.bandwidth() / 2)
      .attr("cy", (d: any) => y(d.value))
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
      .attr("x", (d: any) => (x(d.label) || 0))
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
      .call(d3.axisBottom(x).tickSize(0).tickPadding(6))
      .call(g => g.select(".domain").attr("stroke", "#e2e8f0"))
      .call(g => g.selectAll(".tick text")
        .attr("fill", "#64748b")
        .attr("font-size", "8.5px")
        .attr("font-family", "JetBrains Mono, ui-monospace"));

    // 7. Y-Axis rendering
    svg.append("g")
      .attr("transform", `translate(${margin.left}, 0)`)
      .call(d3.axisLeft(y).ticks(4).tickFormat(d => `$${d}`))
      .call(g => g.select(".domain").remove())
      .call(g => g.selectAll(".tick text")
        .attr("fill", "#64748b")
        .attr("font-size", "8.5px")
        .attr("font-family", "JetBrains Mono, ui-monospace"));

  }, [data, dimensions]);

  return (
    <div ref={containerRef} className="w-full bg-white rounded-[32px] p-5 border border-slate-200/80 relative shadow-3xs overflow-hidden group">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 mb-3">
         <div className="flex items-center gap-2">
           <Activity size={13} className="text-indigo-600 shrink-0" />
           <span className="text-[10px] font-mono font-bold tracking-wider text-slate-500 uppercase">Recent Transaction Volume</span>
         </div>
         <div className="flex items-center gap-2">
           <span className="px-2 py-0.5 bg-slate-50 border border-slate-200 text-slate-700 text-[8px] font-mono font-black uppercase rounded-sm">Current</span>
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
            <div className="absolute top-2 right-2 text-[9px] text-slate-400 uppercase font-mono pointer-events-none hidden sm:block">
              Hover series peaks to scope ledger context
            </div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

interface AnalyticalCenterProps {
  transactions: Transaction[];
  accounts: ChartAccount[];
  projects?: Project[];
  bills?: Bill[];
  invoices?: Invoice[];
  filterCriteria: any;
  onAction: (action: string, details?: any) => void;
  metrics?: any;
}

// -------------------------------------------------------------
// Core Redesigned Analytical Channels
// -------------------------------------------------------------
const CHANNELS = [
  {
    group: { en: 'Executive Overview', he: 'סקירת מנהלים' },
    items: [
      { id: 'radar', icon: Activity, label: { en: 'Metrics Radar', he: 'רדאר בריאות' }, desc: { en: 'Live volumetric operational spider web view', he: 'תצוגת רדאר תקציבית חיה' } },
      { id: 'roi', icon: Target, label: { en: 'ROI Matrix', he: 'מטריצת החזר השקעה' }, desc: { en: 'Calculates true velocity and margin projections', he: 'חישוב מהירות החזר השקעה' } }
    ]
  },
  {
    group: { en: 'Financial Core', he: 'פיננסים' },
    items: [
      { id: 'pivot', icon: LayoutGrid, label: { en: 'Pivot Sheet', he: 'גיליון ציר' }, desc: { en: 'Advanced pivot tables for transactions', he: 'טבלאות ציר מתקדמות לתנועות' } },
      { id: 'assets', icon: Building, label: { en: 'Fixed Assets', he: 'רכוש קבוע' }, desc: { en: 'Track depreciation and lifecycle', he: 'מעקב אחר פחת ומחזור חיים' } },
      { id: 'amortization', icon: Clock, label: { en: 'Amortization Tool', he: 'לוח סילוקין' }, desc: { en: 'Loan and amortization schedules', he: 'לוחות סילוקין להלוואות' } }
    ]
  },
  {
    group: { en: 'Calculators', he: 'מחשבונים' },
    items: [
      { id: 'currency', icon: DollarSign, label: { en: 'Currency Converter', he: 'המרת מטבעות' }, desc: { en: 'Real-time exchange rate calculation', he: 'חישוב שערי חליפין בזמן אמת' } },
      { id: 'margin', icon: TrendingUp, label: { en: 'Margin & Markup', he: 'מחשבון שולי רווח' }, desc: { en: 'Calculate profit margins and markup', he: 'חישוב שולי רווח וסימון' } },
      { id: 'breakeven', icon: Target, label: { en: 'Break-Even Analysis', he: 'ניתוח נקודת איזון' }, desc: { en: 'Calculate break-even units and revenue', he: 'חישוב יחידות והכנסות לנקודת איזון' } },
      { id: 'compound', icon: Target, label: { en: 'Compound Interest', he: 'ריבית דריבית' }, desc: { en: 'Calculate compounding investment returns', he: 'חישוב תשואות השקעה בריבית דריבית' } },
      { id: 'rule72', icon: Activity, label: { en: 'Rule of 72', he: 'כלל ה-72' }, desc: { en: 'Calculate years to double investment', he: 'חישוב שנים להכפלת השקעה' } },
      { id: 'ltv', icon: Users, label: { en: 'LTV', he: 'LTV' }, desc: { en: 'Customer Lifetime Value', he: 'ערך חיי לקוח' } },
      { id: 'npv', icon: BarChart, label: { en: 'NPV', he: 'NPV' }, desc: { en: 'Net Present Value', he: 'ערך נוכחי נקי' } },
      { id: 'cac', icon: Users, label: { en: 'CAC', he: 'CAC' }, desc: { en: 'Customer Acquisition Cost', he: 'עלות רכישת לקוח' } },
      { id: 'wacc', icon: BarChart3, label: { en: 'WACC', he: 'WACC' }, desc: { en: 'Weighted Average Cost of Capital', he: 'עלות הון משוקללת' } },
      { id: 'roas', icon: TrendingUp, label: { en: 'ROAS Calculator', he: 'החזר הוצאות פרסום' }, desc: { en: 'Return on Ad Spend', he: 'החזר על הוצאות פרסום' } },
      { id: 'caprate', icon: Building, label: { en: 'Cap Rate', he: 'שיעור היוון' }, desc: { en: 'Real Estate Capitalization Rate', he: 'שיעור היוון לנדל״ן' } }
    ]
  },
  {
    group: { en: 'Reporting & Compliance', he: 'דוחות וציות' },
    items: [
      { id: 'nexus', label: { en: 'Tax Nexus', he: 'מיסוי מקומי' }, icon: ShieldCheck, desc: { en: 'Identify tax liabilities across states', he: 'זיהוי חבויות מס ברחבי המדינות' } },
      { id: 'ratios', label: { en: 'Financial Ratios', he: 'יחסים פיננסיים' }, icon: BarChart3, desc: { en: 'In-depth ratio and metric analysis', he: 'ניתוח עומק של יחסים ומדדים' } },
      { id: 'budgets', label: { en: 'Budget Analysis', he: 'ניתוח תקציב' }, icon: DollarSign, desc: { en: 'Budget vs Actual variance reporting', he: 'דוחות סטיות של תקציב מול מציאות' } },
      { id: 'ebitda', label: { en: 'EBITDA', he: 'EBITDA' }, icon: BarChart3, desc: { en: 'Earnings Before Interest, Taxes, Depreciation', he: 'רווח לפני ריבית, מסים, פחת והפחתות' } }
    ]
  },
  {
    group: { en: 'Advanced Systems', he: 'מערכות מתקדמות' },
    items: [
      { id: 'forensics', icon: ShieldCheck, label: { en: 'Audit & Forensics', he: 'ביקורת וממצאים' }, desc: { en: 'Deep scan integrity ledger evaluation', he: 'סריקת עומק והערכת תקינות ספר יומן' } },
      { id: 'entities', icon: Building, label: { en: 'Entity Consolidation', he: 'איחוד ישויות' }, desc: { en: 'Multi-company ledger aggregation', he: 'ריכוז ואיחוד ספרי הנהלת חשבונות' } }
    ]
  }
,
  {
    group: { en: 'Additional Tools 1', he: 'כלים נוספים 1' },
    items: [
      { id: 'altmanZScore', icon: Calculator, label: { en: 'Altman Z Score', he: 'Altman Z Score' }, desc: { en: 'Altman Z Score tool', he: 'כלי Altman Z Score' } },
      { id: 'apy', icon: Calculator, label: { en: 'Apy', he: 'Apy' }, desc: { en: 'Apy tool', he: 'כלי Apy' } },
      { id: 'assetTurnover', icon: Calculator, label: { en: 'Asset Turnover', he: 'Asset Turnover' }, desc: { en: 'Asset Turnover tool', he: 'כלי Asset Turnover' } },
      { id: 'autoLoan', icon: Calculator, label: { en: 'Auto Loan', he: 'Auto Loan' }, desc: { en: 'Auto Loan tool', he: 'כלי Auto Loan' } },
      { id: 'beta', icon: Calculator, label: { en: 'Beta', he: 'Beta' }, desc: { en: 'Beta tool', he: 'כלי Beta' } },
      { id: 'blackScholes', icon: Calculator, label: { en: 'Black Scholes', he: 'Black Scholes' }, desc: { en: 'Black Scholes tool', he: 'כלי Black Scholes' } },
      { id: 'bollingerBands', icon: Calculator, label: { en: 'Bollinger Bands', he: 'Bollinger Bands' }, desc: { en: 'Bollinger Bands tool', he: 'כלי Bollinger Bands' } },
      { id: 'bondPrice', icon: Calculator, label: { en: 'Bond Price', he: 'Bond Price' }, desc: { en: 'Bond Price tool', he: 'כלי Bond Price' } },
      { id: 'breakEven', icon: Calculator, label: { en: 'Break Even', he: 'Break Even' }, desc: { en: 'Break Even tool', he: 'כלי Break Even' } },
      { id: 'cacLtv', icon: Calculator, label: { en: 'Cac Ltv', he: 'Cac Ltv' }, desc: { en: 'Cac Ltv tool', he: 'כלי Cac Ltv' } },
      { id: 'cagr', icon: Calculator, label: { en: 'Cagr', he: 'Cagr' }, desc: { en: 'Cagr tool', he: 'כלי Cagr' } },
      { id: 'capRate', icon: Calculator, label: { en: 'Cap Rate', he: 'Cap Rate' }, desc: { en: 'Cap Rate tool', he: 'כלי Cap Rate' } },
      { id: 'capitalGains', icon: Calculator, label: { en: 'Capital Gains', he: 'Capital Gains' }, desc: { en: 'Capital Gains tool', he: 'כלי Capital Gains' } },
      { id: 'capitalGainsTax', icon: Calculator, label: { en: 'Capital Gains Tax', he: 'Capital Gains Tax' }, desc: { en: 'Capital Gains Tax tool', he: 'כלי Capital Gains Tax' } },
      { id: 'capm', icon: Calculator, label: { en: 'Capm', he: 'Capm' }, desc: { en: 'Capm tool', he: 'כלי Capm' } },
      { id: 'carAffordability', icon: Calculator, label: { en: 'Car Affordability', he: 'Car Affordability' }, desc: { en: 'Car Affordability tool', he: 'כלי Car Affordability' } },
      { id: 'cashOnCash', icon: Calculator, label: { en: 'Cash On Cash', he: 'Cash On Cash' }, desc: { en: 'Cash On Cash tool', he: 'כלי Cash On Cash' } },
      { id: 'cashRatio', icon: Calculator, label: { en: 'Cash Ratio', he: 'Cash Ratio' }, desc: { en: 'Cash Ratio tool', he: 'כלי Cash Ratio' } },
      { id: 'ccc', icon: Calculator, label: { en: 'Ccc', he: 'Ccc' }, desc: { en: 'Ccc tool', he: 'כלי Ccc' } },
      { id: 'collegeSavings', icon: Calculator, label: { en: 'College Savings', he: 'College Savings' }, desc: { en: 'College Savings tool', he: 'כלי College Savings' } }
    ]
  },
  {
    group: { en: 'Additional Tools 2', he: 'כלים נוספים 2' },
    items: [
      { id: 'costOfDebt', icon: Calculator, label: { en: 'Cost Of Debt', he: 'Cost Of Debt' }, desc: { en: 'Cost Of Debt tool', he: 'כלי Cost Of Debt' } },
      { id: 'costOfDelay', icon: Calculator, label: { en: 'Cost Of Delay', he: 'Cost Of Delay' }, desc: { en: 'Cost Of Delay tool', he: 'כלי Cost Of Delay' } },
      { id: 'dcf', icon: Calculator, label: { en: 'Dcf', he: 'Dcf' }, desc: { en: 'Dcf tool', he: 'כלי Dcf' } },
      { id: 'ddm', icon: Calculator, label: { en: 'Ddm', he: 'Ddm' }, desc: { en: 'Ddm tool', he: 'כלי Ddm' } },
      { id: 'debtSnowball', icon: Calculator, label: { en: 'Debt Snowball', he: 'Debt Snowball' }, desc: { en: 'Debt Snowball tool', he: 'כלי Debt Snowball' } },
      { id: 'debtToAsset', icon: Calculator, label: { en: 'Debt To Asset', he: 'Debt To Asset' }, desc: { en: 'Debt To Asset tool', he: 'כלי Debt To Asset' } },
      { id: 'debtToCapital', icon: Calculator, label: { en: 'Debt To Capital', he: 'Debt To Capital' }, desc: { en: 'Debt To Capital tool', he: 'כלי Debt To Capital' } },
      { id: 'debtToEquity', icon: Calculator, label: { en: 'Debt To Equity', he: 'Debt To Equity' }, desc: { en: 'Debt To Equity tool', he: 'כלי Debt To Equity' } },
      { id: 'depreciation', icon: Calculator, label: { en: 'Depreciation', he: 'Depreciation' }, desc: { en: 'Depreciation tool', he: 'כלי Depreciation' } },
      { id: 'dfl', icon: Calculator, label: { en: 'Dfl', he: 'Dfl' }, desc: { en: 'Dfl tool', he: 'כלי Dfl' } },
      { id: 'dio', icon: Calculator, label: { en: 'Dio', he: 'Dio' }, desc: { en: 'Dio tool', he: 'כלי Dio' } },
      { id: 'discount', icon: Calculator, label: { en: 'Discount', he: 'Discount' }, desc: { en: 'Discount tool', he: 'כלי Discount' } },
      { id: 'discountYield', icon: Calculator, label: { en: 'Discount Yield', he: 'Discount Yield' }, desc: { en: 'Discount Yield tool', he: 'כלי Discount Yield' } },
      { id: 'dividendCoverage', icon: Calculator, label: { en: 'Dividend Coverage', he: 'Dividend Coverage' }, desc: { en: 'Dividend Coverage tool', he: 'כלי Dividend Coverage' } },
      { id: 'dividendPayout', icon: Calculator, label: { en: 'Dividend Payout', he: 'Dividend Payout' }, desc: { en: 'Dividend Payout tool', he: 'כלי Dividend Payout' } },
      { id: 'dividendYield', icon: Calculator, label: { en: 'Dividend Yield', he: 'Dividend Yield' }, desc: { en: 'Dividend Yield tool', he: 'כלי Dividend Yield' } },
      { id: 'dol', icon: Calculator, label: { en: 'Dol', he: 'Dol' }, desc: { en: 'Dol tool', he: 'כלי Dol' } },
      { id: 'dpo', icon: Calculator, label: { en: 'Dpo', he: 'Dpo' }, desc: { en: 'Dpo tool', he: 'כלי Dpo' } },
      { id: 'dscr', icon: Calculator, label: { en: 'Dscr', he: 'Dscr' }, desc: { en: 'Dscr tool', he: 'כלי Dscr' } },
      { id: 'dso', icon: Calculator, label: { en: 'Dso', he: 'Dso' }, desc: { en: 'Dso tool', he: 'כלי Dso' } }
    ]
  },
  {
    group: { en: 'Additional Tools 3', he: 'כלים נוספים 3' },
    items: [
      { id: 'dti', icon: Calculator, label: { en: 'Dti', he: 'Dti' }, desc: { en: 'Dti tool', he: 'כלי Dti' } },
      { id: 'duPontAnalysis', icon: Calculator, label: { en: 'Du Pont Analysis', he: 'Du Pont Analysis' }, desc: { en: 'Du Pont Analysis tool', he: 'כלי Du Pont Analysis' } },
      { id: 'dupontAnalysis', icon: Calculator, label: { en: 'Dupont Analysis', he: 'Dupont Analysis' }, desc: { en: 'Dupont Analysis tool', he: 'כלי Dupont Analysis' } },
      { id: 'earningsYield', icon: Calculator, label: { en: 'Earnings Yield', he: 'Earnings Yield' }, desc: { en: 'Earnings Yield tool', he: 'כלי Earnings Yield' } },
      { id: 'ebitdaValuation', icon: Calculator, label: { en: 'Ebitda Valuation', he: 'Ebitda Valuation' }, desc: { en: 'Ebitda Valuation tool', he: 'כלי Ebitda Valuation' } },
      { id: 'ema', icon: Calculator, label: { en: 'Ema', he: 'Ema' }, desc: { en: 'Ema tool', he: 'כלי Ema' } },
      { id: 'emergencyFund', icon: Calculator, label: { en: 'Emergency Fund', he: 'Emergency Fund' }, desc: { en: 'Emergency Fund tool', he: 'כלי Emergency Fund' } },
      { id: 'enterpriseValue', icon: Calculator, label: { en: 'Enterprise Value', he: 'Enterprise Value' }, desc: { en: 'Enterprise Value tool', he: 'כלי Enterprise Value' } },
      { id: 'eps', icon: Calculator, label: { en: 'Eps', he: 'Eps' }, desc: { en: 'Eps tool', he: 'כלי Eps' } },
      { id: 'epsGrowth', icon: Calculator, label: { en: 'Eps Growth', he: 'Eps Growth' }, desc: { en: 'Eps Growth tool', he: 'כלי Eps Growth' } },
      { id: 'equityMultiplier', icon: Calculator, label: { en: 'Equity Multiplier', he: 'Equity Multiplier' }, desc: { en: 'Equity Multiplier tool', he: 'כלי Equity Multiplier' } },
      { id: 'equityToAsset', icon: Calculator, label: { en: 'Equity To Asset', he: 'Equity To Asset' }, desc: { en: 'Equity To Asset tool', he: 'כלי Equity To Asset' } },
      { id: 'evEbitda', icon: Calculator, label: { en: 'Ev Ebitda', he: 'Ev Ebitda' }, desc: { en: 'Ev Ebitda tool', he: 'כלי Ev Ebitda' } },
      { id: 'eva', icon: Calculator, label: { en: 'Eva', he: 'Eva' }, desc: { en: 'Eva tool', he: 'כלי Eva' } },
      { id: 'expenseRatio', icon: Calculator, label: { en: 'Expense Ratio', he: 'Expense Ratio' }, desc: { en: 'Expense Ratio tool', he: 'כלי Expense Ratio' } },
      { id: 'fcf', icon: Calculator, label: { en: 'Fcf', he: 'Fcf' }, desc: { en: 'Fcf tool', he: 'כלי Fcf' } },
      { id: 'fcfYield', icon: Calculator, label: { en: 'Fcf Yield', he: 'Fcf Yield' }, desc: { en: 'Fcf Yield tool', he: 'כלי Fcf Yield' } },
      { id: 'fcfe', icon: Calculator, label: { en: 'Fcfe', he: 'Fcfe' }, desc: { en: 'Fcfe tool', he: 'כלי Fcfe' } },
      { id: 'fica', icon: Calculator, label: { en: 'Fica', he: 'Fica' }, desc: { en: 'Fica tool', he: 'כלי Fica' } },
      { id: 'fire', icon: Calculator, label: { en: 'Fire', he: 'Fire' }, desc: { en: 'Fire tool', he: 'כלי Fire' } }
    ]
  },
  {
    group: { en: 'Additional Tools 4', he: 'כלים נוספים 4' },
    items: [
      { id: 'fixedAssetTurnover', icon: Calculator, label: { en: 'Fixed Asset Turnover', he: 'Fixed Asset Turnover' }, desc: { en: 'Fixed Asset Turnover tool', he: 'כלי Fixed Asset Turnover' } },
      { id: 'fv', icon: Calculator, label: { en: 'Fv', he: 'Fv' }, desc: { en: 'Fv tool', he: 'כלי Fv' } },
      { id: 'gordonGrowth', icon: Calculator, label: { en: 'Gordon Growth', he: 'Gordon Growth' }, desc: { en: 'Gordon Growth tool', he: 'כלי Gordon Growth' } },
      { id: 'grm', icon: Calculator, label: { en: 'Grm', he: 'Grm' }, desc: { en: 'Grm tool', he: 'כלי Grm' } },
      { id: 'grossMargin', icon: Calculator, label: { en: 'Gross Margin', he: 'Gross Margin' }, desc: { en: 'Gross Margin tool', he: 'כלי Gross Margin' } },
      { id: 'houseFlip', icon: Calculator, label: { en: 'House Flip', he: 'House Flip' }, desc: { en: 'House Flip tool', he: 'כלי House Flip' } },
      { id: 'inflation', icon: Calculator, label: { en: 'Inflation', he: 'Inflation' }, desc: { en: 'Inflation tool', he: 'כלי Inflation' } },
      { id: 'interestCoverage', icon: Calculator, label: { en: 'Interest Coverage', he: 'Interest Coverage' }, desc: { en: 'Interest Coverage tool', he: 'כלי Interest Coverage' } },
      { id: 'inventoryTurnover', icon: Calculator, label: { en: 'Inventory Turnover', he: 'Inventory Turnover' }, desc: { en: 'Inventory Turnover tool', he: 'כלי Inventory Turnover' } },
      { id: 'irr', icon: Calculator, label: { en: 'Irr', he: 'Irr' }, desc: { en: 'Irr tool', he: 'כלי Irr' } },
      { id: 'leaseVsBuy', icon: Calculator, label: { en: 'Lease Vs Buy', he: 'Lease Vs Buy' }, desc: { en: 'Lease Vs Buy tool', he: 'כלי Lease Vs Buy' } },
      { id: 'liquidity', icon: Calculator, label: { en: 'Liquidity', he: 'Liquidity' }, desc: { en: 'Liquidity tool', he: 'כלי Liquidity' } },
      { id: 'loan', icon: Calculator, label: { en: 'Loan', he: 'Loan' }, desc: { en: 'Loan tool', he: 'כלי Loan' } },
      { id: 'macaulayDuration', icon: Calculator, label: { en: 'Macaulay Duration', he: 'Macaulay Duration' }, desc: { en: 'Macaulay Duration tool', he: 'כלי Macaulay Duration' } },
      { id: 'macd', icon: Calculator, label: { en: 'Macd', he: 'Macd' }, desc: { en: 'Macd tool', he: 'כלי Macd' } },
      { id: 'marginMarkup', icon: Calculator, label: { en: 'Margin Markup', he: 'Margin Markup' }, desc: { en: 'Margin Markup tool', he: 'כלי Margin Markup' } },
      { id: 'marginOfSafety', icon: Calculator, label: { en: 'Margin Of Safety', he: 'Margin Of Safety' }, desc: { en: 'Margin Of Safety tool', he: 'כלי Margin Of Safety' } },
      { id: 'netProfitMargin', icon: Calculator, label: { en: 'Net Profit Margin', he: 'Net Profit Margin' }, desc: { en: 'Net Profit Margin tool', he: 'כלי Net Profit Margin' } },
      { id: 'netWorth', icon: Calculator, label: { en: 'Net Worth', he: 'Net Worth' }, desc: { en: 'Net Worth tool', he: 'כלי Net Worth' } },
      { id: 'ocfRatio', icon: Calculator, label: { en: 'Ocf Ratio', he: 'Ocf Ratio' }, desc: { en: 'Ocf Ratio tool', he: 'כלי Ocf Ratio' } }
    ]
  },
  {
    group: { en: 'Additional Tools 5', he: 'כלים נוספים 5' },
    items: [
      { id: 'operatingMargin', icon: Calculator, label: { en: 'Operating Margin', he: 'Operating Margin' }, desc: { en: 'Operating Margin tool', he: 'כלי Operating Margin' } },
      { id: 'paybackPeriod', icon: Calculator, label: { en: 'Payback Period', he: 'Payback Period' }, desc: { en: 'Payback Period tool', he: 'כלי Payback Period' } },
      { id: 'peRatio', icon: Calculator, label: { en: 'Pe Ratio', he: 'Pe Ratio' }, desc: { en: 'Pe Ratio tool', he: 'כלי Pe Ratio' } },
      { id: 'pegRatio', icon: Calculator, label: { en: 'Peg Ratio', he: 'Peg Ratio' }, desc: { en: 'Peg Ratio tool', he: 'כלי Peg Ratio' } },
      { id: 'piotroskiFScore', icon: Calculator, label: { en: 'Piotroski F Score', he: 'Piotroski F Score' }, desc: { en: 'Piotroski F Score tool', he: 'כלי Piotroski F Score' } },
      { id: 'pretaxMargin', icon: Calculator, label: { en: 'Pretax Margin', he: 'Pretax Margin' }, desc: { en: 'Pretax Margin tool', he: 'כלי Pretax Margin' } },
      { id: 'priceToBook', icon: Calculator, label: { en: 'Price To Book', he: 'Price To Book' }, desc: { en: 'Price To Book tool', he: 'כלי Price To Book' } },
      { id: 'priceToCashFlow', icon: Calculator, label: { en: 'Price To Cash Flow', he: 'Price To Cash Flow' }, desc: { en: 'Price To Cash Flow tool', he: 'כלי Price To Cash Flow' } },
      { id: 'priceToSales', icon: Calculator, label: { en: 'Price To Sales', he: 'Price To Sales' }, desc: { en: 'Price To Sales tool', he: 'כלי Price To Sales' } },
      { id: 'profitMargin', icon: Calculator, label: { en: 'Profit Margin', he: 'Profit Margin' }, desc: { en: 'Profit Margin tool', he: 'כלי Profit Margin' } },
      { id: 'pv', icon: Calculator, label: { en: 'Pv', he: 'Pv' }, desc: { en: 'Pv tool', he: 'כלי Pv' } },
      { id: 'quickRatio', icon: Calculator, label: { en: 'Quick Ratio', he: 'Quick Ratio' }, desc: { en: 'Quick Ratio tool', he: 'כלי Quick Ratio' } },
      { id: 'realInterestRate', icon: Calculator, label: { en: 'Real Interest Rate', he: 'Real Interest Rate' }, desc: { en: 'Real Interest Rate tool', he: 'כלי Real Interest Rate' } },
      { id: 'rentVsBuy', icon: Calculator, label: { en: 'Rent Vs Buy', he: 'Rent Vs Buy' }, desc: { en: 'Rent Vs Buy tool', he: 'כלי Rent Vs Buy' } },
      { id: 'rentalYield', icon: Calculator, label: { en: 'Rental Yield', he: 'Rental Yield' }, desc: { en: 'Rental Yield tool', he: 'כלי Rental Yield' } },
      { id: 'retentionRatio', icon: Calculator, label: { en: 'Retention Ratio', he: 'Retention Ratio' }, desc: { en: 'Retention Ratio tool', he: 'כלי Retention Ratio' } },
      { id: 'retirement', icon: Calculator, label: { en: 'Retirement', he: 'Retirement' }, desc: { en: 'Retirement tool', he: 'כלי Retirement' } },
      { id: 'rmd', icon: Calculator, label: { en: 'Rmd', he: 'Rmd' }, desc: { en: 'Rmd tool', he: 'כלי Rmd' } },
      { id: 'roa', icon: Calculator, label: { en: 'Roa', he: 'Roa' }, desc: { en: 'Roa tool', he: 'כלי Roa' } },
      { id: 'roe', icon: Calculator, label: { en: 'Roe', he: 'Roe' }, desc: { en: 'Roe tool', he: 'כלי Roe' } }
    ]
  },
  {
    group: { en: 'Additional Tools 6', he: 'כלים נוספים 6' },
    items: [
      { id: 'roic', icon: Calculator, label: { en: 'Roic', he: 'Roic' }, desc: { en: 'Roic tool', he: 'כלי Roic' } },
      { id: 'rsi', icon: Calculator, label: { en: 'Rsi', he: 'Rsi' }, desc: { en: 'Rsi tool', he: 'כלי Rsi' } },
      { id: 'ruleOf72', icon: Calculator, label: { en: 'Rule Of72', he: 'Rule Of72' }, desc: { en: 'Rule Of72 tool', he: 'כלי Rule Of72' } },
      { id: 'ruleOf78', icon: Calculator, label: { en: 'Rule Of78', he: 'Rule Of78' }, desc: { en: 'Rule Of78 tool', he: 'כלי Rule Of78' } },
      { id: 'salaryHourly', icon: Calculator, label: { en: 'Salary Hourly', he: 'Salary Hourly' }, desc: { en: 'Salary Hourly tool', he: 'כלי Salary Hourly' } },
      { id: 'sharpeRatio', icon: Calculator, label: { en: 'Sharpe Ratio', he: 'Sharpe Ratio' }, desc: { en: 'Sharpe Ratio tool', he: 'כלי Sharpe Ratio' } },
      { id: 'sinkingFund', icon: Calculator, label: { en: 'Sinking Fund', he: 'Sinking Fund' }, desc: { en: 'Sinking Fund tool', he: 'כלי Sinking Fund' } },
      { id: 'sma', icon: Calculator, label: { en: 'Sma', he: 'Sma' }, desc: { en: 'Sma tool', he: 'כלי Sma' } },
      { id: 'stockAverage', icon: Calculator, label: { en: 'Stock Average', he: 'Stock Average' }, desc: { en: 'Stock Average tool', he: 'כלי Stock Average' } },
      { id: 'sustainableGrowth', icon: Calculator, label: { en: 'Sustainable Growth', he: 'Sustainable Growth' }, desc: { en: 'Sustainable Growth tool', he: 'כלי Sustainable Growth' } },
      { id: 'taxEquivalentYield', icon: Calculator, label: { en: 'Tax Equivalent Yield', he: 'Tax Equivalent Yield' }, desc: { en: 'Tax Equivalent Yield tool', he: 'כלי Tax Equivalent Yield' } },
      { id: 'tieRatio', icon: Calculator, label: { en: 'Tie Ratio', he: 'Tie Ratio' }, desc: { en: 'Tie Ratio tool', he: 'כלי Tie Ratio' } },
      { id: 'timesInterestEarned', icon: Calculator, label: { en: 'Times Interest Earned', he: 'Times Interest Earned' }, desc: { en: 'Times Interest Earned tool', he: 'כלי Times Interest Earned' } },
      { id: 'tip', icon: Calculator, label: { en: 'Tip', he: 'Tip' }, desc: { en: 'Tip tool', he: 'כלי Tip' } },
      { id: 'vat', icon: Calculator, label: { en: 'Vat', he: 'Vat' }, desc: { en: 'Vat tool', he: 'כלי Vat' } },
      { id: 'workingCapital', icon: Calculator, label: { en: 'Working Capital', he: 'Working Capital' }, desc: { en: 'Working Capital tool', he: 'כלי Working Capital' } },
      { id: 'ytm', icon: Calculator, label: { en: 'Ytm', he: 'Ytm' }, desc: { en: 'Ytm tool', he: 'כלי Ytm' } }
    ]
  }
];

export default function AnalyticalCenter({ 
  transactions, 
  accounts, 
  projects = [], 
  bills = [], 
  invoices = [], 
  filterCriteria, 
  onAction, 
  metrics: passedMetrics 
}: AnalyticalCenterProps) {
  
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
  
  // High efficiency metrics calculations
  const metrics = useAuditTelemetry(transactions, accounts, timeRange, (timeRange === 30) ? passedMetrics : undefined);

  // Active channel attributes lookup
  const activeChannelDef = useMemo(() => {
    for (const group of CHANNELS) {
      const match = group.items.find((item: any) => item.id === activeChannel);
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
      items: g.items.filter((i: any) => 
        i.label.en.toLowerCase().includes(searchTerm.toLowerCase()) || 
        i.desc.en.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (i.label.he && i.label.he.includes(searchTerm))
      )
    })).filter(g => g.items.length > 0);
  }, [searchTerm]);

  const activeChannelName = activeChannelDef.label[language] || activeChannelDef.label['en'];

  return (
    <div className="flex flex-col lg:flex-row h-full min-h-[660px] overflow-hidden bg-white border border-slate-200/80 rounded-[32px] shadow-sm relative text-slate-800 font-sans">
      
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
        <aside className="lg:w-72 border-r border-slate-200/80 bg-slate-50/70 hidden lg:flex flex-col h-full overflow-hidden shrink-0">
          
          {/* Executive identity header */}
          <div className="p-5 border-b border-slate-250/50 bg-[#fafbfe]/80 shrink-0 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 bg-indigo-600 rounded-lg flex items-center justify-center text-white shrink-0">
                  <Target size={14} className="stroke-[2.5px]" />
                </div>
                <div>
                  <h2 className="text-xs font-bold text-slate-800 leading-snug">Advanced Overview</h2>
                  <p className="text-[9px] font-mono font-medium text-slate-400">Financial Metrics</p>
                </div>
              </div>
              
              {/* Stability Node Pulse */}
              <div className="flex items-center gap-1 bg-emerald-50 border border-emerald-100/60 px-1.5 py-0.5 rounded-full select-none">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-60"></span>
                  <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500"></span>
                </span>
                <span className="text-[8px] font-bold font-mono tracking-wide text-emerald-800">SECURE</span>
              </div>
            </div>

            {/* Instant Filter Box */}
            <div className="relative">
              <input
                type="text"
                placeholder="Search analytics & auditing..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="w-full text-xs px-3 py-1.5 pl-8 bg-white border border-slate-200/85 hover:border-slate-300 focus:border-indigo-500 focus:outline-none rounded-lg transition-all focus:shadow-3xs text-slate-700"
              />
              <Search size={11} className="absolute left-2.5 top-2.5 text-slate-400" />
              {searchTerm && (
                <button onClick={() => setSearchTerm('')} className="absolute right-2 top-1.5 text-slate-400 hover:text-slate-600 font-mono text-[11px] px-1">
                  ×
                </button>
              )}
            </div>
          </div>

          {/* Categorized Options List as Cards */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar select-none">
            {filteredChannels.map((group, groupIdx) => (
              <div key={groupIdx} className="space-y-1">
                <div className="px-2 pb-1 flex items-center justify-between">
                  <span className="text-[8.5px] font-bold uppercase tracking-[0.12em] text-slate-400 block">
                    {group.group[language] || group.group['en']}
                  </span>
                  <span className="text-[8px] font-mono text-slate-300 font-semibold">{group.items.length} LENSES</span>
                </div>
                
                <div className="space-y-0.5">
                  {group.items.map((item: any) => {
                    const isActive = activeChannel === item.id;
                    const IconComponent = item.icon;
                    return (
                      <button
                        key={item.id}
                        onClick={() => setActiveChannel(item.id)}
                        className={cn(
                          "w-full flex items-start gap-2.5 px-3 py-2 rounded-lg text-left transition-all duration-150 border cursor-pointer group",
                          isActive
                            ? "bg-white border-slate-200 text-slate-800 shadow-3xs"
                            : "bg-transparent border-transparent text-slate-500 hover:bg-slate-200/35 hover:text-slate-800"
                        )}
                      >
                        <div className={cn(
                          "w-5 h-5 rounded-md flex items-center justify-center shrink-0 mt-0.5 transition-colors",
                          isActive ? "bg-indigo-50 text-indigo-650" : "bg-slate-100 text-slate-400 group-hover:bg-slate-200 group-hover:text-slate-600"
                        )}>
                          <IconComponent size={12} className="stroke-[2.2px]" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className={cn("text-[11.5px] leading-none tracking-tight transition-colors", isActive ? "font-bold text-slate-800" : "font-medium text-slate-700")}>
                            {item.label[language] || item.label['en']}
                          </p>
                          <p className="text-[9px] text-slate-400 mt-1 leading-normal font-medium truncate group-hover:text-slate-500 transition-colors">
                            {item.desc[language] || item.desc['en']}
                          </p>
                        </div>
                        {isActive && (
                          <div className="w-1 h-3 rounded-full bg-indigo-600 shrink-0 self-center" />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
            
            {filteredChannels.length === 0 && (
              <p className="text-center text-[10px] text-slate-400 font-mono py-6">No specific intelligence lenses matched.</p>
            )}
          </div>
          
          {/* Sidebar Footer with Workspace Stats summary info */}
          <div className="p-4 border-t border-slate-200 bg-[#f8fafc] shrink-0 text-[10px] space-y-1 font-mono text-slate-400">
             <div className="flex items-center justify-between">
               <span>Total Transactions</span>
               <span className="font-bold text-slate-700 tabular-nums">{transactions.length} items</span>
             </div>
             <div className="flex items-center justify-between">
               <span>Active Accounts</span>
               <span className="font-bold text-slate-700 tabular-nums">{accounts.length} nodes</span>
             </div>
          </div>
        </aside>
      )}

      {/* -------------------------------------------------------------
          2. Main Workspace Detail View (Pristine Canvas)
          ------------------------------------------------------------- */}
      <main className="flex-1 flex flex-col min-w-0 h-full overflow-hidden bg-white">
        
        {/* Dynamic header toolbar */}
        <header className="px-5 py-3 border-b border-slate-200 flex items-center justify-between shrink-0 bg-slate-50/50">
          <div className="flex items-center gap-3">
            {/* Mobile menu trigger */}
            <button 
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)} 
              className="lg:hidden p-1.5 border border-slate-250 hover:bg-slate-100 text-slate-600 rounded-lg shrink-0 cursor-pointer"
              title="Toggle Menu"
            >
              <Menu size={14} />
            </button>

            {/* Display active state details */}
            <div className="space-y-0.5">
              <div className="flex items-center gap-1">
                <span className="text-[9px] font-bold text-indigo-650 uppercase tracking-widest">{(activeChannelDef as any).badge || "PRO"}</span>
                <ChevronRight size={10} className="text-slate-350" />
                <span className="text-[9px] font-semibold text-slate-450 uppercase tracking-wider">{activeChannelDef.id} lens</span>
              </div>
              <h1 className="text-sm font-bold tracking-tight text-slate-800 flex items-center gap-1.5 leading-none">
                <activeChannelDef.icon size={14} className="text-indigo-600 shrink-0" />
                <span>{activeChannelName}</span>
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Time interval selection pills */}
            <div className="flex bg-slate-100 p-0.5 rounded-lg border border-slate-200/80 shrink-0">
              {[30, 90, 365].map(days => (
                <button
                  key={days}
                  onClick={() => setTimeRange(days)}
                  className={cn(
                    "px-2.5 py-0.5 rounded-md text-[9px] font-bold uppercase tracking-wider cursor-pointer whitespace-nowrap",
                    timeRange === days ? "bg-white text-slate-800 border border-slate-100 shadow-3xs" : "text-slate-500 hover:text-slate-800"
                  )}
                >
                  {days}D
                </button>
              ))}
            </div>

            {/* Minimal focus controller */}
            <button
              onClick={() => onAction?.('toggle-focus-mode')}
              title={isFocusMode ? "Standard Workspace View" : "Maximize Intelligence Lens"}
              className="p-1.5 border border-slate-200 hover:bg-slate-50 rounded-lg text-slate-500 hover:text-slate-800 shadow-3xs cursor-pointer transition-all shrink-0"
            >
              {isFocusMode ? <Minimize2 size={12} /> : <Maximize2 size={12} />}
            </button>

            {/* Export data trigger */}
            <button 
              onClick={() => onAction?.('export', { transactions })} 
              className="px-2.5 py-1.5 bg-slate-900 hover:bg-indigo-600 text-white rounded-lg text-[9px] font-bold uppercase tracking-wider transition-all shadow-3xs flex items-center gap-1.5 shrink-0 cursor-pointer"
            >
              <Download size={10} /> 
              <span>Export</span>
            </button>
          </div>
        </header>

        {/* -------------------------------------------------------------
            3. Workspace Canvas View: Unified, single scrolling layer
            ------------------------------------------------------------- */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 custom-scrollbar bg-slate-50/30 lens-canvas-wrapper">
          
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
                  <div className="p-4 bg-white border border-slate-200/80 rounded-xl shadow-3xs flex flex-col justify-between hover:border-slate-350 transition-colors">
                    <div className="flex items-center justify-between text-slate-400 mb-2">
                      <span className="text-[8.5px] font-bold uppercase tracking-wider text-slate-400">Data Integrity</span>
                      <ShieldCheck size={14} className="text-emerald-500" />
                    </div>
                    <div className="space-y-0.5">
                      <p className="text-lg font-black text-slate-800 leading-none">
                        {integrityStatus.isConsistent ? 'VERIFIED' : 'VARIANCE'}
                      </p>
                      <p className="text-[9px] text-slate-500 font-mono tracking-tight leading-normal">
                        {transactions.length} secure trace logs
                      </p>
                    </div>
                  </div>

                  {/* Card 2: Enterprise Viability Score */}
                  <div className="p-4 bg-white border border-slate-200/80 rounded-xl shadow-3xs flex flex-col justify-between hover:border-slate-350 transition-colors">
                    <div className="flex items-center justify-between text-slate-400 mb-2">
                      <span className="text-[8.5px] font-bold uppercase tracking-wider">Health Score</span>
                      <Sparkles size={14} className="text-indigo-500" />
                    </div>
                    <div className="space-y-1.5">
                      <p className="text-lg font-black text-slate-800 leading-none">
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
                  <div className="p-4 bg-white border border-slate-200/80 rounded-xl shadow-3xs flex flex-col justify-between hover:border-slate-350 transition-colors">
                    <div className="flex items-center justify-between text-slate-400 mb-2">
                      <span className="text-[8.5px] font-bold uppercase tracking-wider">Estimated Runway</span>
                      <Calendar size={14} className="text-amber-500" />
                    </div>
                    <div className="space-y-0.5">
                      <p className="text-lg font-black text-slate-800 leading-none">
                        {metrics.kpis.runwayMonths.toFixed(1)} Months
                      </p>
                      <p className="text-[9px] text-slate-500 font-mono tracking-tight leading-normal">
                        At ${Math.round((metrics.kpis.burnRate * 30) / 100).toLocaleString()}/Mo burn
                      </p>
                    </div>
                  </div>

                  {/* Card 4: Index Volatility */}
                  <div className="p-4 bg-white border border-slate-200/80 rounded-xl shadow-3xs flex flex-col justify-between hover:border-slate-350 transition-colors">
                    <div className="flex items-center justify-between text-slate-400 mb-2">
                      <span className="text-[8.5px] font-bold uppercase tracking-wider">Trend Volatility</span>
                      <Flame size={14} className="text-rose-500" />
                    </div>
                    <div className="space-y-0.5">
                      <p className="text-lg font-black text-slate-800 leading-none">
                        {metrics.kpis.volatility.toFixed(1)}%
                      </p>
                      <p className="text-[9px] text-slate-500 font-mono tracking-tight leading-normal">
                        Cashflow trend deviation
                      </p>
                    </div>
                  </div>

                </div>

                {/* Primary Radar grid + Insights (Side-by-Side Bento) */}
                <div className="grid grid-cols-1 xl:grid-cols-12 gap-5 items-start">
                  
                  {/* Radar Performance Web Grid */}
                  <div className="xl:col-span-7 bg-white border border-slate-200/80 rounded-[32px] p-5 flex flex-col justify-between shadow-3xs min-h-[420px]">
                     <div className="pb-3 border-b border-slate-100 flex items-center justify-between">
                        <div>
                           <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Metric Distribution Web</h3>
                           <p className="text-[9px] text-slate-400">Comparative metrics across baseline dimensions</p>
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

                     <div className="pt-3 border-t border-slate-100 grid grid-cols-3 gap-2 text-center bg-slate-50/50 -mx-5 -mb-5 rounded-b-2xl p-3">
                        <div>
                           <p className="text-[8.5px] font-bold text-slate-400 uppercase tracking-wider">Quick Liquidity</p>
                           <p className="text-xs font-bold text-indigo-600 mt-0.5">{(metrics?.kpis?.currentRatio || 0).toFixed(2)}x</p>
                        </div>
                        <div>
                           <p className="text-[8.5px] font-bold text-slate-400 uppercase tracking-wider">Compliance</p>
                           <p className="text-xs font-bold text-emerald-600 mt-0.5">{metrics?.kpis?.complianceScore || 0}%</p>
                        </div>
                        <div>
                           <p className="text-[8.5px] font-bold text-slate-400 uppercase tracking-wider">Yield Factor</p>
                           <p className="text-xs font-bold text-slate-800 mt-0.5">{metrics?.kpis?.yieldEfficiency || 0}%</p>
                        </div>
                     </div>
                  </div>

                  {/* Refined clean actionable summary list (Clean typography) */}
                  <div className="xl:col-span-5 bg-white border border-slate-200/80 rounded-[32px] p-5 shadow-3xs h-[420px] flex flex-col justify-between">
                     <div className="space-y-4">
                        <div className="flex items-center gap-2 pb-2.5 border-b border-slate-100">
                          <BrainCircuit size={15} className="text-indigo-600 shrink-0" />
                          <h3 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider">Key Metrics Summary</h3>
                        </div>
                        
                        <div className="space-y-3.5">
                           {[
                             { 
                               title: 'Runway Estimate', 
                               text: `Healthy reserves to support ${metrics.kpis.runwayMonths.toFixed(1)} months of activity without adjustments.`, 
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
                           ].map((item: any, i: number) => (
                             <div key={i} className={cn("p-2.5 border-l-2 bg-slate-50/50 rounded-r-lg space-y-1.5 transition-all hover:bg-slate-50", item.color)}>
                               <div className="flex items-center justify-between">
                                 <span className="text-[10px] font-bold text-slate-850">{item.title}</span>
                                 <span className="text-[8px] font-mono font-black tracking-wider uppercase bg-white border px-1.5 py-0.5 rounded-sm text-slate-500">
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
                        <Info size={13} className="text-indigo-600 shrink-0 mt-0.5" />
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
                   <div className="p-5 bg-white border border-slate-200/80 rounded-[32px] shadow-3xs flex flex-col h-[320px]">
                      <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-3 pb-2 border-b border-slate-100">Project Raw Revenue & Profit Matrix</h4>
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
                                 formatter={(val: any) => [`$${val.toLocaleString()}`, 'Profit']}
                               />
                               <Bar dataKey="profit" fill="#6366f1" radius={[3, 3, 0, 0]} />
                            </BarChart>
                         </ResponsiveContainer>
                      </div>
                      <p className="text-[8px] font-mono text-slate-400 uppercase text-center mt-3 tracking-wider">Click columns to filter transaction explorer down to project bounds</p>
                   </div>

                   <div className="p-5 bg-white border border-slate-200/80 rounded-[32px] shadow-3xs flex flex-col h-[320px]">
                      <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-3 pb-2 border-b border-slate-100">Relative Profit Margins</h4>
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
                                 formatter={(val: any) => [`${parseFloat(val).toFixed(1)}%`, 'Operational Margin']} 
                               />
                               <Area type="monotone" dataKey="margin" stroke="#10b981" strokeWidth={1.8} fillOpacity={1} fill="url(#marginColorGrad)" />
                            </AreaChart>
                         </ResponsiveContainer>
                      </div>
                      <p className="text-[8px] font-mono text-slate-400 uppercase text-center mt-3 tracking-wider">Dynamic mathematical ratio derived from live journal lines</p>
                   </div>
                </div>

                {/* Strategic Profitability List */}
                <div className="p-5 bg-white border border-slate-200/80 rounded-[32px] shadow-3xs">
                   <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-3">Enterprise Segment Allocations Performance</h4>
                   <div className="space-y-2">
                      {projectStats.map((p, i) => (
                         <div key={i} className="flex flex-col sm:flex-row sm:items-center justify-between p-3 bg-slate-50/50 border border-slate-200/60 rounded-xl hover:bg-slate-100/40 transition-colors gap-3">
                            <div className="flex items-center gap-3">
                               <div className="w-6 h-6 rounded bg-emerald-50 text-emerald-700 border border-emerald-100 flex items-center justify-center shrink-0">
                                  <TrendingUp size={11} className="stroke-[2.5px]" />
                               </div>
                               <div>
                                  <p className="text-xs font-bold text-slate-850">{p.name}</p>
                                  <p className="text-[9.5px] text-slate-500 mt-0.5 leading-none">
                                     Operating profit bounds: <span className="font-semibold text-slate-700">${p.profit.toLocaleString()}</span>
                                  </p>
                               </div>
                            </div>
                            
                            {/* Project profitability indicators */}
                            <div className="flex items-center gap-4">
                               <div className="flex flex-col items-end text-right">
                                  <span className="text-[10px] font-extrabold text-slate-800">{p.margin.toFixed(1)}% Margin</span>
                                  <span className="text-[8px] text-slate-400 uppercase tracking-wider">Ratio yield</span>
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
                        <p className="text-center text-[11px] text-slate-400 font-mono py-6">No enterprise segments categorized inside active ledger bounds.</p>
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
                <ForensicAuditor transactions={transactions} isEmbedded={true} />
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
                <EntityConsolidation />
              </motion.div>
            )}

            {/* ----------------- DYNAMIC REGISTRY REFERRED LENSES ----------------- */}
            {activeChannel !== 'radar' && activeChannel !== 'roi' && activeChannel !== 'forensics' && activeChannel !== 'entities' && (() => {
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
                      <React.Suspense fallback={
                        <div className="flex flex-col items-center justify-center p-16 space-y-3 bg-white border border-slate-200 rounded-[32px] min-h-[380px] text-center">
                          <Loader2 className="w-7 h-7 text-indigo-650 animate-spin shrink-0" />
                          <p className="text-[10px] uppercase font-mono font-bold tracking-widest text-slate-400">Restructuring Lens Component...</p>
                        </div>
                      }>
                        <Component 
                          transactions={transactions} 
                          accounts={accounts} 
                          computedAccounts={accounts} 
                          budgets={budgets} 
                          projects={projects}
                          isEmbedded={true}
                        />
                      </React.Suspense>
                    </motion.div>
                  );
                }
              }
              return (
                <div className="p-4 md:p-8 text-center bg-white border border-slate-200 rounded-[32px]">
                  <p className="text-slate-400 text-xs font-mono">Select a channel lens to align telemetry parameters.</p>
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
              className="lg:hidden absolute top-0 bottom-0 left-0 w-72 bg-white z-50 shadow-xl border-r border-slate-250 flex flex-col h-full"
            >
              <div className="p-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-1.5">
                  <Target size={14} className="text-indigo-650 stroke-[2.5px]" />
                  <span className="text-xs font-bold text-slate-800 tracking-tight">Advanced Overview</span>
                </div>
                <button 
                  onClick={() => setMobileMenuOpen(false)} 
                  className="p-1 border border-slate-200 hover:bg-slate-100 rounded-lg text-slate-500 cursor-pointer"
                >
                  <X size={13} />
                </button>
              </div>

              {/* Channels navigation selector */}
              <div className="flex-1 overflow-y-auto p-3 space-y-4 custom-scrollbar select-none">
                {CHANNELS.map((group, groupIdx) => (
                  <div key={groupIdx} className="space-y-1">
                    <span className="text-[8.5px] font-bold text-slate-400 uppercase tracking-widest px-2 block">
                      {group.group[language] || group.group['en']}
                    </span>
                    <div className="space-y-0.5">
                      {group.items.map((item: any) => {
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
                                ? "bg-slate-100/70 border-slate-200 text-slate-950 font-bold"
                                : "bg-transparent border-transparent text-slate-500 hover:bg-slate-50"
                            )}
                          >
                            <IconComponent size={13} className={cn(isActive ? "text-indigo-600" : "text-slate-400")} />
                            <span>{item.label[language] || item.label['en']}</span>
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
