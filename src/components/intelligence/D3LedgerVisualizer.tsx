import type { Transaction } from '../../types';

import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';

import { Activity } from 'lucide-react';

import { select } from 'd3-selection';
import { scaleBand, scaleLinear } from 'd3-scale';
import { max } from 'd3-array';
import { axisBottom, axisLeft } from 'd3-axis';
import { area, line, curveMonotoneX } from 'd3-shape';

export const D3LedgerVisualizer = ({ data }: { data: (Transaction & { category?: string })[] }) => {
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
