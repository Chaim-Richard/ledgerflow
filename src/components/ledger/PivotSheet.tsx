import React, { useState, useMemo } from 'react';
import { Transaction } from '../../types';
import { 
  Table as TableIcon, 
  Search, 
  Download, 
  ChevronDown, 
  ChevronRight,
  Calculator,
  Grid3X3,
  ListCollapse,
  Plus
} from 'lucide-react';
import { formatDecimal, cn, formatCurrency, sanitizeCsvCell, resolveAccountName } from '../../lib/utils';
import { getLineDimension, DEFAULT_WORKSPACE_DIMENSIONS } from '../../lib/dimensionUtils';
import { useAuthStore } from '../../stores/useAuthStore';
import { useLedgerStore } from '../../stores/useLedgerStore';

interface PivotSheetProps {
  transactions: Transaction[];
  isEmbedded?: boolean;
}

type GroupBy = string; // Dynamic dimension ID or 'month' | 'payee'
type PivotMode = 'flat' | 'matrix';

export default function PivotSheet({ transactions, isEmbedded = false }: PivotSheetProps) {
  const currentWorkspace = useAuthStore(s => s.getCurrentWorkspace());
  const accounts = useLedgerStore(s => s.accounts);
  const activeDimensions = useMemo(() => {
    const custom = currentWorkspace?.dimensions || DEFAULT_WORKSPACE_DIMENSIONS;
    const baseIds = custom.map(d => ({ id: d.id, name: d.name }));
    return [
      ...baseIds,
      { id: 'month', name: 'Month' },
      { id: 'payee', name: 'Payee' }
    ];
  }, [currentWorkspace]);

  const [pivotMode, setPivotMode] = useState<PivotMode>('flat');
  const [rowDim, setRowDim] = useState<GroupBy>('category');
  const [colDim, setColDim] = useState<GroupBy>('month');
  const [groupBy, setGroupBy] = useState<GroupBy>('category');
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  const toggleGroup = (groupId: string) => {
    const newExpanded = new Set(expandedGroups);
    if (newExpanded.has(groupId)) {
      newExpanded.delete(groupId);
    } else {
      newExpanded.add(groupId);
    }
    setExpandedGroups(newExpanded);
  };

  // Helper code to map a Transaction to a group key representation using dynamic dimension resolver
  const getDimensionValue = (t: Transaction, dim: GroupBy): string => {
    if (dim === 'payee') {
      return t.payee || t.description || 'Direct Entry';
    }
    if (dim === 'month') {
      if (!t.date) return 'Unknown Date';
      const parts = t.date.split('-');
      if (parts.length < 2) return 'Unknown Date';
      const d = new Date(Number(parts[0]), Number(parts[1]) - 1, 1);
      return d.toLocaleString('default', { month: 'short', year: 'numeric' });
    }

    // Try line-level dimension resolution
    const lineVal = t.lines?.[0] ? getLineDimension(t.lines[0], t, dim) : 'Unassigned';
    return lineVal || 'Unassigned';
  };

  // 1. FLAT MODE COMPILATION (O(N) List Aggregate)
  const groupedData = useMemo(() => {
    const groups: Record<string, { total: number, items: Transaction[] }> = {};
    
    transactions.forEach(t => {
      const key = getDimensionValue(t, groupBy);

      if (searchTerm && 
          !key.toLowerCase().includes(searchTerm.toLowerCase()) && 
          !t.description.toLowerCase().includes(searchTerm.toLowerCase())) {
        return;
      }

      if (!groups[key]) groups[key] = { total: 0, items: [] };
      groups[key].total += t.totalAmountCents;
      groups[key].items.push(t);
    });

    return Object.entries(groups).sort((a, b) => Math.abs(b[1].total) - Math.abs(a[1].total));
  }, [transactions, groupBy, searchTerm]);

  // 2. CROSS-TAB MATRIX MODE COMPILATION
  const matrixData = useMemo(() => {
    if (pivotMode !== 'matrix') return { rows: [], cols: [], cells: {}, rowTotals: {}, colTotals: {}, grandTotal: 0 };

    const cells: Record<string, Record<string, number>> = {};
    const rowTotals: Record<string, number> = {};
    const colTotals: Record<string, number> = {};
    let grandTotal = 0;

    const rowKeys = new Set<string>();
    const colKeys = new Set<string>();

    transactions.forEach(t => {
      const rKey = getDimensionValue(t, rowDim);
      const cKey = getDimensionValue(t, colDim);

      if (searchTerm && 
          !rKey.toLowerCase().includes(searchTerm.toLowerCase()) && 
          !cKey.toLowerCase().includes(searchTerm.toLowerCase())) {
        return;
      }

      rowKeys.add(rKey);
      colKeys.add(cKey);

      if (!cells[rKey]) cells[rKey] = {};
      if (!cells[rKey][cKey]) cells[rKey][cKey] = 0;

      cells[rKey][cKey] += t.totalAmountCents;
      
      rowTotals[rKey] = (rowTotals[rKey] || 0) + t.totalAmountCents;
      colTotals[cKey] = (colTotals[cKey] || 0) + t.totalAmountCents;
      grandTotal += t.totalAmountCents;
    });

    const sortedRows = Array.from(rowKeys).sort((a, b) => Math.abs(rowTotals[b]) - Math.abs(rowTotals[a]));
    
    // Sort columns chronologically if month, else alphanumeric
    const sortedCols = Array.from(colKeys).sort((a, b) => {
      if (colDim === 'month') {
        const parseMonth = (s: string) => {
          const parts = s.split(' ');
          if (parts.length < 2) return 0;
          const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
          const mIdx = months.indexOf(parts[0]);
          return Number(parts[1]) * 12 + (mIdx !== -1 ? mIdx : 0);
        };
        return parseMonth(a) - parseMonth(b);
      }
      return a.localeCompare(b);
    });

    return {
      rows: sortedRows,
      cols: sortedCols,
      cells,
      rowTotals,
      colTotals,
      grandTotal
    };

  }, [transactions, pivotMode, rowDim, colDim, searchTerm]);

  return (
    <div className={cn(
      "flex flex-col h-full bg-[var(--surface)] animate-fadeIn text-left",
      isEmbedded ? "p-0 border-0 shadow-none rounded-[32px]" : "border border-[var(--line)] rounded-[32px] overflow-hidden shadow-2xl"
    )}>
      {/* Spreadsheet Controller Topbar */}
      <div className="border-b border-[var(--line)] bg-[var(--ink)]/70 p-5 space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
             <div className="p-2 bg-slate-900 text-white rounded-xl">
                <TableIcon size={16} />
             </div>
             <div>
                <h3 className="text-sm font-bold text-[var(--text)] uppercase tracking-tight leading-none">Spreadsheet Pivot Matrix</h3>
                <p className="text-[9.5px] text-slate-400 font-mono tracking-tight mt-1">Cross-tabulation & Dimension Aggregator</p>
             </div>
          </div>
          
          <div className="flex flex-wrap items-center gap-3">
             {/* Mode Selector */}
             <div className="flex p-0.5 bg-[var(--panel)] border border-[var(--line)] rounded-xl shrink-0">
                <button
                  type="button"
                  onClick={() => setPivotMode('flat')}
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[9.5px] font-bold uppercase tracking-wider transition-all cursor-pointer",
                    pivotMode === 'flat' ? "bg-[var(--brass)] text-black shadow-3xs" : "text-[var(--muted)] hover:text-[var(--text)]"
                  )}
                >
                  <ListCollapse size={11} />
                  <span>Flat View</span>
                </button>
                <button
                  type="button"
                  onClick={() => setPivotMode('matrix')}
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[9.5px] font-bold uppercase tracking-wider transition-all cursor-pointer",
                    pivotMode === 'matrix' ? "bg-[var(--brass)] text-black shadow-3xs" : "text-[var(--muted)] hover:text-[var(--text)]"
                  )}
                >
                  <Grid3X3 size={11} />
                  <span>Cross-Tab Matrix</span>
                </button>
             </div>

             {/* Export Data Button */}
             <button 
               type="button"
               onClick={() => {
                 if (transactions.length === 0) return;
                 const headers = ['Date', 'Description', 'Payee', 'Category', 'Amount (USD)'];
                 const rows = transactions.map(t => [
                   t.date,
                   `"${t.description.replace(/"/g, '""')}"`,
                   `"${(t.payee || '').replace(/"/g, '""')}"`,
                   `"${resolveAccountName(accounts, t.lines[0]?.accountId, t.lines[0]?.accountName).replace(/"/g, '""')}"`,
                   formatDecimal(t.totalAmountCents)
                 ]);
                 const csvString = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
                 const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
                 const url = URL.createObjectURL(blob);
                 const link = document.createElement('a');
                 link.href = url;
                 link.download = 'pivot_export.csv';
                 link.click();
                 URL.revokeObjectURL(url);
               }}
               className="h-9 px-3 border border-[var(--line)] hover:border-slate-350 bg-[var(--surface)] hover:bg-[var(--ink)] rounded-xl flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider transition-all cursor-pointer shrink-0"
             >
               <Download size={12} /> 
               <span>CSV</span>
             </button>
          </div>
        </div>

        {/* Filters and secondary dimension settings */}
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4 pt-1">
          <div className="flex flex-wrap items-center gap-4 text-left">
            {pivotMode === 'flat' ? (
              <div className="flex items-center gap-2">
                 <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Group Rows:</span>
                 <div className="flex flex-wrap gap-1">
                    {activeDimensions.map(dim => (
                      <button
                        key={dim.id}
                        type="button"
                        onClick={() => setGroupBy(dim.id)}
                        className={cn(
                          "px-3 py-1 bg-[var(--surface)] border rounded-lg text-[9px] font-bold uppercase tracking-wider transition-all cursor-pointer",
                          groupBy === dim.id 
                            ? "border-indigo-600 bg-indigo-50/50 text-indigo-750 font-bold" 
                            : "border-[var(--line)] hover:border-slate-350 text-slate-600"
                        )}
                      >
                        {dim.name}
                      </button>
                    ))}
                 </div>
              </div>
            ) : (
              <div className="flex flex-wrap items-center gap-4">
                <div className="flex items-center gap-2">
                   <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Rows (R):</span>
                   <div className="flex flex-wrap gap-1">
                      {activeDimensions.map(dim => (
                        <button
                          key={dim.id}
                          type="button"
                          onClick={() => setRowDim(dim.id)}
                          className={cn(
                            "px-2.5 py-1 bg-[var(--surface)] border rounded-lg text-[9px] font-bold uppercase tracking-wider transition-all cursor-pointer",
                            rowDim === dim.id 
                              ? "border-indigo-600 bg-indigo-50/50 text-indigo-750 font-bold" 
                              : "border-[var(--line)] hover:border-slate-300 text-slate-500"
                          )}
                        >
                          {dim.name}
                        </button>
                      ))}
                   </div>
                </div>

                <div className="flex items-center gap-2">
                   <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Columns (C):</span>
                   <div className="flex flex-wrap gap-1">
                      {activeDimensions.map(dim => (
                        <button
                          key={dim.id}
                          type="button"
                          disabled={rowDim === dim.id}
                          onClick={() => setColDim(dim.id)}
                          className={cn(
                            "px-2.5 py-1 bg-[var(--surface)] border rounded-lg text-[9px] font-bold uppercase tracking-wider transition-all cursor-pointer",
                            colDim === dim.id 
                              ? "border-indigo-600 bg-indigo-50/50 text-indigo-750 font-bold" 
                              : "border-[var(--line)] hover:border-slate-300 text-slate-500 disabled:opacity-40"
                          )}
                        >
                          {dim.name}
                        </button>
                      ))}
                   </div>
                </div>
              </div>
            )}
          </div>

          <div className="relative group">
             <Search size={12} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-[var(--text)] transition-colors" />
             <input 
               value={searchTerm}
               onChange={(e) => setSearchTerm(e.target.value)}
               placeholder="Search spreadsheet cells ..." 
               className="h-9 w-full sm:w-64 pl-9 pr-3 bg-[var(--surface)] border border-[var(--line)] hover:border-slate-300 rounded-xl text-[10.5px] font-medium outline-none focus:border-indigo-600 transition-all shadow-3xs"
             />
          </div>
        </div>
      </div>

      {/* Spreadsheet Body Canvas */}
      <div className="flex-1 overflow-auto custom-scrollbar bg-[var(--surface)]">
        {pivotMode === 'flat' ? (
          // Standard Hierarchical List View
          <table className="w-full border-collapse">
             <thead className="sticky top-0 z-20 bg-slate-55/90 backdrop-blur-md border-b border-[var(--line)] shadow-3xs">
                <tr className="text-left bg-[var(--ink)]">
                   <th className="px-6 py-3.5 text-[9.5px] font-bold text-slate-500 uppercase tracking-widest w-12 text-center">Collapse</th>
                   <th className="px-4 py-3.5 text-[9.5px] font-bold text-slate-500 uppercase tracking-widest min-w-[320px]">Dimension Name / Nodes</th>
                   <th className="px-4 py-3.5 text-[9.5px] font-bold text-slate-500 uppercase tracking-widest text-center">Count</th>
                   <th className="px-4 py-3.5 text-[9.5px] font-bold text-slate-500 uppercase tracking-widest">Type Category</th>
                   <th className="px-6 py-3.5 text-[9.5px] font-bold text-slate-500 uppercase tracking-widest text-right">Sum value</th>
                </tr>
             </thead>
             <tbody>
                {groupedData.map(([groupName, data], gIdx) => (
                  <React.Fragment key={groupName}>
                     <tr 
                       onClick={() => toggleGroup(groupName)}
                       className="group cursor-pointer hover:bg-[var(--ink)]/80 border-b border-[var(--line)] transition-colors bg-[var(--surface)] z-10 text-left"
                     >
                        <td className="px-6 py-3.5 text-center">
                           <div className="flex justify-center text-slate-400 group-hover:text-slate-700">
                             {expandedGroups.has(groupName) ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                           </div>
                        </td>
                        <td className="px-4 py-3.5">
                           <div className="flex items-center gap-3">
                              <span className="text-[10px] font-mono font-bold text-slate-400 w-5">{(gIdx + 1).toString().padStart(2, '0')}</span>
                              <span className="text-xs font-bold text-slate-850 uppercase tracking-tight">{groupName}</span>
                           </div>
                        </td>
                        <td className="px-4 py-3.5 text-center">
                           <span className="text-[9.5px] font-bold text-slate-500 px-2.5 py-0.5 bg-slate-100 rounded-md">
                             {data.items.length} lines
                           </span>
                        </td>
                        <td className="px-4 py-3.5">
                           <span className="text-[9px] font-mono font-bold text-slate-400 uppercase">
                             Aggregate Row Node
                           </span>
                        </td>
                        <td className="px-6 py-3.5 text-right font-mono text-xs font-bold">
                           <span className={data.total >= 0 ? "text-emerald-600" : "text-rose-600"}>
                              {formatCurrency(data.total)}
                           </span>
                        </td>
                     </tr>
                     
                     {/* Items Row inside Expanded Accordion */}
                     {expandedGroups.has(groupName) && data.items.map((t, tIdx) => (
                       <tr 
                         key={t.id}
                         className="border-b border-[var(--line)] bg-[var(--ink)]/25 hover:bg-[var(--ink)]/50 transition-colors text-left"
                       >
                          <td className="px-6 py-2.5 text-[8.5px] font-mono text-slate-300 text-center">{gIdx + 1}.{tIdx + 1}</td>
                          <td className="px-4 py-2.5">
                             <div className="flex flex-col">
                                <span className="text-[11.5px] font-medium text-[var(--text)]">{t.description}</span>
                                <span className="text-[8.5px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">{t.payee || 'Direct Ledger Entry'}</span>
                             </div>
                          </td>
                          <td className="px-4 py-2.5" />
                          <td className="px-4 py-2.5">
                             <span className="px-2 py-0.5 bg-[var(--surface)] border border-[var(--line)] rounded text-[8.5px] font-bold uppercase text-slate-500">
                                {resolveAccountName(accounts, t.lines[0]?.accountId, t.lines[0]?.accountName)}
                             </span>
                          </td>
                          <td className="px-6 py-2.5 text-right font-mono text-[11px] font-medium">
                             <span className={t.totalAmountCents >= 0 ? "text-emerald-500" : "text-rose-500"}>
                                {formatCurrency(t.totalAmountCents)}
                             </span>
                          </td>
                       </tr>
                     ))}
                  </React.Fragment>
                ))}
             </tbody>
          </table>
        ) : (
          // Advanced Matrix View (Intersection crosstab tabulation)
          <div className="w-full min-w-max pb-4">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-[var(--ink)] border-b border-[var(--line)]">
                  <th className="sticky left-0 z-30 bg-[var(--ink)] text-left px-6 py-4 text-[9.5px] font-bold text-slate-500 uppercase tracking-widest border-r border-[var(--line)] min-w-[200px]">
                    Row Dim / Column Dim
                  </th>
                  {matrixData.cols.map(cKey => (
                    <th key={cKey} className="px-4 py-4 text-[9.5px] font-bold text-slate-500 uppercase tracking-widest text-right font-mono border-r border-slate-150">
                      {cKey}
                    </th>
                  ))}
                  <th className="px-6 py-4 text-[9.5px] font-bold text-slate-700 uppercase tracking-widest text-right bg-slate-100/70">
                    Row Total
                  </th>
                </tr>
              </thead>
              <tbody>
                {matrixData.rows.map((rKey, rIdx) => {
                  const rowTotalVal = matrixData.rowTotals[rKey] || 0;
                  return (
                    <tr key={rKey} className="border-b border-slate-205 hover:bg-[var(--ink)]/40 text-left">
                      {/* Row Header - Sticky */}
                      <td className="sticky left-0 z-10 bg-[var(--surface)] group-hover:bg-[var(--ink)]/50 px-6 py-3 text-xs font-bold text-slate-850 uppercase tracking-tight border-r border-[var(--line)]">
                        <div className="flex items-center gap-2">
                           <span className="text-[8.5px] font-mono text-slate-400">R{(rIdx + 1).toString().padStart(2, '0')}</span>
                           <span className="truncate max-w-[170px]">{rKey}</span>
                        </div>
                      </td>
                      
                      {/* Matrix cells intersections */}
                      {matrixData.cols.map(cKey => {
                        const cellVal = matrixData.cells[rKey]?.[cKey] || 0;
                        return (
                          <td key={cKey} className="px-4 py-3 text-right font-mono text-[11px] border-r border-[var(--line)] font-medium">
                            {cellVal !== 0 ? (
                              <span className={cellVal >= 0 ? "text-emerald-500" : "text-rose-500"}>
                                 {formatCurrency(cellVal)}
                              </span>
                            ) : (
                              <span className="text-slate-300">-</span>
                            )}
                          </td>
                        );
                      })}

                      {/* Row Total Accumulator */}
                      <td className="px-6 py-3 text-right font-mono text-xs font-bold bg-[var(--ink)]/30">
                        <span className={rowTotalVal >= 0 ? "text-emerald-600" : "text-rose-600"}>
                           {formatCurrency(rowTotalVal)}
                        </span>
                      </td>
                    </tr>
                  );
                })}

                {/* Columns Totals Aggregated Footer */}
                <tr className="bg-slate-100/60 border-t border-slate-250 text-left font-black">
                  <td className="sticky left-0 z-10 bg-slate-150/70 px-6 py-4 text-[9.5px] font-bold text-[var(--text)] uppercase tracking-widest border-r border-[var(--line)]">
                    Grand Totals (C)
                  </td>
                  {matrixData.cols.map(cKey => {
                    const colTotalVal = matrixData.colTotals[cKey] || 0;
                    return (
                      <td key={cKey} className="px-4 py-4 text-right font-mono text-xs font-bold border-r border-slate-150">
                        <span className={colTotalVal >= 0 ? "text-emerald-600" : "text-rose-600"}>
                           {formatCurrency(colTotalVal)}
                        </span>
                      </td>
                    );
                  })}
                  
                  {/* Grand total intersection Cell */}
                  <td className="px-6 py-4 text-right font-mono text-xs font-black bg-slate-200/40">
                    <span className={matrixData.grandTotal >= 0 ? "text-emerald-700" : "text-rose-700"}>
                       {formatCurrency(matrixData.grandTotal)}
                    </span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        )}

        {/* Missing Elements Placeholders */}
        {((pivotMode === 'flat' && groupedData.length === 0) || (pivotMode === 'matrix' && matrixData.rows.length === 0)) && (
          <div className="p-24 text-center">
             <Calculator size={44} className="mx-auto text-slate-300 mb-4 stroke-[1.5px]" />
             <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">No matching transaction intersections matched.</p>
          </div>
        )}
      </div>

      {/* Spreadsheet Status Footer */}
      <div className="h-11 bg-slate-900 border-t border-slate-800 px-6 sm:px-8 flex items-center justify-between text-slate-400 font-mono text-[9px] shrink-0">
         <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
               <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
               <span className="text-slate-300 font-bold uppercase tracking-wider">COMPUTATIONAL MATRIX ENGINE LIVE</span>
            </div>
            <span className="hidden sm:inline">ROWS: {transactions.length} items</span>
            <span className="hidden sm:inline">GROUPS: {pivotMode === 'flat' ? groupedData.length : matrixData.rows.length} modes</span>
         </div>
         <div className="flex items-center gap-4 text-slate-500">
            <span>ZOOM: 100%</span>
            <span>DOM: GRID-V3</span>
         </div>
      </div>
    </div>
  );
}
