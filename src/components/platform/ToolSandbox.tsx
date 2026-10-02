import React, { useState, useMemo } from 'react';
import { motion } from 'motion/react';
import { X, Play, CheckCircle2, BarChart3, ListFilter, ArrowUpRight, Download, FileSpreadsheet, RotateCcw } from 'lucide-react';
import { Line, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ComposedChart } from 'recharts';
import { useLedgerStore } from '../../stores/useLedgerStore';
import { useUIStore } from '../../stores/useUIStore';
import { FINANCIAL_ALGORITHMS } from '../../lib/financial-algorithms';
import { buildAlgorithmContext } from '../../lib/algorithms/types';
import { exportToExcel } from '../../lib/excelExport';
import { getLocalDateISO } from '../../lib/utils';
import { useLedgerCollections } from '../../hooks/useLedgerCollections';

interface ToolSandboxProps {
  toolId: string;
  toolName: string;
  onClose: () => void;
}

export default function ToolSandbox({ toolId, toolName, onClose }: ToolSandboxProps) {
  const setActiveTab = useUIStore(state => state.setActiveTab);
  const transactions = useLedgerStore(state => state.transactions || []);
  const rawAccounts = useLedgerStore(state => state.accounts || []);
  const computedAccounts = useLedgerStore(state => state.computedAccounts || []);
  const accounts = computedAccounts.length > 0 ? computedAccounts : rawAccounts;
  const invoices = useLedgerStore(state => state.invoices || []);
  const bills = useLedgerStore(state => state.bills || []);
  const vendors = useLedgerStore(state => state.vendors || []);
  const employees = useLedgerStore(state => state.employees || []);
  const budgets = useLedgerStore(state => state.budgets || []);
  const customers = useLedgerStore(state => state.customers || []);
  const baseCurrency = useLedgerStore(state => state.baseCurrency || 'USD');
  useLedgerCollections('bills', 'budgets', 'customers', 'employees', 'invoices', 'vendors');
  const reportingCurrency = baseCurrency;
  
  const algorithm = useMemo(() => {
    if (FINANCIAL_ALGORITHMS[toolId]) return FINANCIAL_ALGORITHMS[toolId];
    const found = Object.values(FINANCIAL_ALGORITHMS).find(
      (a: any) => a.id === toolId || a.id?.replace(/_/g, '-') === toolId || a.id?.replace(/-/g, '_') === toolId
    );
    if (!found) throw new Error(`Unknown algorithm: ${toolId}`);
    return found;
  }, [toolId]);
  
  // Custom user inputs per algorithm
  const [prevAlgoId, setPrevAlgoId] = useState(algorithm.id);
  const [params, setParams] = useState<Record<string, any>>(() => {
    const init: Record<string, any> = {};
    algorithm.inputs.forEach((i: any) => init[i.key] = i.defaultValue);
    return init;
  });

  // Automatically reset parameters during render when switching active algorithm
  if (prevAlgoId !== algorithm.id) {
    setPrevAlgoId(algorithm.id);
    const init: Record<string, any> = {};
    algorithm.inputs.forEach((i: any) => init[i.key] = i.defaultValue);
    setParams(init);
  }

  // Re-run anytime params change, using REAL user dataset
  const results = useMemo(() => {
    const today = getLocalDateISO();
    const asOfDate = params.asOfDate || today;
    const rangeInput = algorithm.inputs.find((i: any) => i.kind === 'dateRange');
    const range = rangeInput ? params[rangeInput.key] : undefined;
    const period = range?.start && range?.end 
      ? { start: range.start, end: range.end } 
      : { start: '1970-01-01', end: asOfDate };

    const ctx = buildAlgorithmContext(
      transactions,
      accounts,
      asOfDate,
      period,
      reportingCurrency,
      { invoices, bills, vendors, employees, budgets, customers }
    );

    return algorithm.compute(ctx, params);
  }, [algorithm, transactions, accounts, params, invoices, bills, vendors, employees, budgets, customers, reportingCurrency]);

  // Derive dynamic table columns from rows
  const tableColumns = useMemo(() => {
    if (!results.rows || results.rows.length === 0) return [];
    const keys = Object.keys(results.rows[0]).filter(k => k !== 'id' && k !== 'sourceIds');
    return keys.map(key => ({
      key,
      label: key
        .replace(/([A-Z])/g, ' $1')
        .replace(/_/g, ' ')
        .replace(/^\w/, c => c.toUpperCase())
        .trim()
    }));
  }, [results.rows]);

  const handleExportXLSX = async () => {
    if (!results.rows || results.rows.length === 0) return;

    const columns = Object.keys(results.rows[0])
      .filter(k => k !== 'id' && k !== 'sourceIds')
      .map(key => ({
        header: key.replace(/([A-Z])/g, ' $1').replace(/_/g, ' ').replace(/^\w/, c => c.toUpperCase()).trim(),
        key,
        width: 20
      }));

    const sanitizedName = algorithm.name.replace(/[^a-zA-Z0-9_-]/g, '_');
    await exportToExcel(columns, results.rows, {
      sheetName: 'Report',
      fileName: `${sanitizedName}_${getLocalDateISO()}.xlsx`
    });
  };

  const handleExportCSV = () => {
    if (!results.rows || results.rows.length === 0) return;
    const columns = Object.keys(results.rows[0]).filter(k => k !== 'id' && k !== 'sourceIds');
    const headers = columns.join(',');
    const rows = results.rows.map(row => 
      columns.map(col => {
        const val = row[col];
        const str = val !== undefined && val !== null ? String(val) : '';
        return str.includes(',') ? `"${str.replace(/"/g, '""')}"` : str;
      }).join(',')
    );
    const csv = [headers, ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    const sanitizedName = algorithm.name.replace(/[^a-zA-Z0-9_-]/g, '_');
    link.setAttribute('download', `${sanitizedName}_${getLocalDateISO()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 bg-[#0c0d0e]/60 backdrop-blur-md z-[100] flex items-center justify-center p-4 md:p-4 md:p-8"
    >
      <motion.div 
        initial={{ scale: 0.95, y: 15 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 15 }}
        transition={{ type: "spring", damping: 25, stiffness: 180 }}
        className="bg-[#fafafa] dark:bg-[#161718] border border-[var(--line)] rounded-[32px] w-full max-w-6xl h-[85dvh] flex flex-col overflow-hidden shadow-2xl relative"
      >
        <div className="flex items-center justify-between px-8 py-6 border-b border-[var(--line)] bg-[var(--surface)] dark:bg-[#1b1c1d]">
          <div className="flex items-center gap-3">
             <div className="w-10 h-10 bg-slate-900 text-emerald-400 rounded-xl flex items-center justify-center font-mono font-black text-xs border border-[var(--line)]">
                {toolId}
             </div>
             <div>
                <div className="flex items-center gap-2">
                   <h2 className="text-xl font-black uppercase italic text-[var(--text)] dark:text-white tracking-tight leading-none">{algorithm.name}</h2>
                   <span className="hidden sm:inline-block px-2 py-0.5 bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 text-[8px] font-medium uppercase tracking-wider rounded">
                     Real-Time Data Connected
                   </span>
                </div>
                <p className="text-[10px] uppercase font-bold tracking-widest text-[#8a8a8f] dark:text-neutral-400 mt-1">
                   {algorithm.description}
                </p>
             </div>
          </div>
          <button aria-label="Close" onClick={onClose} className="p-3 bg-neutral-100 dark:bg-neutral-800 text-slate-500 rounded-xl transition-all cursor-pointer hover:bg-neutral-200"><X size={16} /></button>
        </div>

        <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
           {/* Parameters Pane */}
           <div className="w-full md:w-80 border-b md:border-r md:border-b-0 border-[var(--line)] bg-[var(--surface)] dark:bg-[#1b1c1d] flex flex-col shrink-0">
              <div className="p-6 border-b border-[var(--line)] flex items-center justify-between">
                 <div>
                    <h3 className="text-xs font-black uppercase tracking-wider text-[var(--text)] dark:text-white flex items-center gap-2">
                       <Play size={14} className="text-indigo-600" /> Analysis Parameters
                    </h3>
                    <p className="text-[10px] text-[var(--muted)] uppercase tracking-wider mt-1 opacity-60">Tune computational vectors</p>
                 </div>
                 <button
                    type="button"
                    title="Reset to defaults"
                    onClick={() => {
                      const init: Record<string, any> = {};
                      algorithm.inputs.forEach((i: any) => init[i.key] = i.defaultValue);
                      setParams(init);
                    }}
                    className="p-1.5 rounded-lg border border-[var(--line)] hover:bg-[var(--line)] text-[var(--muted)] hover:text-[var(--text)] transition-colors cursor-pointer flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider"
                 >
                    <RotateCcw size={12} /> Reset
                 </button>
              </div>
              <div className="flex-1 overflow-y-auto p-6 space-y-6">
                 {algorithm.inputs.map((inp: any) => {
                    const kind = inp.kind || 'number';
                    
                    return (
                      <div key={inp.key} className="space-y-3">
                         <div className="flex justify-between items-center text-xs font-bold font-mono">
                            <span className="text-[10px] text-[#8a8a8f] uppercase tracking-wider font-sans">{inp.label}</span>
                            {kind === 'number' && (
                              <span className="text-[var(--text)] dark:text-white">{params[inp.key]}</span>
                            )}
                         </div>
                         
                         {kind === 'number' && (
                           <input 
                             type="range" min={inp.min} max={inp.max} step={inp.step} 
                             value={params[inp.key]} 
                             onChange={e => setParams({...params, [inp.key]: Number(e.target.value)})}
                             className="w-full accent-ledger-ink"
                           />
                         )}

                         {kind === 'boolean' && (
                           <button
                             type="button"
                             onClick={() => setParams({...params, [inp.key]: !params[inp.key]})}
                             className="w-full text-left p-2 border border-[var(--line)] rounded-lg bg-[var(--panel)] hover:bg-[var(--surface)] text-[var(--text)] text-xs font-medium cursor-pointer flex justify-between items-center"
                           >
                             <span>{params[inp.key] ? 'Enabled' : 'Disabled'}</span>
                             <div className={`w-8 h-4 rounded-full p-0.5 transition-colors ${params[inp.key] ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-700'}`}>
                                <div className={`w-3 h-3 bg-white rounded-full shadow-sm transform transition-transform ${params[inp.key] ? 'translate-x-4' : 'translate-x-0'}`} />
                             </div>
                           </button>
                         )}

                         {kind === 'select' && (
                           <select
                             value={params[inp.key]}
                             onChange={e => setParams({...params, [inp.key]: e.target.value})}
                             className="w-full p-2 border border-[var(--line)] rounded-lg bg-[var(--panel)] text-[var(--text)] text-xs font-medium"
                           >
                             {inp.options?.map((opt: any) => (
                               <option key={opt.value} value={opt.value}>{opt.label}</option>
                             ))}
                           </select>
                         )}
                         
                         {kind === 'dateRange' && (
                           <div className="grid grid-cols-2 gap-2">
                             <input 
                               type="date"
                               value={params[inp.key]?.start || ''}
                               onChange={e => setParams({...params, [inp.key]: { ...params[inp.key], start: e.target.value }})}
                               className="w-full p-1.5 border border-[var(--line)] rounded-md bg-[var(--panel)] text-[var(--text)] text-[10px]"
                             />
                             <input 
                               type="date"
                               value={params[inp.key]?.end || ''}
                               onChange={e => setParams({...params, [inp.key]: { ...params[inp.key], end: e.target.value }})}
                               className="w-full p-1.5 border border-[var(--line)] rounded-md bg-[var(--panel)] text-[var(--text)] text-[10px]"
                             />
                           </div>
                         )}

                         {kind === 'account' && (
                           <select
                             value={params[inp.key] || ''}
                             onChange={e => setParams({...params, [inp.key]: e.target.value})}
                             className="w-full p-2 border border-[var(--line)] rounded-lg bg-[var(--panel)] text-[var(--text)] text-xs font-medium"
                           >
                             <option value="">All Accounts</option>
                             {accounts.map((acc: any) => (
                               <option key={acc.id} value={acc.id}>
                                 {acc.code ? `${acc.code} - ` : ''}{acc.name} ({acc.type})
                               </option>
                             ))}
                           </select>
                         )}
                      </div>
                    );
                 })}
                 
                 <div className="p-4 bg-[var(--ink)] rounded-xl border border-[var(--line)]">
                    <span className="text-[9px] uppercase tracking-wider font-black text-[var(--muted)] block mb-2">Ingestion Status</span>
                    <div className="space-y-1 font-mono text-[10px] font-bold text-[var(--text)] dark:text-white">
                       <div className="flex justify-between"><span>Transactions:</span> <span className="text-emerald-500">{transactions.length}</span></div>
                       <div className="flex justify-between"><span>Active Accounts:</span> <span className="text-emerald-500">{accounts.length}</span></div>
                    </div>
                 </div>
              </div>
           </div>

           {/* Metrics & Visualization Workspace */}
           <div className="flex-1 overflow-y-auto custom-scrollbar bg-[#fafafa] dark:bg-[#161718] p-4 md:p-8 space-y-8">
               {/* Metrics Row */}
               <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {results.metrics.map((m: any, idx: number) => (
                     <div key={idx} className="p-6 bg-[var(--surface)] dark:bg-[#1b1c1d] border border-[var(--line)] rounded-[32px] shadow-sm">
                        <span className="text-[10px] font-medium uppercase tracking-wider text-[var(--muted)] block mb-1">{m.label}</span>
                        <h4 className="text-3xl font-black text-[var(--text)] dark:text-white tracking-tighter italic">
                           {m.value}
                        </h4>
                        {m.trend && <p className="text-[10px] uppercase font-bold text-emerald-500 tracking-wider mt-2">{m.trend}</p>}
                     </div>
                  ))}
               </div>

               {/* Engine Output Chart */}
               {results.charts.map((c: any, idx: number) => (
                  <div key={idx} className="p-6 bg-[var(--surface)] dark:bg-[#1b1c1d] border border-[var(--line)] rounded-[32px] shadow-sm h-96 flex flex-col">
                     <div className="flex justify-between items-center mb-6">
                         <h3 className="text-sm font-black uppercase tracking-wider text-[var(--text)] dark:text-white flex items-center gap-2">
                            <BarChart3 size={16} /> Operational Topology Projection
                         </h3>
                     </div>
                     <div className="flex-1 min-h-0">
                        <ResponsiveContainer width="100%" height="100%">
                           <ComposedChart data={c.data} margin={{ top: 10, right: 10, left: 10, bottom: 10 }}>
                              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e5e5" />
                              <XAxis dataKey={c.config.xKey} fontSize={10} tickLine={false} tickMargin={10} />
                              <YAxis fontSize={10} tickLine={false} />
                              <Tooltip contentStyle={{ background: '#111', color: '#fff', borderRadius: '8px', border: 'none' }} />
                              <Legend iconType="circle" wrapperStyle={{ fontSize: '10px', textTransform: 'uppercase', fontWeight: 900 }} />
                              {c.config.yKeys.map((y: any) => y.type === 'bar' ? (
                                 <Bar key={y.key} dataKey={y.key} fill={y.color} name={y.name} radius={[4, 4, 0, 0]} />
                              ) : (
                                 <Line key={y.key} type="monotone" dataKey={y.key} stroke={y.color} strokeWidth={3} name={y.name} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                              ))}
                           </ComposedChart>
                        </ResponsiveContainer>
                     </div>
                  </div>
               ))}

               {/* Insights Engine */}
               <div className="p-6 bg-indigo-50 dark:bg-indigo-950/20 border border-indigo-100 dark:border-indigo-900 rounded-[32px] space-y-4">
                  <h3 className="text-xs font-black uppercase tracking-wider text-indigo-800 dark:text-indigo-400">Algorithmic Consensus Output</h3>
                  <div className="space-y-2">
                     {results.insights.map((ins: string, i: number) => (
                        <div key={i} className="flex gap-3 text-sm text-indigo-900 dark:text-indigo-200">
                           <CheckCircle2 size={16} className="text-indigo-500 shrink-0 mt-0.5" />
                           <p className="leading-relaxed font-medium">{ins}</p>
                        </div>
                     ))}
                  </div>
               </div>

               {/* Drill-down Results Table (if tool outputs rows) */}
               {results.rows && results.rows.length > 0 && (
                 <div className="p-6 bg-slate-900 border border-white/10 rounded-[32px] space-y-4">
                   <div className="flex flex-wrap items-center justify-between gap-3">
                     <div className="flex items-center gap-2">
                       <ListFilter size={16} className="text-[var(--brass)]" />
                       <h3 className="text-xs font-black uppercase tracking-wider text-[var(--brass)]">
                         Report Output & Details ({results.rows.length} Items)
                       </h3>
                     </div>
                     <div className="flex items-center gap-2">
                       <button
                         type="button"
                         onClick={handleExportCSV}
                         className="px-2.5 py-1.5 bg-white/10 hover:bg-white/20 text-slate-200 text-xs font-semibold rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer"
                         title="Download as CSV"
                        aria-label="Download as CSV">
                         <Download size={13} />
                         <span>CSV</span>
                       </button>
                       <button
                         type="button"
                         onClick={handleExportXLSX}
                         className="px-2.5 py-1.5 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-400 border border-emerald-500/30 text-xs font-semibold rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer"
                         title="Download as Excel (.xlsx)"
                        aria-label="Download as Excel (.xlsx)">
                         <FileSpreadsheet size={13} />
                         <span>Excel</span>
                       </button>
                       {results.sourceTransactionIds && results.sourceTransactionIds.length > 0 && (
                         <button
                           type="button"
                           onClick={() => {
                             onClose();
                             setActiveTab('transactions');
                           }}
                           className="text-xs font-bold text-[var(--brass)] hover:underline flex items-center gap-1 cursor-pointer ml-2"
                         >
                           View in Ledger Grid <ArrowUpRight size={14} />
                         </button>
                       )}
                     </div>
                   </div>

                   <div className="overflow-x-auto">
                     <table className="w-full text-left text-xs text-slate-300">
                       <thead className="border-b border-white/10 text-[10px] uppercase font-bold text-[var(--muted)]">
                         <tr>
                           {tableColumns.map(col => (
                             <th key={col.key} className="py-2.5 px-3 whitespace-nowrap">
                               {col.label}
                             </th>
                           ))}
                         </tr>
                       </thead>
                       <tbody className="divide-y divide-white/5 font-mono">
                         {results.rows.map((row: any, idx: number) => (
                           <tr key={row.id || idx} className="hover:bg-white/5 transition-colors">
                             {tableColumns.map(col => {
                               const val = row[col.key];
                               const isFlagType = col.key === 'type';
                               const isAmountOrVariance = ['amount', 'grossSales', 'taxableSales', 'taxCollected', 'taxDue', 'budget', 'actual', 'variance', 'balance', 'debit', 'credit', 'gross', 'net', 'taxes', 'employerBurden', 'liability'].includes(col.key);
                               
                               return (
                                 <td 
                                   key={col.key} 
                                   className={"py-2.5 px-3 whitespace-nowrap " + (isAmountOrVariance ? "font-bold text-white" : "")}
                                 >
                                   {isFlagType ? (
                                     <span className={val === 'Exact' ? 'text-rose-400 font-bold' : 'text-amber-400 font-medium'}>
                                       {val || 'Flagged'}
                                     </span>
                                   ) : (
                                     val !== undefined && val !== null ? String(val) : '-'
                                   )}
                                 </td>
                               );
                             })}
                           </tr>
                         ))}
                       </tbody>
                     </table>
                   </div>
                 </div>
               )}
           </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
